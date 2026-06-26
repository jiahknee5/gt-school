// engagement.ts — the ONLY source of the engagement tier (Renée Adler's catch).
//
// Tier (clicked > opened > cold) is a function of HubSpot engagement signals ONLY
// (lead_score + a deterministic email open/click stand-in). It deliberately does NOT
// read funnel_stage / enrollments, so the heatmap's conversion% (which reads funnel only)
// is statistically DISJOINT from the tier — no circularity (Dr. Nair, invariant #2).

import type { Family } from "@/lib/seed/types";
import { hash01 } from "./util";

export type EngagementTier = "clicked" | "opened" | "cold";

export const ENGAGEMENT_FIELDS = ["lead_score", "hs_engagement.opened", "hs_engagement.clicked"] as const;
/** Conversion is computed from these and ONLY these (disjoint from ENGAGEMENT_FIELDS). */
export const CONVERSION_FIELDS = ["funnel_stage", "enrollments.paid"] as const;

export interface EngagementSignal {
  familyId: string;
  opened: boolean;
  clicked: boolean;
  tier: EngagementTier;
}

/** Deterministic email engagement stand-in for a family (HubSpot-side, no funnel read). */
export function engagementSignal(f: Family): EngagementSignal {
  const openP = hash01(f.id + ":open");
  const clickP = hash01(f.id + ":click");
  const scoreLift = (f.lead_score ?? 25) / 100; // higher HubSpot score → more engaged
  const opened = openP < 0.35 + 0.4 * scoreLift;
  const clicked = opened && clickP < 0.25 + 0.45 * scoreLift;
  const tier: EngagementTier = clicked ? "clicked" : opened ? "opened" : "cold";
  return { familyId: f.id, opened, clicked, tier };
}

export function engagementTier(f: Family): EngagementTier {
  return engagementSignal(f).tier;
}

export interface TierMix {
  clicked: number;
  opened: number;
  cold: number;
  total: number;
}

export function tierMix(families: Family[]): TierMix {
  const mix: TierMix = { clicked: 0, opened: 0, cold: 0, total: 0 };
  for (const f of families) {
    mix[engagementTier(f)] += 1;
    mix.total += 1;
  }
  return mix;
}
