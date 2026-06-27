/**
 * registry.ts — the SINGLE KPI definition layer for Module 6 (Dashboard / KPI Tracking).
 *
 * THE CONTRACT (Priya/Devon falsifiable ask): a KPI is computed in EXACTLY one place.
 * Every surface that shows a KPI — the Dashboard scorecard, the Home widget, a trend —
 * resolves its number through `computeKpi` / `kpiWeeklySeries` here. There is no second
 * definition. If a number is computed anywhere else, it does not exist (it is drift).
 *
 * The dashboard is a READ-ONLY aggregator: every function here READS the seed dataset
 * (the deterministic twin of the home-module SoT) and never mutates it. Each KPI names
 * its `home_module` (the module that OWNS the number) and its authoritative `source`.
 *
 * Weekly grain: the marketing sprint is a 13-week window from 2026-06-01. A flow KPI
 * (applicants, deposits, ...) is bucketed by its record's real timestamp into the week
 * it occurred; a level KPI (parity) reads the week's snapshot. Uninstrumented inputs
 * (event-to-consult = manual; channel-conversion = UTM broken) carry instrumented=false
 * so every consumer can render a low-confidence badge (Rahman's "don't trust it").
 */

import type { SeedDataset } from "@/lib/seed/types";

export const SPRINT_START = "2026-06-01T00:00:00.000Z";
export const SPRINT_WEEKS = 13;
const DAY = 86_400_000;

export type KpiUnit = "count" | "pct" | "ratio";
export type KpiDirection = "higher_better" | "lower_better";

export interface KpiDefinition {
  key: string;
  label: string;
  /** Slug of the module that OWNS this number. The dashboard only reads it. */
  homeModule: string;
  /** Authoritative source connector for freshness joins. */
  source: string;
  unit: KpiUnit;
  direction: KpiDirection;
  /** false = uninstrumented (manual) or broken (UTM) → low-confidence badge. */
  instrumented: boolean;
}

/** The v1 KPI list (PLAN §8). Additions go through this array — never ad-hoc. */
export const KPI_DEFINITIONS: KpiDefinition[] = [
  { key: "applicants", label: "Applicants (new / wk)", homeModule: "nurture", source: "supabase", unit: "count", direction: "higher_better", instrumented: true },
  { key: "deposits", label: "Deposits (new / wk)", homeModule: "nurture", source: "supabase", unit: "count", direction: "higher_better", instrumented: true },
  { key: "parity_pct", label: "Sync parity", homeModule: "crm-ops", source: "hubspot", unit: "pct", direction: "higher_better", instrumented: true },
  { key: "ambassador_influenced", label: "Ambassador-influenced deposits", homeModule: "grassroots", source: "hubspot", unit: "count", direction: "higher_better", instrumented: true },
  { key: "conversion_top_channel", label: "Top-channel conversion", homeModule: "analytics", source: "ga4", unit: "pct", direction: "higher_better", instrumented: false },
  { key: "event_to_consult", label: "Event-to-consult (manual)", homeModule: "events", source: "manual", unit: "count", direction: "higher_better", instrumented: false },
];

const BY_KEY = new Map(KPI_DEFINITIONS.map((d) => [d.key, d]));

export function kpiDefinition(key: string): KpiDefinition | undefined {
  return BY_KEY.get(key);
}

const APPLICANT_PLUS = new Set(["applicant", "shadow_day", "deposit"]);

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/** The 13 Monday (week-of) keys for the sprint window. */
export function weekMondays(weeks = SPRINT_WEEKS): string[] {
  const start = Date.parse(SPRINT_START);
  return Array.from({ length: weeks }, (_, w) => iso(start + w * 7 * DAY).slice(0, 10));
}

/**
 * The single demo clock. Every consumer (default reporting week, available weeks,
 * cumulative-as-of) reads "now" through here so they can never disagree.
 */
export function nowMs(now: number | Date = Date.now()): number {
  return typeof now === "number" ? now : now.getTime();
}

/** Current sprint week index (0..weeks-1) for `now`, clamped to the window bounds. */
export function currentWeekIndex(now: number | Date = Date.now(), weeks = SPRINT_WEEKS): number {
  const idx = Math.floor((nowMs(now) - Date.parse(SPRINT_START)) / (7 * DAY));
  return Math.min(Math.max(idx, 0), weeks - 1);
}

/** Default reporting week: the current Monday in the sprint window, clamped to bounds. */
export function defaultReportingWeek(now: number | Date = Date.now(), weeks = SPRINT_WEEKS): string {
  return weekMondays(weeks)[currentWeekIndex(now, weeks)];
}

/**
 * The Monday keys that have actually arrived (≤ today) — the ONLY weeks a selector may
 * offer. Future sprint weeks are not navigable: they carry no settled verdict yet, so
 * showing them would imply a reading we cannot honestly make.
 */
export function availableWeeks(now: number | Date = Date.now(), weeks = SPRINT_WEEKS): string[] {
  return weekMondays(weeks).slice(0, currentWeekIndex(now, weeks) + 1);
}

/** Week index (0..weeks-1) for a timestamp, or -1 if outside the window. */
export function weekIndexOf(isoTs: string | null, weeks = SPRINT_WEEKS): number {
  if (!isoTs) return -1;
  const t = Date.parse(isoTs);
  if (Number.isNaN(t)) return -1;
  const idx = Math.floor((t - Date.parse(SPRINT_START)) / (7 * DAY));
  return idx >= 0 && idx < weeks ? idx : -1;
}

function bucketCount(ds: SeedDataset, weeks: number, pred: (f: SeedDataset["families"][number]) => boolean): number[] {
  const out = new Array(weeks).fill(0);
  for (const f of ds.families) {
    if (!pred(f)) continue;
    const w = weekIndexOf(f.created_at, weeks);
    if (w >= 0) out[w] += 1;
  }
  return out;
}

// Event-to-consult is a MANUAL field-marketing count (no instrumentation in v1). It is
// not derivable from any connector, so it is a fixed manual series — honestly flagged.
const EVENT_TO_CONSULT_MANUAL = [4, 5, 6, 5, 7, 6, 8, 7, 6, 5, 7, 6, 8];

function paritySeries(ds: SeedDataset, weeks: number): number[] {
  const out = new Array(weeks).fill(0);
  for (const snap of ds.parity_snapshot) {
    const w = weekIndexOf(snap.taken_at, weeks);
    if (w >= 0) out[w] = Number(snap.overall_pct.toFixed(2));
  }
  // Carry the last known value forward into any empty trailing week (level metric).
  let last = 0;
  for (let w = 0; w < weeks; w++) {
    if (out[w] === 0) out[w] = last;
    else last = out[w];
  }
  return out;
}

function conversionSeries(ds: SeedDataset, weeks: number): number[] {
  const sessions = new Array(weeks).fill(0);
  const conversions = new Array(weeks).fill(0);
  for (const g of ds.ga4_days) {
    const w = weekIndexOf(`${g.date}T00:00:00.000Z`, weeks);
    if (w < 0) continue;
    sessions[w] += g.sessions;
    conversions[w] += g.conversions;
  }
  return sessions.map((s, w) => (s > 0 ? Number(((100 * conversions[w]) / s).toFixed(2)) : 0));
}

/** Per-week series for a KPI (length = weeks). The ONLY place a weekly KPI is computed. */
export function kpiWeeklySeries(key: string, ds: SeedDataset, weeks = SPRINT_WEEKS): number[] {
  switch (key) {
    case "applicants":
      return bucketCount(ds, weeks, (f) => APPLICANT_PLUS.has(f.funnel_stage ?? ""));
    case "deposits":
      return bucketCount(ds, weeks, (f) => f.funnel_stage === "deposit");
    case "ambassador_influenced":
      return bucketCount(ds, weeks, (f) => f.source === "referral" && f.funnel_stage === "deposit");
    case "parity_pct":
      return paritySeries(ds, weeks);
    case "conversion_top_channel":
      return conversionSeries(ds, weeks);
    case "event_to_consult":
      return Array.from({ length: weeks }, (_, w) => EVENT_TO_CONSULT_MANUAL[w] ?? 0);
    default:
      return new Array(weeks).fill(0);
  }
}

/** The single value of a KPI for a given week-of (Monday) key. */
export function computeKpi(key: string, ds: SeedDataset, weekOf: string, weeks = SPRINT_WEEKS): number {
  const idx = weekMondays(weeks).indexOf(weekOf);
  if (idx < 0) return 0;
  return kpiWeeklySeries(key, ds, weeks)[idx] ?? 0;
}

/**
 * The cumulative-AS-OF-the-selected-week value of a KPI — never the whole-dataset total.
 *
 * FLOW KPIs (unit `count`: applicants, deposits, …) accumulate, so the as-of value is the
 * running sum of the weekly series through `weekOf`. This is what a North Star like
 * "deposits so far" must use: selecting week 3 shows week-3 cumulative, not the end-of-
 * sprint figure. LEVEL KPIs (unit `pct`/`ratio`: parity, conversion rate) are a snapshot,
 * so the as-of value is simply that week's reading.
 */
export function kpiCumulative(key: string, ds: SeedDataset, weekOf: string, weeks = SPRINT_WEEKS): number {
  const idx = weekMondays(weeks).indexOf(weekOf);
  if (idx < 0) return 0;
  const series = kpiWeeklySeries(key, ds, weeks);
  const def = kpiDefinition(key);
  if (def && def.unit !== "count") return series[idx] ?? 0;
  return series.slice(0, idx + 1).reduce((a, v) => a + v, 0);
}
