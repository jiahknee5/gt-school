import { afterEach, describe, expect, it, vi } from "vitest";

const enrichMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/opendata/enrich", () => ({
  enrichDecisionByCounties: enrichMock,
}));

const { GET } = await import("@/app/api/opendata/decision-enrichment/route");

function request(path: string): Request {
  return new Request(`http://localhost${path}`);
}

describe("GET /api/opendata/decision-enrichment", () => {
  afterEach(() => {
    enrichMock.mockReset();
  });

  it("rejects missing counties with 400 and does not call Open Data", async () => {
    const res = await GET(request("/api/opendata/decision-enrichment"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Provide at least one county");
    expect(enrichMock).not.toHaveBeenCalled();
  });

  it("normalizes counties, forwards optional years, and returns cache headers", async () => {
    enrichMock.mockResolvedValueOnce({
      counties: ["TRAVIS", "DALLAS"],
      schoolYear: "2024-2025",
      financeYear: 2024,
      ratings: [],
      giftedSpend: [],
      summary: {
        districts: 0,
        totalStudents: 0,
        studentsInWeakDistricts: 0,
        weakDistrictShare: 0,
        medianGiftedSpendPerStudent: null,
      },
      signal: "No district data found.",
      source: "fixture",
      fetchedAt: "2026-06-26T00:00:00.000Z",
    });

    const res = await GET(
      request(
        "/api/opendata/decision-enrichment?counties=travis,%20DALLAS&schoolYear=2024-2025&financeYear=2024&refresh=1",
      ),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("s-maxage=3600, stale-while-revalidate=86400");
    expect(body.source).toBe("fixture");
    expect(enrichMock).toHaveBeenCalledWith(["travis", "DALLAS"], {
      schoolYear: "2024-2025",
      financeYear: 2024,
      refresh: true,
    });
  });

  it("returns 502 when enrichment fails", async () => {
    enrichMock.mockRejectedValueOnce(new Error("Open Data unavailable"));

    const res = await GET(request("/api/opendata/decision-enrichment?counties=TRAVIS"));
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toBe("Open Data unavailable");
  });
});
