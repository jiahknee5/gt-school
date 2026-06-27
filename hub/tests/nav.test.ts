import { describe, expect, it } from "vitest";
import { MODULES } from "@/lib/modules";
import {
  agendaModuleSlugs,
  moduleMatchesViewer,
  modulesForNavScope,
  parseNavScope,
} from "@/lib/nav";
import type { DemoUser } from "@/lib/phase2";
import { DEMO_USERS } from "@/lib/phase2";

function viewer(user: DemoUser) {
  return {
    role: user.role,
    functionalRoles: user.functionalRoles,
    ownsModules: user.ownsModules,
  };
}

describe("nav scope filtering", () => {
  it("parses nav scope values", () => {
    expect(parseNavScope("my")).toBe("my");
    expect(parseNavScope(" ALL ")).toBe("all");
    expect(parseNavScope("agenda")).toBe("agenda");
    expect(parseNavScope("invalid")).toBeNull();
  });

  it("shows all RBAC-permitted modules in all scope", () => {
    const grassroots = DEMO_USERS.find((u) => u.id === "grassroots-operator")!;
    const rbac = MODULES.filter((m) => !m.leaderOnly);
    const scoped = modulesForNavScope(rbac, viewer(grassroots), "all");
    expect(scoped.length).toBe(rbac.length);
  });

  it("declutters my scope to owned + always-visible modules", () => {
    const grassroots = DEMO_USERS.find((u) => u.id === "grassroots-operator")!;
    const rbac = MODULES.filter((m) => !m.leaderOnly);
    const scoped = modulesForNavScope(rbac, viewer(grassroots), "my");
    const slugs = scoped.map((m) => m.slug);
    expect(slugs).toContain("grassroots");
    expect(slugs).toContain("home");
    expect(slugs).toContain("dashboard");
    expect(slugs).toContain("library");
    expect(slugs).not.toContain("content");
  });

  it("agenda scope follows meeting order slugs", () => {
    const marketing = DEMO_USERS.find((u) => u.id === "marketing-lead")!;
    const rbac = MODULES.filter((m) => !m.leaderOnly);
    const scoped = modulesForNavScope(rbac, viewer(marketing), "agenda");
    const slugs = scoped.map((m) => m.slug);
    expect(slugs).toEqual(
      rbac.filter((m) => agendaModuleSlugs().includes(m.slug)).map((m) => m.slug),
    );
  });

  it("matches modules by functional role owners array", () => {
    const admissions = MODULES.find((m) => m.slug === "admissions")!;
    const fieldOwner = DEMO_USERS.find((u) => u.id === "field-events-operator")!;
    expect(moduleMatchesViewer(admissions, viewer(fieldOwner))).toBe(true);
  });
});
