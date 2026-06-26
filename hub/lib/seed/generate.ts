/**
 * The GT Marketing Hub seed generator. Deterministic from a seed: same seed →
 * byte-identical dataset, so a walkthrough can always reset to a known state.
 *
 * It models the real thing (the backbone tables) with volume and spread, and
 * threads in DELIBERATE edge cases so isolation, idempotency, and dual-source
 * reconciliation are provable — not happy-path. Every edge case is recorded in
 * the manifest and asserted by invariants.ts.
 */

import { matchKey } from "../connectors/SourceConnector";
import { makeRng, type Rng } from "./rng";
import {
  BUDGET,
  ENGAGEMENT_TIERS,
  FALL_TUITION,
  FIRST_NAMES,
  GEO,
  GRADES,
  INCOME_BANDS,
  LAST_NAMES,
  LIFECYCLE_STAGES,
  PERSONAS,
  SOURCES,
  SUMMER_CAMPUSES,
  SUMMER_WEEK_PRICE,
  SYNCED_FIELDS,
  TEFA_STATUSES,
} from "./dictionaries";
import {
  ALL_CAMPAIGNS,
  META_CAMPAIGNS,
  SUMMER_UTM,
  X_CAMPAIGNS,
} from "./campaigns";
import type {
  BudgetWorkstream,
  Child,
  CommunityAmbassador,
  DataQualityIssue,
  Decision,
  Enrollment,
  Family,
  FieldState,
  Ga4Day,
  GenerateOptions,
  HubspotAmbassador,
  MetaAction,
  MetaInsight,
  ParitySnapshot,
  Payment,
  Program,
  ProgramMembership,
  ProcessedEvent,
  RegistrationFormEntry,
  SeedDataset,
  SheetRow,
  SummerSiteRegistration,
  SyncEventLogEntry,
  SyncIdentityMapEntry,
  SyncOutboxEntry,
  XPost,
} from "./types";

const DAY = 86_400_000;
const PROGRAM_FALL = "fall_enrollment";
const PROGRAM_SUMMER = "summer_camp";

const RANK: Record<string, number> = {
  requires_payment: 0,
  failed: 1,
  succeeded: 2,
  refunded: 3,
};

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

export function generate(opts: GenerateOptions = {}): SeedDataset {
  const seed = opts.seed ?? 424242;
  const familyCount = opts.families ?? 1200;
  const weeks = opts.weeks ?? 13; // June → end of August sprint
  const sprintStartMs = Date.parse(opts.sprintStart ?? "2026-06-01T00:00:00.000Z");
  const asOfMs = sprintStartMs + weeks * 7 * DAY;
  const rng = makeRng(seed);

  const edgeCases: string[] = [];
  const mark = (e: string) => {
    if (!edgeCases.includes(e)) edgeCases.push(e);
  };

  // ---------------- programs ----------------
  const programs: Program[] = [
    { id: rng.uuid(), key: PROGRAM_SUMMER, name: "Summer Camp" },
    { id: rng.uuid(), key: PROGRAM_FALL, name: "Fall Enrollment" },
  ];
  const programId = (key: string): string => programs.find((p) => p.key === key)!.id;

  // ---------------- families + children ----------------
  const families: Family[] = [];
  const children: Child[] = [];

  for (let i = 0; i < familyCount; i++) {
    const built = buildFamily(rng, i, sprintStartMs, asOfMs);
    families.push(built.family);
    children.push(...built.children);
  }

  // ----- deliberate family-level edge cases (deterministic indices) -----

  // (1) duplicate family: clone an existing person as a second typo'd record,
  //     SAME match_key → dedup must collapse them.
  {
    const src = families[7];
    const dupChildFirst = rng.pick(FIRST_NAMES);
    const dupUtm = resolveAttribution(rng, "newsletter");
    const dup: Family = {
      ...src,
      id: rng.uuid(),
      hubspot_contact_id: null, // came in via a different form, not yet linked
      first_name: src.first_name,
      last_name: src.last_name,
      // same email → same match_key (identity resolution should merge)
      row_version: 1,
      created_at: iso(Date.parse(src.created_at) + 2 * DAY),
      source: "newsletter",
      utm_source: dupUtm.utm_source,
      utm_medium: dupUtm.utm_medium,
      utm_campaign: dupUtm.utm_campaign,
    };
    families.push(dup);
    children.push({
      id: rng.uuid(),
      family_id: dup.id,
      first_name: dupChildFirst,
      grade: src.grade,
      created_at: dup.created_at,
    });
    mark("duplicate_family");
  }

  // (9) mojibake name (UTF-8 mis-decoded), (10) missing email, (11) missing zip,
  // (12) broken utm source — apply to specific records so they always exist.
  families[3].first_name = "JosÃ©"; // "José" mis-decoded
  families[3].last_name = "MuÃ±oz";
  mark("mojibake_name");

  families[4].email = null; // phone-only intake
  families[4].match_key = matchKey({
    phone: families[4].phone,
    firstName: families[4].first_name,
    lastName: families[4].last_name,
  });
  mark("missing_email");

  families[5].source = "(none)";
  families[5].utm_source = null;
  families[5].utm_medium = null;
  families[5].utm_campaign = null;
  mark("broken_utm_source");

  // ---------------- program membership / enrollments / payments ----------------
  const membership: ProgramMembership[] = [];
  const enrollments: Enrollment[] = [];
  const payments: Payment[] = [];
  const processed: ProcessedEvent[] = [];
  const eventLog: SyncEventLogEntry[] = [];
  const identityMap: SyncIdentityMapEntry[] = [];

  const pushPayment = (p: Payment) => payments.push(p);

  for (const fam of families) {
    const stage = fam.funnel_stage;
    const isApplicantPlus =
      stage === "applicant" || stage === "shadow_day" || stage === "deposit";
    const child = children.find((c) => c.family_id === fam.id) ?? null;

    // FALL: applicants+ become a deal; deposits are paid.
    if (isApplicantPlus) {
      const m: ProgramMembership = {
        id: rng.uuid(),
        program_id: programId(PROGRAM_FALL),
        program_key: PROGRAM_FALL,
        family_id: fam.id,
        child_id: child?.id ?? null,
        status: "active",
        source: "hubspot",
        joined_at: fam.created_at,
      };
      membership.push(m);

      const dealId = `deal_${rng.digits(8)}`;
      const paid = stage === "deposit";
      const enr: Enrollment = {
        id: rng.uuid(),
        program_id: programId(PROGRAM_FALL),
        program_key: PROGRAM_FALL,
        family_id: fam.id,
        child_id: child?.id ?? null,
        hubspot_deal_id: dealId,
        stage,
        amount: FALL_TUITION,
        paid,
        created_at: fam.created_at,
      };
      enrollments.push(enr);
      identityMap.push({
        id: rng.uuid(),
        local_table: "enrollments",
        local_id: enr.id,
        system: "hubspot",
        external_id: dealId,
      });

      if (paid) {
        const occurred = Date.parse(fam.created_at) + rng.int(1, 20) * DAY;
        const pi = `pi_${rng.digits(16)}`;
        const evt = `evt_${rng.digits(16)}`;
        pushPayment({
          id: rng.uuid(),
          program_id: programId(PROGRAM_FALL),
          program_key: PROGRAM_FALL,
          family_id: fam.id,
          enrollment_id: enr.id,
          stripe_payment_intent_id: pi,
          stripe_event_id: evt,
          amount: FALL_TUITION,
          status: "succeeded",
          status_rank: RANK.succeeded,
          occurred_at: iso(occurred),
          created_at: iso(occurred),
        });
        processed.push({
          source: "stripe",
          event_id: evt,
          first_seen_at: iso(occurred),
          result: { payment_intent: pi, status: "succeeded" },
        });
      }
    }

    // SUMMER: an independent subset register for camp.
    if (rng.bool(0.16)) {
      const campus = rng.pick(SUMMER_CAMPUSES);
      const amount = campus.weeks * SUMMER_WEEK_PRICE;
      const m: ProgramMembership = {
        id: rng.uuid(),
        program_id: programId(PROGRAM_SUMMER),
        program_key: PROGRAM_SUMMER,
        family_id: fam.id,
        child_id: child?.id ?? null,
        status: "active",
        source: "summer_site",
        joined_at: iso(sprintStartMs + rng.int(0, weeks * 7) * DAY),
      };
      membership.push(m);
      const paid = rng.bool(0.7);
      const enr: Enrollment = {
        id: rng.uuid(),
        program_id: programId(PROGRAM_SUMMER),
        program_key: PROGRAM_SUMMER,
        family_id: fam.id,
        child_id: child?.id ?? null,
        hubspot_deal_id: `deal_${rng.digits(8)}`,
        stage: paid ? "paid" : "registered_unpaid",
        amount,
        paid,
        created_at: m.joined_at,
      };
      enrollments.push(enr);
      if (paid) {
        const occurred = Date.parse(m.joined_at) + rng.int(0, 10) * DAY;
        const pi = `pi_${rng.digits(16)}`;
        const evt = `evt_${rng.digits(16)}`;
        pushPayment({
          id: rng.uuid(),
          program_id: programId(PROGRAM_SUMMER),
          program_key: PROGRAM_SUMMER,
          family_id: fam.id,
          enrollment_id: enr.id,
          stripe_payment_intent_id: pi,
          stripe_event_id: evt,
          amount,
          status: "succeeded",
          status_rank: RANK.succeeded,
          occurred_at: iso(occurred),
          created_at: iso(occurred),
        });
        processed.push({
          source: "stripe",
          event_id: evt,
          first_seen_at: iso(occurred),
          result: { payment_intent: pi, status: "succeeded" },
        });
      }
    }
  }

  // (2) family in TWO programs: take a fall member NOT already in summer, add summer.
  {
    const summerFamilies = new Set(
      membership.filter((m) => m.program_key === PROGRAM_SUMMER).map((m) => m.family_id),
    );
    const fallMember = membership.find(
      (m) => m.program_key === PROGRAM_FALL && !summerFamilies.has(m.family_id),
    );
    if (fallMember) {
      const campus = SUMMER_CAMPUSES[1];
      membership.push({
        id: rng.uuid(),
        program_id: programId(PROGRAM_SUMMER),
        program_key: PROGRAM_SUMMER,
        family_id: fallMember.family_id,
        child_id: fallMember.child_id,
        status: "active",
        source: "summer_site",
        joined_at: iso(asOfMs - 10 * DAY),
      });
      enrollments.push({
        id: rng.uuid(),
        program_id: programId(PROGRAM_SUMMER),
        program_key: PROGRAM_SUMMER,
        family_id: fallMember.family_id,
        child_id: fallMember.child_id,
        hubspot_deal_id: `deal_${rng.digits(8)}`,
        stage: "paid",
        amount: campus.weeks * SUMMER_WEEK_PRICE,
        paid: true,
        created_at: iso(asOfMs - 10 * DAY),
      });
      mark("family_in_two_programs");
    }
  }

  // (3,6) failed payment then a late succeeded retry (two intents, one enrollment).
  {
    const target = enrollments.find((e) => e.program_key === PROGRAM_FALL && !e.paid);
    if (target) {
      const failedAt = Date.parse(target.created_at) + 3 * DAY;
      payments.push({
        id: rng.uuid(),
        program_id: target.program_id,
        program_key: target.program_key,
        family_id: target.family_id,
        enrollment_id: target.id,
        stripe_payment_intent_id: `pi_${rng.digits(16)}`,
        stripe_event_id: `evt_${rng.digits(16)}`,
        amount: FALL_TUITION,
        status: "failed",
        status_rank: RANK.failed,
        occurred_at: iso(failedAt),
        created_at: iso(failedAt),
      });
      const lateAt = failedAt + 26 * DAY; // well after → "late payment"
      const pi = `pi_${rng.digits(16)}`;
      const evt = `evt_${rng.digits(16)}`;
      payments.push({
        id: rng.uuid(),
        program_id: target.program_id,
        program_key: target.program_key,
        family_id: target.family_id,
        enrollment_id: target.id,
        stripe_payment_intent_id: pi,
        stripe_event_id: evt,
        amount: FALL_TUITION,
        status: "succeeded",
        status_rank: RANK.succeeded,
        occurred_at: iso(lateAt),
        created_at: iso(lateAt),
      });
      processed.push({ source: "stripe", event_id: evt, first_seen_at: iso(lateAt), result: { payment_intent: pi, status: "succeeded" } });
      target.paid = true;
      target.stage = "deposit";
      mark("failed_payment");
      mark("late_payment");
    }
  }

  // (4) refund: flip a succeeded payment to refunded (terminal, rank does not regress).
  {
    const succeeded = payments.find((p) => p.status === "succeeded");
    if (succeeded) {
      const refundAt = Date.parse(succeeded.occurred_at ?? iso(asOfMs)) + 12 * DAY;
      succeeded.status = "refunded";
      succeeded.status_rank = RANK.refunded;
      eventLog.push({
        id: rng.uuid(),
        source_system: "stripe",
        external_event_id: `evt_${rng.digits(16)}`,
        entity: "payment",
        entity_id: succeeded.id,
        change: { status: "refunded", amount: succeeded.amount },
        conflict: false,
        received_at: iso(refundAt),
        processed_at: iso(refundAt),
      });
      mark("refunded_payment");
    }
  }

  // (5) duplicate Stripe webhook: the SAME event_id arrives twice. processed_events
  //     holds it ONCE; the event log records both deliveries; payments stays single.
  {
    const anchor = payments.find((p) => p.status === "succeeded" || p.status === "refunded");
    if (anchor && anchor.stripe_event_id) {
      const ev = anchor.stripe_event_id;
      for (let k = 0; k < 2; k++) {
        eventLog.push({
          id: rng.uuid(),
          source_system: "stripe",
          external_event_id: ev,
          entity: "payment",
          entity_id: anchor.id,
          change: { status: anchor.status, delivery: k + 1 },
          conflict: false,
          received_at: iso(Date.parse(anchor.created_at) + k * 1000),
          processed_at: k === 0 ? iso(Date.parse(anchor.created_at) + 50) : null, // 2nd is a no-op
        });
      }
      // processed_events already has `ev` once from the succeeded path; ensure it.
      if (!processed.some((p) => p.source === "stripe" && p.event_id === ev)) {
        processed.push({ source: "stripe", event_id: ev, first_seen_at: anchor.created_at, result: { payment_intent: anchor.stripe_payment_intent_id } });
      }
      mark("duplicate_stripe_event");
    }
  }

  // ---------------- field_state (parity + conflicts) ----------------
  const fieldState: FieldState[] = [];
  for (const fam of families) {
    // Parity is an app↔HubSpot concept: only families that have synced have a
    // per-field baseline. Unsynced families simply aren't in parity scope yet.
    if (fam.last_synced_at === null) continue;
    for (const f of SYNCED_FIELDS) {
      const appVal = appFieldValue(fam, f.field);
      // Unreliable fields conflict more often (HubSpot copy drifts).
      const conflictP = f.unreliable ? 0.22 : 0.03;
      const conflict = fam.last_synced_at !== null && rng.bool(conflictP);
      const hsVal = conflict ? mutateValue(rng, f.field, appVal) : appVal;
      fieldState.push({
        entity: "family",
        entity_id: fam.id,
        field: f.field,
        app_value: appVal,
        hs_value: hsVal,
        app_updated_at: fam.app_updated_at,
        hs_updated_at: fam.hs_updated_at,
        in_parity: appVal === hsVal,
        last_checked_at: fam.last_synced_at,
      });
      if (conflict) mark("crm_app_conflict");
    }
  }

  // ---------------- parity snapshots (with a deliberate dip) ----------------
  const parity: ParitySnapshot[] = [];
  for (let w = 0; w < weeks; w++) {
    const takenMs = sprintStartMs + w * 7 * DAY;
    // Healthy ~0.965–0.985, EXCEPT week 6 dips below the 0.95 banner threshold.
    let pct = 0.965 + rng.next() * 0.02;
    if (w === 6) pct = 0.912;
    parity.push({
      id: rng.uuid(),
      taken_at: iso(takenMs),
      scope: "overall",
      overall_pct: Number((pct * 100).toFixed(2)),
      fields: {
        tefa_status: Number(((pct - 0.04) * 100).toFixed(2)),
        income_band: Number(((pct - 0.03) * 100).toFixed(2)),
        source: Number(((pct - 0.06) * 100).toFixed(2)),
        funnel_stage: Number(((pct + 0.01) * 100).toFixed(2)),
      },
    });
  }
  mark("parity_dip_below_threshold");

  // ---------------- budget (reconciles to $365,000) + decisions ----------------
  const budget: BudgetWorkstream[] = BUDGET.map((b) => {
    const planned = b.recommended;
    // Burn ~55–75% of planned, EXCEPT guerrilla which we push >10% over plan.
    let committed = Math.round(planned * (0.6 + rng.next() * 0.15));
    let actual = Math.round(committed * (0.85 + rng.next() * 0.1));
    if (b.key === "guerrilla") {
      committed = Math.round(planned * 1.18);
      actual = Math.round(planned * 1.12); // >10% over plan → variance auto-flag
    }
    return { id: rng.uuid(), key: b.key, name: b.name, recommended: b.recommended, planned, committed, actual };
  });

  const decisions = buildDecisions(rng, asOfMs, budget);

  // ---------------- data quality issues ----------------
  const brokenUtm = families.filter((f) => f.source === "(none)" || (f.source ?? "").includes("{{")).length;
  const unscored = families.filter((f) => f.lead_score === null).length;
  const dataQuality: DataQualityIssue[] = [
    issue(rng, "utm", "high", `UTM attribution broken on ${brokenUtm} contacts (source missing or unrendered template).`, asOfMs - 4 * DAY, "open"),
    issue(rng, "sync", "medium", "Sync parity dipped to 91.2% in week 6 (HubSpot tefa_status/source drift).", asOfMs - 21 * DAY, "open"),
    issue(rng, "scoring", "low", `${unscored} contacts missing a HubSpot lead_score.`, asOfMs - 9 * DAY, "open"),
    issue(rng, "tracking", "medium", "Event-to-consult conversion is uninstrumented (field events have no attribution).", asOfMs - 30 * DAY, "open"),
    issue(rng, "sync", "low", "Resolved: 3 contacts had stale lifecycle_stage; re-synced.", asOfMs - 35 * DAY, "resolved"),
  ];

  // ---------------- sync outbox ----------------
  const outbox: SyncOutboxEntry[] = [
    outboxEntry(rng, families[10], "upsert_contact", "pending", asOfMs - 1 * DAY, null),
    outboxEntry(rng, families[11], "upsert_contact", "done", asOfMs - 6 * DAY, null),
    outboxEntry(rng, families[12], "upsert_contact", "dead", asOfMs - 8 * DAY, "HubSpot 409: contact merged externally"),
  ];

  // ---------------- stood-in sources ----------------
  const standIn = buildStandIns(rng, families, sprintStartMs, weeks, asOfMs, mark);

  const dataset: SeedDataset = {
    manifest: {
      seed,
      generatedAt: iso(asOfMs), // deterministic as-of clock (NOT wall time)
      counts: {},
      edgeCases: edgeCases.sort(),
      real: [
        "programs", "families", "children", "program_membership", "enrollments",
        "payments", "field_state", "parity_snapshot", "data_quality_issue",
        "budget_workstream", "decisions", "processed_events", "sync_event_log",
        "sync_outbox", "sync_identity_map",
      ],
      standIn: [
        "meta_insights", "ga4_days", "x_posts", "content_sheet",
        "summer_site_registrations", "registration_form_entries",
        "community_ambassadors", "hubspot_ambassadors",
      ],
    },
    programs,
    families,
    children,
    program_membership: membership,
    enrollments,
    payments,
    field_state: fieldState,
    parity_snapshot: parity,
    data_quality_issue: dataQuality,
    budget_workstream: budget,
    decisions,
    processed_events: processed,
    sync_event_log: eventLog,
    sync_outbox: outbox,
    sync_identity_map: identityMap,
    ...standIn,
  };

  // counts for the manifest
  for (const [k, v] of Object.entries(dataset)) {
    if (Array.isArray(v)) dataset.manifest.counts[k] = v.length;
  }

  return dataset;
}

// ----------------------------- builders -----------------------------

function dateKey(isoTs: string): string {
  return isoTs.slice(0, 10);
}

/** Map HubSpot `source` → UTM triple for attribution joins. */
function resolveAttribution(
  rng: Rng,
  source: string,
): Pick<Family, "utm_source" | "utm_medium" | "utm_campaign"> {
  if (source === "meta_ads") {
    const c = rng.pick(META_CAMPAIGNS);
    return { utm_source: c.utm_source, utm_medium: c.utm_medium, utm_campaign: c.utm_campaign };
  }
  if (source === "x_twitter") {
    const c = rng.pick(X_CAMPAIGNS);
    return { utm_source: c.utm_source, utm_medium: c.utm_medium, utm_campaign: c.utm_campaign };
  }
  if (source === "organic_search") {
    return { utm_source: "google", utm_medium: "organic", utm_campaign: null };
  }
  if (source === "referral") {
    return { utm_source: "referral", utm_medium: "partner", utm_campaign: "ambassador_referral" };
  }
  if (source === "newsletter") {
    return { utm_source: "newsletter", utm_medium: "email", utm_campaign: "june_nurture" };
  }
  if (source === "direct") {
    return { utm_source: "(direct)", utm_medium: "(none)", utm_campaign: null };
  }
  // broken attribution: (none), unrendered template, etc.
  return { utm_source: null, utm_medium: null, utm_campaign: null };
}

function indexFamiliesByDateCampaign(families: Family[]): Map<string, Family[]> {
  const map = new Map<string, Family[]>();
  for (const f of families) {
    if (!f.utm_campaign) continue;
    const key = `${dateKey(f.created_at)}|${f.utm_campaign}`;
    const arr = map.get(key) ?? [];
    arr.push(f);
    map.set(key, arr);
  }
  return map;
}

function buildFamily(
  rng: Rng,
  i: number,
  sprintStartMs: number,
  asOfMs: number,
): { family: Family; children: Child[] } {
  const geo = rng.weighted(GEO.map((g) => [g, g.weight] as const));
  const [, zip] = rng.pick(geo.cities);
  const income = rng.weighted(INCOME_BANDS.map((b) => [b, b.weight] as const));
  const grade = rng.weighted(GRADES.map((g) => [g, g.weight] as const));
  const engagement = rng.weighted(ENGAGEMENT_TIERS.map((e) => [e, e.weight] as const));
  // Preserve the historical RNG sequence even though persona is not in the fixture schema.
  rng.pick(PERSONAS);
  const source = rng.weighted(SOURCES.map((s) => [s.value, s.weight] as const));
  const utm = resolveAttribution(rng, source);

  const first = rng.pick(FIRST_NAMES);
  const last = rng.pick(LAST_NAMES);
  const childFirst = rng.pick(FIRST_NAMES);

  const email = `${first}.${last}${i}@example.com`.toLowerCase();
  const phone = `(${rng.int(200, 989)}) 555-${rng.digits(4)}`;

  // Conversion model: income × grade × engagement (spec's stated drivers).
  let conv = income.conversion * grade.convMult * engagement.convMult;
  conv = Math.min(0.6, conv);
  const converted = rng.bool(conv);
  const followsAlpha = converted ? rng.bool(0.274) : rng.bool(0.08);
  if (followsAlpha) conv = Math.min(0.7, conv * 1.15);

  // Funnel stage.
  let funnel: string;
  if (converted) funnel = "deposit";
  else if (rng.bool(0.5)) funnel = "applicant";
  else if (rng.bool(0.3)) funnel = "shadow_day";
  else if (rng.bool(0.2)) funnel = "waitlisted";
  else funnel = "lead";

  const tefa =
    geo.esaFunded
      ? rng.weighted([["esa_planned", 6], ["no_indicator", 3], ["esa_ineligible", 1]] as const)
      : rng.weighted([["esa_ineligible", 6], ["no_indicator", 4]] as const);

  const lifecycle =
    funnel === "deposit"
      ? "customer"
      : funnel === "shadow_day"
        ? "opportunity"
        : funnel === "applicant"
          ? "marketingqualifiedlead"
          : rng.pick(LIFECYCLE_STAGES.slice(0, 2));

  // lead_score correlates with the conversion drivers; a few are null (data gap).
  const scoreBase = Math.round(conv * 140 + (followsAlpha ? 15 : 0) + rng.int(-8, 8));
  const leadScore = rng.bool(0.05) ? null : Math.max(1, Math.min(100, scoreBase));

  const createdMs = sprintStartMs + rng.int(0, asOfMs - sprintStartMs - DAY);
  const appUpdated = createdMs + rng.int(0, 6) * DAY;
  // ~12% never synced to HubSpot yet (no hs id, no parity baseline).
  const synced = rng.bool(0.88);
  const hsContactId = synced ? `hs_${rng.digits(9)}` : null;
  const hsUpdated = synced ? appUpdated + rng.int(0, 3) * DAY : null;
  const lastSynced = synced ? Math.min(asOfMs, hsUpdated! + rng.int(0, 2) * DAY) : null;

  const family: Family = {
    id: rng.uuid(),
    hubspot_contact_id: hsContactId,
    email,
    phone,
    first_name: first,
    last_name: last,
    funnel_stage: funnel,
    tefa_status: tefa,
    income_band: income.key,
    grade: grade.key,
    lifecycle_stage: lifecycle,
    lead_score: leadScore,
    source,
    utm_source: utm.utm_source,
    utm_medium: utm.utm_medium,
    utm_campaign: utm.utm_campaign,
    match_key: matchKey({ email, phone, firstName: first, lastName: last, zip }),
    row_version: rng.int(1, 4),
    app_updated_at: iso(appUpdated),
    hs_updated_at: hsUpdated ? iso(hsUpdated) : null,
    last_synced_at: lastSynced ? iso(lastSynced) : null,
    created_at: iso(createdMs),
  };

  const kids: Child[] = [
    { id: rng.uuid(), family_id: family.id, first_name: childFirst, grade: grade.key, created_at: family.created_at },
  ];
  if (rng.bool(0.18)) {
    kids.push({ id: rng.uuid(), family_id: family.id, first_name: rng.pick(FIRST_NAMES), grade: rng.pick(GRADES).key, created_at: family.created_at });
  }

  return { family, children: kids };
}

function appFieldValue(fam: Family, field: string): string | null {
  const v = (fam as unknown as Record<string, unknown>)[field];
  return v === null || v === undefined ? null : String(v);
}

function mutateValue(rng: Rng, field: string, appVal: string | null): string | null {
  if (field === "income_band") return rng.pick(INCOME_BANDS).key;
  if (field === "tefa_status") return rng.pick(TEFA_STATUSES);
  if (field === "source") return rng.pick(SOURCES).value;
  if (field === "lead_score") return String(rng.int(1, 100));
  if (field === "lifecycle_stage") return rng.pick(LIFECYCLE_STAGES);
  if (appVal === null) return "stale";
  return `${appVal}_stale`;
}

function issue(
  rng: Rng,
  category: string,
  severity: string,
  description: string,
  createdMs: number,
  status: string,
): DataQualityIssue {
  return {
    id: rng.uuid(),
    category,
    severity,
    entity: null,
    entity_id: null,
    field: null,
    description,
    status,
    created_at: iso(createdMs),
    resolved_at: status === "resolved" ? iso(createdMs + 2 * DAY) : null,
  };
}

function outboxEntry(
  rng: Rng,
  fam: Family,
  op: string,
  status: string,
  createdMs: number,
  lastError: string | null,
): SyncOutboxEntry {
  return {
    id: rng.uuid(),
    aggregate_type: "family",
    aggregate_id: fam.id,
    target_system: "hubspot",
    op,
    payload: { email: fam.email, funnel_stage: fam.funnel_stage },
    dedupe_key: `family:${fam.id}:${op}:${createdMs}`,
    status,
    attempts: status === "dead" ? 5 : status === "done" ? 1 : 0,
    last_error: lastError,
    created_at: iso(createdMs),
  };
}

function buildDecisions(rng: Rng, asOfMs: number, budget: BudgetWorkstream[]): Decision[] {
  const guerrilla = budget.find((b) => b.key === "guerrilla")!;
  const overPct = Math.round(((guerrilla.actual - guerrilla.planned) / guerrilla.planned) * 100);
  return [
    {
      id: rng.uuid(),
      question: "Approve $18K guerrilla bet: gifted-family chess-tournament street team in Austin + Dallas?",
      raised_by: "the Field & Events Owner",
      workstream: "guerrilla",
      recommendation: "Approve at $18K. Open Data shows large gifted pools in C/D/F-rated Austin + Dallas districts; CPQL modeling ≈ $41/qualified lead vs $63 blended.",
      budget_ask: 18000,
      due_date: iso(asOfMs + 2 * DAY).slice(0, 10),
      priority: "urgent",
      status: "open",
      response: null,
      response_note: null,
      auto_flag: false,
      resolved_at: null,
      created_at: iso(asOfMs - 1 * DAY),
    },
    {
      id: rng.uuid(),
      question: `Guerrilla workstream is ${overPct}% over plan — approve $5K reallocation from Foundations + Ops?`,
      raised_by: "system (budget variance)",
      workstream: "guerrilla",
      recommendation: "Reallocate $5K; guerrilla is the best-yielding channel in pilot.",
      budget_ask: 5000,
      due_date: iso(asOfMs + 1 * DAY).slice(0, 10),
      priority: "urgent",
      status: "open",
      response: null,
      response_note: null,
      auto_flag: true, // raised by the >10% variance rule
      resolved_at: null,
      created_at: iso(asOfMs - 2 * DAY),
    },
    {
      id: rng.uuid(),
      question: "Launch a T3 ESA-ineligible out-of-pocket nurture sequence?",
      raised_by: "the Marketing Lead",
      workstream: "thought_leadership",
      recommendation: "Yes — the out-of-pocket sub-bucket is the largest impact slice of the 1,124 waitlist.",
      budget_ask: null,
      due_date: iso(asOfMs + 5 * DAY).slice(0, 10),
      priority: "normal",
      status: "open",
      response: null,
      response_note: null,
      auto_flag: false,
      resolved_at: null,
      created_at: iso(asOfMs - 3 * DAY),
    },
    {
      id: rng.uuid(),
      question: "Add a 4th summer session at Austin (capacity sold > 90%)?",
      raised_by: "the Content Owner",
      workstream: "foundations",
      recommendation: "Open a waitlist-driven 4th Austin session.",
      budget_ask: 8000,
      due_date: iso(asOfMs + 7 * DAY).slice(0, 10),
      priority: "normal",
      status: "in_flight",
      response: "need_info",
      response_note: "Confirm guide availability before committing.",
      auto_flag: false,
      resolved_at: null,
      created_at: iso(asOfMs - 6 * DAY),
    },
    {
      id: rng.uuid(),
      question: "Approve founding-family scholarship copy for the NYC value frame?",
      raised_by: "the Content Owner",
      workstream: "thought_leadership",
      recommendation: "Approve with brand-voice edits.",
      budget_ask: null,
      due_date: iso(asOfMs - 4 * DAY).slice(0, 10),
      priority: "normal",
      status: "decided",
      response: "approve",
      response_note: "Approved; ship to the nurture sequence.",
      auto_flag: false,
      resolved_at: iso(asOfMs - 4 * DAY),
      created_at: iso(asOfMs - 9 * DAY),
    },
  ];
}

function buildStandIns(
  rng: Rng,
  families: Family[],
  sprintStartMs: number,
  weeks: number,
  asOfMs: number,
  mark: (e: string) => void,
): Pick<
  SeedDataset,
  | "meta_insights"
  | "ga4_days"
  | "x_posts"
  | "content_sheet"
  | "summer_site_registrations"
  | "registration_form_entries"
  | "community_ambassadors"
  | "hubspot_ambassadors"
> {
  const days = weeks * 7;
  const byDateCampaign = indexFamiliesByDateCampaign(families);

  // ---- Meta (Marketing API): campaign × date × publisher_platform ----
  const meta_insights: MetaInsight[] = [];
  let metaLeadsTotal = 0;
  let crmMetaLeadsTotal = 0;

  for (let d = 0; d < days; d++) {
    const date = iso(sprintStartMs + d * DAY).slice(0, 10);
    for (const camp of META_CAMPAIGNS) {
      const crmOnDay = (byDateCampaign.get(`${date}|${camp.utm_campaign}`) ?? []).filter(
        (f) => f.source === "meta_ads",
      );
      crmMetaLeadsTotal += crmOnDay.length;

      for (const publisher_platform of ["facebook", "instagram"] as const) {
        const platformShare = publisher_platform === "facebook" ? 0.58 : 0.42;
        const crmSlice = Math.round(crmOnDay.length * platformShare);
        // Meta's attribution window inflates lead counts vs CRM (the deliberate gap).
        const inflation = 1.18 + rng.next() * 0.22;
        const metaLeads = Math.max(
          0,
          Math.round(crmSlice * inflation) + (crmSlice === 0 && rng.bool(0.12) ? rng.int(0, 2) : 0),
        );
        metaLeadsTotal += metaLeads;

        const spend = crmSlice > 0 ? rng.int(60, 320) * platformShare : rng.int(15, 90) * platformShare;
        const impressions = Math.round(spend * rng.int(70, 150));
        const reach = Math.round(impressions * (0.72 + rng.next() * 0.15));
        const clicks = Math.round(impressions * (0.008 + rng.next() * 0.018));
        const ctr = impressions > 0 ? Number((clicks / impressions).toFixed(4)) : 0;
        const cpc = clicks > 0 ? Number((spend / clicks).toFixed(2)) : 0;

        const actions: MetaAction[] = [
          { action_type: "link_click", value: String(clicks) },
          { action_type: "landing_page_view", value: String(Math.round(clicks * 0.82)) },
          { action_type: "lead", value: String(metaLeads) },
        ];

        meta_insights.push({
          _standIn: true,
          _source: "meta_marketing_api",
          date,
          campaign_id: camp.meta_campaign_id,
          campaign_name: camp.name,
          utm_campaign: camp.utm_campaign,
          publisher_platform,
          spend: Number(spend.toFixed(2)),
          impressions,
          reach,
          clicks,
          ctr,
          cpc,
          actions,
          attribution_window: rng.bool(0.85) ? "7d_click" : "1d_view",
          leads: metaLeads,
        });
      }
    }
  }
  if (metaLeadsTotal > crmMetaLeadsTotal) mark("attribution_gap");

  // ---- GA4 (Data API): date × site × campaign × landing page ----
  const ga4_days: Ga4Day[] = [];
  const sites = ["gt.school", "anywhere.gt.school"] as const;

  for (let d = 0; d < days; d++) {
    const date = iso(sprintStartMs + d * DAY).slice(0, 10);
    for (const site of sites) {
      // Campaign-attributed rows (UTM join path).
      for (const camp of ALL_CAMPAIGNS) {
        const fams = (byDateCampaign.get(`${date}|${camp.utm_campaign}`) ?? []).filter(
          (f) => f.source === camp.crm_source,
        );
        if (fams.length === 0 && !rng.bool(0.08)) continue;

        const sessions = Math.max(
          fams.length,
          Math.round(fams.length * (2.5 + rng.next() * 1.5) + rng.int(5, 40)),
        );
        const generateLead = fams.filter((f) =>
          f.funnel_stage === "applicant" || f.funnel_stage === "deposit" || f.funnel_stage === "shadow_day",
        ).length;
        // GA4 event count is close but not exact (uninstrumented steps).
        const eventLeads = Math.max(0, generateLead + rng.int(-1, 2));

        ga4_days.push({
          _standIn: true,
          _source: "ga4_data_api",
          date,
          site,
          sessionDefaultChannelGroup: camp.ga4_channel,
          sessionSourceMedium: `${camp.utm_source} / ${camp.utm_medium}`,
          landingPage: camp.landing_page,
          utm_campaign: camp.utm_campaign,
          sessions,
          totalUsers: Math.round(sessions * (0.68 + rng.next() * 0.18)),
          engagedSessions: Math.round(sessions * (0.42 + rng.next() * 0.2)),
          screenPageViews: Math.round(sessions * (2.2 + rng.next() * 1.8)),
          conversions: Math.round(eventLeads * (0.6 + rng.next() * 0.3)),
          eventCount_pdf_download: rng.int(0, Math.max(2, Math.round(sessions * 0.04))),
          eventCount_generate_lead: eventLeads,
        });
      }

      // Organic / direct bucket (no utm_campaign).
      if (rng.bool(0.65)) {
        const sessions = site === "anywhere.gt.school" ? rng.int(120, 380) : rng.int(80, 260);
        ga4_days.push({
          _standIn: true,
          _source: "ga4_data_api",
          date,
          site,
          sessionDefaultChannelGroup: "Direct",
          sessionSourceMedium: "(direct) / (none)",
          landingPage: "/",
          utm_campaign: null,
          sessions,
          totalUsers: Math.round(sessions * 0.75),
          engagedSessions: Math.round(sessions * 0.38),
          screenPageViews: Math.round(sessions * 2.1),
          conversions: rng.int(0, 6),
          eventCount_pdf_download: rng.int(1, 12),
          eventCount_generate_lead: rng.int(0, 4),
        });
      }
    }
  }

  // ---- X (API v2): tweets with UTM-bearing links → GA4 sessions ----
  const x_posts: XPost[] = [];
  const xCopy: Record<string, string[]> = {
    x_conviction_june: [
      "Gifted kids don't need more worksheets. They need no ceiling. → anywhere.gt.school?utm_campaign=x_conviction_june",
      "Your district says 'gifted' then puts them back in the same class. We don't.",
    ],
    x_esa_thread: [
      "GT Anywhere is free with the Texas ESA. Elite gifted education, $0 out of pocket.",
      "Thread: how the TEFA voucher changes the math for gifted families in TX 🧵",
    ],
  };

  for (const camp of X_CAMPAIGNS) {
    const posts = xCopy[camp.utm_campaign] ?? ["3x learning velocity. Self-paced, no ceiling."];
    for (const text of posts) {
      const created_at = iso(sprintStartMs + rng.int(0, days - 1) * DAY + rng.int(8, 20) * 3_600_000);
      const impressions = rng.int(2500, 95000);
      const urlClicks = Math.round(impressions * (0.004 + rng.next() * 0.022));
      x_posts.push({
        _standIn: true,
        _source: "x_api_v2",
        id: `${rng.digits(18)}`,
        created_at,
        text,
        public_metrics: {
          impression_count: impressions,
          like_count: Math.round(impressions * (0.012 + rng.next() * 0.028)),
          retweet_count: Math.round(impressions * (0.003 + rng.next() * 0.01)),
          reply_count: Math.round(impressions * (0.001 + rng.next() * 0.004)),
          quote_count: Math.round(impressions * (0.0008 + rng.next() * 0.003)),
          bookmark_count: Math.round(impressions * (0.002 + rng.next() * 0.006)),
        },
        non_public_metrics: {
          url_link_clicks: urlClicks,
          user_profile_clicks: Math.round(impressions * 0.003),
        },
        utm_campaign: camp.utm_campaign,
        utm_source: camp.utm_source,
        utm_medium: camp.utm_medium,
      });
    }
  }

  const content_sheet: SheetRow[] = [];
  const statuses = ["idea", "drafting", "review", "scheduled", "published"] as const;
  const owners = ["the Content Owner", "the Marketing Lead", "Pamela Hobart"];
  for (let i = 0; i < 16; i++) {
    const camp = rng.bool(0.75) ? rng.pick(ALL_CAMPAIGNS) : null;
    content_sheet.push({
      _standIn: true,
      _source: "google_sheets",
      piece: `Content piece #${i + 1}`,
      owner: rng.pick(owners),
      status: rng.pick(statuses),
      target_date: iso(sprintStartMs + rng.int(0, days) * DAY).slice(0, 10),
      utm_campaign: camp?.utm_campaign ?? null,
    });
  }

  // ---- DUAL SOURCE: summer.gt.school registrations ⇄ registration form ----
  const summer_site_registrations: SummerSiteRegistration[] = [];
  const registration_form_entries: RegistrationFormEntry[] = [];
  const campFamilies = rng.shuffle(families).slice(0, 40);
  campFamilies.forEach((fam, idx) => {
    const campus = rng.pick(SUMMER_CAMPUSES);
    const childName = `${fam.first_name} Jr`;
    const key = fam.match_key;
    const weeksN = campus.weeks;
    const created_at = iso(sprintStartMs + rng.int(0, days) * DAY);
    const session_start = iso(sprintStartMs + rng.int(14, days - 7) * DAY).slice(0, 10);
    const onSite = idx % 9 !== 0;
    const onForm = idx % 7 !== 0;
    const paid = rng.bool(0.7);

    if (onSite) {
      summer_site_registrations.push({
        _standIn: true,
        _source: "summer_gt_school",
        registration_id: `sgs_${rng.digits(7)}`,
        parent_email: fam.email,
        parent_phone: fam.phone,
        child_name: childName,
        campus: campus.name,
        campus_key: campus.key,
        session_start,
        weeks: weeksN,
        amount: weeksN * SUMMER_WEEK_PRICE,
        paid,
        status: paid ? "confirmed" : rng.pick(["pending", "waitlisted"] as const),
        utm_source: SUMMER_UTM.utm_source,
        utm_medium: SUMMER_UTM.utm_medium,
        utm_campaign: SUMMER_UTM.utm_campaign,
        created_at,
        match_key: key,
      });
    }
    if (onForm) {
      const conflictWeeks = idx === 3 ? weeksN + 1 : weeksN;
      registration_form_entries.push({
        _standIn: true,
        _source: "registration_form",
        form_id: `rf_${rng.digits(7)}`,
        child_name: childName,
        parent_email: fam.email ?? "",
        parent_phone: fam.phone,
        campus: campus.name,
        weeks: conflictWeeks,
        utm_source: SUMMER_UTM.utm_source,
        utm_medium: SUMMER_UTM.utm_medium,
        utm_campaign: SUMMER_UTM.utm_campaign,
        created_at,
        match_key: key,
      });
      if (idx === 3) mark("dual_source_conflict");
    }
    if (onSite && onForm) mark("dual_source_duplicate");
  });

  // ---- DUAL SOURCE: community.gt.school ambassadors ⇄ HubSpot ambassadors ----
  const community_ambassadors: CommunityAmbassador[] = [];
  const hubspot_ambassadors: HubspotAmbassador[] = [];
  const ambFamilies = rng.shuffle(families).slice(0, 22);
  const statusesA = ["prospect", "onboarded", "active", "champion"];
  ambFamilies.forEach((fam, idx) => {
    const name = `${fam.first_name} ${fam.last_name}`;
    const key = fam.match_key;
    const inCommunity = idx % 8 !== 0;
    const inHubspot = idx % 6 !== 0;
    const commStatus = rng.pick(statusesA);
    if (inCommunity) {
      community_ambassadors.push({
        _standIn: true,
        _source: "community_gt_school",
        community_id: `cgs_${rng.digits(6)}`,
        name,
        email: fam.email ?? "",
        status: commStatus,
        match_key: key,
      });
    }
    if (inHubspot) {
      const hsStatus = idx === 2 ? "prospect" : commStatus;
      hubspot_ambassadors.push({
        _standIn: true,
        _source: "hubspot",
        hubspot_contact_id: fam.hubspot_contact_id ?? `hs_${rng.digits(9)}`,
        name,
        email: fam.email ?? "",
        ambassador_status: hsStatus,
        match_key: key,
      });
      if (idx === 2) mark("ambassador_conflict");
    }
  });

  return {
    meta_insights,
    ga4_days,
    x_posts,
    content_sheet,
    summer_site_registrations,
    registration_form_entries,
    community_ambassadors,
    hubspot_ambassadors,
  };
}
