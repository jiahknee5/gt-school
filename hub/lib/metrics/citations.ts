// Dual citations (WS4): every surfaced metric links to BOTH the module that OWNS the
// number (/m/<homeModule>) AND the data source it comes from (/dev/integrations#<id>).
// This is the single place mapping a KPI `source` to its integration anchor, so the
// Dashboard scorecard, the Status metric contract, and any future surface cite the same.

import { moduleHref } from "@/lib/modules";

/** KPI `source` (lib/metrics/registry) → integration_id (lib/integrations/catalog). */
export const SOURCE_INTEGRATION: Record<string, string> = {
  supabase: "supabase_app_form",
  hubspot: "hubspot_crm",
  ga4: "ga4_gt_school",
  manual: "hub_manual_workflows",
  stripe: "stripe",
};

/** Link to the data source's row on the Integrations dev surface (anchored by id). */
export function sourceHref(source: string): string {
  const id = SOURCE_INTEGRATION[source] ?? source;
  return `/dev/integrations#${id}`;
}

/** Link to the module that owns the number. */
export function moduleCiteHref(homeModule: string): string {
  return moduleHref(homeModule);
}

/** Short, human label for a source (the connector name as shown on the board). */
export function sourceLabel(source: string): string {
  switch (source) {
    case "supabase":
      return "Supabase";
    case "hubspot":
      return "HubSpot";
    case "ga4":
      return "GA4";
    case "stripe":
      return "Stripe";
    case "manual":
      return "Manual";
    default:
      return source;
  }
}
