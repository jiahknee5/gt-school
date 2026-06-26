/**
 * goals.ts — leadership-editable KPI targets + the RBAC that guards them.
 *
 * RBAC (PLAN §0 + invariant #4): the scorecard VIEW is identical for every role
 * (shared, not personal), but ONLY a Leader may edit a goal. Admin and Operator are
 * denied. Every successful edit appends a `kpi_goal_audit` row (who + before/after).
 * The guard is pure and server-enforced — the UI mirrors it but never decides it.
 */

import type { Role } from "@/lib/phase2";

export interface KpiGoal {
  kpiKey: string;
  period: string;
  targetValue: number;
  cutoffDate: string;
}

export interface KpiGoalAudit {
  kpiKey: string;
  actor: string;
  oldValue: number;
  newValue: number;
  changedAt: string;
}

export const FALL_CUTOFF = "2026-08-17";

/** Seeded Fall-2026 targets (PLAN: "targets are already defined"). Per-WEEK run-rate goals. */
export const DEFAULT_GOALS: KpiGoal[] = [
  { kpiKey: "applicants", period: "fall_2026", targetValue: 90, cutoffDate: FALL_CUTOFF },
  { kpiKey: "deposits", period: "fall_2026", targetValue: 55, cutoffDate: FALL_CUTOFF },
  { kpiKey: "parity_pct", period: "fall_2026", targetValue: 97, cutoffDate: FALL_CUTOFF },
  { kpiKey: "ambassador_influenced", period: "fall_2026", targetValue: 12, cutoffDate: FALL_CUTOFF },
  { kpiKey: "conversion_top_channel", period: "fall_2026", targetValue: 6, cutoffDate: FALL_CUTOFF },
  { kpiKey: "event_to_consult", period: "fall_2026", targetValue: 8, cutoffDate: FALL_CUTOFF },
];

export function goalFor(kpiKey: string, goals: KpiGoal[] = DEFAULT_GOALS): KpiGoal | undefined {
  return goals.find((g) => g.kpiKey === kpiKey);
}

/** Only Leaders edit goals. Admin + Operator are denied (PLAN §0). */
export function canEditGoal(role: Role | null | undefined): boolean {
  return role === "leader";
}

export class GoalAuthError extends Error {
  status: 401 | 403;
  constructor(status: 401 | 403, message: string) {
    super(message);
    this.status = status;
    this.name = "GoalAuthError";
  }
}

export function assertCanEditGoal(role: Role | null | undefined): void {
  if (!role) throw new GoalAuthError(401, "Authentication required to edit a goal.");
  if (!canEditGoal(role)) throw new GoalAuthError(403, "Only Leaders may edit KPI goals.");
}

/**
 * Apply a goal edit. Returns the new goal list + the audit row the edit produced.
 * Throws GoalAuthError (no goal/audit mutation) when the role is not a Leader — this
 * is the pure proof behind invariant #4.
 */
export function applyGoalEdit(
  role: Role | null | undefined,
  kpiKey: string,
  newValue: number,
  actor: string,
  changedAt: string,
  goals: KpiGoal[] = DEFAULT_GOALS,
): { goals: KpiGoal[]; audit: KpiGoalAudit } {
  assertCanEditGoal(role);
  const existing = goalFor(kpiKey, goals);
  if (!existing) throw new GoalAuthError(403, `Unknown KPI goal: ${kpiKey}.`);
  const audit: KpiGoalAudit = {
    kpiKey,
    actor,
    oldValue: existing.targetValue,
    newValue,
    changedAt,
  };
  const next = goals.map((g) => (g.kpiKey === kpiKey ? { ...g, targetValue: newValue } : g));
  return { goals: next, audit };
}
