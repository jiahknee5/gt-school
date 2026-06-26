import { afterEach, describe, expect, it, vi } from "vitest";
import { clearOpenDataCache } from "../lib/opendata/client";
import {
  curateProviders,
  formatRows,
  getPlatformStats,
  listProviders,
  providerTier,
  type ProviderSummary,
} from "../lib/opendata/catalog";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  clearOpenDataCache();
  vi.restoreAllMocks();
});

describe("formatRows", () => {
  it("compacts large counts", () => {
    expect(formatRows(136448498)).toBe("136.4M");
    expect(formatRows(600779800)).toBe("600.8M");
    expect(formatRows(2724399)).toBe("2.7M");
    expect(formatRows(20587)).toBe("20.6K");
    expect(formatRows(230)).toBe("230");
    expect(formatRows(1_200_000_000)).toBe("1.2B");
  });
});

describe("providerTier / curateProviders", () => {
  it("classifies known providers into tiers", () => {
    expect(providerTier("tea")).toBe("texas-school");
    expect(providerTier("tefa")).toBe("texas-school");
    expect(providerTier("nces")).toBe("education");
    expect(providerTier("bls")).toBe("other");
  });

  it("groups and sorts providers by dataset count", () => {
    const providers: ProviderSummary[] = [
      { slug: "tea", name: "TEA", description: null, datasetCount: 38, totalRows: 1 },
      { slug: "tefa", name: "TEFA", description: null, datasetCount: 14, totalRows: 1 },
      { slug: "nces", name: "NCES", description: null, datasetCount: 23, totalRows: 1 },
      { slug: "bls", name: "BLS", description: null, datasetCount: 35, totalRows: 1 },
    ];
    const tiers = curateProviders(providers);
    expect(tiers["texas-school"].map((p) => p.slug)).toEqual(["tea", "tefa"]);
    expect(tiers.education.map((p) => p.slug)).toEqual(["nces"]);
    expect(tiers.other.map((p) => p.slug)).toEqual(["bls"]);
  });
});

describe("listProviders", () => {
  it("maps API fields and drops empty providers", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        items: [
          { slug: "tea", name: "Texas Education Agency", description: "K-12", dataset_count: 38, total_rows: 281402045 },
          { slug: "empty", name: "Empty", dataset_count: 0, total_rows: 0 },
        ],
      }),
    ) as unknown as typeof fetch;

    const res = await listProviders({ fetchImpl });
    expect(res.source).toBe("live");
    expect(res.data).toHaveLength(1);
    expect(res.data[0]).toMatchObject({
      slug: "tea",
      datasetCount: 38,
      totalRows: 281402045,
    });
  });
});

describe("getPlatformStats", () => {
  it("normalizes platform totals", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ totalProviders: 104, totalDatasets: 580, totalRows: 600779800, addedThisWeek: 32 }),
    ) as unknown as typeof fetch;
    const res = await getPlatformStats({ fetchImpl });
    expect(res.data.totalProviders).toBe(104);
    expect(res.data.totalDatasets).toBe(580);
    expect(res.data.addedThisWeek).toBe(32);
  });
});
