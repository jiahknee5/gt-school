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
    // Lead answer bullet (the proof) is present at default — tolerate both the
    // board phrasing ("Conversion is binding") and the generated/snapshot
    // verdict phrasing ("Conversion binding").
    expect(html).toMatch(/Conversion (is )?binding/);
  });

  it("Option C+: only Position + Narrative are content columns; Drivers is fully collapsed", async () => {
    const html = renderToStaticMarkup(await StatusPage({ searchParams: Promise.resolve({}) }));
    // The two calm content columns are present...
    expect(html).toContain("Position");
    expect(html).toContain("Narrative");
    // ...but the Drivers column (header + its one-line glance) is gone from the
    // default board — it now lives only in the drawer.
    expect(html).not.toContain("What's driving it");
    expect(html).not.toContain("Referral best CPQL");
    // The Decisions column header is no longer rendered as a spine column.
    expect(html).not.toContain("What needs you");
  });

  it("Option C+: Decisions surface as a per-row flag linking to the Decision Queue", async () => {
    const html = renderToStaticMarkup(await StatusPage({ searchParams: Promise.resolve({}) }));
    // The compact per-row flag is rendered for stages with a real open decision.
    expect(html).toContain("needs leadership");
    // It links straight to the Decision Queue.
    expect(html).toContain("/m/decisions");
  });

  it("Option C+: every stage with an open decision exposes a row-level flag affordance", () => {
    const board = buildStatusBoard(ds);
    const withDecision = board.stages.filter((s) => s.decisions.decision);
    // At least one stage carries a real open decision to flag (e.g. conversion).
    expect(withDecision.length).toBeGreaterThan(0);
    for (const stage of withDecision) {
      expect(stage.decisions.decision?.href).toBe("/m/decisions");
      // Full decision detail still survives in the drawer ("What we're doing").
      const headings = stage.drawerSections.map((s) => s.heading);
      expect(headings).toContain("What we're doing");
    }
  });
});
