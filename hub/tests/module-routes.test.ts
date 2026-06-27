import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import ModulePage from "@/app/m/[slug]/page";
import { devRoleSwitchUsers } from "@/lib/auth/dev-role-switcher";
import { buildScorecard } from "@/lib/dashboard/scorecard";
import { weekMondays } from "@/lib/metrics/registry";
import { DEMO_USERS } from "@/lib/phase2";
import { generate } from "@/lib/seed/generate";

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

async function renderModule(slug: string, role?: string): Promise<string> {
  const node = await ModulePage({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve(role ? { role } : {}),
  });
  return renderToStaticMarkup(node);
}

async function renderHome(week?: string): Promise<string> {
  const node = await HomePage({
    searchParams: Promise.resolve(week ? { week } : {}),
  });
  return renderToStaticMarkup(node);
}

describe("Phase 2 rendered route surfaces", () => {
  it("Home renders the PRD top-level signals and links to the deep module slice", async () => {
    const html = renderToStaticMarkup(await HomePage());

    expect(html).toContain("One trustworthy operating room for GT marketing.");
    expect(html).toContain("Data confidence needs review");
    expect(html).toContain("Home widgets");
    expect(html).toContain("Decision preview");
    expect(html).toContain("GT Challenge CPQL");
  });

  it("Home widgets consume the selected reporting week for KPI-backed values", async () => {
    const ds = generate({ seed: 424242, families: 1200 });
    const rows = weekMondays().map((week) => {
      const applicants = buildScorecard(ds, week).rows.find((row) => row.key === "applicants")!;
      return { week, value: compact.format(applicants.thisWeek) };
    });
    const first = rows[0];
    const changed = rows.find((row) => row.value !== first.value);

    if (!changed) throw new Error("Expected at least one Home reporting week to change applicants.");

    const firstHtml = await renderHome(first.week);
    const changedHtml = await renderHome(changed.week);

    expect(firstHtml).toContain(`week of ${first.week}`);
    expect(changedHtml).toContain(`week of ${changed.week}`);
    expect(firstHtml).toContain(first.value);
    expect(changedHtml).toContain(changed.value);
    expect(firstHtml).not.toBe(changedHtml);
  });

  it("dev role switcher exposes one target per permission role", () => {
    expect(DEMO_USERS.filter((user) => user.role === "leader").length).toBeGreaterThan(1);
    expect(DEMO_USERS.filter((user) => user.role === "operator").length).toBeGreaterThan(1);
    expect(devRoleSwitchUsers().map((user) => user.role)).toEqual([
      "admin",
      "leader",
      "operator",
    ]);
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
    expect(html).toContain("Full queue hidden");
    expect(html).not.toContain("open decisions exist");
    expect(html).not.toContain("Active decisions");
    expect(html).not.toContain("Need info");
  });

  it("leader role lens shows Decision Queue ruling controls", async () => {
    const html = await renderModule("decisions", "leader");

    expect(html).toContain("Active decisions");
    expect(html).toContain("Approve");
    expect(html).toContain("Reject");
    expect(html).toContain("Need info");
    expect(html).toContain("Comment");
    expect(html).toContain("Open Data enrichment");
    expect(html).toContain("Decision impact");
    expect(html).toContain("pilot -&gt; approve");
    expect(html).toContain("recommendation changed");
    expect(html).toContain("Travis + Dallas");
    expect(html).not.toContain("Access denied for this role");
  });
});
