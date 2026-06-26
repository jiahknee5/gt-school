// ingest.ts — normalize Conversations/manual/app_form into objections + family quotes,
// de-duplicated at ingest so one thread ≠ many objections (invariant #1). The dedup
// anchor is (source_ref, theme): re-delivering the same thread/theme is a no-op. Themes
// resolve through the closed set (themes.ts); family is resolved deterministically.

import type { SeedDataset, Family } from "@/lib/seed/types";
import { suggestTheme, type Theme } from "./themes";

const DAY = 86_400_000;

export interface Objection {
  id: string;
  theme: Theme;
  verbatim: string;
  source: string;
  sourceRef: string; // dedup anchor
  themeConfidence: number;
  sentiment: "pos" | "neg" | "neutral";
  familyId: string | null;
  surfacedAt: string;
}

export interface FamilyQuote {
  id: string;
  quote: string;
  sentiment: "pos" | "neg" | "neutral";
  source: string;
  familyId: string | null;
  consent: boolean;
  redacted: boolean;
  quoteOfWeek: boolean;
  capturedAt: string;
}

// Seeded verbatims spanning all 8 themes (incl. the verbatim gifted_enough phrasing).
const VERBATIMS: { body: string; source: string }[] = [
  { body: "Is my kid gifted enough for this program?", source: "hubspot_conversations" },
  { body: "What's the tuition and are there scholarships? It feels expensive.", source: "hubspot_conversations" },
  { body: "Are you accredited? Will the diploma be recognized?", source: "bdr_note" },
  { body: "Can we change the schedule? The start date and hours don't work.", source: "event" },
  { body: "How rigorous is the math curriculum for a 4th grader?", source: "shadow_day_survey" },
  { body: "I worry my child won't make friends — is there enough social time?", source: "hubspot_conversations" },
  { body: "Does the platform need special tech? Our wifi is spotty.", source: "form" },
  { body: "Just wondering about parking at the campus.", source: "bdr_note" },
  { body: "Is she really gifted enough or will she fall behind?", source: "hubspot_conversations" },
  { body: "The price is the main blocker for us right now.", source: "event" },
];

const POSITIVE_QUOTES = [
  "My son finally feels challenged — he asks to do more.",
  "Best decision we made; the self-paced model fits her.",
  "The community of gifted families is exactly what we needed.",
];

function pickFamily(families: Family[], i: number): Family | null {
  return families[(i * 37) % families.length] ?? null;
}

function sentimentOf(theme: Theme): "pos" | "neg" | "neutral" {
  if (theme === "other") return "neutral";
  return "neg"; // objections skew negative
}

/**
 * Build raw objections (with a deliberate re-surfaced duplicate + a multi-objection
 * thread) so dedup is provable. surfaced_at is spread across the 4-week window.
 */
export function buildRawObjections(ds: SeedDataset): Objection[] {
  const asOf = Date.parse(ds.manifest.generatedAt);
  const raw: Objection[] = [];
  VERBATIMS.forEach((v, i) => {
    const sug = suggestTheme(v.body);
    const fam = pickFamily(ds.families, i);
    const sourceRef = `thread_${i}`;
    raw.push({
      id: `obj_${i}`,
      theme: sug.theme,
      verbatim: v.body,
      source: v.source,
      sourceRef,
      themeConfidence: sug.confidence,
      sentiment: sentimentOf(sug.theme),
      familyId: fam?.id ?? null,
      surfacedAt: new Date(asOf - (i % 28) * DAY).toISOString(),
    });
  });
  // Deliberate re-surfaced thread (same source_ref + theme as obj_0) → must dedup away.
  raw.push({ ...raw[0], id: "obj_dup", surfacedAt: new Date(asOf - 1 * DAY).toISOString() });
  // Multi-objection thread: same source_ref as obj_1 but a DIFFERENT theme → kept.
  raw.push({
    id: "obj_multi",
    theme: "scheduling",
    verbatim: "Also, can we change the schedule?",
    source: "hubspot_conversations",
    sourceRef: "thread_1",
    themeConfidence: 0.85,
    sentiment: "neg",
    familyId: pickFamily(ds.families, 1)?.id ?? null,
    surfacedAt: new Date(asOf - 2 * DAY).toISOString(),
  });
  return raw;
}

/** Dedup by (source_ref, theme): re-delivery of the same thread/theme is a no-op. */
export function dedupObjections(raw: Objection[]): Objection[] {
  const seen = new Set<string>();
  const out: Objection[] = [];
  for (const o of raw) {
    const key = `${o.sourceRef}:${o.theme}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }
  return out;
}

export function buildObjections(ds: SeedDataset): Objection[] {
  return dedupObjections(buildRawObjections(ds));
}

export function buildFamilyQuotes(ds: SeedDataset): FamilyQuote[] {
  const asOf = Date.parse(ds.manifest.generatedAt);
  const quotes: FamilyQuote[] = POSITIVE_QUOTES.map((q, i) => ({
    id: `quote_${i}`,
    quote: q,
    sentiment: "pos",
    source: "hubspot_conversations",
    familyId: pickFamily(ds.families, i + 5)?.id ?? null,
    consent: true,
    redacted: true,
    quoteOfWeek: i === 0,
    capturedAt: new Date(asOf - i * 3 * DAY).toISOString(),
  }));
  // One UNCONSENTED quote — must never surface publicly (consent gate, invariant #5).
  quotes.push({
    id: "quote_unconsented",
    quote: "We're still deciding but the price is steep.",
    sentiment: "neg",
    source: "bdr_note",
    familyId: pickFamily(ds.families, 9)?.id ?? null,
    consent: false,
    redacted: false,
    quoteOfWeek: false,
    capturedAt: new Date(asOf - DAY).toISOString(),
  });
  return quotes;
}

/** Public Voice-of-Families feed: consented quotes only (Schwartz "don't ship"). */
export function publicQuotes(quotes: FamilyQuote[]): FamilyQuote[] {
  return quotes.filter((q) => q.consent);
}

export function quoteOfWeek(quotes: FamilyQuote[]): FamilyQuote | null {
  return publicQuotes(quotes).find((q) => q.quoteOfWeek) ?? null;
}
