/**
 * attribution.ts — PURE UTM/source attribution health for CRM Ops (§7b).
 *
 * UTM attribution is KNOWN broken (a permanent red flag until rebuilt). This module
 * makes "broken" diagnosable instead of a vibe:
 *   - UTM health % (resolved vs (not set)/malformed),
 *   - the exact broken records (drill-in), and
 *   - the form → Supabase app_form → HubSpot chain status PER HOP, naming the HubSpot
 *     property (`HS_PROP_FOR_FIELD.source = gt_utm_source`) the source maps to.
 *
 * No PII leaves: the broken drill-in carries family id + the (broken) source value
 * only — never email/child/TEFA/income.
 */

import { HS_PROP_FOR_FIELD } from "../connectors/hubspot";
import type { Family } from "../seed/types";
import { isMalformedSource } from "./detect";
import { isExpectedUnreliable } from "./parity-view";

export interface UtmHealth {
  total: number;
  resolved: number;
  broken: number;
  healthPct: number; // 0–100
}

export interface BrokenUtmRecord {
  familyId: string;
  source: string | null;
  utmCampaign: string | null;
  reason: string;
}

export type HopStatus = "ok" | "degraded" | "broken";

export interface ChainHop {
  step: number;
  hop: string;
  system: string;
  field: string;
  status: HopStatus;
  detail: string;
}

export interface AttributionSummary {
  health: UtmHealth;
  /** Bounded sample of broken records for the drill-in (full count is in `health.broken`). */
  brokenSample: BrokenUtmRecord[];
  chain: ChainHop[];
  /** The HubSpot property the `source` field mirrors — names the last hop precisely. */
  hsProperty: string;
  /** True while the `source` field_authority direction stays hs_to_app (the rebuild flips it). */
  hsAuthoritative: boolean;
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

/**
 * Summarize attribution health from the families snapshot. `sampleLimit` bounds the
 * drill-in list (the UI shows the count + a sample, not thousands of rows).
 */
export function summarizeAttribution(families: Family[], sampleLimit = 12): AttributionSummary {
  const total = families.length;
  const brokenRecords: BrokenUtmRecord[] = [];
  for (const f of families) {
    if (!isMalformedSource(f.source)) continue;
    const reason =
      f.source == null || f.source.trim() === ""
        ? "source not set"
        : f.source.includes("{{")
          ? "unrendered UTM template"
          : `sentinel value '${f.source}'`;
    brokenRecords.push({
      familyId: f.id,
      source: f.source,
      utmCampaign: f.utm_campaign,
      reason,
    });
  }
  const broken = brokenRecords.length;
  const resolved = total - broken;
  const healthPct = total === 0 ? 100 : round2((100 * resolved) / total);

  // Per-hop chain status. Form capture is assumed healthy (we receive submissions);
  // Supabase degrades by the broken share; HubSpot is the known-unreliable mirror.
  const supabaseStatus: HopStatus = broken === 0 ? "ok" : healthPct >= 90 ? "degraded" : "broken";
  const hsProperty = HS_PROP_FOR_FIELD.source; // gt_utm_source
  const hsAuthoritative = !isExpectedUnreliable("source") ? false : true; // source is expected_unreliable → hs mirror is the broken copy

  const chain: ChainHop[] = [
    {
      step: 1,
      hop: "Lead form capture",
      system: "Form (gt.school / registration form)",
      field: "utm_source",
      status: "ok",
      detail: "Submissions are received; UTM params are captured at the form when present.",
    },
    {
      step: 2,
      hop: "Supabase app_form",
      system: "Supabase",
      field: "source",
      status: supabaseStatus,
      detail: `${resolved}/${total} families carry a resolved source; ${broken} are (not set) or malformed.`,
    },
    {
      step: 3,
      hop: "HubSpot mirror",
      system: "HubSpot",
      field: hsProperty,
      status: "broken",
      detail: `'${hsProperty}' is the expected-unreliable mirror of source (hs_to_app); the rebuild must make the form-captured UTM authoritative.`,
    },
  ];

  return {
    health: { total, resolved, broken, healthPct },
    brokenSample: brokenRecords.slice(0, sampleLimit),
    chain,
    hsProperty,
    hsAuthoritative,
  };
}
