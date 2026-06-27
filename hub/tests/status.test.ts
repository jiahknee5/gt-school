import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import StatusPage from "@/app/m/status/page";
import { generate } from "@/lib/seed/generate";
import {
  buildStatusBoard,
  statusModuleHref,
  statusModuleSlug,
  statusModuleVisible,
} from "@/lib/status/board";
import { routeDecision } from "@/lib/auth/policy";
import { ALWAYS_VISIBLE_MODULE_SLUGS } from "@/lib/nav";
import { moduleBySlug, moduleHref, MODULE_NAV_GROUPS } from "@/lib/modules";
import { defaultReportingWeek, weekMondays } from "@/lib/metrics/registry";
import { resolveViewerProgramScope } from "@/lib/program-scope";

const ds = generate({ seed: 424242, families: 1200 });

describe("Status board data layer", () => {
  it("buildStatusBoard wires real scorecard deposits and budget totals", () => {
    const board = buildStatusBoard(ds, "fall_enrollment", defaultReportingWeek());
    expect(board.northStar.current).toBeGreaterThan(0);
    expect(board.stages).toHaveLength(6);
    expect(board.answer.bullets.length).toBeGreaterThanOrEqual(3);
    expect(board.rail.some((r) => r.key === "bud")).toBe(true);
    expect(board.rail.find((r) => r.key === "bud")?.kicker).toMatch(/\$365K/);
  });

  it("program scope changes the program label on the board", () => {
    const fall = buildStatusBoard(ds, "fall_enrollment");
    const camp = buildStatusBoard(ds, "summer_camp");
    expect(fall.programLabel).toBe("Fall enrollment");
    expect(camp.programLabel).toBe("Summer Camp");
  });

  it("each stage exposes all four spine columns", () => {
    const board = buildStatusBoard(ds);
    for (const stage of board.stages) {
      expect(stage.position).toBeDefined();
      expect(stage.drivers).toBeDefined();
      expect(stage.decisions).toBeDefined();
      expect(stage.narrative.bullets?.length).toBeGreaterThan(0);
    }
  });

  it("each Drivers cell carries a one-line glance for the calm default", () => {
    const board = buildStatusBoard(ds);
    for (const stage of board.stages) {
      expect(stage.drivers.subline, `${stage.name} drivers glance`).toBeTruthy();
    }
  });

  it("Answer leads with the binding proof, not demand", () => {
    const board = buildStatusBoard(ds);
    expect(board.answer.bullets.length).toBeGreaterThanOrEqual(4);
    expect(board.answer.bullets[0].text.toLowerCase()).toContain("binding");
    expect(board.answer.bullets[0].text).toMatch(/deposits/);
  });

  it("every cell's dense detail survives in the drawer (nothing lost)", () => {
    const board = buildStatusBoard(ds);
    for (const stage of board.stages) {
      const headings = stage.drawerSections.map((s) => s.heading);
      expect(headings, `${stage.name} drawer`).toEqual(
        expect.arrayContaining(["Where we stand", "What's driving it", "What we're doing"]),
      );
      // Stages with charts must still expose them in the drawer.
      const hasChart = stage.drawerSections.some(
        (s) => s.rankedBars?.length || s.funnelSteps?.length || s.sparkline,
      );
      if (stage.drivers.rankedBars || stage.drivers.funnelSteps || stage.drivers.sparkline) {
        expect(hasChart, `${stage.name} chart preserved`).toBe(true);
      }
    }
  });
});

describe("Status route + nav registry", () => {
  it("registers /m/status in modules and command nav", () => {
    expect(statusModuleSlug()).toBe("status");
    expect(statusModuleHref()).toBe("/m/status");
    expect(moduleHref("status")).toBe("/m/status");
    expect(moduleBySlug("status")?.short).toBe("Status");
    expect(MODULE_NAV_GROUPS.find((g) => g.key === "command")?.slugs).toEqual([
      "home",
      "status",
      "dashboard",
      "decisions",
    ]);
    expect(ALWAYS_VISIBLE_MODULE_SLUGS.has("status")).toBe(true);
    expect(statusModuleVisible()).toBe(true);
  });

  it("RBAC allows all authenticated roles (same as Dashboard)", () => {
    expect(routeDecision("operator", "/m/status").allowed).toBe(true);
    expect(routeDecision("leader", "/m/status").allowed).toBe(true);
    expect(routeDecision("admin", "/m/status").allowed).toBe(true);
    expect(routeDecision(null, "/m/status").status).toBe(401);
  });

  it("program lens resolves for operator (fall only)", () => {
    expect(resolveViewerProgramScope("operator", "summer_camp")).toBe("fall_enrollment");
    expect(resolveViewerProgramScope("leader", "all")).toBe("all");
  });
});

describe("Status page render", () => {
  it("renders exec verdict chrome and matrix", async () => {
    const html = renderToStaticMarkup(await StatusPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Executive verdict");
    expect(html).toContain("The Answer");
    expect(html).toContain("Ask the Hub");
    expect(html).toContain("Funnel × spine");
    expect(html).toContain("Position");
    expect(html).toContain("Narrative");
    expect(html).toContain("Dashboard");
    expect(html).toContain("personal cockpit");
  });

  it("default matrix is calm — charts/ranked bars live in the drawer, not at top level", async () => {
    const html = renderToStaticMarkup(await StatusPage({ searchParams: Promise.resolve({}) }));
    // RankedMiniBar tags + Sparkline label only render inside drilled detail now.
    expect(html).not.toContain("ENGINE");
    expect(html).not.toContain("TRAP");
    expect(html).not.toContain("est. trend");
    // The one-line glance (driver summary) is what shows at default instead.
    expect(html).toContain("Referral best CPQL");
    // Lead answer bullet (the proof) is present at default.
    expect(html).toContain("Conversion is binding");
  });

  it("renders the week selector and the snapshot provenance badge", async () => {
    const html = renderToStaticMarkup(await StatusPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Reporting week");
    expect(html).toMatch(/Current week|Historical snapshot/);
    expect(html).toMatch(/Deterministic|LLM/);
  });

  it("a past week is marked as a historical snapshot (recall, not recompute)", async () => {
    const past = weekMondays()[0];
    const html = renderToStaticMarkup(await StatusPage({ searchParams: Promise.resolve({ week: past }) }));
    expect(html).toContain("Historical snapshot");
  });

  it("overlays a rubric-structured Answer onto the board", () => {
    const board = buildStatusBoard(ds);
    // The page overlays a generated snapshot; the data layer exposes the hook for it.
    expect(board.answer.bullets.length).toBeGreaterThanOrEqual(3);
  });
});
