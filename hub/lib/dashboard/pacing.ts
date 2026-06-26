/**
 * pacing.ts — goal pacing: required-vs-actual run-rate + a linear-v1 projection (node 6d).
 *
 * Elena vs Rahman, resolved: ship a projection leadership can plan against, but state
 * the method and flag uninstrumented inputs. The projection is explicitly LINEAR v1:
 *   required run-rate = (target - actual) / weeks_left
 *   actual run-rate   = mean of the recent weeks
 *   projection        = actual + actual_run_rate * weeks_left
 * Seasonality / back-loading is a stated limitation (no curve fit in v1). A KPI whose
 * input is uninstrumented carries a low-confidence flag on its projection.
 */

import type { SeedDataset } from "@/lib/seed/types";
import { KPI_DEFINITIONS, kpiWeeklySeries, weekMondays } from "@/lib/metrics/registry";
import { DEFAULT_GOALS, goalFor, type KpiGoal } from "@/lib/dashboard/goals";

export type PaceStatus = "on_track" | "watch" | "at_risk";

export interface PacingRow {
  key: string;
  label: string;
  target: number;
  cutoffDate: string;
  weeksLeft: number;
  actualThisWeek: number;
  requiredRunRate: number;
  actualRunRate: number;
  projection: number;
  status: PaceStatus;
  confidence: "measured" | "low";
  method: string;
}

const METHOD = "linear-v1 (mean recent run-rate; no seasonality curve)";

function weeksLeft(cutoffDate: string, weekOf: string): number {
  const ms = Date.parse(cutoffDate) - Date.parse(weekOf);
  return Math.max(0, Math.round(ms / (7 * 86_400_000)));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function buildPacing(
  ds: SeedDataset,
  weekOf?: string,
  goals: KpiGoal[] = DEFAULT_GOALS,
): PacingRow[] {
  const mondays = weekMondays();
  const week = weekOf && mondays.includes(weekOf) ? weekOf : mondays[mondays.length - 1];
  const idx = mondays.indexOf(week);

  const rows: PacingRow[] = [];
  for (const def of KPI_DEFINITIONS) {
    const goal = goalFor(def.key, goals);
    if (!goal) continue;
    const series = kpiWeeklySeries(def.key, ds);
    const actualThisWeek = series[idx] ?? 0;
    const recent = series.slice(Math.max(0, idx - 3), idx + 1);
    const actualRunRate = Number(mean(recent).toFixed(2));
    const left = weeksLeft(goal.cutoffDate, week);
    const requiredRunRate = left > 0 ? Number(((goal.targetValue - actualThisWeek) / left).toFixed(2)) : 0;
    const projection = Number((actualThisWeek + actualRunRate * left).toFixed(2));

    const ratio = requiredRunRate <= 0 ? 1 : actualRunRate / requiredRunRate;
    const status: PaceStatus = ratio >= 1 ? "on_track" : ratio >= 0.9 ? "watch" : "at_risk";

    rows.push({
      key: def.key,
      label: def.label,
      target: goal.targetValue,
      cutoffDate: goal.cutoffDate,
      weeksLeft: left,
      actualThisWeek,
      requiredRunRate,
      actualRunRate,
      projection,
      status,
      confidence: def.instrumented ? "measured" : "low",
      method: METHOD,
    });
  }
  return rows;
}

export function pacingMethodLabel(): string {
  return METHOD;
}
