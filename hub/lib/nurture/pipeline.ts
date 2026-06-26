// pipeline.ts — parent pipeline stage distribution + the marketing→onboarding handoff.
//
// Parent (contact) and child are kept SEPARATE; a contact appears exactly once in the
// parent distribution (invariant #4). Handoff conversion = onboarded ÷ handed_off and is
// always ≤ 1 (no double-count). Reads enrollments (the HubSpot deal half) for the fall
// program only.

import type { Enrollment } from "@/lib/seed/types";

const FALL = "fall_enrollment";
const STAGE_ORDER = ["lead", "applicant", "shadow_day", "waitlisted", "deposit"];

export interface StageCount {
  stage: string;
  count: number;
}

/** Parent stage distribution — each fall deal counted once, ordered by funnel. */
export function parentStageDistribution(enrollments: Enrollment[]): StageCount[] {
  const fall = enrollments.filter((e) => e.program_key === FALL);
  const counts = new Map<string, number>();
  for (const e of fall) {
    const stage = e.stage ?? "lead";
    counts.set(stage, (counts.get(stage) ?? 0) + 1);
  }
  const ordered = [...counts.entries()].sort((a, b) => {
    const ai = STAGE_ORDER.indexOf(a[0]);
    const bi = STAGE_ORDER.indexOf(b[0]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return ordered.map(([stage, count]) => ({ stage, count }));
}

export interface HandoffMetrics {
  handedOff: number; // reached shadow_day or deposit (marketing → onboarding)
  onboarded: number; // paid deposit
  convRate: number; // onboarded / handedOff, ≤ 1
}

export function handoffMetrics(enrollments: Enrollment[]): HandoffMetrics {
  const fall = enrollments.filter((e) => e.program_key === FALL);
  const handedOff = fall.filter((e) => e.stage === "shadow_day" || e.stage === "deposit").length;
  const onboarded = fall.filter((e) => e.stage === "deposit" && e.paid).length;
  const convRate = handedOff > 0 ? Number((onboarded / handedOff).toFixed(3)) : 0;
  return { handedOff, onboarded, convRate };
}

export interface StuckAlert {
  stage: string;
  count: number;
  thresholdDays: number;
}

/** Stuck-in-stage: deals older than the threshold still sitting in a non-terminal stage. */
export function stuckInStage(enrollments: Enrollment[], asOf: string, thresholdDays = 14): StuckAlert[] {
  const asOfMs = Date.parse(asOf);
  const fall = enrollments.filter((e) => e.program_key === FALL && e.stage !== "deposit");
  const counts = new Map<string, number>();
  for (const e of fall) {
    const days = (asOfMs - Date.parse(e.created_at)) / 86_400_000;
    if (days > thresholdDays) counts.set(e.stage ?? "lead", (counts.get(e.stage ?? "lead") ?? 0) + 1);
  }
  return [...counts.entries()].map(([stage, count]) => ({ stage, count, thresholdDays }));
}
