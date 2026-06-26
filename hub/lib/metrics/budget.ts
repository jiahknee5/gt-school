/**
 * metrics/budget.ts — the single definitions for the Budget Tracker's charts (Module 10
 * 10b/10c, PLAN §2). Chart honesty (Zhang): the burn chart overlays cumulative ACTUAL
 * against a linear PLAN-PACE line and exposes a projected burn-out date; the allocation
 * is share-of-ACTUAL (labelled), never planned.
 */

import type { BudgetEntry } from "@/lib/seed/types";

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface BurnPoint {
  week: number; // 0-indexed week of the sprint window
  weekEnd: string; // ISO date (end of that week)
  cumulativeActual: number;
  planPace: number; // linear plan pace cumulative target at this week
}

export interface BurnSeries {
  points: BurnPoint[];
  weeks: number;
  plannedTotal: number;
  actualTotal: number;
  remaining: number;
  /** ahead = under the plan pace line; behind = over it; on-track ~ equal. */
  pace: "ahead" | "behind" | "on-track";
  /** Date the cumulative actual would hit plannedTotal at the current weekly rate. */
  projectedBurnOutDate: string | null;
  weeklyRate: number;
}

export interface BurnOptions {
  sprintStart?: string; // ISO date; defaults to the earliest actual entry
  weeks?: number; // window length; defaults to span of entries (min 1)
  asOf?: string; // "now" for the projection; defaults to the latest actual entry
}

/**
 * Weekly cumulative ACTUAL vs a linear PLAN pace line. Actual dates come from the
 * append-only ledger's `created_at` (manual + campaign roll-ins alike).
 */
export function buildBurnSeries(
  entries: BudgetEntry[],
  plannedTotal: number,
  opts: BurnOptions = {},
): BurnSeries {
  const actuals = entries
    .filter((e) => e.kind === "actual")
    .map((e) => ({ ms: Date.parse(e.created_at), amount: e.amount }))
    .sort((a, b) => a.ms - b.ms);

  const actualTotal = round2(actuals.reduce((s, a) => s + a.amount, 0));

  if (actuals.length === 0) {
    return {
      points: [],
      weeks: 0,
      plannedTotal,
      actualTotal: 0,
      remaining: round2(plannedTotal),
      pace: "on-track",
      projectedBurnOutDate: null,
      weeklyRate: 0,
    };
  }

  const startMs = Date.parse(opts.sprintStart ?? "") || actuals[0].ms;
  const asOfMs = Date.parse(opts.asOf ?? "") || actuals[actuals.length - 1].ms;
  const spanWeeks = Math.max(1, Math.ceil((asOfMs - startMs) / WEEK) + 1);
  const weeks = opts.weeks ?? spanWeeks;

  const points: BurnPoint[] = [];
  for (let w = 0; w < weeks; w++) {
    const weekEndMs = startMs + (w + 1) * WEEK;
    const cumulativeActual = round2(
      actuals.filter((a) => a.ms < weekEndMs).reduce((s, a) => s + a.amount, 0),
    );
    const planPace = round2((plannedTotal * (w + 1)) / weeks);
    points.push({ week: w, weekEnd: new Date(weekEndMs).toISOString().slice(0, 10), cumulativeActual, planPace });
  }

  const weeksElapsed = Math.max(1, Math.ceil((asOfMs - startMs) / WEEK));
  const weeklyRate = round2(actualTotal / weeksElapsed);
  const remaining = round2(plannedTotal - actualTotal);

  let projectedBurnOutDate: string | null = null;
  if (weeklyRate > 0 && remaining > 0) {
    const weeksToBurnOut = remaining / weeklyRate;
    projectedBurnOutDate = new Date(asOfMs + weeksToBurnOut * WEEK).toISOString().slice(0, 10);
  } else if (remaining <= 0) {
    projectedBurnOutDate = new Date(asOfMs).toISOString().slice(0, 10); // already at/over plan
  }

  const last = points[points.length - 1];
  const delta = last.cumulativeActual - last.planPace;
  const pace: BurnSeries["pace"] =
    Math.abs(delta) <= plannedTotal * 0.02 ? "on-track" : delta > 0 ? "behind" : "ahead";

  return { points, weeks, plannedTotal, actualTotal, remaining, pace, projectedBurnOutDate, weeklyRate };
}

export interface AllocationSlice {
  key: string;
  name: string;
  actual: number;
  pct: number; // share of TOTAL actual (0–100)
}

/** Share-of-actual allocation (10c). Labelled "actual" so it can't be read as planned. */
export function actualAllocation(rows: { key: string; name: string; actual: number }[]): AllocationSlice[] {
  const total = rows.reduce((s, r) => s + r.actual, 0);
  return rows
    .map((r) => ({
      key: r.key,
      name: r.name,
      actual: round2(r.actual),
      pct: total === 0 ? 0 : round2((r.actual / total) * 100),
    }))
    .sort((a, b) => b.actual - a.actual);
}

export type Health = "on-track" | "watch" | "at-risk";

/** Workstream health from actual vs planned (mirrors variance thresholds). */
export function workstreamHealth(planned: number, actual: number): Health {
  if (actual > planned * 1.1 && actual - planned >= 2500) return "at-risk";
  if (actual > planned) return "watch";
  return "on-track";
}
