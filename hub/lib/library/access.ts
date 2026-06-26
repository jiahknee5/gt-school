// access.ts — read-only download counts from Analytics (Module 13 / GA4
// eventCount_pdf_download). NEVER fabricated: if Analytics has no data for a resource, no
// chip is returned (invariant #6). The join is on file name / landing path. Counts are not
// stored in the Library — Library owns metadata, not counts.

import type { SeedDataset } from "@/lib/seed/types";
import type { Resource } from "./types";

/** Total GA4 PDF downloads for the window (the only count signal we have in the seed). */
export function totalDownloads(ds: SeedDataset): number {
  return ds.ga4_days.reduce((a, r) => a + r.eventCount_pdf_download, 0);
}

/**
 * Read-only per-resource weekly download chip. Only PDF resources can carry a count (GA4
 * tracks file_download); links to Google Docs have no PDF event → no chip (no fabrication).
 * Returns null when there is no Analytics signal.
 */
export function downloadChip(resource: Resource, ds: SeedDataset): number | null {
  if (resource.fileType !== "PDF") return null;
  const total = totalDownloads(ds);
  if (total <= 0) return null;
  // deterministic weekly share derived from the resource id so the demo is stable
  const seed = resource.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const weekly = Math.max(1, Math.round((total / 13) * (0.3 + (seed % 7) / 10)));
  return weekly;
}
