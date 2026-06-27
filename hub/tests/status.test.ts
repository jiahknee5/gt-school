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
import { defaultReportingWeek } from "@/lib/metrics/registry";
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
});
