/**
 * scorecard.ts — build + freeze the canonical weekly scorecard (PLAN node 6a).
 *
 * The scorecard is the Monday-meeting artifact: ONE row per KPI (this wk / last wk /
 * delta / 4-wk sparkline / target / status), each carrying its source, freshness, and
 * an `instrumented` flag. Every number resolves through `lib/metrics/registry.ts` — the
 * scorecard never re-derives a KPI (Priya: no drift Home↔Dashboard↔source).
 *
 * Versioned + immutable (invariant #3): the rows for a given `weekOf` are a pure
 * function of the (deterministic) dataset, so re-building a closed week is byte-identical.
 */

import type { SeedDataset } from "@/lib/seed/types";
import {
  KPI_DEFINITIONS,
  kpiWeeklySeries,
  weekMondays,
  type KpiDefinition,
} from "@/lib/metrics/registry";
import { DEFAULT_GOALS, goalFor, type KpiGoal } from "@/lib/dashboard/goals";
import {
  connectorFreshness,
  freshnessFor,
  type ConnectorFreshness,
} from "@/lib/dashboard/freshness";

export type ScorecardStatus = "on_track" | "watch" | "at_risk";
export type Confidence = "measured" | "low";

export interface ScorecardRow {
  key: string;
  label: string;
  homeModule: string;
  source: string;
  unit: KpiDefinition["unit"];
  thisWeek: number;
  lastWeek: number;
  delta: number;
  deltaPct: number | null;
  sparkline: number[];
  target: number | null;
  status: ScorecardStatus;
  confidence: Confidence;
  instrumented: boolean;
  freshness: ConnectorFreshness | undefined;
  stale: boolean;
}

export interface Scorecard {
  weekOf: string;
  rows: ScorecardRow[];
  biggestMover: ScorecardRow | null;
  redFlags: ScorecardRow[];
}

function statusFor(row: { thisWeek: number; target: number | null; direction: KpiDefinition["direction"] }): ScorecardStatus {
  if (row.target === null || row.target === 0) return "on_track";
  const ratio = row.thisWeek / row.target;
  const score = row.direction === "higher_better" ? ratio : 1 / Math.max(ratio, 0.0001);
  if (score >= 1) return "on_track";
  if (score >= 0.9) return "watch";
  return "at_risk";
}

/** Build the frozen scorecard for `weekOf` (defaults to the latest sprint week). */
export function buildScorecard(
  ds: SeedDataset,
  weekOf?: string,
  goals: KpiGoal[] = DEFAULT_GOALS,
): Scorecard {
  const mondays = weekMondays();
  const week = weekOf && mondays.includes(weekOf) ? weekOf : mondays[mondays.length - 1];
  const idx = mondays.indexOf(week);
  const fresh = connectorFreshness(ds);

  const rows: ScorecardRow[] = KPI_DEFINITIONS.map((def) => {
    const series = kpiWeeklySeries(def.key, ds);
    const thisWeek = series[idx] ?? 0;
    const lastWeek = idx > 0 ? series[idx - 1] ?? 0 : 0;
    const delta = Number((thisWeek - lastWeek).toFixed(2));
    const deltaPct = lastWeek !== 0 ? Number(((100 * delta) / lastWeek).toFixed(1)) : null;
    const sparkline = series.slice(Math.max(0, idx - 3), idx + 1);
    const goal = goalFor(def.key, goals);
    const target = goal ? goal.targetValue : null;
    const connector = freshnessFor(def.source, fresh);
    const status = statusFor({ thisWeek, target, direction: def.direction });
    return {
      key: def.key,
      label: def.label,
      homeModule: def.homeModule,
      source: def.source,
      unit: def.unit,
      thisWeek,
      lastWeek,
      delta,
      deltaPct,
      sparkline,
      target,
      status,
      confidence: def.instrumented ? "measured" : "low",
      instrumented: def.instrumented,
      freshness: connector,
      stale: connector?.status === "stale",
    };
  });

  // Biggest mover: rank by |deltaPct| among INSTRUMENTED KPIs only (uninstrumented
  // numbers don't earn an auto-callout — Rahman). Falls back to absolute delta.
  const movers = rows
    .filter((r) => r.instrumented)
    .filter((r) => r.deltaPct !== null);
  movers.sort((a, b) => Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0));
  const biggestMover = movers[0] ?? null;

  const redFlags = rows.filter((r) => r.status === "at_risk");

  return { weekOf: week, rows, biggestMover, redFlags };
}
