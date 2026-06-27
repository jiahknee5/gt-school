import { describe, expect, it } from "vitest";
import { generate } from "@/lib/seed/generate";
import { KPI_DEFINITIONS } from "@/lib/metrics/registry";
import { buildIntegrationAccounts } from "@/lib/integrations/catalog";
import { SOURCE_INTEGRATION, sourceHref, moduleCiteHref } from "@/lib/metrics/citations";
import { moduleBySlug } from "@/lib/modules";

const ds = generate({ seed: 424242, families: 1200 });
const integrationIds = new Set(buildIntegrationAccounts(ds).map((a) => a.integration_id));

describe("WS4 dual citations — every KPI traces to a module AND a real integration", () => {
  it("every KPI source maps to an integration_id that exists in the catalog", () => {
    for (const def of KPI_DEFINITIONS) {
      const mapped = SOURCE_INTEGRATION[def.source];
      expect(mapped, `source "${def.source}" (${def.key}) has no integration mapping`).toBeTruthy();
      expect(integrationIds.has(mapped), `integration "${mapped}" not in catalog`).toBe(true);
    }
  });

  it("every KPI homeModule resolves to a real module route", () => {
    for (const def of KPI_DEFINITIONS) {
      expect(moduleBySlug(def.homeModule), `module "${def.homeModule}" missing`).toBeDefined();
      expect(moduleCiteHref(def.homeModule)).toBe(`/m/${def.homeModule}`);
    }
  });

  it("sourceHref anchors to the integration's row on the Integrations surface", () => {
    expect(sourceHref("hubspot")).toBe("/dev/integrations#hubspot_crm");
    expect(sourceHref("supabase")).toBe("/dev/integrations#supabase_app_form");
    expect(sourceHref("ga4")).toBe("/dev/integrations#ga4_gt_school");
  });
});
