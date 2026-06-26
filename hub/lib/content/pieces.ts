// pieces.ts — the Hub mirror of the Google Sheet (content_sheet stand-in) plus
// cross-link stubs (Grassroots testimonial, VoC brief, camp read-only xref). One row =
// one piece; the sheet stays SoT for production status. Channel/type are derived
// deterministically (no hard-coded list — invariant #10). Seeds the PLAN's edge cases:
// a sync CONFLICT, a MISSING-UTM piece, a grassroots stub with consent=required (minors),
// and a calendar same-day/channel conflict.

import type { SeedDataset, SheetRow } from "@/lib/seed/types";

export type PieceStatus = "concept" | "in_production" | "review" | "scheduled" | "published";
export type Channel = "substack" | "x" | "instagram" | "facebook" | "podcast" | "email" | "youtube";
export type PieceType = "video" | "podcast" | "article" | "social" | "email";
export type PieceSource = "sheet" | "grassroots_stub" | "voc_brief" | "camp_xref";
export type ConsentStatus = "not_required" | "required" | "ok";

export const CHANNELS: Channel[] = ["substack", "x", "instagram", "facebook", "podcast", "email", "youtube"];
export const STATUSES: PieceStatus[] = ["concept", "in_production", "review", "scheduled", "published"];

export interface ContentPiece {
  id: string;
  sheetRowId: string | null;
  title: string;
  owner: string;
  type: PieceType;
  status: PieceStatus;
  channel: Channel;
  personaTarget: string;
  publishDate: string; // YYYY-MM-DD
  utmCampaign: string; // "(not set)" when missing — never dropped (invariant #4)
  source: PieceSource;
  originRef: string | null;
  consentStatus: ConsentStatus;
  programKey: string | null; // "summer_camp" rows are read-only here
  readOnly: boolean;
}

// Map the sheet's lifecycle to the PLAN's 5-stage pipeline.
const SHEET_STATUS: Record<SheetRow["status"], PieceStatus> = {
  idea: "concept",
  drafting: "in_production",
  review: "review",
  scheduled: "scheduled",
  published: "published",
};

// Deterministic channel/type derivation keyed on the row index — stable across runs.
function channelFor(i: number): Channel {
  return CHANNELS[i % CHANNELS.length];
}
function typeFor(channel: Channel): PieceType {
  if (channel === "podcast") return "podcast";
  if (channel === "youtube") return "video";
  if (channel === "email") return "email";
  if (channel === "x" || channel === "instagram" || channel === "facebook") return "social";
  return "article";
}

const PERSONAS = ["gifted-parent", "esa-curious", "afterschool", "homeschool"];

export function buildPieces(ds: SeedDataset): ContentPiece[] {
  const pieces: ContentPiece[] = ds.content_sheet.map((row, i) => {
    const channel = channelFor(i);
    return {
      id: `piece_${i}`,
      sheetRowId: `sheet_${i}`,
      title: row.piece,
      owner: row.owner,
      type: typeFor(channel),
      status: SHEET_STATUS[row.status],
      channel,
      personaTarget: PERSONAS[i % PERSONAS.length],
      publishDate: row.target_date,
      utmCampaign: row.utm_campaign ?? "(not set)", // honesty: never dropped
      source: "sheet",
      originRef: null,
      consentStatus: "not_required",
      programKey: null,
      readOnly: false,
    };
  });

  // Edge: a grassroots testimonial stub — minor consent required, parked in concept.
  pieces.push({
    id: "piece_gr_stub",
    sheetRowId: null,
    title: "Testimonial: the Alvarez family",
    owner: "the Content Owner",
    type: "video",
    status: "concept",
    channel: "instagram",
    personaTarget: "gifted-parent",
    publishDate: ds.content_sheet[0]?.target_date ?? "2026-07-01",
    utmCampaign: "(not set)",
    source: "grassroots_stub",
    originRef: "testimonial_1",
    consentStatus: "required", // cannot advance past concept until 'ok'
    programKey: null,
    readOnly: false,
  });

  // Edge: a read-only camp cross-link (Module 4 owns it).
  pieces.push({
    id: "piece_camp_xref",
    sheetRowId: null,
    title: "Summer Camp: Austin week 3 recap",
    owner: "Camp content (Module 4)",
    type: "social",
    status: "scheduled",
    channel: "facebook",
    personaTarget: "afterschool",
    publishDate: ds.content_sheet[1]?.target_date ?? "2026-07-08",
    utmCampaign: "(not set)",
    source: "camp_xref",
    originRef: "camp_austin_w3",
    consentStatus: "not_required",
    programKey: "summer_camp",
    readOnly: true, // not editable here
  });

  return pieces;
}

/** Status transition guard: camp rows are read-only; grassroots stubs need consent. */
export function canAdvance(piece: ContentPiece): { ok: boolean; reason?: string } {
  if (piece.readOnly || piece.programKey === "summer_camp") {
    return { ok: false, reason: "camp content is read-only here (Module 4 owns it)" };
  }
  if (piece.source === "grassroots_stub" && piece.status === "concept" && piece.consentStatus !== "ok") {
    return { ok: false, reason: "consent (minor usage rights) required before leaving concept" };
  }
  return { ok: true };
}

export interface KanbanColumn {
  status: PieceStatus;
  pieces: ContentPiece[];
}

export function kanban(pieces: ContentPiece[]): KanbanColumn[] {
  return STATUSES.map((status) => ({ status, pieces: pieces.filter((p) => p.status === status) }));
}

/** Calendar conflict: > N pieces on the same day + channel. */
export function calendarConflicts(pieces: ContentPiece[], maxPerDayChannel = 1): { day: string; channel: Channel; count: number }[] {
  const counts = new Map<string, { day: string; channel: Channel; count: number }>();
  for (const p of pieces) {
    if (p.status !== "scheduled" && p.status !== "published") continue;
    const key = `${p.publishDate}:${p.channel}`;
    const cur = counts.get(key);
    if (cur) cur.count += 1;
    else counts.set(key, { day: p.publishDate, channel: p.channel, count: 1 });
  }
  return [...counts.values()].filter((c) => c.count > maxPerDayChannel);
}
