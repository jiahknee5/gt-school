import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import ModulePage from "@/app/m/[slug]/page";

async function renderModule(slug: string, role?: string): Promise<string> {
  const node = await ModulePage({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve(role ? { role } : {}),
  });
  return renderToStaticMarkup(node);
}

describe("Phase 2 rendered route surfaces", () => {
  it("Home renders the PRD top-level signals and links to the deep module slice", () => {
    const html = renderToStaticMarkup(HomePage());

    expect(html).toContain("One trustworthy operating room for GT marketing.");
    expect(html).toContain("Data confidence needs review");
    expect(html).toContain("Home widgets");
    expect(html).toContain("Decision preview");
    expect(html).toContain("GT Challenge CPQL");
  });

  it("Budget route visibly reconciles workstreams to the $365K total and variance queue", async () => {
    const html = await renderModule("budget");

    expect(html).toContain("Budget Tracker");
    expect(html).toContain("$365,000");
    expect(html).toContain("Workstream rows");
    expect(html).toContain("Variance decisions");
    expect(html).toContain("Guerrilla");
  });

  it("data-confidence banner renders on HubSpot-consuming module routes", async () => {
    const budget = await renderModule("budget");
    const crm = await renderModule("crm-ops");

    expect(budget).toContain("Data confidence warning");
    expect(budget).toContain("Open CRM Ops");
    expect(crm).toContain("Data confidence warning");
    expect(crm).toContain("Field reliability");
  });

  it("operator role lens shows a denied Decision Queue state without queue actions", async () => {
    const html = await renderModule("decisions", "operator");

    expect(html).toContain("Access denied for this role");
    expect(html).toContain("Submit a decision request");
    expect(html).not.toContain("Need info");
  });
});
