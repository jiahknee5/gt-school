import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import DevIntegrationsPage from "@/app/dev/integrations/page";
import {
  integrationCoverage,
  missingRequiredIntegrations,
  PRD_REQUIRED_INTEGRATION_IDS,
} from "@/lib/integrations/catalog";
import { generate } from "@/lib/seed/generate";

const ds = generate({ seed: 424242, families: 1200 });
const byId = new Map(ds.integration_accounts.map((row) => [row.integration_id, row]));

describe("integration source registry", () => {
  it("covers every required PRD and inferred operational source", () => {
    expect(missingRequiredIntegrations(ds.integration_accounts)).toEqual([]);
    expect(ds.integration_accounts).toHaveLength(PRD_REQUIRED_INTEGRATION_IDS.length);
    expect(byId.get("supabase_app_form")?.status).toBe("connected");
    expect(byId.get("stripe")?.phase).toBe("phase_1");
    expect(byId.get("gt_challenge_capture")?.module_slugs).toContain("gt-challenge");
  });

  it("documents why each source matters and how it joins into the Hub", () => {
    for (const row of ds.integration_accounts) {
      expect(row.business_purpose.length, row.integration_id).toBeGreaterThan(40);
      expect(row.why_important.length, row.integration_id).toBeGreaterThan(60);
      expect(row.module_slugs.length, row.integration_id).toBeGreaterThan(0);
      if (row.status !== "deferred") {
        expect(row.authoritative_for.length, row.integration_id).toBeGreaterThan(0);
        expect(row.join_keys.length, row.integration_id).toBeGreaterThan(0);
        expect(row.row_count, row.integration_id).toBeGreaterThan(0);
      }
    }
  });

  it("keeps GA4 properties and social channels separated instead of blending them", () => {
    expect(byId.get("ga4_gt_school")?.join_keys).toContain("site");
    expect(byId.get("ga4_anywhere")?.join_keys).toContain("site");
    expect(byId.get("meta_business")?.authoritative_for.join(" ")).toContain("Meta spend");
    expect(byId.get("x_api")?.status).toBe("degraded");
    expect(byId.get("x_api")?.known_gaps.join(" ")).toContain("stale connector");
  });

  it("creates one traceable sync run per integration account", () => {
    const runIds = new Set(ds.integration_sync_runs.map((run) => run.integration_id));
    expect(runIds.size).toBe(ds.integration_accounts.length);
    for (const account of ds.integration_accounts) {
      const run = ds.integration_sync_runs.find((row) => row.integration_id === account.integration_id);
      expect(run, account.integration_id).toBeDefined();
      if (account.status === "deferred") expect(run?.status).toBe("skipped");
      if (account.status === "degraded") expect(run?.status).toBe("warning");
    }
  });

  it("shows deferred optional sources as explicit gaps, not fake green integrations", () => {
    const coverage = integrationCoverage(ds.integration_accounts);
    expect(coverage.deferred).toBe(2);
    expect(byId.get("read_ai_transcripts")?.status).toBe("deferred");
    expect(byId.get("reconnectext_sms")?.status).toBe("deferred");
    expect(byId.get("read_ai_transcripts")?.known_gaps.length).toBeGreaterThan(0);
    expect(byId.get("reconnectext_sms")?.known_gaps.length).toBeGreaterThan(0);
  });

  it("renders the Admin integrations tab with source docs and sync trace rows", async () => {
    const html = renderToStaticMarkup(await DevIntegrationsPage());
    expect(html).toContain("Integrations");
    expect(html).toContain("required PRD and inferred operational sources are represented");
    expect(html).toContain("GT Challenge capture");
    expect(html).toContain("Recent sync activity");
    expect(html).toContain("Known gaps");
  });
});
