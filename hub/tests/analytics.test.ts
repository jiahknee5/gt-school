// Module 13 — Website & Digital Analytics. Pure proofs for GA4 aggregate reconciliation,
// bounce definition, explicit UTM buckets, download totals, page threshold flags, RBAC,
// and rendered sub-views.

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { generate } from "@/lib/seed/generate";
import {
  assertCanFlagPage,
  bounce,
  canFlagPage,
  conversionPaths,
  downloads,
  ga4Rows,
  preFunnelJourney,
  siteTotals,
  subpagePerformance,
  totalPdfDownloads,
  trafficSources,
  utmValidationSummary,
  validateUtms,
} from "@/lib/metrics/analytics";

const ds = generate({ seed: 424242, families: 1200 });
const rows = ga4Rows(ds);

describe("Analytics · GA4 source-of-truth metrics", () => {
  it("aggregate sessions equal the sum of both GA4 properties", () => {
    const totals = siteTotals(rows);
    const aggregate = totals.find((row) => row.site === "aggregate")!;
    const sites = totals.filter((row) => row.site !== "aggregate");
    expect(aggregate.sessions).toBe(sites.reduce((sum, row) => sum + row.sessions, 0));
    expect(aggregate.pdfDownloads).toBe(sites.reduce((sum, row) => sum + row.pdfDownloads, 0));
  });

  it("bounce has one bounded definition: 1 - engaged/sessions", () => {
    expect(bounce(100, 63)).toBe(0.37);
    expect(bounce(0, 0)).toBe(0);
    for (const page of subpagePerformance(rows)) {
      expect(page.bounce).toBeGreaterThanOrEqual(0);
      expect(page.bounce).toBeLessThanOrEqual(1);
    }
  });

  it("UTM validation keeps valid, invalid, and missing buckets explicit", () => {
    const validations = validateUtms(rows);
    const summary = utmValidationSummary(rows);
    expect(validations.some((row) => row.status === "valid")).toBe(true);
    expect(validations.some((row) => row.status === "missing")).toBe(true);
    expect(summary.valid + summary.invalid + summary.missing).toBe(rows.reduce((sum, row) => sum + row.sessions, 0));
  });

  it("download rows reconcile exactly to the PDF widget total", () => {
    const byFile = downloads(rows);
    expect(byFile.reduce((sum, row) => sum + row.downloadsCumulative, 0)).toBe(totalPdfDownloads(rows));
  });

  it("conversion paths are explicitly stand-in and page rows are never dropped", () => {
    const pages = subpagePerformance(rows);
    const lowVolume = subpagePerformance([
      {
        ...rows[0],
        landingPage: "/tiny-test",
        sessions: 3,
        totalUsers: 3,
        engagedSessions: 1,
        screenPageViews: 3,
      },
    ]);
    expect(pages.length).toBeGreaterThan(0);
    expect(lowVolume[0].thresholded).toBe(true);
    expect(conversionPaths(rows).every((path) => path.standIn)).toBe(true);
    expect(preFunnelJourney(rows).standIn).toBe(true);
    expect(trafficSources(rows).length).toBeGreaterThan(0);
  });
});

describe("Analytics · RBAC", () => {
  it("only Admin/Leader can flag pages for analysis", () => {
    expect(canFlagPage("admin")).toBe(true);
    expect(canFlagPage("leader")).toBe(true);
    expect(canFlagPage("operator")).toBe(false);
    expect(() => assertCanFlagPage("operator")).toThrow(/forbidden/);
  });
});

vi.mock("@/lib/auth", () => ({
  DEV_MODE: true,
  getSession: vi.fn(async () => null),
}));

const { default: AnalyticsPage } = await import("@/app/m/analytics/page");

async function render(tab?: string, role?: string): Promise<string> {
  const node = await AnalyticsPage({
    searchParams: Promise.resolve({ ...(tab ? { tab } : {}), ...(role ? { role } : {}) }),
  });
  return renderToStaticMarkup(node);
}

describe("Analytics · rendered sub-views", () => {
  it("overview renders aggregate reconciliation and GA4 confidence framing", async () => {
    const html = await render("overview", "leader");
    expect(html).toContain("Website &amp; Digital Analytics");
    expect(html).toContain("GA4-confidence note");
    expect(html).toContain("aggregate = sum of sites");
  });

  it("renders subpages, source validation, downloads, and path tabs", async () => {
    expect(await render("subpages", "leader")).toContain("Subpage performance");
    expect(await render("sources", "leader")).toContain("UTM validation");
    expect(await render("downloads", "leader")).toContain("PDF &amp; download tracking");
    expect(await render("paths", "leader")).toContain("Conversion paths");
  });
});
