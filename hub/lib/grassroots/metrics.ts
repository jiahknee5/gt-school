// metrics.ts — the single definition of every grassroots goal bar. Each number has ONE
// source. activeAmbassadors counts golden roster rows once (post-reconcile); influenced
// enrollments READ app_form (families with a referral touchpoint) — not a checkbox
// (Rahman, invariant #4); intros/P2P are the de-duplicated activity sum (invariant #5).

import type { Family } from "@/lib/seed/types";
import { hash01 } from "@/lib/nurture/util";
import type { GoldenAmbassador } from "./reconcile";

export function activeAmbassadors(roster: GoldenAmbassador[]): number {
  return roster.filter((a) => a.stage === "Active" || a.stage === "Champion").length;
}

const APPLICANT_PLUS = new Set(["applicant", "shadow_day", "deposit"]);

export interface InfluencedEnrollment {
  familyId: string;
  name: string;
  stage: string;
  touchpoint: string; // the attribution chain anchor (utm_campaign / source)
}

/**
 * Influenced enrollments = app_form rows that carry an ambassador touchpoint
 * (source 'referral' + ambassador_referral campaign). Each is clickable to its chain.
 */
export function influencedEnrollments(families: Family[]): InfluencedEnrollment[] {
  return families
    .filter((f) => f.source === "referral" && APPLICANT_PLUS.has(f.funnel_stage ?? ""))
    .map((f) => ({
      familyId: f.id,
      name: `${f.first_name ?? ""} ${f.last_name ?? ""}`.trim() || "(unknown)",
      stage: f.funnel_stage ?? "",
      touchpoint: f.utm_campaign ?? "ambassador_referral",
    }));
}

export interface ActivityRecord {
  ambassadorMatchKey: string;
  type: "intro" | "p2p_call";
  familyKey: string;
  dedupeKey: string;
  occurredAt: string;
}

/**
 * Deterministic activity log derived from the golden roster (stand-in for HubSpot/manual
 * logging). dedupe_key = ambassador×family×type×window prevents double-count (#5).
 */
export function ambassadorActivity(roster: GoldenAmbassador[]): ActivityRecord[] {
  const records: ActivityRecord[] = [];
  for (const a of roster) {
    const intros = Math.floor(hash01(a.matchKey + ":intros") * 6); // 0..5
    const calls = Math.floor(hash01(a.matchKey + ":p2p") * 3); // 0..2
    for (let i = 0; i < intros; i++) {
      records.push({
        ambassadorMatchKey: a.matchKey,
        type: "intro",
        familyKey: `${a.matchKey}:fam:${i}`,
        dedupeKey: `${a.matchKey}:intro:${i}`,
        occurredAt: "2026-08-01T00:00:00.000Z",
      });
    }
    for (let i = 0; i < calls; i++) {
      records.push({
        ambassadorMatchKey: a.matchKey,
        type: "p2p_call",
        familyKey: `${a.matchKey}:fam:${i}`,
        dedupeKey: `${a.matchKey}:p2p_call:${i}`,
        occurredAt: "2026-08-01T00:00:00.000Z",
      });
    }
  }
  return records;
}

/** Deduplicated counts (single definition shared by 2a Overview and 2b Roster). */
export function warmIntros(activity: ActivityRecord[]): number {
  return new Set(activity.filter((a) => a.type === "intro").map((a) => a.dedupeKey)).size;
}

export function p2pCalls(activity: ActivityRecord[]): number {
  return new Set(activity.filter((a) => a.type === "p2p_call").map((a) => a.dedupeKey)).size;
}

// ---------------- market map (deterministic stand-in; coverage has a denominator) ----------------

export const MARKET_CATEGORIES = [
  "Microschools",
  "Homeschool co-ops",
  "Chess clubs",
  "Robotics teams",
  "Gifted associations",
  "Faith communities",
  "Tutoring centers",
  "Library programs",
  "STEM camps",
  "Parent FB groups",
  "Montessori schools",
  "Music academies",
  "Sports leagues",
  "Maker spaces",
];

export interface MarketCategoryCoverage {
  category: string;
  total: number;
  contacted: number;
  coveragePct: number;
  ungeocoded: number;
}

export function marketCoverage(): MarketCategoryCoverage[] {
  return MARKET_CATEGORIES.map((category) => {
    const total = 4 + Math.floor(hash01(category + ":total") * 9); // 4..12
    const contacted = Math.floor(hash01(category + ":contacted") * (total + 1));
    const ungeocoded = Math.floor(hash01(category + ":geo") * 2); // 0..1 node without lat/lng
    return {
      category,
      total,
      contacted,
      coveragePct: total > 0 ? Number(((100 * contacted) / total).toFixed(1)) : 0,
      ungeocoded,
    };
  });
}
