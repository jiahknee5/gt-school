// metrics.ts — single definitions for the admissions surfaces. Pipeline numbers read
// families.funnel_stage (app-authoritative SSOT, invariant #3) — never HubSpot lifecycle.
// The 4-wk trend arrow matches the sign of (this-period − prior-period) per theme
// (invariant #9). Closure rate = actioned≤7d ÷ flagged (invariant #6).

import type { Family } from "@/lib/seed/types";
import { THEMES, type Theme } from "./themes";
import type { Objection } from "./ingest";

const DAY = 86_400_000;

export interface PipelineNumbers {
  applicants: number;
  shadowDays: number;
  deposits: number;
  waitlisted: number;
}

export function pipelineNumbers(families: Family[]): PipelineNumbers {
  const count = (stage: string) => families.filter((f) => f.funnel_stage === stage).length;
  return {
    applicants: count("applicant"),
    shadowDays: count("shadow_day"),
    deposits: count("deposit"),
    waitlisted: count("waitlisted"),
  };
}

export type Trend = "up" | "stable" | "down";

export interface ThemeFrequency {
  theme: Theme;
  thisPeriod: number;
  priorPeriod: number;
  cumulative: number;
  trend: Trend;
  exampleVerbatim: string | null;
}

/** Per-theme frequency over a recent vs prior window (default 14 days each). */
export function themeFrequencies(objections: Objection[], asOf: string, windowDays = 14): ThemeFrequency[] {
  const asOfMs = Date.parse(asOf);
  const recentStart = asOfMs - windowDays * DAY;
  const priorStart = asOfMs - 2 * windowDays * DAY;

  return THEMES.map((theme) => {
    const all = objections.filter((o) => o.theme === theme);
    const thisPeriod = all.filter((o) => Date.parse(o.surfacedAt) >= recentStart).length;
    const priorPeriod = all.filter((o) => {
      const t = Date.parse(o.surfacedAt);
      return t >= priorStart && t < recentStart;
    }).length;
    const trend: Trend = thisPeriod > priorPeriod ? "up" : thisPeriod < priorPeriod ? "down" : "stable";
    return {
      theme,
      thisPeriod,
      priorPeriod,
      cumulative: all.length,
      trend,
      exampleVerbatim: all[0]?.verbatim ?? null,
    };
  }).filter((f) => f.cumulative > 0);
}

export function topObjections(objections: Objection[], asOf: string, n = 3): ThemeFrequency[] {
  return [...themeFrequencies(objections, asOf)].sort((a, b) => b.cumulative - a.cumulative).slice(0, n);
}

export interface SentimentRatio {
  pos: number;
  neg: number;
  neutral: number;
  total: number;
}

export function sentimentRatio(items: { sentiment: "pos" | "neg" | "neutral" }[]): SentimentRatio {
  const r: SentimentRatio = { pos: 0, neg: 0, neutral: 0, total: 0 };
  for (const i of items) {
    r[i.sentiment] += 1;
    r.total += 1;
  }
  return r;
}
