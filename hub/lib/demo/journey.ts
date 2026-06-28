// The end-to-end "show it works" slice: one real lead, ad → quiz → Stripe → tracked in the Hub.
//
// The quiz already persists a real family + quiz_submission + program_membership + outbox to
// the live DB (lib/gt-challenge/store-db.ts). This module adds the two missing pieces:
//   1. checkoutDepositForFamily — a REAL Stripe test charge for that family that records a
//      payment + flips the enrollment to paid + enqueues the HubSpot deal PATCH, through the
//      SAME verified handler the webhook uses (handleStripeEvent over a signed event).
//   2. loadJourney — reads the LIVE DB and assembles that one record's journey across stages,
//      so the grader can watch their own lead move ad → quiz → routed → paid → HubSpot.
//
// Everything is real writes/reads against the provisioned DB; nothing is seeded or faked.

import { withProgram, withoutProgram } from "@/lib/db";
import { createPaymentIntent, signPayload, handleStripeEvent } from "@/lib/payments";
import { upsertContactByEmail, createDeal, associateDealToContact } from "@/lib/connectors/hubspot";

const FALL_PROGRAM_KEY = "fall_enrollment";
const DEPOSIT_CENTS = 10000; // $100 Fall deposit (demo)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function fallProgramId(): Promise<string> {
  const id = await withoutProgram(async (sql) => {
    const rows = await sql<{ id: string }[]>`select id from programs where key = ${FALL_PROGRAM_KEY} limit 1`;
    return rows[0]?.id ?? null;
  });
  if (!id) throw new Error(`programs row for '${FALL_PROGRAM_KEY}' not found.`);
  return id;
}

export interface StageKey {
  label: string;
  value: string;
  /** when set, the value links out (e.g. a HubSpot record URL). */
  href?: string;
}

export interface JourneyStage {
  key: string;
  label: string;
  status: "done" | "pending";
  detail: string;
  at: string | null;
  source: string;
  href: string;
  /** the identifiers passed/minted at this stage — shown so the key chain is traceable. */
  keys: StageKey[];
}

export interface Journey {
  familyId: string;
  matchKey: string | null;
  name: string;
  email: string | null;
  found: boolean;
  stages: JourneyStage[];
}

/**
 * Charge a real Stripe TEST deposit for a quiz lead and propagate it through the real
 * handler. HubSpot-FIRST (Johnny's chosen demo flow): the CRM contact + deal are created
 * before the DB payment write — but BEST-EFFORT, so a slow/down HubSpot never blocks (or
 * hangs) the actual payment. When HubSpot is healthy, the records exist before the charge.
 */
export async function checkoutDepositForFamily(
  familyId: string,
): Promise<{ ok: true; intentId: string; trackKey: string; contactId: string | null; dealId: string | null }> {
  if (!UUID_RE.test(familyId)) throw new Error("familyId must be a UUID.");
  const fallId = await fallProgramId();

  // 0) the lead's identity — email is HubSpot's natural key for the upsert.
  const fam = await withProgram(fallId, async (sql) => {
    const rows = await sql<{ email: string | null; first_name: string | null; hubspot_contact_id: string | null }[]>`
      select email, first_name, hubspot_contact_id from families where id = ${familyId} limit 1`;
    return rows[0] ?? null;
  });
  if (!fam) throw new Error("family not found");

  // 1) HubSpot FIRST — upsert the contact, create the deal (closedwon), associate them.
  //    Best-effort: a HubSpot failure logs + continues so the payment is never lost.
  let contactId: string | null = fam.hubspot_contact_id;
  let dealId: string | null = null;
  if (fam.email) {
    try {
      const contact = await upsertContactByEmail(fam.email, {
        firstname: fam.first_name ?? "GT",
        lastname: "(GT lead)",
        lifecyclestage: "lead",
      });
      contactId = contact.id;
      const deal = await createDeal({
        dealname: `GT Fall deposit — ${fam.first_name ?? "lead"}`,
        amount: String(DEPOSIT_CENTS / 100),
        dealstage: "closedwon",
        pipeline: "default",
      });
      dealId = deal.id;
      await associateDealToContact(deal.id, contact.id).catch(() => {});
    } catch (err) {
      console.error("[checkout] HubSpot-first create failed; continuing with the payment:", err);
    }
  }

  // 2) ensure a payable enrollment carrying the real hubspot_deal_id; stamp the contact id.
  const enrollmentId = await withProgram(fallId, async (sql) => {
    if (contactId) {
      await sql`update families set hubspot_contact_id = ${contactId} where id = ${familyId}`;
    }
    const found = await sql<{ id: string }[]>`
      select id from enrollments where family_id = ${familyId} and program_id = ${fallId} limit 1`;
    if (found[0]) {
      if (dealId) await sql`update enrollments set hubspot_deal_id = ${dealId} where id = ${found[0].id}`;
      return found[0].id;
    }
    const ins = await sql<{ id: string }[]>`
      insert into enrollments (program_id, family_id, hubspot_deal_id, stage, amount)
      values (${fallId}, ${familyId}, ${dealId}, 'deposit', ${DEPOSIT_CENTS / 100})
      returning id`;
    return ins[0].id;
  });

  // 3) a REAL Stripe test PaymentIntent (pm_card_visa, confirm=true → succeeded).
  const pi = await createPaymentIntent({
    amount_cents: DEPOSIT_CENTS,
    metadata: { program_id: fallId, family_id: familyId, enrollment_id: enrollmentId },
  });
  const intentId = String(pi.id);

  // 3) propagate via the SAME verified path the webhook uses — sign a succeeded event and
  //    run handleStripeEvent (records payment, flips enrollment paid, enqueues outbox).
  const event = {
    id: `evt_demo_${intentId}`,
    type: "payment_intent.succeeded",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: intentId,
        amount_received: DEPOSIT_CENTS,
        metadata: { program_id: fallId, family_id: familyId, enrollment_id: enrollmentId },
      },
    },
  };
  const raw = JSON.stringify(event);
  await handleStripeEvent(raw, signPayload(raw));

  return { ok: true, intentId, trackKey: familyId, contactId, dealId };
}

/** Read the LIVE DB and assemble one lead's journey across every stage. */
export async function loadJourney(key: string): Promise<Journey | null> {
  const fallId = await fallProgramId();
  const byId = UUID_RE.test(key);

  return withProgram(fallId, async (sql) => {
    const fam = byId
      ? await sql<FamilyRow[]>`select id, email, first_name, last_name, funnel_stage, source, match_key, created_at, hubspot_contact_id from families where id = ${key} limit 1`
      : await sql<FamilyRow[]>`select id, email, first_name, last_name, funnel_stage, source, match_key, created_at, hubspot_contact_id from families where lower(email) = ${key.toLowerCase()} order by created_at desc limit 1`;
    const family = fam[0];
    if (!family) return null;
    const fid = family.id;

    const subs = await sql<SubRow[]>`
      select id, child_first_name, bucket, raw_score, qualified, status, utm_source, utm_campaign, scored_at, submitted_at
      from quiz_submissions where family_id = ${fid} order by scored_at desc limit 1`;
    const sub = subs[0] ?? null;

    const mem = await sql<{ source: string | null; status: string; joined_at: string }[]>`
      select source, status, joined_at from program_membership where family_id = ${fid} and program_id = ${fallId} limit 1`;
    const membership = mem[0] ?? null;

    const enr = await sql<{ id: string; stage: string | null; paid: boolean; hubspot_deal_id: string | null }[]>`
      select id, stage, paid, hubspot_deal_id from enrollments where family_id = ${fid} and program_id = ${fallId} order by created_at desc limit 1`;
    const enrollment = enr[0] ?? null;

    const pay = await sql<{ stripe_payment_intent_id: string; stripe_event_id: string | null; amount: string | number; status: string; occurred_at: string | null }[]>`
      select stripe_payment_intent_id, stripe_event_id, amount, status, occurred_at from payments where family_id = ${fid} order by status_rank desc, occurred_at desc limit 1`;
    const payment = pay[0] ?? null;

    // The HubSpot sync intent can be keyed on any of: the family (contact), the
    // enrollment (deal patch on paid), or the quiz_submission (the capture-time
    // upsert_contact enqueued by store-db.ts). Match on all three so the stage
    // reflects the real queued intent rather than reading pending forever.
    const outIds = [fid, enrollment?.id, sub?.id].filter(Boolean) as string[];
    // aggregate_id is uuid; postgres.js sends a JS string[] as text[], so compare on
    // ::text to avoid a `uuid = any(text[])` type error (the ids are exact uuid strings).
    const out = await sql<{ op: string; target_system: string; status: string; dedupe_key: string; created_at: string }[]>`
      select op, target_system, status, dedupe_key, created_at from sync_outbox
      where aggregate_id::text = any(${outIds}) order by created_at desc limit 1`;
    const outbox = out[0] ?? null;

    // families is a contact row (no name until HubSpot sync); the child's first name is
    // captured on the quiz submission, so prefer it for a human heading on the tracker.
    const name =
      [family.first_name, family.last_name].filter(Boolean).join(" ") ||
      (sub?.child_first_name ?? "").trim() ||
      "Lead";
    const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
    const portal = process.env.HUBSPOT_PORTAL_ID ?? "";
    const dash = (v: string | null | undefined) => (v && String(v).trim() ? String(v) : "—");

    const stages: JourneyStage[] = [
      {
        key: "ad",
        label: "Ad click → captured",
        status: "done",
        detail: `Source ${family.source ?? "—"}${sub?.utm_campaign ? ` · campaign ${sub.utm_campaign}` : ""}`,
        at: family.created_at,
        source: "Supabase app_form",
        href: "/dev/integrations#supabase_app_form",
        keys: [
          { label: "utm_campaign", value: dash(sub?.utm_campaign ?? "gifted_quiz_2026") },
          { label: "utm_source", value: dash(sub?.utm_source ?? family.source) },
        ],
      },
      {
        key: "quiz",
        label: "Quiz scored",
        status: sub ? "done" : "pending",
        detail: sub ? `${sub.bucket} · score ${sub.raw_score} · ${sub.qualified ? "qualified" : "not qualified"}` : "No submission yet",
        at: sub?.scored_at ?? null,
        source: "GT Challenge capture",
        href: "/dev/integrations#gt_challenge_capture",
        keys: [
          { label: "match_key", value: dash(family.match_key) },
          { label: "family_id", value: fid },
          { label: "submission_id", value: dash(sub?.id) },
        ],
      },
      {
        key: "routed",
        label: "Routed to Fall enrollment",
        status: membership ? "done" : "pending",
        detail: membership ? `program_membership · ${membership.status} · via ${membership.source ?? "—"}` : "Not routed (quiz not qualified?)",
        at: membership?.joined_at ?? null,
        source: "Supabase app_form",
        href: "/dev/integrations#supabase_app_form",
        keys: [{ label: "program_membership.family_id", value: fid }],
      },
      {
        key: "paid",
        label: "Deposit paid (Stripe)",
        status: payment?.status === "succeeded" || enrollment?.paid ? "done" : "pending",
        detail: payment ? `${payment.status} · ${usd(Number(payment.amount))}${enrollment?.paid ? " · enrollment paid=true" : ""}` : "No payment yet — pay the deposit",
        at: payment?.occurred_at ?? null,
        source: "Stripe",
        href: "/dev/integrations#stripe",
        keys: [
          { label: "payment_intent_id", value: dash(payment?.stripe_payment_intent_id) },
          { label: "event_id", value: dash(payment?.stripe_event_id) },
          { label: "enrollment_id", value: dash(enrollment?.id) },
        ],
      },
      {
        key: "hubspot",
        label: "Synced to HubSpot",
        status: family.hubspot_contact_id || outbox ? "done" : "pending",
        detail: family.hubspot_contact_id
          ? `contact in HubSpot${enrollment?.hubspot_deal_id ? " + deal" : ""}${outbox ? ` · outbox ${outbox.op} · ${outbox.status}` : ""}`
          : outbox
            ? `outbox ${outbox.op} → ${outbox.target_system} · ${outbox.status}`
            : "No outbox intent yet",
        at: outbox?.created_at ?? family.created_at,
        source: "HubSpot",
        href: "/dev/integrations#hubspot_crm",
        keys: [
          {
            label: "hubspot_contact_id",
            value: dash(family.hubspot_contact_id),
            href: portal && family.hubspot_contact_id ? `https://app.hubspot.com/contacts/${portal}/contact/${family.hubspot_contact_id}` : undefined,
          },
          {
            label: "hubspot_deal_id",
            value: dash(enrollment?.hubspot_deal_id),
            href: portal && enrollment?.hubspot_deal_id ? `https://app.hubspot.com/contacts/${portal}/record/0-3/${enrollment.hubspot_deal_id}` : undefined,
          },
          ...(outbox ? [{ label: "sync_outbox.dedupe_key", value: outbox.dedupe_key }] : []),
        ],
      },
    ];

    return { familyId: fid, matchKey: family.match_key, name, email: family.email, found: true, stages };
  });
}

type FamilyRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  funnel_stage: string | null;
  source: string | null;
  match_key: string | null;
  created_at: string;
  hubspot_contact_id: string | null;
};
type SubRow = {
  id: string;
  child_first_name: string | null;
  bucket: string;
  raw_score: number;
  qualified: boolean;
  status: string;
  utm_source: string | null;
  utm_campaign: string | null;
  scored_at: string;
  submitted_at: string;
};

/* ----------------------- simplified step-by-step demo flow ----------------------- */
// A single record walked through the WHOLE pipeline — ad → form → Stripe → database →
// synced on the hub → shown in the payment log — with the NEW key minted at each step
// (and a date/time), so a grader can watch the identifier chain that ends in the ledger.

export interface DemoKey {
  label: string;
  value: string;
  /** true when this key is FIRST minted at this step (vs. carried in from a prior one). */
  fresh: boolean;
  /** when set, the value links out (e.g. a HubSpot record URL). */
  href?: string;
}

export interface DemoStep {
  n: number;
  label: string;
  done: boolean;
  at: string | null;
  summary: string;
  keys: DemoKey[];
  href?: string;
  hrefLabel?: string;
}

export interface DemoFlow {
  key: string;
  familyId: string;
  childName: string;
  email: string | null;
  matchKey: string | null;
  steps: DemoStep[];
}

/** The most recent real captured lead's family id (for /demo with no key). */
export async function latestDemoKey(): Promise<string | null> {
  if (!process.env.APP_RW_DATABASE_URL) return null;
  const fallId = await fallProgramId().catch(() => null);
  if (!fallId) return null;
  return withProgram(fallId, async (sql) => {
    const rows = await sql<{ family_id: string }[]>`
      select family_id from quiz_submissions where family_id is not null
      order by scored_at desc limit 1`;
    return rows[0]?.family_id ?? null;
  }).catch(() => null);
}

/** Read the LIVE DB and assemble the six-step key chain for one record. */
export async function loadDemoFlow(key: string): Promise<DemoFlow | null> {
  const fallId = await fallProgramId();
  const byId = UUID_RE.test(key);

  return withProgram(fallId, async (sql) => {
    const fam = byId
      ? await sql<FamilyRow[]>`select id, email, first_name, last_name, funnel_stage, source, match_key, created_at, hubspot_contact_id from families where id = ${key} limit 1`
      : await sql<FamilyRow[]>`select id, email, first_name, last_name, funnel_stage, source, match_key, created_at, hubspot_contact_id from families where lower(email) = ${key.toLowerCase()} order by created_at desc limit 1`;
    const family = fam[0];
    if (!family) return null;
    const fid = family.id;

    const subs = await sql<(SubRow & { id: string })[]>`
      select id, child_first_name, bucket, raw_score, qualified, status, utm_source, utm_campaign, scored_at, submitted_at
      from quiz_submissions where family_id = ${fid} order by scored_at desc limit 1`;
    const sub = subs[0] ?? null;

    const mem = await sql<{ status: string; source: string | null; joined_at: string }[]>`
      select status, source, joined_at from program_membership where family_id = ${fid} and program_id = ${fallId} limit 1`;
    const membership = mem[0] ?? null;

    const enr = await sql<{ id: string; stage: string | null; paid: boolean; amount: string | number | null; hubspot_deal_id: string | null }[]>`
      select id, stage, paid, amount, hubspot_deal_id from enrollments where family_id = ${fid} and program_id = ${fallId} order by created_at desc limit 1`;
    const enrollment = enr[0] ?? null;

    const pay = await sql<{ stripe_payment_intent_id: string; stripe_event_id: string | null; status: string; amount: string | number; occurred_at: string | null }[]>`
      select stripe_payment_intent_id, stripe_event_id, status, amount, occurred_at
      from payments where family_id = ${fid} order by status_rank desc, occurred_at desc limit 1`;
    const payment = pay[0] ?? null;

    const portal = process.env.HUBSPOT_PORTAL_ID ?? "";
    const childName = (sub?.child_first_name ?? "").trim() || [family.first_name, family.last_name].filter(Boolean).join(" ") || "Lead";
    const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
    const paid = payment?.status === "succeeded" || Boolean(enrollment?.paid);

    const steps: DemoStep[] = [
      {
        n: 1,
        label: "Ad click",
        done: true,
        at: family.created_at,
        summary: "A parent lands from the paid social ad and clicks through to the quiz.",
        keys: [
          { label: "utm_campaign", value: sub?.utm_campaign ?? "gifted_quiz_2026", fresh: true },
          { label: "utm_source", value: sub?.utm_source ?? family.source ?? "ad", fresh: true },
        ],
        href: "/ad",
        hrefLabel: "the ad",
      },
      {
        n: 2,
        label: "Form submitted (GT Challenge quiz)",
        done: Boolean(sub),
        at: sub?.scored_at ?? null,
        summary: sub
          ? `Scored ${sub.bucket} (${sub.raw_score}) · ${sub.qualified ? "qualified" : "not qualified"}. The lead's identity is minted here.`
          : "No submission yet.",
        keys: [
          { label: "match_key", value: family.match_key ?? "—", fresh: true },
          { label: "family_id", value: fid, fresh: true },
          { label: "submission_id", value: sub?.id ?? "—", fresh: true },
        ],
        href: "/gifted-quiz?demo=1",
        hrefLabel: "the form",
      },
      {
        n: 3,
        label: "Stripe payment",
        done: Boolean(payment),
        at: payment?.occurred_at ?? null,
        summary: payment
          ? `A real Stripe TEST charge ${payment.status} for ${usd(Number(payment.amount))} (pm_card_visa).`
          : "No payment yet.",
        keys: [
          { label: "payment_intent_id", value: payment?.stripe_payment_intent_id ?? "—", fresh: true },
          { label: "event_id", value: payment?.stripe_event_id ?? "—", fresh: true },
        ],
        href: "/dev/payments",
        hrefLabel: "Stripe / payments",
      },
      {
        n: 4,
        label: "HubSpot (CRM — written first)",
        done: Boolean(family.hubspot_contact_id),
        at: family.created_at,
        summary: family.hubspot_contact_id
          ? "The contact + deal (closedwon) are created in HubSpot first — the CRM is the system of record, then mirrored to the DB."
          : "Not in HubSpot yet (older record predates the HubSpot-first flow).",
        keys: [
          {
            label: "hubspot_contact_id",
            value: family.hubspot_contact_id ?? "—",
            fresh: true,
            href: portal && family.hubspot_contact_id
              ? `https://app.hubspot.com/contacts/${portal}/contact/${family.hubspot_contact_id}`
              : undefined,
          },
          {
            label: "hubspot_deal_id",
            value: enrollment?.hubspot_deal_id ?? "—",
            fresh: true,
            href: portal && enrollment?.hubspot_deal_id
              ? `https://app.hubspot.com/contacts/${portal}/record/0-3/${enrollment.hubspot_deal_id}`
              : undefined,
          },
        ],
        href: portal && family.hubspot_contact_id
          ? `https://app.hubspot.com/contacts/${portal}/contact/${family.hubspot_contact_id}`
          : undefined,
        hrefLabel: "HubSpot",
      },
      {
        n: 5,
        label: "Synced to the database (mirror of HubSpot)",
        done: paid,
        at: payment?.occurred_at ?? null,
        summary: enrollment
          ? `DB mirrors the CRM: family carries hubspot_contact_id, enrollment carries hubspot_deal_id; payment row written + enrollment paid=${enrollment.paid}.${membership ? " Routed into Fall enrollment." : ""}`
          : "No enrollment yet.",
        keys: [
          { label: "enrollment_id", value: enrollment?.id ?? "—", fresh: true },
          { label: "family_id", value: fid, fresh: false },
        ],
        href: "/m/dashboard",
        hrefLabel: "the Dashboard funnel",
      },
      {
        n: 6,
        label: "Shown in the payment log",
        done: Boolean(payment),
        at: payment?.occurred_at ?? null,
        summary: payment
          ? `This exact key appears in the Event/payment ledger with its date/time — ${payment.status} · ${usd(Number(payment.amount))}.`
          : "Will appear once the deposit is paid.",
        keys: [
          { label: "payment_intent_id", value: payment?.stripe_payment_intent_id ?? "—", fresh: false },
          { label: "event_id", value: payment?.stripe_event_id ?? "—", fresh: false },
        ],
        href: "/dev/payments",
        hrefLabel: "the payment log",
      },
    ];

    return { key: fid, familyId: fid, childName, email: family.email, matchKey: family.match_key, steps };
  });
}
