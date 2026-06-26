// segments.ts — the T1/T2/T3 nurture cohorts + reachability. Reads app_form (families)
// for funnel/TEFA, never HubSpot field values for those (SSOT, invariant #1). T3 is the
// waitlist with the ESA sub-buckets (esa_planned / esa_ineligible / no_indicator). TEFA
// segments are historical/read-only after the freeze (invariant #10).

import type { Family } from "@/lib/seed/types";

export type Tier = "T1" | "T2" | "T3";

export interface SegmentSummary {
  tier: Tier;
  name: string;
  count: number;
  reachablePct: number; // has an email → reachable by the nurture sequences
}

const ACTIVE = new Set(["applicant", "shadow_day", "deposit"]);

function reachable(families: Family[]): number {
  if (families.length === 0) return 0;
  const withEmail = families.filter((f) => !!f.email).length;
  return Number(((100 * withEmail) / families.length).toFixed(1));
}

export function tierOf(f: Family): Tier {
  if (f.funnel_stage === "waitlisted") return "T3";
  if (ACTIVE.has(f.funnel_stage ?? "")) return "T1";
  return "T2";
}

export function segmentSummaries(families: Family[]): SegmentSummary[] {
  const groups: Record<Tier, Family[]> = { T1: [], T2: [], T3: [] };
  for (const f of families) groups[tierOf(f)].push(f);
  return [
    { tier: "T1", name: "Active intent (applicant → deposit)", count: groups.T1.length, reachablePct: reachable(groups.T1) },
    { tier: "T2", name: "Engaged leads (nurture cohort)", count: groups.T2.length, reachablePct: reachable(groups.T2) },
    { tier: "T3", name: "Waitlist", count: groups.T3.length, reachablePct: reachable(groups.T3) },
  ];
}

export interface T3Bucket {
  key: string;
  label: string;
  count: number;
}

/** The T3 waitlist ESA sub-buckets (read app_form tefa_status — the SSOT). */
export function t3Buckets(families: Family[]): T3Bucket[] {
  const wl = families.filter((f) => f.funnel_stage === "waitlisted");
  const count = (status: string) => wl.filter((f) => f.tefa_status === status).length;
  return [
    { key: "esa_planned", label: "ESA-planned", count: count("esa_planned") },
    { key: "esa_ineligible", label: "ESA-ineligible (out-of-pocket)", count: count("esa_ineligible") },
    { key: "no_indicator", label: "No indicator", count: count("no_indicator") },
  ];
}

/** A custom segment built from an attribute×value rule (the segment builder, pure). */
export function buildCustomSegment(
  families: Family[],
  rule: { attribute: "income_band" | "grade" | "tefa_status"; value: string },
): Family[] {
  return families.filter((f) => (f as unknown as Record<string, unknown>)[rule.attribute] === rule.value);
}
