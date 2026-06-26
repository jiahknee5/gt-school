// heatmap.ts — engagement-tier × attribute conversion heatmap (the module centrepiece).
//
// Rows = engagement tier (clicked/opened/cold, from engagement.ts). Cols = an app_form
// attribute (income_band / grade). Cell = conversion% (commit = funnel_stage 'deposit')
// with n and a Wilson 95% CI. Cells with n < 25 are SUPPRESSED (never reported as a
// finding) — Dr. Nair's small-cell honesty (invariant #3). Conversion reads funnel only,
// tier reads engagement only → no circularity (invariant #2).

import type { Family } from "@/lib/seed/types";
import { engagementTier, type EngagementTier } from "./engagement";
import { wilsonHalfWidth } from "./util";

export const MIN_CELL_N = 25;
export type HeatAttribute = "income_band" | "grade";

const TIERS: EngagementTier[] = ["clicked", "opened", "cold"];

export interface HeatCell {
  tier: EngagementTier;
  col: string;
  n: number;
  conversions: number;
  pct: number | null; // null when suppressed
  ci: number | null; // Wilson half-width (pct points)
  suppressed: boolean;
}

export interface Heatmap {
  attribute: HeatAttribute;
  cols: string[];
  cells: HeatCell[];
}

function isCommit(f: Family): boolean {
  return f.funnel_stage === "deposit";
}

function attrValue(f: Family, attribute: HeatAttribute): string {
  const v = attribute === "income_band" ? f.income_band : f.grade;
  return v ?? "(not set)";
}

export function buildHeatmap(families: Family[], attribute: HeatAttribute): Heatmap {
  const cols = [...new Set(families.map((f) => attrValue(f, attribute)))].sort();
  const cells: HeatCell[] = [];
  for (const tier of TIERS) {
    for (const col of cols) {
      const cohort = families.filter((f) => engagementTier(f) === tier && attrValue(f, attribute) === col);
      const n = cohort.length;
      const conversions = cohort.filter(isCommit).length;
      const suppressed = n < MIN_CELL_N;
      cells.push({
        tier,
        col,
        n,
        conversions,
        pct: suppressed ? null : Number(((100 * conversions) / n).toFixed(1)),
        ci: suppressed ? null : wilsonHalfWidth(conversions, n),
        suppressed,
      });
    }
  }
  return { attribute, cols, cells };
}

/** Conversion% per engagement tier across the whole population (the headline predictor). */
export function tierConversion(families: Family[]): { tier: EngagementTier; n: number; pct: number }[] {
  return TIERS.map((tier) => {
    const cohort = families.filter((f) => engagementTier(f) === tier);
    const n = cohort.length;
    const conversions = cohort.filter(isCommit).length;
    return { tier, n, pct: n > 0 ? Number(((100 * conversions) / n).toFixed(1)) : 0 };
  });
}
