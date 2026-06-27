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
import {
  SCORECARD_GROUPS,
  groupOrder,
  stageForKpi,
  type ScorecardGroupDef,
  type ScorecardGroupKey,
} from "@/lib/funnel/stages";

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
  /** Direction-aware pace toward the per-week target, as a percentage. >=100 = meeting/ahead;
   *  null when no target is set. Single source for both the status pill and the "% to goal" cell. */
  pctToTarget: number | null;
  status: ScorecardStatus;
  confidence: Confidence;
  instrumented: boolean;
  freshness: ConnectorFreshness | undefined;
  stale: boolean;
  /** Funnel stage (or cross-cutting bucket) this KPI belongs to. Drives row ordering. */
  stage: ScorecardGroupKey;
}

/** A run of scorecard rows sharing one funnel stage (or the cross-cutting bucket). */
export interface ScorecardGroup {
  key: ScorecardGroupKey;
  name: string;
  blurb: string;
  order: number;
  rows: ScorecardRow[];
}

export interface Scorecard {
  weekOf: string;
  /** Rows ordered along the marketing funnel (then cross-cutting). */
  rows: ScorecardRow[];
  /** Same rows partitioned by funnel stage, in funnel order (empty groups omitted). */
  groups: ScorecardGroup[];
  biggestMover: ScorecardRow | null;
  redFlags: ScorecardRow[];
}

/**
 * Direction-aware pace toward the per-week target, as a percentage (>=100 = meeting/ahead).
 * higher_better → thisWeek/target; lower_better → target/thisWeek. Null when there is no
 * target to pace against. The single computation behind both the "% to goal" cell and the
 * status pill, so the two can never contradict each other.
 */
export function paceToTarget(
  thisWeek: number,
  target: number | null,
  direction: KpiDefinition["direction"],
): number | null {
  if (target === null || target === 0) return null;
  const ratio = thisWeek / target;
  const score = direction === "higher_better" ? ratio : 1 / Math.max(ratio, 0.0001);
  return Math.round(score * 100);
}

function statusFor(row: { thisWeek: number; target: number | null; direction: KpiDefinition["direction"] }): ScorecardStatus {
  const pace = paceToTarget(row.thisWeek, row.target, row.direction);
  if (pace === null) return "on_track";
  if (pace >= 100) return "on_track";
  if (pace >= 90) return "watch";
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

  const unordered: ScorecardRow[] = KPI_DEFINITIONS.map((def) => {
    const series = kpiWeeklySeries(def.key, ds);
    const thisWeek = series[idx] ?? 0;
    const lastWeek = idx > 0 ? series[idx - 1] ?? 0 : 0;
    const delta = Number((thisWeek - lastWeek).toFixed(2));
    const deltaPct = lastWeek !== 0 ? Number(((100 * delta) / lastWeek).toFixed(1)) : null;
    const sparkline = series.slice(Math.max(0, idx - 3), idx + 1);
    const goal = goalFor(def.key, goals);
    const target = goal ? goal.targetValue : null;
    const pctToTarget = paceToTarget(thisWeek, target, def.direction);
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
      pctToTarget,
      status,
      confidence: def.instrumented ? "measured" : "low",
      instrumented: def.instrumented,
      freshness: connector,
      stale: connector?.status === "stale",
      stage: stageForKpi(def.key),
    };
  });

  // ORDER along the marketing funnel (Awareness → … → Advocacy), cross-cutting last,
  // so the Dashboard scorecard reads in the same sequence as the Status board. Within
  // a stage, keep the registry order (the single source for KPI definitions) so the
  // snapshot stays deterministic + byte-identical per week.
  const registryIndex = new Map(KPI_DEFINITIONS.map((d, i) => [d.key, i]));
  const rows = [...unordered].sort(
    (a, b) =>
      groupOrder(a.stage) - groupOrder(b.stage) ||
      (registryIndex.get(a.key) ?? 0) - (registryIndex.get(b.key) ?? 0),
  );

  // Partition into funnel groups (in funnel order), dropping stages with no KPIs.
  const groups: ScorecardGroup[] = SCORECARD_GROUPS.map((g: ScorecardGroupDef) => ({
    key: g.key,
    name: g.name,
    blurb: g.blurb,
    order: g.order,
    rows: rows.filter((r) => r.stage === g.key),
  })).filter((g) => g.rows.length > 0);

  // Biggest mover: rank by |deltaPct| among INSTRUMENTED KPIs only (uninstrumented
  // numbers don't earn an auto-callout — Rahman). Falls back to absolute delta.
  const movers = rows
    .filter((r) => r.instrumented)
    .filter((r) => r.deltaPct !== null);
  movers.sort((a, b) => Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0));
  const biggestMover = movers[0] ?? null;

  const redFlags = rows.filter((r) => r.status === "at_risk");

  return { weekOf: week, rows, groups, biggestMover, redFlags };
}
