// brand-voice.ts — the auditor runs in SUGGEST mode only (invariant #5). It emits inline
// advisory rows; it NEVER gates a status transition. A rules floor (deterministic) runs
// under an Auditor interface so the demo is record-replay reproducible — swap AiAuditor in
// later behind the same shape.

export type SuggestionStatus = "suggested" | "accepted" | "dismissed";

export interface BrandVoiceSuggestion {
  id: string;
  pieceId: string;
  spanStart: number;
  spanEnd: number;
  originalText: string;
  suggestedText: string;
  rationale: string;
  status: SuggestionStatus;
}

export interface Auditor {
  audit(pieceId: string, draft: string): BrandVoiceSuggestion[];
}

// Brand-voice rules floor: flag hedge words + jargon the GT voice avoids.
const RULES: { pattern: RegExp; suggested: string; rationale: string }[] = [
  { pattern: /\bworld-class\b/i, suggested: "no ceiling", rationale: "GT voice: concrete over generic superlatives." },
  { pattern: /\bsynergy\b/i, suggested: "fit", rationale: "Avoid corporate jargon." },
  { pattern: /\bvery unique\b/i, suggested: "unique", rationale: "'Unique' is absolute; drop the intensifier." },
  { pattern: /\bgifted students\b/i, suggested: "gifted kids", rationale: "Parent-facing, warmer register." },
];

export class RulesAuditor implements Auditor {
  audit(pieceId: string, draft: string): BrandVoiceSuggestion[] {
    const out: BrandVoiceSuggestion[] = [];
    RULES.forEach((rule, i) => {
      const m = rule.pattern.exec(draft);
      if (!m || m.index === undefined) return;
      out.push({
        id: `bvs_${pieceId}_${i}`,
        pieceId,
        spanStart: m.index,
        spanEnd: m.index + m[0].length,
        originalText: m[0],
        suggestedText: rule.suggested,
        rationale: rule.rationale,
        status: "suggested",
      });
    });
    return out;
  }
}

export const defaultAuditor: Auditor = new RulesAuditor();

/**
 * Publish gate is INDEPENDENT of suggestions — a piece with N open suggestions still
 * advances. This function exists to prove the non-blocking contract in tests.
 */
export function canPublishWithSuggestions(_suggestions: BrandVoiceSuggestion[]): boolean {
  return true;
}
