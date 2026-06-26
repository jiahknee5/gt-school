// cross-links.ts — idempotent inbound consumers (invariant #7). A re-delivered Grassroots
// testimonial creates EXACTLY ONE stub; a VoC objection creates exactly one brief. Dedup
// rides a processed-events ledger keyed (source, event_id) — mirrors `processed_events`.
// Camp content is a read-only cross-link (never written here).

import type { ContentPiece, PieceType } from "./pieces";

export interface ProcessedKey {
  source: string;
  eventId: string;
}

function keyOf(k: ProcessedKey): string {
  return `${k.source}:${k.eventId}`;
}

export interface StubResult {
  pieces: ContentPiece[];
  processed: Set<string>;
  created: boolean;
}

/** Grassroots testimonial → one concept stub, consent required (minor usage rights). */
export function ingestTestimonial(
  pieces: ContentPiece[],
  processed: Set<string>,
  testimonialId: string,
  opts: { title: string; type?: PieceType } = { title: "Testimonial" },
): StubResult {
  const k = keyOf({ source: "grassroots", eventId: testimonialId });
  if (processed.has(k)) return { pieces, processed, created: false };
  const next = new Set(processed);
  next.add(k);
  const piece: ContentPiece = {
    id: `piece_gr_${testimonialId}`,
    sheetRowId: null,
    title: opts.title,
    owner: "the Content Owner",
    type: opts.type ?? "video",
    status: "concept",
    channel: "instagram",
    personaTarget: "gifted-parent",
    publishDate: "2026-07-01",
    utmCampaign: "(not set)",
    source: "grassroots_stub",
    originRef: testimonialId,
    consentStatus: "required",
    programKey: null,
    readOnly: false,
  };
  return { pieces: [...pieces, piece], processed: next, created: true };
}

/** Admissions VoC objection → one concept brief. */
export function ingestObjectionBrief(
  pieces: ContentPiece[],
  processed: Set<string>,
  objectionId: string,
  theme: string,
): StubResult {
  const k = keyOf({ source: "voc", eventId: objectionId });
  if (processed.has(k)) return { pieces, processed, created: false };
  const next = new Set(processed);
  next.add(k);
  const piece: ContentPiece = {
    id: `piece_voc_${objectionId}`,
    sheetRowId: null,
    title: `Brief: answer the "${theme}" objection`,
    owner: "the Content Owner",
    type: "article",
    status: "concept",
    channel: "substack",
    personaTarget: "gifted-parent",
    publishDate: "2026-07-05",
    utmCampaign: "(not set)",
    source: "voc_brief",
    originRef: objectionId,
    consentStatus: "not_required",
    programKey: null,
    readOnly: false,
  };
  return { pieces: [...pieces, piece], processed: next, created: true };
}
