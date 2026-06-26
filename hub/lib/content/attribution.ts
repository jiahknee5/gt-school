// attribution.ts — content_to_conversion via the app-authoritative UTM spine:
// content_pieces.utm_campaign → families.utm_campaign → app_form funnel_stage. Conversion
// is a MEASURED ratio against the seed (invariant #3) — there is NO hard-coded 42 here.
// Missing UTM persists as "(not set)" and is still counted (invariant #4), never dropped.

import type { Family, SeedDataset } from "@/lib/seed/types";
import type { Channel, ContentPiece } from "./pieces";

const NOT_SET = "(not set)";
const CONVERTED = new Set(["deposit", "enrolled"]);

function utmOf(f: Family): string {
  return f.utm_campaign ?? NOT_SET;
}

/** conversions per utm_campaign from app_form (deposit/enrolled families). */
export function conversionsByCampaign(families: Family[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const f of families) {
    if (!CONVERTED.has(f.funnel_stage ?? "")) continue;
    const k = utmOf(f);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export interface PieceConversion {
  pieceId: string;
  title: string;
  channel: Channel;
  utmCampaign: string;
  conversions: number;
}

export function contentToConversion(pieces: ContentPiece[], ds: SeedDataset): PieceConversion[] {
  const byCampaign = conversionsByCampaign(ds.families);
  return pieces.map((p) => ({
    pieceId: p.id,
    title: p.title,
    channel: p.channel,
    utmCampaign: p.utmCampaign,
    // "(not set)" pieces still resolve against "(not set)" families — counted, not dropped.
    conversions: byCampaign.get(p.utmCampaign) ?? 0,
  }));
}

export interface ChannelConversion {
  channel: Channel;
  conversions: number;
  ratio: number; // share of total attributed conversions
}

/** Per-channel conversion share — the X figure is whatever the seed yields (measured). */
export function channelConversionShare(pieces: ContentPiece[], ds: SeedDataset): ChannelConversion[] {
  const perPiece = contentToConversion(pieces, ds);
  const byChannel = new Map<Channel, number>();
  // De-dupe campaigns per channel so two pieces on the same campaign don't double-count.
  const seen = new Map<Channel, Set<string>>();
  for (const pc of perPiece) {
    const set = seen.get(pc.channel) ?? new Set<string>();
    if (set.has(pc.utmCampaign)) continue;
    set.add(pc.utmCampaign);
    seen.set(pc.channel, set);
    byChannel.set(pc.channel, (byChannel.get(pc.channel) ?? 0) + pc.conversions);
  }
  const total = [...byChannel.values()].reduce((a, b) => a + b, 0) || 1;
  return [...byChannel.entries()]
    .map(([channel, conversions]) => ({ channel, conversions, ratio: Number((conversions / total).toFixed(4)) }))
    .sort((a, b) => b.conversions - a.conversions);
}

/** The "X conversion engine" ratio — MEASURED, returned with its denominator. */
export function xConversionRatio(pieces: ContentPiece[], ds: SeedDataset): { ratio: number; xConversions: number; total: number } {
  const shares = channelConversionShare(pieces, ds);
  const x = shares.find((s) => s.channel === "x");
  const total = shares.reduce((a, b) => a + b.conversions, 0);
  return { ratio: x?.ratio ?? 0, xConversions: x?.conversions ?? 0, total };
}
