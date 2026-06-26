import crypto from "node:crypto";
import { withProgram, type ScopedSql } from "./db";

/**
 * payments.ts — Stripe payment propagation for the GT Marketing Hub.
 *
 * Zero-dependency Stripe client (form-encoded REST + HMAC webhook verify — NO
 * `stripe` npm package) ported ~verbatim from scripts/lib/stripe.mjs, plus the
 * webhook handler adapted to the hub backbone schema (0001_backbone.sql):
 *
 *   verify (Stripe-Signature t/v1, timing-safe, 300s tolerance)
 *     -> claim processed_events(source='stripe', event_id)  [ON CONFLICT DO NOTHING]
 *     -> withProgram(metadata.program_id):  upsert payments on stripe_payment_intent_id
 *        with a MONOTONIC status_rank guard (a terminal state never regresses),
 *        flip enrollments.paid on succeeded, enqueue a sync_outbox HubSpot deal PATCH
 *     -> record the result on processed_events.
 *
 * Idempotency is layered: processed_events (event-level) + payments.stripe_payment_intent_id
 * UNIQUE (business-fact level) + the status_rank guard (ordering-level). The whole
 * thing runs in ONE program-scoped transaction, so a mid-flight failure rolls back
 * the event claim and a redelivery can reprocess.
 */

/* --------------------------------- env --------------------------------- */

function secretKey(): string {
  const s = process.env.STRIPE_SECRET_KEY;
  if (!s) throw new Error("STRIPE_SECRET_KEY is not set");
  return s;
}
function webhookSecret(): string {
  const s = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return s;
}

const STRIPE_BASE = "https://api.stripe.com";

/* ------------------------------- Stripe client ------------------------------- */

// Flatten a nested object into Stripe's bracketed form encoding (metadata[program_id]=…).
function formEncode(
  obj: Record<string, unknown>,
  prefix = "",
  acc: string[] = [],
): string[] {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object" && !Array.isArray(v)) {
      formEncode(v as Record<string, unknown>, key, acc);
    } else {
      acc.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return acc;
}

async function stripe(
  path: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(STRIPE_BASE + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formEncode(params).join("&"),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = (json.error ?? {}) as { message?: string };
    throw new Error(`Stripe ${path} ${res.status}: ${err.message ?? ""}`);
  }
  return json;
}

/**
 * Create + confirm a PaymentIntent server-side (no browser) with a test card.
 * `metadata` is what drives propagation — stamp program_id (uuid), family_id,
 * enrollment_id so the webhook routes into the correct program scope.
 */
export function createPaymentIntent(opts: {
  amount_cents: number;
  metadata: Record<string, string>;
  decline?: boolean;
}): Promise<Record<string, unknown>> {
  return stripe("/v1/payment_intents", {
    amount: opts.amount_cents,
    currency: "usd",
    confirm: "true",
    payment_method: opts.decline ? "pm_card_visa_chargeDeclined" : "pm_card_visa",
    automatic_payment_methods: { enabled: "true", allow_redirects: "never" },
    description: `GT ${opts.metadata.program ?? "payment"} — ${opts.metadata.enrollment_id ?? ""}`,
    metadata: opts.metadata,
  });
}

/* ----------------------------- webhook signatures ----------------------------- */

/** Verify the Stripe-Signature header (t=…,v1=…) against the raw request body. Throws on mismatch. */
export function verifyEvent(
  rawBody: string,
  sigHeader: string | null | undefined,
  tolerance = 300,
): StripeEvent {
  const parts = Object.fromEntries(
    (sigHeader || "").split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i), p.slice(i + 1)];
    }),
  ) as Record<string, string>;
  if (!parts.t || !parts.v1) throw new Error("missing signature parts");
  const expected = crypto
    .createHmac("sha256", webhookSecret())
    .update(`${parts.t}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("signature mismatch");
  }
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(parts.t)) > tolerance) {
    throw new Error("timestamp outside tolerance");
  }
  return JSON.parse(rawBody) as StripeEvent;
}

/** Sign a synthetic payload — used by the dev driver/tests to exercise the handler without Stripe CLI. */
export function signPayload(rawBody: string, t?: number): string {
  const ts = t || Math.floor(Date.now() / 1000);
  const sig = crypto
    .createHmac("sha256", webhookSecret())
    .update(`${ts}.${rawBody}`)
    .digest("hex");
  return `t=${ts},v1=${sig}`;
}

/* ------------------------------ event handling ------------------------------ */

export interface StripeEvent {
  id: string;
  type: string;
  created?: number;
  data: { object: StripeObject };
}
interface StripeObject {
  id?: string;
  object?: string;
  payment_intent?: string;
  amount?: number;
  amount_received?: number;
  metadata?: Record<string, string>;
  status?: string;
}

/** Monotonic guard ranks: a higher rank is a more terminal state and can never regress. */
export const STATUS_RANK = {
  requires_payment: 0,
  failed: 1,
  succeeded: 2,
  refunded: 3,
} as const;
export type PaymentStatus = keyof typeof STATUS_RANK;

/** Map a Stripe event type to a payment status, or null for events we ignore. */
export function statusForEvent(type: string): PaymentStatus | null {
  switch (type) {
    case "payment_intent.succeeded":
      return "succeeded";
    case "payment_intent.payment_failed":
      return "failed";
    case "payment_intent.created":
    case "payment_intent.processing":
    case "payment_intent.requires_action":
      return "requires_payment";
    case "charge.refunded":
    case "payment_intent.refunded": // synthetic convenience for the out-of-order proof
      return "refunded";
    default:
      return null;
  }
}

export interface HandleResult {
  status: "ignored" | "duplicate" | "processed";
  type: string;
  event_id?: string;
  intent_id?: string | null;
  program_id?: string | null;
  payment_status?: PaymentStatus;
  applied?: boolean; // did the upsert actually insert/update (false ⇒ monotonic guard blocked it)
  paid_flipped?: boolean;
  outbox_enqueued?: boolean;
  note?: string;
}

/**
 * Verify, dedupe, and propagate a Stripe webhook event into the program-scoped
 * backbone. Throws on bad signature (caller returns 400). Returns a structured
 * result otherwise. `succeeded` and `payment_failed` (non-terminal) are both handled.
 */
export async function handleStripeEvent(
  rawBody: string,
  sigHeader: string | null | undefined,
): Promise<HandleResult> {
  const event = verifyEvent(rawBody, sigHeader); // throws on bad sig → 400 at the route
  const type = event.type;

  const status = statusForEvent(type);
  if (!status) {
    return { status: "ignored", type, event_id: event.id, note: `unhandled ${type}` };
  }

  const obj = event.data?.object ?? {};
  const intentId =
    typeof obj.id === "string" && obj.id.startsWith("pi_")
      ? obj.id
      : obj.payment_intent ?? null;
  const metadata = obj.metadata ?? {};
  const programId = metadata.program_id ?? null;
  const familyId = metadata.family_id ?? null;
  const enrollmentId = metadata.enrollment_id ?? null;
  const amountCents = Number(obj.amount_received ?? obj.amount ?? 0);
  const amount = amountCents / 100;
  const occurredAt = event.created ? new Date(event.created * 1000) : new Date();

  if (!intentId) throw new Error("event has no payment_intent id");
  if (!programId) throw new Error("event metadata is missing program_id (cannot scope to a program)");

  const rank = STATUS_RANK[status];

  return withProgram(programId, async (sql: ScopedSql) => {
    // 1) idempotency: claim this event exactly once. (processed_events is global; the
    //    program GUC does not gate it. 0 rows ⇒ already processed ⇒ no-op.)
    const claimed = await sql<{ event_id: string }[]>`
      insert into processed_events (source, event_id)
      values ('stripe', ${event.id})
      on conflict (source, event_id) do nothing
      returning event_id`;
    if (claimed.length === 0) {
      return {
        status: "duplicate" as const,
        type,
        event_id: event.id,
        intent_id: intentId,
        program_id: programId,
        payment_status: status,
      };
    }

    // 2) upsert the payment with the MONOTONIC status_rank guard. On conflict the
    //    UPDATE only fires when the incoming rank is strictly higher, so a terminal
    //    state (refunded) can never be regressed by a late `succeeded`.
    const upserted = await sql<{ id: string; status: string; status_rank: number }[]>`
      insert into payments
        (program_id, family_id, enrollment_id, stripe_payment_intent_id,
         stripe_event_id, amount, status, status_rank, occurred_at)
      values
        (${programId}, ${familyId}, ${enrollmentId}, ${intentId},
         ${event.id}, ${amount}, ${status}, ${rank}, ${occurredAt})
      on conflict (stripe_payment_intent_id) do update
        set status        = excluded.status,
            status_rank   = excluded.status_rank,
            stripe_event_id = excluded.stripe_event_id,
            amount        = excluded.amount,
            occurred_at   = excluded.occurred_at
        where excluded.status_rank > payments.status_rank
      returning id, status, status_rank`;
    const applied = upserted.length > 0;

    // 3) reflect terminal money state onto the enrollment (only when the write applied).
    let paidFlipped = false;
    if (applied && enrollmentId) {
      if (status === "succeeded") {
        await sql`update enrollments set paid = true, stage = 'paid' where id = ${enrollmentId}`;
        paidFlipped = true;
      } else if (status === "refunded") {
        await sql`update enrollments set paid = false where id = ${enrollmentId}`;
        paidFlipped = true;
      }
    }

    // 4) enqueue the durable HubSpot deal PATCH (transactional outbox). Only on an
    //    applied `succeeded`, and only if the enrollment carries a deal id. dedupe_key
    //    is unique per event, so redeliveries never double-enqueue.
    let outboxEnqueued = false;
    if (applied && status === "succeeded" && enrollmentId) {
      const [enr] = await sql<{ hubspot_deal_id: string | null }[]>`
        select hubspot_deal_id from enrollments where id = ${enrollmentId}`;
      if (enr?.hubspot_deal_id) {
        const payload = {
          deal_id: enr.hubspot_deal_id,
          properties: { dealstage: "closedwon" },
          reason: "stripe_payment_succeeded",
          intent: intentId,
        };
        const enq = await sql<{ id: string }[]>`
          insert into sync_outbox
            (aggregate_type, aggregate_id, target_system, op, payload, dedupe_key)
          values
            ('enrollment', ${enrollmentId}, 'hubspot', 'patch_deal',
             ${sql.json(payload)}, ${`stripe:${event.id}`})
          on conflict (dedupe_key) do nothing
          returning id`;
        outboxEnqueued = enq.length > 0;
      }
    }

    const result: HandleResult = {
      status: "processed",
      type,
      event_id: event.id,
      intent_id: intentId,
      program_id: programId,
      payment_status: status,
      applied,
      paid_flipped: paidFlipped,
      outbox_enqueued: outboxEnqueued,
    };

    // 5) record the outcome on the idempotency ledger. (JSON round-trip → plain
    //    JSON value the postgres `json` helper accepts, and drops any undefined.)
    const ledger = JSON.parse(JSON.stringify(result));
    await sql`update processed_events set result = ${sql.json(ledger)}
              where source = 'stripe' and event_id = ${event.id}`;

    return result;
  });
}
