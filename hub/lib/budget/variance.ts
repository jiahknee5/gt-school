// Budget variance engine. The PLAN's auto-flag rule: a workstream trips when
// actual > planned x 1.10 AND actual - planned >= $2,500 (the materiality FLOOR keeps a
// $300 overage off the Decision Queue — Rivera/Park). A tripped line yields ONE idempotent
// Decision Queue payload (the named §4 contract) that deep-links to a pre-filled
// reallocation; re-running never duplicates an already-open auto-flag for that workstream.

import type { BudgetWorkstream, Decision } from "@/lib/seed/types";

export const BUDGET_VARIANCE_PCT = 10;
export const BUDGET_VARIANCE_FLOOR = 2500;
// Public aliases used by the UI + tests (kept stable; the BUDGET_* names predate them).
export const VARIANCE_PCT = BUDGET_VARIANCE_PCT;
export const VARIANCE_FLOOR = BUDGET_VARIANCE_FLOOR;
export const VARIANCE_RAISED_BY = "system (budget variance)";
const DEFAULT_CREATED_AT = "2026-08-30T00:00:00.000Z";
const DEFAULT_DUE_DATE = "2026-09-01";

export type VarianceCandidate = Pick<BudgetWorkstream, "key" | "name" | "planned" | "actual">;
export type VarianceInput = VarianceCandidate;

export interface BudgetVariance {
  key: string;
  name: string;
  planned: number;
  actual: number;
  overAmount: number;
  overPct: number;
  flagged: boolean;
  urgent: boolean;
}

export function isBudgetVariance(row: VarianceCandidate): boolean {
  return (
    row.actual > row.planned * (1 + BUDGET_VARIANCE_PCT / 100) &&
    row.actual - row.planned >= BUDGET_VARIANCE_FLOOR
  );
}

export function evaluateVariance(rows: VarianceCandidate[]): BudgetVariance[] {
  return rows.map((row) => {
    const overAmount = Math.max(0, row.actual - row.planned);
    const overPct = row.planned === 0 ? 0 : ((row.actual - row.planned) / row.planned) * 100;
    const flagged = isBudgetVariance(row);
    return {
      key: row.key,
      name: row.name,
      planned: row.planned,
      actual: row.actual,
      overAmount,
      overPct,
      flagged,
      urgent: flagged && (overPct >= 20 || overAmount >= 10000),
    };
  });
}

/** Only the flagged variances (those that trip BOTH the % and the $ floor). */
export function flaggedVariances(rows: VarianceCandidate[]): BudgetVariance[] {
  return evaluateVariance(rows).filter((v) => v.flagged);
}

/** Pre-filled Decision Queue link so a variance leads to a LOGGED reallocation (Rivera). */
export function reallocationDeepLink(v: BudgetVariance | VarianceCandidate): string {
  const over = "overAmount" in v ? v.overAmount : Math.max(0, v.actual - v.planned);
  const params = new URLSearchParams({
    intent: "reallocation",
    workstream: v.key,
    ask: String(Math.round(over)),
  });
  return `/m/decisions?${params.toString()}`;
}

/** The named §4 auto-flag payload for one flagged workstream. Stable id ⇒ idempotent. */
export function buildVariancePayload(v: BudgetVariance, createdAt: string = DEFAULT_CREATED_AT): Decision {
  return {
    id: `auto-budget-${v.key}`,
    question: `${v.name} is ${v.overPct.toFixed(1)}% over plan — approve reallocation?`,
    raised_by: VARIANCE_RAISED_BY,
    workstream: v.key,
    recommendation: `Actual on ${v.name} exceeds plan by $${Math.round(v.overAmount).toLocaleString()} (>${BUDGET_VARIANCE_PCT}% and the $${BUDGET_VARIANCE_FLOOR.toLocaleString()} floor). Approve a reallocation or hold spend.`,
    budget_ask: Math.round(v.overAmount),
    due_date: DEFAULT_DUE_DATE,
    priority: v.urgent ? "urgent" : "normal",
    status: "open",
    response: null,
    response_note: null,
    auto_flag: true,
    resolved_at: null,
    created_at: createdAt,
  };
}

/** Back-compat single-row helper (phase2 surfaces). Priority now derives from urgency. */
export function budgetVarianceDecision(
  row: VarianceCandidate,
  _index = 0,
  createdAt = DEFAULT_CREATED_AT,
): Decision {
  return buildVariancePayload(evaluateVariance([row])[0], createdAt);
}

/**
 * New auto-flag payloads for flagged workstreams that do NOT already have an open
 * auto-flag decision — the idempotency guard (one open flag per workstream).
 */
export function pendingVarianceDecisions(
  rows: VarianceCandidate[],
  decisions: Decision[],
  createdAt = DEFAULT_CREATED_AT,
): Decision[] {
  const existingOpenByWorkstream = new Set(
    decisions
      .filter((decision) => decision.auto_flag && decision.status === "open" && decision.workstream)
      .map((decision) => decision.workstream),
  );
  return flaggedVariances(rows)
    .filter((v) => !existingOpenByWorkstream.has(v.key))
    .map((v) => buildVariancePayload(v, createdAt));
}

export function ensureBudgetVarianceDecisions(
  rows: VarianceCandidate[],
  decisions: Decision[],
): Decision[] {
  return [...decisions, ...pendingVarianceDecisions(rows, decisions)];
}
