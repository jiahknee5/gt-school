// themes.ts — the CLOSED objection theme set (PRD §3 Module 9) + auto-theming. Nothing
// is silently dumped into `other`: the verbatim "is my kid gifted enough" maps to
// gifted_enough (invariant #2). Auto-theming suggests a theme + confidence; a human may
// re-tag (audit retained).

export const THEMES = [
  "accreditation",
  "cost",
  "gifted_enough",
  "scheduling",
  "curriculum",
  "social",
  "tech",
  "other",
] as const;

export type Theme = (typeof THEMES)[number];

export function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value);
}

export interface ThemeSuggestion {
  theme: Theme;
  confidence: number; // 0..1
}

/** Deterministic keyword auto-theming. Returns a theme + confidence (low → other). */
export function suggestTheme(verbatim: string): ThemeSuggestion {
  const t = verbatim.toLowerCase();
  if (/gifted enough|smart enough|qualify|really gifted|truly gifted/.test(t)) return { theme: "gifted_enough", confidence: 0.95 };
  if (/accredit|diploma|transcript|recogniz|college admit/.test(t)) return { theme: "accreditation", confidence: 0.9 };
  if (/cost|price|tuition|afford|scholarship|expensive|pay/.test(t)) return { theme: "cost", confidence: 0.92 };
  if (/schedul|time|when|hours|calendar|start date/.test(t)) return { theme: "scheduling", confidence: 0.85 };
  if (/curriculum|subject|grade level|learn|rigor|math|reading/.test(t)) return { theme: "curriculum", confidence: 0.85 };
  if (/friend|social|socializ|peers|isolat|lonely/.test(t)) return { theme: "social", confidence: 0.88 };
  if (/tech|computer|screen|device|wifi|software|platform/.test(t)) return { theme: "tech", confidence: 0.8 };
  return { theme: "other", confidence: 0.4 };
}
