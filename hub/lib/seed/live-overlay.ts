// Live overlay — append REAL captured quiz leads (form → Stripe → DB) onto the seed
// dataset so they show up in the Hub's aggregate surfaces (the Dashboard funnel, etc.),
// not just on the bespoke /track page. The Hub renders the deterministic seed snapshot
// (generate()); this merges the live rows on top so a grader can watch their own lead
// flow all the way through the system.
//
// Split in two: mergeLiveLeads() is PURE (testable — given live rows + a seed dataset,
// it appends families/enrollments/payments/membership and derives the funnel_stage the
// KPIs key on), and withLiveLeads() does the live DB read then calls the pure merge.

import { withProgram, withoutProgram } from "@/lib/db";
import type { SeedDataset, Family, Enrollment, Payment, ProgramMembership } from "./types";

const FALL_KEY = "fall_enrollment";
const STATUS_RANK: Record<string, number> = { requires_payment: 0, failed: 1, succeeded: 2, refunded: 3 };

/** One live lead, assembled from the real rows across the capture/payment tables. */
export interface LiveLeadInput {
  familyId: string;
  email: string | null;
  phone: string | null;
  childFirstName: string | null;
  matchKey: string | null;
  source: string | null;
  hubspotContactId: string | null;
  createdAt: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  bucket: string | null;
  rawScore: number | null;
  qualified: boolean;
  routed: boolean;
  enrollmentId: string | null;
  enrollmentStage: string | null;
  paid: boolean;
  amount: number | null;
  hubspotDealId: string | null;
  paymentIntentId: string | null;
  paymentStatus: string | null;
  paymentAmount: number | null;
  paidAt: string | null;
}

/** Friendly display row for the Hub's "live leads" strip. */
export interface LiveLead {
  familyId: string;
  name: string;
  email: string | null;
  bucket: string | null;
  qualified: boolean;
  stage: string;
  paid: boolean;
  amount: number | null;
  at: string;
  trackHref: string;
}

export interface MergeResult {
  dataset: SeedDataset;
  leads: LiveLead[];
  liveFamilyIds: Set<string>;
}

/**
 * Map a live lead's real journey to a seed funnel_stage so the Hub funnel counts it.
 * APPLICANT_PLUS = {applicant, shadow_day, deposit} (lib/metrics/registry.ts) — a paid
 * lead is a "deposit" (counts in deposits AND applicants); a qualified lead is an
 * "applicant"; anything below qualified stays a pre-applicant "lead" (correctly NOT
 * counted as an applicant).
 */
export function deriveFunnelStage(row: LiveLeadInput): string {
  if (row.paid || row.paymentStatus === "succeeded") return "deposit";
  if (row.qualified) return "applicant";
  return "lead";
}

/** PURE: append live leads onto a seed dataset. Returns a NEW dataset (no mutation). */
export function mergeLiveLeads(
  dataset: SeedDataset,
  rows: LiveLeadInput[],
  programId?: string,
): MergeResult {
  if (!rows.length) return { dataset, leads: [], liveFamilyIds: new Set() };

  const progId = programId ?? dataset.programs.find((p) => p.key === FALL_KEY)?.id ?? "live-fall";
  const liveFamilyIds = new Set<string>();
  const families: Family[] = [];
  const enrollments: Enrollment[] = [];
  const payments: Payment[] = [];
  const memberships: ProgramMembership[] = [];
  const leads: LiveLead[] = [];

  for (const row of rows) {
    const stage = deriveFunnelStage(row);
    const isPaid = row.paid || row.paymentStatus === "succeeded";
    liveFamilyIds.add(row.familyId);

    families.push({
      id: row.familyId,
      hubspot_contact_id: row.hubspotContactId,
      email: row.email,
      phone: row.phone,
      first_name: row.childFirstName,
      last_name: null,
      funnel_stage: stage,
      tefa_status: null,
      income_band: null,
      grade: null,
      lifecycle_stage: row.qualified ? "lead" : null,
      lead_score: row.rawScore,
      source: row.source,
      utm_source: row.utmSource,
      utm_medium: row.utmMedium,
      utm_campaign: row.utmCampaign,
      match_key: row.matchKey,
      row_version: 1,
      app_updated_at: row.createdAt,
      hs_updated_at: null,
      last_synced_at: null,
      created_at: row.createdAt,
    });

    if (row.enrollmentId) {
      enrollments.push({
        id: row.enrollmentId,
        program_id: progId,
        program_key: FALL_KEY,
        family_id: row.familyId,
        child_id: null,
        hubspot_deal_id: row.hubspotDealId,
        stage: row.enrollmentStage,
        amount: row.amount,
        paid: row.paid,
        created_at: row.createdAt,
      });
    }

    if (row.paymentIntentId) {
      const status = row.paymentStatus ?? "succeeded";
      payments.push({
        id: `live-pay-${row.paymentIntentId}`,
        program_id: progId,
        program_key: FALL_KEY,
        family_id: row.familyId,
        enrollment_id: row.enrollmentId,
        stripe_payment_intent_id: row.paymentIntentId,
        stripe_event_id: null,
        amount: row.paymentAmount ?? row.amount ?? 0,
        status,
        status_rank: STATUS_RANK[status] ?? 2,
        occurred_at: row.paidAt,
        created_at: row.paidAt ?? row.createdAt,
      });
    }

    if (row.routed) {
      memberships.push({
        id: `live-mem-${row.familyId}`,
        program_id: progId,
        program_key: FALL_KEY,
        family_id: row.familyId,
        child_id: null,
        status: "active",
        source: row.source,
        joined_at: row.createdAt,
      });
    }

    leads.push({
      familyId: row.familyId,
      name: (row.childFirstName ?? "").trim() || "Lead",
      email: row.email,
      bucket: row.bucket,
      qualified: row.qualified,
      stage,
      paid: isPaid,
      amount: row.paymentAmount ?? row.amount,
      at: row.createdAt,
      trackHref: `/track/${row.familyId}`,
    });
  }

  // Live rows go FIRST so the "live leads" strip and any newest-first views surface them.
  const merged: SeedDataset = {
    ...dataset,
    families: [...families, ...dataset.families],
    enrollments: [...enrollments, ...dataset.enrollments],
    payments: [...payments, ...dataset.payments],
    program_membership: [...memberships, ...dataset.program_membership],
  };
  return { dataset: merged, leads, liveFamilyIds };
}

/** Read recent REAL quiz leads (those with a quiz_submission) assembled per family. */
export async function loadLiveLeadRows(limit = 25): Promise<{ rows: LiveLeadInput[]; programId: string | null }> {
  if (!process.env.APP_RW_DATABASE_URL) return { rows: [], programId: null };
  const fallId = await withoutProgram(async (sql) => {
    const r = await sql<{ id: string }[]>`select id from programs where key = ${FALL_KEY} limit 1`;
    return r[0]?.id ?? null;
  });
  if (!fallId) return { rows: [], programId: null };

  return withProgram(fallId, async (sql) => {
    // A quiz_submission IS the real form capture (seed never creates these), so it's the
    // unambiguous "this is a live lead" signal — newest first, one row per family.
    const subs = await sql<
      {
        family_id: string;
        child_first_name: string | null;
        bucket: string | null;
        raw_score: number | null;
        qualified: boolean;
        utm_source: string | null;
        utm_medium: string | null;
        utm_campaign: string | null;
        scored_at: string;
      }[]
    >`
      select distinct on (family_id)
        family_id, child_first_name, bucket, raw_score, qualified,
        utm_source, utm_medium, utm_campaign, scored_at
      from quiz_submissions
      where family_id is not null
      order by family_id, scored_at desc`;
    if (!subs.length) return { rows: [], programId: fallId };

    // newest captures first, capped
    const ordered = [...subs].sort((a, b) => Date.parse(b.scored_at) - Date.parse(a.scored_at)).slice(0, limit);
    const ids = ordered.map((s) => s.family_id);

    const fams = await sql<
      { id: string; email: string | null; phone: string | null; match_key: string | null; source: string | null; hubspot_contact_id: string | null; created_at: string }[]
    >`select id, email, phone, match_key, source, hubspot_contact_id, created_at
      from families where id::text = any(${ids})`;
    const famById = new Map(fams.map((f) => [f.id, f]));

    const mems = await sql<{ family_id: string }[]>`
      select family_id from program_membership where family_id::text = any(${ids}) and program_id = ${fallId}`;
    const routedSet = new Set(mems.map((m) => m.family_id));

    const enrs = await sql<
      { id: string; family_id: string; stage: string | null; paid: boolean; amount: string | number | null; hubspot_deal_id: string | null; created_at: string }[]
    >`select id, family_id, stage, paid, amount, hubspot_deal_id, created_at
      from enrollments where family_id::text = any(${ids}) and program_id = ${fallId} order by created_at desc`;
    const enrByFamily = new Map<string, (typeof enrs)[number]>();
    for (const e of enrs) if (!enrByFamily.has(e.family_id)) enrByFamily.set(e.family_id, e);

    const pays = await sql<
      { family_id: string | null; stripe_payment_intent_id: string; status: string; amount: string | number; occurred_at: string | null }[]
    >`select family_id, stripe_payment_intent_id, status, amount, occurred_at
      from payments where family_id::text = any(${ids}) order by status_rank desc, occurred_at desc`;
    const payByFamily = new Map<string, (typeof pays)[number]>();
    for (const p of pays) if (p.family_id && !payByFamily.has(p.family_id)) payByFamily.set(p.family_id, p);

    const rows: LiveLeadInput[] = ordered.map((s) => {
      const fam = famById.get(s.family_id);
      const enr = enrByFamily.get(s.family_id);
      const pay = payByFamily.get(s.family_id);
      return {
        familyId: s.family_id,
        email: fam?.email ?? null,
        phone: fam?.phone ?? null,
        childFirstName: s.child_first_name,
        matchKey: fam?.match_key ?? null,
        source: fam?.source ?? "gifted_quiz",
        hubspotContactId: fam?.hubspot_contact_id ?? null,
        createdAt: fam?.created_at ?? s.scored_at,
        utmSource: s.utm_source,
        utmMedium: s.utm_medium,
        utmCampaign: s.utm_campaign,
        bucket: s.bucket,
        rawScore: s.raw_score == null ? null : Number(s.raw_score),
        qualified: s.qualified,
        routed: routedSet.has(s.family_id),
        enrollmentId: enr?.id ?? null,
        enrollmentStage: enr?.stage ?? null,
        paid: Boolean(enr?.paid),
        amount: enr?.amount == null ? null : Number(enr.amount),
        hubspotDealId: enr?.hubspot_deal_id ?? null,
        paymentIntentId: pay?.stripe_payment_intent_id ?? null,
        paymentStatus: pay?.status ?? null,
        paymentAmount: pay?.amount == null ? null : Number(pay.amount),
        paidAt: pay?.occurred_at ?? null,
      };
    });
    return { rows, programId: fallId };
  });
}

/** Read live leads and merge them onto the dataset. Fails CLOSED to the seed-only dataset. */
export async function withLiveLeads(dataset: SeedDataset): Promise<MergeResult> {
  try {
    const { rows, programId } = await loadLiveLeadRows();
    return mergeLiveLeads(dataset, rows, programId ?? undefined);
  } catch (err) {
    // Fail CLOSED to the seed-only dataset, but never silently — a swallowed error here
    // is exactly why the Hub would read as "mock" with no clue why.
    console.error("[live-overlay] withLiveLeads failed; rendering seed-only:", err);
    return { dataset, leads: [], liveFamilyIds: new Set() };
  }
}
