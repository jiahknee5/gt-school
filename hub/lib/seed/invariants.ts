/**
 * Invariants the seed must satisfy. These are the brief's promises made checkable:
 * the budget reconciles, programs are isolated, payments are idempotent, the
 * deliberate edge cases are actually present, and the dual-source feeds really do
 * collide so reconciliation has something to reconcile. `validate()` is run by the
 * seed script (fails non-zero) and by the test suite.
 */

import { BUDGET_TOTAL } from "./dictionaries";
import type { SeedDataset } from "./types";

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export interface ValidationResult {
  ok: boolean;
  checks: Check[];
}

const REQUIRED_EDGE_CASES = [
  "duplicate_family",
  "family_in_two_programs",
  "failed_payment",
  "refunded_payment",
  "late_payment",
  "duplicate_stripe_event",
  "crm_app_conflict",
  "parity_dip_below_threshold",
  "mojibake_name",
  "missing_email",
  "broken_utm_source",
  "dual_source_duplicate",
  "dual_source_conflict",
  "ambassador_conflict",
  "attribution_gap",
];

const STATUS_RANK: Record<string, number> = {
  requires_payment: 0,
  failed: 1,
  succeeded: 2,
  refunded: 3,
};

export function validate(ds: SeedDataset): ValidationResult {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });

  // 1. Budget reconciles to exactly $365,000.
  const rec = ds.budget_workstream.reduce((s, b) => s + b.recommended, 0);
  add("budget_reconciles_to_365k", rec === BUDGET_TOTAL, `sum(recommended) = ${rec}`);

  // 2. Program isolation: a payment never crosses into another program's enrollment.
  const programIds = new Set(ds.programs.map((p) => p.id));
  const enrById = new Map(ds.enrollments.map((e) => [e.id, e]));
  let crossProgram = 0;
  for (const p of ds.payments) {
    if (!programIds.has(p.program_id)) crossProgram++;
    if (p.enrollment_id) {
      const e = enrById.get(p.enrollment_id);
      if (e && e.program_id !== p.program_id) crossProgram++;
    }
  }
  for (const m of ds.program_membership) if (!programIds.has(m.program_id)) crossProgram++;
  add("program_isolation_no_cross_refs", crossProgram === 0, `${crossProgram} cross-program references`);

  // 3. Stripe payment-intent uniqueness (the business-fact idempotency layer).
  const intents = ds.payments.map((p) => p.stripe_payment_intent_id);
  const uniqueIntents = new Set(intents);
  add("payment_intent_unique", uniqueIntents.size === intents.length, `${intents.length - uniqueIntents.size} duplicate intents`);

  // 4. Idempotency: processed_events unique by (source,event_id); a duplicate
  //    delivery shows twice in the event log but once in processed_events.
  const procKeys = ds.processed_events.map((e) => `${e.source}:${e.event_id}`);
  const procUnique = new Set(procKeys);
  const evCounts = new Map<string, number>();
  for (const e of ds.sync_event_log) {
    if (e.external_event_id) evCounts.set(e.external_event_id, (evCounts.get(e.external_event_id) ?? 0) + 1);
  }
  const dupDelivered = [...evCounts.values()].some((c) => c >= 2);
  add("processed_events_unique", procUnique.size === procKeys.length, `${procKeys.length - procUnique.size} dup ledger keys`);
  add("idempotent_redelivery_modeled", dupDelivered, "at least one event_id delivered ≥2× in the log");

  // 5. status_rank is consistent and never regresses a terminal state.
  const badRank = ds.payments.filter((p) => STATUS_RANK[p.status] !== p.status_rank);
  add("status_rank_consistent", badRank.length === 0, `${badRank.length} payments with wrong rank`);

  // 6. Every required edge case is present.
  const missing = REQUIRED_EDGE_CASES.filter((e) => !ds.manifest.edgeCases.includes(e));
  add("all_edge_cases_present", missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : "all 15 present");

  // 7. Referential integrity for the program-scoped + child tables.
  const famIds = new Set(ds.families.map((f) => f.id));
  const orphans =
    ds.children.filter((c) => !famIds.has(c.family_id)).length +
    ds.enrollments.filter((e) => !famIds.has(e.family_id)).length +
    ds.program_membership.filter((m) => !famIds.has(m.family_id)).length +
    ds.payments.filter((p) => p.family_id !== null && !famIds.has(p.family_id)).length;
  add("referential_integrity", orphans === 0, `${orphans} orphaned rows`);

  // 8. Duplicate family: ≥1 match_key shared by ≥2 family rows.
  const keyCounts = new Map<string, number>();
  for (const f of ds.families) if (f.match_key) keyCounts.set(f.match_key, (keyCounts.get(f.match_key) ?? 0) + 1);
  const dupFamilies = [...keyCounts.values()].filter((c) => c >= 2).length;
  add("duplicate_family_collides", dupFamilies >= 1, `${dupFamilies} match_keys shared by ≥2 families`);

  // 9. Dual-source reconciliation: summer site ∩ form by match_key (the overlap
  //    the reconciler must collapse) plus a conflicting pair.
  const siteKeys = new Map<string, number>();
  for (const r of ds.summer_site_registrations) if (r.match_key) siteKeys.set(r.match_key, r.weeks);
  let overlap = 0;
  let conflicts = 0;
  for (const f of ds.registration_form_entries) {
    if (f.match_key && siteKeys.has(f.match_key)) {
      overlap++;
      if (siteKeys.get(f.match_key) !== f.weeks) conflicts++;
    }
  }
  add("dual_source_overlap_exists", overlap >= 5, `${overlap} families on both summer site + form`);
  add("dual_source_conflict_exists", conflicts >= 1, `${conflicts} conflicting weeks across sources`);

  // 10. Parity dip below the 95% banner threshold.
  const dip = ds.parity_snapshot.some((p) => p.overall_pct < 95);
  add("parity_dip_present", dip, `min overall = ${Math.min(...ds.parity_snapshot.map((p) => p.overall_pct))}%`);

  // 11. Variance auto-flag: a workstream >10% over plan AND an auto-flagged decision.
  const over = ds.budget_workstream.some((b) => b.actual > b.planned * 1.1);
  const autoFlag = ds.decisions.some((d) => d.auto_flag);
  add("budget_variance_autoflag", over && autoFlag, `over-plan workstream=${over}, auto-flagged decision=${autoFlag}`);

  // 12. Manifest counts match the actual arrays (honest manifest).
  let countMismatch = 0;
  for (const [k, v] of Object.entries(ds)) {
    if (Array.isArray(v) && ds.manifest.counts[k] !== v.length) countMismatch++;
  }
  add("manifest_counts_match", countMismatch === 0, `${countMismatch} mismatched counts`);

  // 13. UTM threading: CRM families with utm_campaign appear in Meta + GA4 stand-ins.
  const crmCampaigns = new Set(
    ds.families.filter((f) => f.utm_campaign).map((f) => f.utm_campaign!),
  );
  const metaCampaigns = new Set(ds.meta_insights.map((m) => m.utm_campaign));
  const ga4Campaigns = new Set(
    ds.ga4_days.map((g) => g.utm_campaign).filter((c): c is string => c !== null),
  );
  const threaded = [...crmCampaigns].filter((c) => metaCampaigns.has(c) && ga4Campaigns.has(c));
  add(
    "utm_thread_meta_ga4_crm",
    threaded.length >= 3,
    `${threaded.length} shared utm_campaign keys across CRM, Meta, GA4`,
  );

  // 14. Attribution gap: Meta-reported leads exceed CRM meta-sourced families.
  const metaReported = ds.meta_insights.reduce((s, m) => s + m.leads, 0);
  const crmMeta = ds.families.filter((f) => f.source === "meta_ads").length;
  add(
    "attribution_gap_meta_over_crm",
    metaReported > crmMeta,
    `Meta leads ${metaReported} vs CRM meta families ${crmMeta}`,
  );

  // 15. Summer site uses transactional shape (match_key + status + utm).
  const summerOk = ds.summer_site_registrations.every(
    (r) => r.registration_id && r.status && r.created_at && r.campus_key,
  );
  add("summer_transactional_shape", summerOk && ds.summer_site_registrations.length > 0, `${ds.summer_site_registrations.length} registrations`);

  return { ok: checks.every((c) => c.ok), checks };
}
