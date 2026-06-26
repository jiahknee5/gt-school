import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildDatasetUrl,
  clearOpenDataCache,
  fetchDataset,
  type OpenDataRow,
} from "../lib/opendata/client";
import { openDataFixture } from "../lib/opendata/fixtures";
import {
  enrichDecisionByCounties,
  recommendationImpactFromEnrichment,
} from "../lib/opendata/enrich";

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

describe("buildDatasetUrl", () => {
  it("always requests objects and encodes filter[col] params", () => {
    const url = buildDatasetUrl("tea", "accountability-summary", {
      fields: ["district", "county"],
      filter: { county: "TRAVIS", county_name: "TRAVIS COUNTY" },
      sort: "-number_of_students",
      limit: 5,
    });
    expect(url).toContain("/v1/datasets/tea/accountability-summary?");
    expect(url).toContain("response_format=objects");
    expect(url).toContain("fields=district%2Ccounty");
    expect(url).toContain("filter%5Bcounty%5D=TRAVIS");
    // space in the value must be encoded, not dropped
    expect(url).toContain("filter%5Bcounty_name%5D=TRAVIS+COUNTY");
    expect(url).toContain("sort=-number_of_students");
    expect(url).toContain("limit=5");
  });
});

describe("fetchDataset caching", () => {
  it("hits the network once, then serves from cache within TTL", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ data: [{ a: 1 }], columns: ["a"], total_rows: 1, filtered_rows: 1 }),
    ) as unknown as typeof fetch;
    let t = 1000;
    const now = () => t;

    const first = await fetchDataset("tea", "x", {}, { fetchImpl, now });
    expect(first.source).toBe("live");

    t = 1000 + 60_000; // 1 min later, within 24h TTL
    const second = await fetchDataset("tea", "x", {}, { fetchImpl, now });
    expect(second.source).toBe("cache");
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
  });

  it("refetches once TTL has elapsed", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ data: [{ a: 1 }], columns: ["a"], total_rows: 1 }),
    ) as unknown as typeof fetch;
    let t = 0;
    const now = () => t;
    await fetchDataset("tea", "x", {}, { fetchImpl, now, ttlMs: 1000 });
    t = 2000; // past TTL
    const again = await fetchDataset("tea", "x", {}, { fetchImpl, now, ttlMs: 1000 });
    expect(again.source).toBe("live");
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2);
  });

  it("falls back to stale cache when a later fetch fails", async () => {
    let call = 0;
    const fetchImpl = vi.fn(async () => {
      call += 1;
      if (call === 1) return jsonResponse({ data: [{ a: 1 }], columns: ["a"], total_rows: 1 });
      throw new Error("network down");
    }) as unknown as typeof fetch;
    let t = 0;
    const now = () => t;
    await fetchDataset("tea", "x", {}, { fetchImpl, now, ttlMs: 1000 });
    t = 5000; // past TTL → tries network → fails → stale cache
    const stale = await fetchDataset("tea", "x", {}, { fetchImpl, now, ttlMs: 1000 });
    expect(stale.source).toBe("cache");
    expect(stale.data).toEqual([{ a: 1 }]);
  });

  it("falls back to the fixture when there is no cache and the network fails", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const res = await fetchDataset(
      "tea",
      "accountability-summary",
      { filter: { county: "TRAVIS" }, fields: ["district", "overall_rating"] },
      { fetchImpl, fixture: openDataFixture },
    );
    expect(res.source).toBe("fixture");
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data.every((r: OpenDataRow) => r.county === "TRAVIS")).toBe(true);
  });
});

describe("openDataFixture", () => {
  it("filters ratings by county and returns null for unknown datasets", () => {
    const travis = openDataFixture("tea", "accountability-summary", {
      filter: { county: "TRAVIS" },
    });
    expect(travis && travis.length).toBeGreaterThan(0);
    expect(openDataFixture("tea", "unknown-dataset", {})).toBeNull();
    expect(openDataFixture("census", "acs", {})).toBeNull();
  });
});

describe("enrichDecisionByCounties (offline via fixture)", () => {
  it("computes a weak-district signal from stood-in data", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline"); // force fixture path
    }) as unknown as typeof fetch;

    const result = await enrichDecisionByCounties(["travis"], { fetchImpl });

    expect(result.counties).toEqual(["TRAVIS"]);
    expect(result.source).toBe("fixture");
    expect(result.ratings.length).toBeGreaterThan(0);
    // Austin (C) + Pflugerville (C) + Del Valle (D) are weak; Lake Travis (A) + KIPP (B) are not.
    expect(result.summary.studentsInWeakDistricts).toBe(72175 + 25451 + 11681);
    expect(result.summary.totalStudents).toBe(72175 + 32754 + 25451 + 11681 + 10970);
    expect(result.summary.weakDistrictShare).toBeGreaterThan(0);
    expect(result.summary.weakDistrictShare).toBeLessThan(1);
    expect(result.summary.medianGiftedSpendPerStudent).not.toBeNull();
    expect(result.signal).toContain("Travis");
    expect(result.signal).toContain("C/D/F");
  });

  it("turns a cautious baseline decision into an approve recommendation when underserved demand is high", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;

    const result = await enrichDecisionByCounties(["travis"], { fetchImpl });
    const impact = recommendationImpactFromEnrichment(result, "pilot");

    expect(impact.before).toBe("pilot");
    expect(impact.after).toBe("approve");
    expect(impact.changed).toBe(true);
    expect(impact.reason).toContain("Open Data upgrades the ask to approve");
  });
});
