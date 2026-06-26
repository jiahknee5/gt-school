/**
 * freshness.ts — per-connector last-sync → stale/fresh evaluation (Dana's "stale-but-green").
 *
 * Each scorecard row carries its source connector's last-sync. A connector whose
 * last-sync exceeds its SLA renders STALE even if its number looks healthy. The seed
 * deliberately ages ONE connector (X) past SLA so the stale badge is always provable.
 */

import type { SeedDataset } from "@/lib/seed/types";

export type FreshnessStatus = "fresh" | "stale" | "error";

export interface ConnectorFreshness {
  connector: string;
  lastSyncAt: string;
  freshnessSlaMinutes: number;
  ageMinutes: number;
  status: FreshnessStatus;
}

const SLA_MINUTES: Record<string, number> = {
  supabase: 15,
  hubspot: 60,
  meta: 1440,
  ga4: 1440,
  x: 1440,
  manual: 10080, // weekly manual entry
};

/**
 * Build connector freshness as-of the dataset clock. Most connectors synced recently;
 * `x` is deliberately aged past its SLA (the seeded stale connector, invariant #7).
 */
export function connectorFreshness(ds: SeedDataset): ConnectorFreshness[] {
  const asOf = Date.parse(ds.manifest.generatedAt);
  const MIN = 60_000;
  // Minutes-ago each connector last synced (deterministic; `x` exceeds its SLA).
  const lastSyncAgo: Record<string, number> = {
    supabase: 8,
    hubspot: 41,
    meta: 320,
    ga4: 700,
    x: 4320, // 3 days → > 1440 SLA → stale
    manual: 2880,
  };

  return Object.keys(SLA_MINUTES).map((connector) => {
    const ageMinutes = lastSyncAgo[connector] ?? 0;
    const sla = SLA_MINUTES[connector];
    const status: FreshnessStatus = ageMinutes > sla ? "stale" : "fresh";
    return {
      connector,
      lastSyncAt: new Date(asOf - ageMinutes * MIN).toISOString(),
      freshnessSlaMinutes: sla,
      ageMinutes,
      status,
    };
  });
}

export function freshnessFor(connector: string, all: ConnectorFreshness[]): ConnectorFreshness | undefined {
  return all.find((c) => c.connector === connector);
}

export function humanizeAge(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}
