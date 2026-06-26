import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnvLocal } from "../scripts/_env";

loadEnvLocal();

import { closeDb, withProgram, withoutProgram } from "../lib/db";
import {
  handleStripeEvent,
  signPayload,
  verifyEvent,
  type StripeEvent,
} from "../lib/payments";
import { POST } from "../app/api/webhooks/stripe/route";

const HAS_DB = Boolean(process.env.APP_RW_DATABASE_URL);
const HAS_WH = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
const ENABLED = HAS_DB && HAS_WH;
const RUN = `RT${randomBytes(3).toString("hex")}`;
const T = 15000; // live DB round-trips; generous per-test timeout

let summerId = "";
let fallId = "";
let familyId = "";
let enrA = ""; // succeeded / idempotency enrollment
let enrB = ""; // out-of-order enrollment

function meta(enrollmentId: string): Record<string, string> {
  return { program_id: summerId, family_id: familyId, enrollment_id: enrollmentId };
}

function piEvent(
  type: string,
  eventId: string,
  intentId: string,
  metadata: Record<string, string>,
  amountCents = 72500,
): StripeEvent {
  return {
    id: eventId,
    type,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: intentId,
        object: "payment_intent",
        amount: amountCents,
        status: type.endsWith("succeeded") ? "succeeded" : "requires_payment_method",
        metadata,
      },
    },
  };
}

function chargeRefundEvent(
  eventId: string,
  intentId: string,
  metadata: Record<string, string>,
  amountCents = 72500,
): StripeEvent {
  return {
    id: eventId,
    type: "charge.refunded",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        object: "charge",
        payment_intent: intentId,
        amount: amountCents,
        metadata,
      },
    },
  };
}

function deliverDirect(ev: StripeEvent) {
  const raw = JSON.stringify(ev);
  return handleStripeEvent(raw, signPayload(raw));
}

async function deliverViaRoute(
  ev: StripeEvent,
  sigOverride?: string,
  bodyOverride?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const raw = JSON.stringify(ev);
  const sig = sigOverride ?? signPayload(raw);
  const req = new Request("http://local/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": sig, "content-type": "application/json" },
    body: bodyOverride ?? raw,
  });
  const res = await POST(req);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe("Stripe payment propagation (live Stripe TEST sig + live Supabase)", () => {
  beforeAll(async () => {
    if (!ENABLED) return;
    const programs = await withoutProgram(
      (sql) => sql<{ id: string; key: string }[]>`select id, key from programs`,
    );
    summerId = programs.find((p) => p.key === "summer_camp")!.id;
    fallId = programs.find((p) => p.key === "fall_enrollment")!.id;

    familyId = await withoutProgram(async (sql) => {
      const [f] = await sql<{ id: string }[]>`
        insert into families (email, first_name, last_name, match_key)
        values (${`${RUN}@gtfamilies.test`}, 'PaymentsTest', ${RUN}, ${`Rtest:${RUN}`})
        returning id`;
      return f.id;
    });
    [enrA, enrB] = await withProgram(summerId, async (sql) => {
      const mk = async (deal: string) => {
        const [e] = await sql<{ id: string }[]>`
          insert into enrollments (program_id, family_id, hubspot_deal_id, stage, amount, paid)
          values (${summerId}, ${familyId}, ${deal}, 'registered', 725, false)
          returning id`;
        return e.id;
      };
      return [await mk(`deal-${RUN}-A`), await mk(`deal-${RUN}-B`)];
    });
  }, T);

  afterAll(async () => {
    if (!ENABLED) return;
    await withProgram(summerId, async (sql) => {
      await sql`delete from payments where stripe_payment_intent_id like ${`pi_${RUN}%`}`;
      await sql`delete from enrollments where id in ${sql([enrA, enrB])}`;
    });
    await withoutProgram(async (sql) => {
      await sql`delete from sync_outbox where dedupe_key like ${`stripe:evt_${RUN}%`}`;
      await sql`delete from processed_events where source = 'stripe' and event_id like ${`evt_${RUN}%`}`;
      await sql`delete from families where id = ${familyId}`;
    });
    await closeDb();
  }, T);

  it("#2 propagates a succeeded PI into the CORRECT program; flips paid; enqueues outbox", async () => {
    if (!ENABLED) {
      console.log("SKIP #2: APP_RW_DATABASE_URL / STRIPE_WEBHOOK_SECRET not set");
      return;
    }
    const intent = `pi_${RUN}_camp`;
    const evId = `evt_${RUN}_camp`;
    const { status, body } = await deliverViaRoute(
      piEvent("payment_intent.succeeded", evId, intent, meta(enrA)),
    );
    expect(status).toBe(200);
    expect(body.status).toBe("processed");
    expect(body.applied).toBe(true);
    expect(body.paid_flipped).toBe(true);
    expect(body.outbox_enqueued).toBe(true);

    // visible UNDER summer
    const sView = await withProgram(summerId, (sql) =>
      sql<{ status: string; amount: string; program_id: string }[]>`
        select status, amount, program_id from payments where stripe_payment_intent_id = ${intent}`,
    );
    expect(sView.length).toBe(1);
    expect(sView[0].status).toBe("succeeded");
    expect(sView[0].program_id).toBe(summerId);

    // NOT visible under fall (RLS isolation)
    const fView = await withProgram(fallId, (sql) =>
      sql<{ c: number }[]>`select count(*)::int as c from payments where stripe_payment_intent_id = ${intent}`,
    );
    expect(fView[0].c).toBe(0);

    // enrollment.paid flipped true
    const enr = await withProgram(summerId, (sql) =>
      sql<{ paid: boolean }[]>`select paid from enrollments where id = ${enrA}`,
    );
    expect(enr[0].paid).toBe(true);

    // outbox row enqueued for the deal PATCH
    const ob = await withoutProgram((sql) =>
      sql<{ op: string; target_system: string }[]>`
        select op, target_system from sync_outbox where dedupe_key = ${`stripe:${evId}`}`,
    );
    expect(ob.length).toBe(1);
    expect(ob[0].op).toBe("patch_deal");
    expect(ob[0].target_system).toBe("hubspot");
  }, T);

  it("#3 is idempotent on replay of the SAME signed event", async () => {
    if (!ENABLED) {
      console.log("SKIP #3");
      return;
    }
    const intent = `pi_${RUN}_idem`;
    const evId = `evt_${RUN}_idem`;
    const ev = piEvent("payment_intent.succeeded", evId, intent, meta(enrA));

    const first = await deliverDirect(ev);
    expect(first.status).toBe("processed");
    const second = await deliverDirect(ev); // exact replay
    expect(second.status).toBe("duplicate");

    const pay = await withProgram(summerId, (sql) =>
      sql<{ c: number }[]>`select count(*)::int as c from payments where stripe_payment_intent_id = ${intent}`,
    );
    expect(pay[0].c).toBe(1); // exactly ONE payments row

    const pe = await withoutProgram((sql) =>
      sql<{ c: number }[]>`select count(*)::int as c from processed_events where source='stripe' and event_id = ${evId}`,
    );
    expect(pe[0].c).toBe(1); // exactly ONE processed_events row

    const ob = await withoutProgram((sql) =>
      sql<{ c: number }[]>`select count(*)::int as c from sync_outbox where dedupe_key = ${`stripe:${evId}`}`,
    );
    expect(ob[0].c).toBe(1); // no duplicate outbox
  }, T);

  it("#4 out-of-order: refund (rank 3) then late succeeded (rank 2) — terminal state holds", async () => {
    if (!ENABLED) {
      console.log("SKIP #4");
      return;
    }
    const intent = `pi_${RUN}_reorder`;
    const refund = await deliverDirect(
      chargeRefundEvent(`evt_${RUN}_refund`, intent, meta(enrB)),
    );
    expect(refund.status).toBe("processed");
    expect(refund.payment_status).toBe("refunded");
    expect(refund.applied).toBe(true);

    const late = await deliverDirect(
      piEvent("payment_intent.succeeded", `evt_${RUN}_resucc`, intent, meta(enrB)),
    );
    expect(late.status).toBe("processed");
    expect(late.payment_status).toBe("succeeded");
    expect(late.applied).toBe(false); // monotonic guard blocked the regression

    const final = await withProgram(summerId, (sql) =>
      sql<{ status: string; status_rank: number }[]>`
        select status, status_rank from payments where stripe_payment_intent_id = ${intent}`,
    );
    expect(final.length).toBe(1);
    expect(final[0].status).toBe("refunded");
    expect(final[0].status_rank).toBe(3);
  }, T);

  it("#5 cross-program write is denied by RLS (WITH CHECK)", async () => {
    if (!ENABLED) {
      console.log("SKIP #5");
      return;
    }
    // Scoped to FALL, attempt to write a payment tagged for SUMMER → WITH CHECK fails.
    await expect(
      withProgram(fallId, async (sql) => {
        await sql`
          insert into payments (program_id, family_id, enrollment_id, stripe_payment_intent_id, amount, status, status_rank)
          values (${summerId}, null, null, ${`pi_${RUN}_xprog`}, 725, 'succeeded', 2)`;
      }),
    ).rejects.toThrow(/row-level security/i);

    // And it left no row behind (visible from neither scope).
    const leaked = await withoutProgram((sql) =>
      sql<{ c: number }[]>`select count(*)::int as c from payments where stripe_payment_intent_id = ${`pi_${RUN}_xprog`}`,
    );
    expect(leaked[0].c).toBe(0);
  }, T);

  it("#6 rejects a tampered body / bad signature", async () => {
    if (!ENABLED) {
      console.log("SKIP #6");
      return;
    }
    const ev = piEvent("payment_intent.succeeded", `evt_${RUN}_badsig`, `pi_${RUN}_badsig`, meta(enrA));
    const raw = JSON.stringify(ev);
    const goodSig = signPayload(raw);
    const tampered = raw.replace(`pi_${RUN}_badsig`, `pi_${RUN}_HACKED`);

    // verifyEvent rejects a body that no longer matches the signature
    expect(() => verifyEvent(tampered, goodSig)).toThrow(/signature mismatch/);
    // and a malformed signature header
    expect(() => verifyEvent(raw, "not-a-signature")).toThrow(/missing signature parts/);

    // the route returns 400 (Stripe will not retry) on a tampered body
    const res = await deliverViaRoute(ev, goodSig, tampered);
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  }, T);
});
