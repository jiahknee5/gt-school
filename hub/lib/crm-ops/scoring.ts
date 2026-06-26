/**
 * scoring.ts — PURE, READ-ONLY lead-score visibility for CRM Ops (§7c).
 *
 * The Hub NEVER writes lead scores back to HubSpot. This module only READS the scores
 * reconciled into `families.lead_score` and presents:
 *   - a score histogram,
 *   - tier breakdown, and
 *   - a score→conversion table that is explicitly labeled CORRELATION on seeded data,
 *     carrying n + a caveat — never presented as model validation (Rahman A4).
 */

import type { Family } from "../seed/types";

export interface ScoreBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface ScoreTier {
  tier: "T1 (70-100)" | "T2 (40-69)" | "T3 (1-39)";
  count: number;
  deposits: number;
  depositRatePct: number;
}

export interface ScoreCorrelation {
  topQuartileDepositRatePct: number;
  bottomQuartileDepositRatePct: number;
  lift: number | null; // top / bottom, null when bottom is 0
  n: number;
  caveat: string;
}

export interface ScoringSummary {
  readOnly: true;
  scored: number;
  unscored: number;
  histogram: ScoreBucket[];
  tiers: ScoreTier[];
  correlation: ScoreCorrelation;
  rulesChangeLog: { date: string; change: string }[];
}

const BUCKETS: ReadonlyArray<readonly [string, number, number]> = [
  ["0-19", 0, 19],
  ["20-39", 20, 39],
  ["40-59", 40, 59],
  ["60-79", 60, 79],
  ["80-100", 80, 100],
];

function depositRate(rows: Family[]): number {
  if (rows.length === 0) return 0;
  const deposits = rows.filter((f) => f.funnel_stage === "deposit").length;
  return Number(((100 * deposits) / rows.length).toFixed(2));
}

export function summarizeLeadScores(families: Family[]): ScoringSummary {
  const scoredRows = families.filter((f) => f.lead_score != null) as (Family & { lead_score: number })[];
  const unscored = families.length - scoredRows.length;

  const histogram: ScoreBucket[] = BUCKETS.map(([label, min, max]) => ({
    label,
    min,
    max,
    count: scoredRows.filter((f) => f.lead_score >= min && f.lead_score <= max).length,
  }));

  const tierDef: ReadonlyArray<readonly [ScoreTier["tier"], number, number]> = [
    ["T1 (70-100)", 70, 100],
    ["T2 (40-69)", 40, 69],
    ["T3 (1-39)", 1, 39],
  ];
  const tiers: ScoreTier[] = tierDef.map(([tier, min, max]) => {
    const rows = scoredRows.filter((f) => f.lead_score >= min && f.lead_score <= max);
    const deposits = rows.filter((f) => f.funnel_stage === "deposit").length;
    return { tier, count: rows.length, deposits, depositRatePct: depositRate(rows) };
  });

  const sorted = [...scoredRows].sort((a, b) => a.lead_score - b.lead_score);
  const q = Math.floor(sorted.length / 4);
  const bottom = sorted.slice(0, q);
  const top = sorted.slice(-q);
  const topRate = depositRate(top);
  const bottomRate = depositRate(bottom);

  return {
    readOnly: true,
    scored: scoredRows.length,
    unscored,
    histogram,
    tiers,
    correlation: {
      topQuartileDepositRatePct: topRate,
      bottomQuartileDepositRatePct: bottomRate,
      lift: bottomRate === 0 ? null : Number((topRate / bottomRate).toFixed(2)),
      n: sorted.length,
      caveat:
        "Correlation on seeded data, not model validation. Lead scores are read-only — the Hub never writes them back to HubSpot.",
    },
    rulesChangeLog: [
      { date: "2026-05-01", change: "Baseline gt_lead_score model imported from HubSpot (read-only mirror)." },
      { date: "2026-06-10", change: "Tier thresholds aligned to T1/T2/T3 (70 / 40 / 1)." },
    ],
  };
}
