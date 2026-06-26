// metrics.ts — channel performance with SEPARATE rows per platform (invariant #2): Meta
// FB and IG are distinct (from meta_insights.publisher_platform), X is its own row (from
// x_posts), email from HubSpot (stand-in), Substack/podcast are manual v1. There is never
// a blended "social" row (Ferraro). Single metric definitions, no per-view recomputation.

import type { SeedDataset } from "@/lib/seed/types";
import type { Channel } from "./pieces";

export interface ChannelPerf {
  channel: Channel;
  source: string;
  reach: number;
  impressions: number;
  clicks: number;
  engagements: number;
}

function sum<T>(rows: T[], f: (r: T) => number): number {
  return rows.reduce((a, r) => a + f(r), 0);
}

export function channelPerformance(ds: SeedDataset): ChannelPerf[] {
  const fb = ds.meta_insights.filter((m) => m.publisher_platform === "facebook");
  const ig = ds.meta_insights.filter((m) => m.publisher_platform === "instagram");
  const out: ChannelPerf[] = [
    {
      channel: "facebook",
      source: "meta",
      reach: sum(fb, (m) => m.reach),
      impressions: sum(fb, (m) => m.impressions),
      clicks: sum(fb, (m) => m.clicks),
      engagements: sum(fb, (m) => m.clicks),
    },
    {
      channel: "instagram",
      source: "meta",
      reach: sum(ig, (m) => m.reach),
      impressions: sum(ig, (m) => m.impressions),
      clicks: sum(ig, (m) => m.clicks),
      engagements: sum(ig, (m) => m.clicks),
    },
    {
      channel: "x",
      source: "x_api",
      reach: sum(ds.x_posts, (p) => p.public_metrics.impression_count),
      impressions: sum(ds.x_posts, (p) => p.public_metrics.impression_count),
      clicks: sum(ds.x_posts, (p) => p.non_public_metrics.url_link_clicks),
      engagements: sum(
        ds.x_posts,
        (p) => p.public_metrics.like_count + p.public_metrics.retweet_count + p.public_metrics.reply_count,
      ),
    },
    // Email (HubSpot stand-in) + manual Substack/podcast — deterministic v1 figures.
    { channel: "email", source: "hubspot", reach: 4200, impressions: 4200, clicks: 612, engagements: 612 },
    { channel: "substack", source: "manual", reach: 1850, impressions: 1850, clicks: 240, engagements: 240 },
    { channel: "podcast", source: "manual", reach: 980, impressions: 980, clicks: 0, engagements: 310 },
  ];
  return out.sort((a, b) => b.reach - a.reach);
}

/** Manual v1 audience figures surfaced on the overview (API later). */
export const MANUAL_AUDIENCE = {
  substackSubscribers: 1850,
  substackGrowthPct: 0.07,
  podcastListens: 980,
} as const;
