// The provenance harness: every Status claim is deterministically derived, self-evaluating,
// honesty-labeled, and cited to a real data source.

import { describe, expect, it } from "vitest";
import { generate } from "@/lib/seed/generate";
import { buildDerivations, DERIVATION_NOTE } from "@/lib/status/derivation";
import { buildIntegrationAccounts } from "@/lib/integrations/catalog";
import { SOURCE_INTEGRATION } from "@/lib/metrics/citations";

const ds = generate({ seed: 424242, families: 1200 });
const week = "2026-06-22";
const derivations = buildDerivations(ds, week);
const integrationIds = new Set(buildIntegrationAccounts(ds).map((a) => a.integration_id));

describe("derivation harness", () => {
  it("produces a graph for every surfaced metric, each with nodes + a self-eval", () => {
    expect(derivations.length).toBeGreaterThanOrEqual(10);
    for (const g of derivations) {
      expect(g.nodes.length, `${g.key} needs ≥2 nodes`).toBeGreaterThanOrEqual(2);
      expect(g.nodes.some((n) => n.role === "source"), `${g.key} needs a source node`).toBe(true);
      expect(g.nodes.some((n) => n.role === "output"), `${g.key} needs an output node`).toBe(true);
      expect(g.edges.length).toBe(g.nodes.length - 1);
      expect(g.rubric.mustState.length).toBeGreaterThan(0);
      expect(g.usedBy.length).toBeGreaterThan(0);
    }
  });

  it("every eval passes (rendered value == independently recomputed)", () => {
    for (const g of derivations) {
      expect(g.eval.pass, `${g.key}: expected ${g.eval.expected} == actual ${g.eval.actual}`).toBe(true);
      // The rendered value carries the eval'd core number (it may add display context like
      // "/ 180" or "· 67 late").
      expect(g.value).toContain(g.eval.actual);
    }
  });

  it("every honesty class is one of measured | derived | stand-in", () => {
    for (const g of derivations) {
      expect(["measured", "derived", "stand-in"]).toContain(g.kind);
    }
  });

  it("stand-ins are labeled honestly and never imply a live measurement", () => {
    const standIns = derivations.filter((g) => g.kind === "stand-in");
    expect(standIns.map((g) => g.key)).toEqual(expect.arrayContaining(["sla_24h", "event_to_consult"]));
    for (const g of standIns) {
      expect(g.rubric.honesty.length).toBeGreaterThan(20);
      // the honesty note or a transform node must say "stand-in" / "hash" / "manual"
      const text = (g.rubric.honesty + g.nodes.map((n) => n.detail).join(" ")).toLowerCase();
      expect(/stand-in|hash|manual|uninstrumented/.test(text)).toBe(true);
    }
  });

  it("the SLA cell names BOTH the first-contact and owner stand-ins (the flagged gap)", () => {
    const sla = derivations.find((g) => g.key === "sla_24h")!;
    const honesty = sla.rubric.honesty.toLowerCase();
    expect(honesty).toContain("owner");
    expect(honesty).toMatch(/hash|stand-in/);
    expect(sla.value).toMatch(/late/);
  });

  it("measured + derived metrics cite a real integration connector", () => {
    for (const g of derivations.filter((x) => x.kind === "measured" || x.kind === "derived")) {
      const integration = SOURCE_INTEGRATION[g.source];
      expect(integration, `${g.key} source "${g.source}" has no integration`).toBeTruthy();
      expect(integrationIds.has(integration), `${integration} not in catalog`).toBe(true);
      expect(g.sourceHref).toContain("/dev/integrations#");
    }
  });

  it("DERIVATION_NOTE covers the derived/stand-in metrics for the board cells", () => {
    for (const key of ["sla_24h", "engagement_hotwarm", "referral_rate", "event_to_consult", "conversion_top_channel"]) {
      expect(DERIVATION_NOTE[key], `${key} needs a board note`).toBeTruthy();
    }
  });
});
