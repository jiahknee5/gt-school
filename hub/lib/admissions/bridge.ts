// bridge.ts — the objection→content bridge. A qualifying theme stubs exactly ONE open
// content_brief (idempotent: one open brief per theme, invariant #4). "Effectiveness" is
// a stored pre/post frequency delta with its window + denominator, labeled CORRELATIONAL
// — never a hard-coded "content fixed it" (Rahman).

import type { Theme } from "./themes";

export type BriefStatus = "open" | "in_production" | "published" | "closed";

export interface ContentBrief {
  id: string;
  objectionTheme: Theme;
  verbatimExamples: string[];
  suggestedAngle: string;
  targetPersona: string;
  urgency: "normal" | "high";
  status: BriefStatus;
  freqBefore: number;
  freqAfter: number | null;
  publishedAt: string | null;
  createdAt: string;
}

/** Idempotent: returns the existing OPEN brief for a theme, or creates one. */
export function stubBrief(
  existing: ContentBrief[],
  theme: Theme,
  verbatimExamples: string[],
  freqBefore: number,
  createdAt: string,
  urgency: "normal" | "high" = "normal",
): { briefs: ContentBrief[]; created: boolean; brief: ContentBrief } {
  const open = existing.find((b) => b.objectionTheme === theme && b.status !== "closed" && b.status !== "published");
  if (open) return { briefs: existing, created: false, brief: open };
  const brief: ContentBrief = {
    id: `brief_${theme}`,
    objectionTheme: theme,
    verbatimExamples,
    suggestedAngle: `Address the "${theme}" objection head-on with a parent-facing explainer.`,
    targetPersona: "gifted-parent",
    urgency,
    status: "open",
    freqBefore,
    freqAfter: null,
    publishedAt: null,
    createdAt,
  };
  return { briefs: [...existing, brief], created: true, brief };
}

export interface BridgeEffect {
  theme: Theme;
  freqBefore: number;
  freqAfter: number;
  delta: number;
  windowDays: number;
  label: "correlational";
}

/** Pre/post delta after publish — explicitly labeled correlational (no causal claim). */
export function bridgeEffect(brief: ContentBrief, freqAfter: number, windowDays = 14): BridgeEffect {
  return {
    theme: brief.objectionTheme,
    freqBefore: brief.freqBefore,
    freqAfter,
    delta: freqAfter - brief.freqBefore,
    windowDays,
    label: "correlational",
  };
}

/** Hit-rate = produced (published) ÷ sent (all briefs). */
export function bridgeHitRate(briefs: ContentBrief[]): number {
  if (briefs.length === 0) return 0;
  const produced = briefs.filter((b) => b.status === "published" || b.status === "closed").length;
  return Number((produced / briefs.length).toFixed(3));
}
