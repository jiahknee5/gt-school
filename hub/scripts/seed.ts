import { pathToFileURL } from "node:url";
import { loadEnvLocal } from "./_env";
import { clearGenerated } from "./clear";
import {
  withProgram,
  withoutProgram,
  closeDb,
  type ScopedSql,
} from "../lib/db";
import { matchKey } from "../lib/connectors/SourceConnector";
import { makeRng } from "../lib/seed/rng";
import { FIRST_NAMES, LAST_NAMES } from "../lib/seed/dictionaries";

loadEnvLocal();

/* ======================================================================== *
 * GT Marketing Hub — LIVE Supabase seed (programmatic, idempotent, RLS-true).
 *
 * Unlike scripts/gen-fixtures.ts (the OFFLINE backbone-fixture generator that
 * writes seed-data/*.json + load.sql), this seeds the LIVE database through
 * lib/db.ts: globals on the raw app_rw connection, and the 3 program-scoped
 * tables THROUGH withProgram() so RLS + WITH CHECK is actually exercised.
 *
 * The numbers are CONSTRUCTED, not sampled-and-hoped. Every rate-bearing
 * marginal the spec calls out (engagement tier -> deposit, income -> deposit,
 * geo split, channel conversion, grade, deposit total) is laid down as an exact
 * contingency table over a fall "applicant pool", so tests/seed-fixtures
 * assert them tightly. See PRD/GT_Marketing_Hub_Spec.md (Module 1 widgets,
 * Module 5 Nurture, Module 10 Budget).
 *
 * STORAGE NOTE: 0001_backbone.families carries only the field-AUTHORITATIVE
 * columns — there is no column for engagement_tier / geo / segment / persona.
 * Overloading the authoritative columns would corrupt the parity model (the
 * whole point of the backbone), so these 4 attributes live as rows in the
 * generic field_state table (field = 'engagement_tier' | 'geo' | 'segment' |
 * 'persona'), always in_parity. The sync-parity demo is computed over ONLY the
 * 8 AUTHORITY fields (SYNCED_FIELDS), so attribute rows never touch 71%/98%.
 * ======================================================================== */

const rng = makeRng(20260626);
const uuid = () => rng.uuid();
/** Expand [[value, count], …] into a flat array with those multiplicities. */
function deck<T>(specs: [T, number][]): T[] {
  const out: T[] = [];
  for (const [v, n] of specs) for (let i = 0; i < n; i++) out.push(v);
  return out;
}

const DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "icloud.com", "proton.me"];
// Mis-decoded UTF-8 (mojibake) — what a broken import leaves behind.
const MOJIBAKE = [
  "JosÃ©", "RenÃ©e", "MÃ¼ller", "BjÃ¶rk", "ZoÃ«", "FranÃ§ois",
  "AndrÃ©a", "NÃºÃ±ez", "SÃ¸ren", "â€‹GhostName", "Ã…sa", "Ã‡aÄŸla",
];
const PERSONAS: [string, number][] = [
  ["Striving Optimizer", 25], ["Disillusioned Public Parent", 22],
  ["Gifted Advocate", 18], ["Roadschooling Family", 12],
  ["Alpha-Curious Tech Parent", 12], ["ESA Maximizer", 7], ["Microschool Switcher", 4],
];
// Spec-named channels: X is the pre-sold engine, Facebook the volume trap.
const CHANNELS = [
  "x", "facebook", "instagram", "organic", "referral",
  "email", "word_of_mouth", "direct", "community", "website",
] as const;
const AREA_CODES = ["512", "737", "214", "469", "210", "713", "212", "646", "310", "415", "305", "617"];

/** The 8 field-AUTHORITATIVE fields the parity demo is computed over. */
const PARITY_FIELDS = [
  "income_band", "tefa_status", "source", "grade",
  "funnel_stage", "lead_score", "lifecycle_stage", "email",
] as const;

type Family = {
  id: string;
  hubspot_contact_id: string | null;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  funnel_stage: string | null;
  tefa_status: string | null;
  income_band: string | null;
  grade: string | null;
  lifecycle_stage: string | null;
  lead_score: number | null;
  source: string | null;
  match_key: string | null;
  // JS-only attributes -> persisted into field_state (NOT families columns):
  tier: string;
  geo: string;
  segment: string;
  persona: string;
};
type Child = { id: string; family_id: string; first_name: string; grade: string };

const FAMILY_COLS = [
  "id", "hubspot_contact_id", "email", "phone", "first_name", "last_name",
  "funnel_stage", "tefa_status", "income_band", "grade", "lifecycle_stage",
  "lead_score", "source", "match_key",
] as const;
const PAYMENT_COLS = [
  "id", "program_id", "family_id", "enrollment_id", "stripe_payment_intent_id",
  "stripe_event_id", "amount", "status", "status_rank", "occurred_at",
] as const;

let hsSeq = 1000;
let emailSeq = 1;

function gradeFromBucket(b: string): string {
  if (b === "K2") return rng.pick(["K", "1", "2"]);
  if (b === "G35") return rng.pick(["3", "4", "5"]);
  if (b === "G68") return rng.pick(["6", "7", "8"]);
  return rng.pick(["9", "10", "11", "12"]); // G912 — the "dead" grades
}
function leadScore(funnel: string | null, tier: string): number {
  const base: Record<string, [number, number]> = {
    deposit: [72, 95], shadow_day: [58, 85], applicant: [42, 72], lead: [5, 45],
  };
  const [lo, hi] = base[funnel ?? "lead"] ?? base.lead;
  const bump = tier === "clicked" ? 8 : tier === "opened" ? 3 : 0;
  return Math.max(0, Math.min(100, rng.int(lo, hi) + bump));
}
function lifecycleFromFunnel(funnel: string | null): string {
  if (funnel === "deposit") return "customer";
  if (funnel === "shadow_day") return "opportunity";
  if (funnel === "applicant") return "marketingqualifiedlead";
  return rng.pick(["lead", "subscriber"]);
}

function mkFamily(opts: {
  funnel: string | null;
  tier: string;
  income: string | null;
  source: string | null;
  grade: string | null;
  synced?: boolean;
  garbled?: boolean;
  email?: string | null;
}): Family {
  const garbled = opts.garbled ?? false;
  const first = garbled ? rng.pick(MOJIBAKE) : rng.pick(FIRST_NAMES);
  const last = garbled ? rng.pick(MOJIBAKE) : rng.pick(LAST_NAMES);
  let email: string | null;
  if (opts.email !== undefined) email = opts.email;
  else if (garbled && rng.bool(0.5)) email = null; // some mojibake rows lose their email too
  else
    email = `${rng.pick(FIRST_NAMES).toLowerCase()}.${last
      .toLowerCase()
      .replace(/[^a-z]/g, "")}.${emailSeq++}@${rng.pick(DOMAINS)}`;
  const phone = `(${rng.pick(AREA_CODES)}) 555-${rng.digits(4)}`;
  const synced = opts.synced ?? rng.bool(0.9);
  return {
    id: uuid(),
    hubspot_contact_id: synced ? `hs-${hsSeq++}` : null,
    email,
    phone,
    first_name: first,
    last_name: last,
    funnel_stage: opts.funnel,
    tefa_status: null, // set in segment pass
    income_band: opts.income,
    grade: opts.grade,
    lifecycle_stage: null, // set in global pass
    lead_score: null, // set in global pass
    source: opts.source,
    match_key: matchKey({ email, phone, firstName: first, lastName: last }),
    tier: opts.tier,
    geo: "",
    segment: "",
    persona: "",
  };
}

export async function seed(): Promise<void> {
  const programs = await withoutProgram(
    (sql) => sql<{ id: string; key: string }[]>`select id, key from programs`,
  );
  const fall = programs.find((p) => p.key === "fall_enrollment");
  const summer = programs.find((p) => p.key === "summer_camp");
  if (!fall || !summer) {
    throw new Error("programs summer_camp/fall_enrollment missing — run 0001 first.");
  }

  console.log("seed: clearing prior generated rows (idempotent)…");
  await clearGenerated(programs);

  /* ---------------- 1. FALL APPLICANT POOL (518): exact contingency tables --------- */
  // 112 deposits + 406 non-deposits. Deposit is a function of TIER only (so the
  // tier marginal is exact); income / channel / grade are independent partitions
  // over the same deposit & non-deposit sets, so THEIR marginals land too.
  const depTier = rng.shuffle(deck([["clicked", 26], ["opened", 24], ["cold", 62]]));
  const ndTier = rng.shuffle(deck([["clicked", 24], ["opened", 56], ["cold", 326]]));
  const depInc = rng.shuffle(deck([["160K+", 30], ["65-160K", 44], ["<65K", 38]]));
  const ndInc = rng.shuffle(deck([["160K+", 90], ["65-160K", 156], ["<65K", 160]]));
  const depChan = rng.shuffle(deck<(typeof CHANNELS)[number]>([
    ["x", 19], ["referral", 16], ["email", 13], ["word_of_mouth", 10], ["organic", 13],
    ["instagram", 9], ["direct", 7], ["community", 5], ["facebook", 12], ["website", 8],
  ]));
  const ndChan = rng.shuffle(deck<(typeof CHANNELS)[number]>([
    ["x", 26], ["referral", 24], ["email", 22], ["word_of_mouth", 20], ["organic", 37],
    ["instagram", 36], ["direct", 33], ["community", 25], ["facebook", 141], ["website", 42],
  ]));
  const depGrade = rng.shuffle(deck([["K2", 75], ["G35", 27], ["G68", 10]]));
  const ndGrade = rng.shuffle(deck([["K2", 145], ["G35", 110], ["G68", 91], ["G912", 60]]));

  const deposits: Family[] = [];
  for (let i = 0; i < 112; i++)
    deposits.push(mkFamily({ funnel: "deposit", tier: depTier[i], income: depInc[i], source: depChan[i], grade: gradeFromBucket(depGrade[i]) }));
  const nonDeposits: Family[] = [];
  for (let i = 0; i < 406; i++)
    nonDeposits.push(mkFamily({ funnel: i % 2 === 0 ? "applicant" : "shadow_day", tier: ndTier[i], income: ndInc[i], source: ndChan[i], grade: gradeFromBucket(ndGrade[i]) }));
  const applicantPool = deposits.concat(nonDeposits); // 518

  /* ---------------- 2. NURTURE LEAD BASE (1177) ---------------- */
  const leadTier = rng.shuffle(deck([["clicked", 118], ["opened", 235], ["cold", 824]]));
  const leadInc = rng.shuffle(deck([["<65K", 412], ["65-160K", 530], ["160K+", 235]]));
  const leads: Family[] = [];
  for (let i = 0; i < 1177; i++) {
    const garbled = i < 12; // a dozen mojibake / missing-field records
    leads.push(mkFamily({
      funnel: "lead", tier: leadTier[i],
      income: garbled ? null : leadInc[i],
      source: rng.pick(CHANNELS),
      grade: garbled ? null : rng.pick(["PreK", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]),
      garbled,
    }));
  }

  /* ---------------- 3. SUMMER CAMP AUDIENCE (300, each a child seat) ------------- */
  const summerFamilies: Family[] = [];
  for (let i = 0; i < 300; i++)
    summerFamilies.push(mkFamily({
      funnel: null, // separate audience/timeline from the fall funnel
      tier: rng.weighted([["clicked", 15], ["opened", 30], ["cold", 55]]),
      income: rng.pick(["<65K", "65-160K", "160K+"]),
      source: rng.pick(CHANNELS),
      grade: rng.pick(["PreK", "K", "1", "2", "3", "4", "5", "6", "7", "8"]),
    }));

  /* ---------------- 4. STRESS-CASE families (Phase-1 proofs) ---------------- */
  const sharedA = mkFamily({ funnel: null, tier: "opened", income: "65-160K", source: "referral", grade: "2" });
  const sharedB = mkFamily({ funnel: null, tier: "cold", income: "<65K", source: "word_of_mouth", grade: "2" });
  const twoKids = mkFamily({ funnel: "applicant", tier: "clicked", income: "160K+", source: "x", grade: "1" });
  const dupEmail = `dana.kapoor.dup.${emailSeq++}@gtfamilies.test`;
  const dupSummer = mkFamily({ funnel: null, tier: "opened", income: "160K+", source: "website", grade: "3", email: dupEmail });
  const dupForm = mkFamily({ funnel: null, tier: "opened", income: "160K+", source: "community", grade: "3", email: dupEmail });
  const stress: Family[] = [sharedA, sharedB, twoKids, dupSummer, dupForm];

  const allFamilies: Family[] = [...applicantPool, ...leads, ...summerFamilies, ...stress];
  const N = allFamilies.length;

  /* ---------------- 5. global attribute passes ---------------- */
  // GEO: stratify the fall applicant pool by (income_band x deposit) so 160K+
  // converts at ~the same rate in TX and out-of-state ("regardless of geo"),
  // then assign the remaining families a balanced remainder so the OVERALL
  // split stays ~50/50. (A purely random geo deck leaves the small 160K+
  // deposit cell, n~30, too noisy across geos.)
  const apIds = new Set(applicantPool.map((f) => f.id));
  const stratCounters = new Map<string, number>();
  for (const f of applicantPool) {
    const key = `${f.income_band}|${f.funnel_stage === "deposit"}`;
    const c = stratCounters.get(key) ?? 0;
    f.geo = c % 2 === 0 ? "TX" : "OOS";
    stratCounters.set(key, c + 1);
  }
  const half = Math.round(N / 2);
  const apTx = applicantPool.filter((f) => f.geo === "TX").length;
  const rest = allFamilies.filter((f) => !apIds.has(f.id));
  const restTx = Math.max(0, Math.min(rest.length, half - apTx));
  const restGeo = rng.shuffle(deck([["TX", restTx], ["OOS", rest.length - restTx]]));
  rest.forEach((f, i) => (f.geo = restGeo[i]));

  const T1 = 60;
  const T2 = Math.round((N - T1) * (3100 / 4224)); // T2 : T3 == 3100 : 1124
  const T3 = N - T1 - T2;
  const segDeck = rng.shuffle(deck([["T1", T1], ["T2", T2], ["T3", T3]]));
  allFamilies.forEach((f, i) => {
    f.segment = segDeck[i];
    f.persona = rng.weighted(PERSONAS);
    f.lead_score = leadScore(f.funnel_stage, f.tier);
    f.lifecycle_stage = lifecycleFromFunnel(f.funnel_stage);
    // T3 carries the ESA waitlist sub-buckets (Spec 5b); others frozen/eligible.
    if (f.tefa_status === null)
      f.tefa_status = f.segment === "T3"
        ? rng.weighted([["esa_planned", 4], ["esa_ineligible", 3], ["no_indicator", 5]])
        : rng.weighted([["frozen_2027", 5], ["eligible", 3], ["not_applicable", 2]]);
  });

  /* ---------------- 6. CHILDREN (camp seats) ---------------- */
  const children: Child[] = [];
  const mkChild = (familyId: string, grade?: string): Child => {
    const c: Child = { id: uuid(), family_id: familyId, first_name: rng.pick(FIRST_NAMES), grade: grade ?? rng.pick(["PreK", "K", "1", "2", "3", "4", "5", "6"]) };
    children.push(c);
    return c;
  };
  const summerChildOf = new Map<string, Child>();
  for (const f of summerFamilies) summerChildOf.set(f.id, mkChild(f.id, f.grade ?? undefined));
  const childShared = mkChild(sharedA.id, "2"); // ONE child, claimed by two parent-families
  const childTwoA = mkChild(twoKids.id, "1"); // -> summer
  const childTwoB = mkChild(twoKids.id, "5"); // -> fall
  const bothFamily = deposits[0]; // a real fall deposit, ALSO enrolled in summer
  const childBoth = mkChild(bothFamily.id, "4");

  /* ============================ WRITE: globals (raw app_rw) ============================ */
  console.log(`seed: inserting ${N} families, ${children.length} children…`);
  await withoutProgram(async (sql) => {
    await insertBatched(sql, "families", allFamilies as unknown as Record<string, unknown>[], FAMILY_COLS as unknown as string[]);
    await insertBatched(sql, "children", children as unknown as Record<string, unknown>[], ["id", "family_id", "first_name", "grade"]);

    const now = new Date();
    // attribute field_state rows (always in_parity; EXCLUDED from the parity demo)
    const attrRows: Record<string, unknown>[] = [];
    for (const f of allFamilies)
      for (const [field, val] of [["engagement_tier", f.tier], ["geo", f.geo], ["segment", f.segment], ["persona", f.persona]] as const)
        attrRows.push({ entity: "family", entity_id: f.id, field, app_value: val, hs_value: val, app_updated_at: now, hs_updated_at: now, in_parity: true, last_checked_at: now });
    await insertBatched(sql, "field_state", attrRows, ["entity", "entity_id", "field", "app_value", "hs_value", "app_updated_at", "hs_updated_at", "in_parity", "last_checked_at"]);

    // parity field_state rows over the 8 AUTHORITY fields: income_band == 71%, overall == 98%.
    const parityPlan: Record<string, { rows: number; out: number }> = {
      income_band: { rows: 100, out: 29 }, // 71%
      tefa_status: { rows: 130, out: 13 }, // 90%
      source: { rows: 160, out: 16 }, // 90%
      grade: { rows: 502, out: 0 },
      funnel_stage: { rows: 502, out: 0 },
      lead_score: { rows: 502, out: 0 },
      lifecycle_stage: { rows: 502, out: 0 },
      email: { rows: 502, out: 0 },
    };
    const altIncome: Record<string, string> = { "160K+": "65-160K", "65-160K": "<65K", "<65K": "65-160K" };
    const parityRows: Record<string, unknown>[] = [];
    const fieldStats: Record<string, number> = {};
    let totRows = 0, totIn = 0;
    for (const field of PARITY_FIELDS) {
      const plan = parityPlan[field];
      const sample = applicantPool.slice(0, plan.rows);
      let inCount = 0;
      sample.forEach((f, i) => {
        const out = i < plan.out;
        const appVal = String((f as Record<string, unknown>)[field] ?? "");
        let hsVal = appVal;
        if (out) {
          if (field === "income_band") hsVal = altIncome[appVal] ?? "unknown";
          else if (field === "tefa_status") hsVal = "no_indicator";
          else if (field === "source") hsVal = "organic";
          else hsVal = appVal + "_drift";
        } else inCount++;
        parityRows.push({ entity: "family", entity_id: f.id, field, app_value: appVal, hs_value: hsVal, app_updated_at: now, hs_updated_at: now, in_parity: !out, last_checked_at: now });
      });
      fieldStats[field] = Math.round((inCount / plan.rows) * 1000) / 10;
      totRows += plan.rows;
      totIn += inCount;
    }
    await insertBatched(sql, "field_state", parityRows, ["entity", "entity_id", "field", "app_value", "hs_value", "app_updated_at", "hs_updated_at", "in_parity", "last_checked_at"]);

    const overallPct = Math.round((totIn / totRows) * 10000) / 100;
    await sql`insert into parity_snapshot (scope, overall_pct, fields)
      values ('overall', ${overallPct}, ${sql.json({ ...fieldStats, overall: overallPct })})`;
    console.log(`seed:   parity -> income_band ${fieldStats.income_band}%, overall ${overallPct}%`);

    // budget: committed reconciles to $365,000; guerrilla is +15% over plan (>10%).
    await sql`update budget_workstream set committed = 204000, actual = 150000 where key = 'grassroots'`;
    await sql`update budget_workstream set committed = 90000,  actual = 55000  where key = 'thought_leadership'`;
    await sql`update budget_workstream set committed = 46000,  actual = 43000  where key = 'guerrilla'`;
    await sql`update budget_workstream set committed = 25000,  actual = 18000  where key = 'foundations'`;

    // decisions: >=3 open; one auto-flagged budget-variance; one leadership-only.
    await insertBatched(sql, "decisions", [
      { question: "Guerrilla / earned-media spend is tracking 15% over plan ($46K vs $40K) — approve the overage or pull back?", raised_by: "the Budget Owner", workstream: "guerrilla", recommendation: "Approve the $6,000 overage; the Austin sticker + mural bet is the cheapest driver of X engagement.", budget_ask: 6000, due_date: "2026-07-08", priority: "urgent", status: "open", auto_flag: true },
      { question: "Approve founder travel for Joe to host the August Austin parent panel? (leadership-only decision)", raised_by: "the Content Owner", workstream: "thought_leadership", recommendation: "Approve — the high-conviction 'I follow Alpha on X' cohort over-indexes on in-person proof.", budget_ask: 3500, due_date: "2026-07-15", priority: "urgent", status: "open", auto_flag: false },
      { question: "Launch a 2-week P2P referral sprint targeting K-2 TX families?", raised_by: "the Grassroots Owner", workstream: "grassroots", recommendation: "Yes — K-2 is the 34% deposit sweet spot and TX is half the base.", budget_ask: null, due_date: "2026-07-01", priority: "normal", status: "open", auto_flag: false },
    ], ["question", "raised_by", "workstream", "recommendation", "budget_ask", "due_date", "priority", "status", "auto_flag"]);

    // data quality queue: PERMANENT UTM-broken + AUTO-DETECTED sync-drift.
    await insertBatched(sql, "data_quality_issue", [
      { category: "utm", severity: "blocker", entity: "family", field: "source", description: "UTM attribution broken: form submissions reach Supabase without a resolved utm_source/medium/campaign. Permanent red flag until the form -> Supabase -> HubSpot chain is rebuilt.", status: "open" },
      { category: "sync", severity: "high", entity: "family", field: "income_band", description: "Auto-detected sync drift: income_band parity fell to ~71% (29 of 100 sampled records disagree app vs HubSpot). Raised automatically by the parity watcher.", status: "open" },
      { category: "scoring", severity: "medium", entity: "family", field: "tefa_status", description: "Auto-detected: tefa_status disagrees app vs HubSpot on ~10% of sampled records (HubSpot value known-unreliable for TEFA).", status: "open" },
    ], ["category", "severity", "entity", "field", "description", "status"]);

    // sync_identity_map: the DUAL-SOURCE duplicate (same person, two sources, same match_key).
    await insertBatched(sql, "sync_identity_map", [
      { id: uuid(), local_table: "families", local_id: dupSummer.id, system: "summer_site", external_id: "sum-reg-DUP-001" },
      { id: uuid(), local_table: "families", local_id: dupForm.id, system: "community", external_id: "com-form-DUP-001" },
      { id: uuid(), local_table: "families", local_id: deposits[1].id, system: "hubspot", external_id: deposits[1].hubspot_contact_id ?? "hs-x" },
    ], ["id", "local_table", "local_id", "system", "external_id"]);

    await sql`insert into sync_event_log (source_system, external_event_id, entity, entity_id, change, conflict)
      values ('hubspot', 'evt-income-conflict-1', 'family', ${dupSummer.id}, ${sql.json({ field: "income_band", app: "160K+", hs: "65-160K" })}, true)`;
    await sql`insert into sync_event_log (source_system, external_event_id, entity, entity_id, change, conflict)
      values ('summer_site', 'evt-reg-1', 'family', ${dupSummer.id}, ${sql.json({ op: "registration", source: "summer_site" })}, false)`;
  });

  /* ====================== WRITE: program-scoped THROUGH RLS ====================== */
  const fallMemberships: Record<string, unknown>[] = applicantPool.map((f) => ({ id: uuid(), program_id: fall.id, family_id: f.id, child_id: null, status: "active", source: f.source }));
  fallMemberships.push({ id: uuid(), program_id: fall.id, family_id: twoKids.id, child_id: childTwoB.id, status: "active", source: twoKids.source });
  const fallEnrollIdByFamily = new Map<string, string>();
  const fallEnrollments: Record<string, unknown>[] = applicantPool.map((f) => {
    const id = uuid();
    if (f.funnel_stage === "deposit") fallEnrollIdByFamily.set(f.id, id);
    return { id, program_id: fall.id, family_id: f.id, child_id: null, hubspot_deal_id: `deal-fall-${f.id.slice(0, 8)}`, stage: f.funnel_stage, amount: f.funnel_stage === "deposit" ? 500 : null, paid: f.funnel_stage === "deposit" };
  });
  fallEnrollments.push({ id: uuid(), program_id: fall.id, family_id: twoKids.id, child_id: childTwoB.id, hubspot_deal_id: `deal-fall-${twoKids.id.slice(0, 8)}`, stage: "applicant", amount: null, paid: false });
  const occurred = () => new Date(2026, 5 + rng.int(0, 1), rng.int(1, 28));
  const fallPayments: Record<string, unknown>[] = deposits.map((f) => ({ id: uuid(), program_id: fall.id, family_id: f.id, enrollment_id: fallEnrollIdByFamily.get(f.id) ?? null, stripe_payment_intent_id: `pi_fall_${f.id.slice(0, 12)}`, stripe_event_id: `evt_${uuid().slice(0, 8)}`, amount: 500, status: "succeeded", status_rank: 2, occurred_at: occurred() }));
  const anchor = deposits[2];
  const stressPayments: Record<string, unknown>[] = [
    { id: uuid(), program_id: fall.id, family_id: anchor.id, enrollment_id: null, stripe_payment_intent_id: "pi_stress_normal", stripe_event_id: "evt_norm", amount: 500, status: "succeeded", status_rank: 2, occurred_at: new Date(2026, 5, 20) },
    { id: uuid(), program_id: fall.id, family_id: deposits[3].id, enrollment_id: null, stripe_payment_intent_id: "pi_stress_late", stripe_event_id: "evt_late", amount: 500, status: "succeeded", status_rank: 2, occurred_at: new Date(2026, 7, 25) }, // past the Aug-17 cutoff
    { id: uuid(), program_id: fall.id, family_id: deposits[4].id, enrollment_id: null, stripe_payment_intent_id: "pi_stress_failed", stripe_event_id: "evt_fail", amount: 500, status: "failed", status_rank: 1, occurred_at: new Date(2026, 6, 2) },
  ];

  console.log(`seed: FALL scope -> ${fallMemberships.length} memberships, ${fallEnrollments.length} enrollments, ${fallPayments.length + stressPayments.length}(+dup/reorder) payments…`);
  await withProgram(fall.id, async (sql) => {
    await insertBatched(sql, "program_membership", fallMemberships, ["id", "program_id", "family_id", "child_id", "status", "source"]);
    await insertBatched(sql, "enrollments", fallEnrollments, ["id", "program_id", "family_id", "child_id", "hubspot_deal_id", "stage", "amount", "paid"]);
    await insertBatched(sql, "payments", fallPayments, PAYMENT_COLS as unknown as string[]);
    await insertBatched(sql, "payments", stressPayments, PAYMENT_COLS as unknown as string[]);

    // DUPLICATE webhook: same intent twice; the 2nd is a no-op (unique constraint).
    await sql`insert into payments (program_id, family_id, stripe_payment_intent_id, amount, status, status_rank, occurred_at)
      values (${fall.id}, ${anchor.id}, 'pi_stress_dup', 500, 'succeeded', 2, ${new Date(2026, 6, 5)})`;
    await sql`insert into payments (program_id, family_id, stripe_payment_intent_id, amount, status, status_rank, occurred_at)
      values (${fall.id}, ${anchor.id}, 'pi_stress_dup', 500, 'succeeded', 2, ${new Date(2026, 6, 5)})
      on conflict (stripe_payment_intent_id) do nothing`;

    // REFUND-then-SUCCEEDED out of order: refunded(rank 3) lands first; a late
    // succeeded(rank 2) must NOT regress the terminal state (guard on status_rank).
    await sql`insert into payments (program_id, family_id, stripe_payment_intent_id, amount, status, status_rank, occurred_at)
      values (${fall.id}, ${anchor.id}, 'pi_stress_reorder', 500, 'refunded', 3, ${new Date(2026, 6, 10)})`;
    await sql`insert into payments (program_id, family_id, stripe_payment_intent_id, amount, status, status_rank, occurred_at)
      values (${fall.id}, ${anchor.id}, 'pi_stress_reorder', 500, 'succeeded', 2, ${new Date(2026, 6, 11)})
      on conflict (stripe_payment_intent_id) do update
        set status = excluded.status, status_rank = excluded.status_rank,
            amount = excluded.amount, occurred_at = excluded.occurred_at
        where excluded.status_rank > payments.status_rank`;
  });

  // SUMMER: registrations (children = seats), ~70% paid; + the seat-dedup stress cases.
  const summerMemberships: Record<string, unknown>[] = [];
  const summerEnrollments: Record<string, unknown>[] = [];
  const summerPayments: Record<string, unknown>[] = [];
  for (const f of summerFamilies) {
    const child = summerChildOf.get(f.id)!;
    const paid = rng.bool(0.7);
    const price = rng.pick([1450, 1450, 725]); // 2-week vs 1-week (SUMMER_WEEK_PRICE)
    const enrId = uuid();
    summerMemberships.push({ id: uuid(), program_id: summer.id, family_id: f.id, child_id: child.id, status: "active", source: f.source });
    summerEnrollments.push({ id: enrId, program_id: summer.id, family_id: f.id, child_id: child.id, hubspot_deal_id: `deal-sum-${f.id.slice(0, 8)}`, stage: paid ? "paid" : "registered", amount: price, paid });
    if (paid) summerPayments.push({ id: uuid(), program_id: summer.id, family_id: f.id, enrollment_id: enrId, stripe_payment_intent_id: `pi_sum_${f.id.slice(0, 12)}`, stripe_event_id: `evt_${uuid().slice(0, 8)}`, amount: price, status: "succeeded", status_rank: 2, occurred_at: new Date(2026, 3 + rng.int(0, 2), rng.int(1, 28)) });
  }
  // STRESS — both-programs family (also a fall deposit): add a summer seat
  { const enrId = uuid();
    summerMemberships.push({ id: uuid(), program_id: summer.id, family_id: bothFamily.id, child_id: childBoth.id, status: "active", source: "website" });
    summerEnrollments.push({ id: enrId, program_id: summer.id, family_id: bothFamily.id, child_id: childBoth.id, hubspot_deal_id: "deal-sum-both", stage: "paid", amount: 1450, paid: true });
    summerPayments.push({ id: uuid(), program_id: summer.id, family_id: bothFamily.id, enrollment_id: enrId, stripe_payment_intent_id: "pi_sum_both", stripe_event_id: "evt_both", amount: 1450, status: "succeeded", status_rank: 2, occurred_at: new Date(2026, 4, 10) }); }
  // STRESS — two parent-families share ONE child (seat counts once)
  { const enrId = uuid();
    summerMemberships.push({ id: uuid(), program_id: summer.id, family_id: sharedA.id, child_id: childShared.id, status: "active", source: "referral" });
    summerMemberships.push({ id: uuid(), program_id: summer.id, family_id: sharedB.id, child_id: childShared.id, status: "active", source: "word_of_mouth" });
    summerEnrollments.push({ id: enrId, program_id: summer.id, family_id: sharedA.id, child_id: childShared.id, hubspot_deal_id: "deal-sum-shared", stage: "paid", amount: 1450, paid: true });
    summerPayments.push({ id: uuid(), program_id: summer.id, family_id: sharedA.id, enrollment_id: enrId, stripe_payment_intent_id: "pi_sum_shared", stripe_event_id: "evt_shared", amount: 1450, status: "succeeded", status_rank: 2, occurred_at: new Date(2026, 4, 12) }); }
  // STRESS — one family, two children across the two programs (summer child here; fall child above)
  { const enrId = uuid();
    summerMemberships.push({ id: uuid(), program_id: summer.id, family_id: twoKids.id, child_id: childTwoA.id, status: "active", source: "x" });
    summerEnrollments.push({ id: enrId, program_id: summer.id, family_id: twoKids.id, child_id: childTwoA.id, hubspot_deal_id: "deal-sum-twokids", stage: "paid", amount: 725, paid: true });
    summerPayments.push({ id: uuid(), program_id: summer.id, family_id: twoKids.id, enrollment_id: enrId, stripe_payment_intent_id: "pi_sum_twokids", stripe_event_id: "evt_twokids", amount: 725, status: "succeeded", status_rank: 2, occurred_at: new Date(2026, 4, 14) }); }

  console.log(`seed: SUMMER scope -> ${summerMemberships.length} memberships, ${summerEnrollments.length} enrollments, ${summerPayments.length} payments…`);
  await withProgram(summer.id, async (sql) => {
    await insertBatched(sql, "program_membership", summerMemberships, ["id", "program_id", "family_id", "child_id", "status", "source"]);
    await insertBatched(sql, "enrollments", summerEnrollments, ["id", "program_id", "family_id", "child_id", "hubspot_deal_id", "stage", "amount", "paid"]);
    await insertBatched(sql, "payments", summerPayments, PAYMENT_COLS as unknown as string[]);
  });

  console.log(`seed: done. families=${N}, fall deposits=112, summer regs=${summerFamilies.length}, children=${children.length}.`);
}

async function insertBatched(
  sql: ScopedSql,
  table: string,
  rows: Record<string, unknown>[],
  cols: readonly string[],
  size = 400,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    const batch = rows.slice(i, i + size);
    if (batch.length === 0) continue;
    await sql`insert into ${sql(table)} ${sql(batch, ...(cols as string[]))}`;
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  seed()
    .then(() => closeDb())
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error("seed failed:", err);
      await closeDb().catch(() => {});
      process.exit(1);
    });
}
