import { describe, expect, it } from "vitest";
import {
  MODULES,
  MODULE_NAV_GROUPS,
  modulesByNavGroup,
} from "@/lib/modules";
import { modulesForNavScope } from "@/lib/nav";
import { DEMO_USERS } from "@/lib/phase2";

describe("module workflow groups", () => {
  it("organizes all modules into the four PRD workflow neighborhoods", () => {
    expect(MODULE_NAV_GROUPS.map((group) => group.label)).toEqual([
      "Command",
      "Channels",
      "Pipeline",
      "Operations",
    ]);
    expect(MODULE_NAV_GROUPS.map((group) => group.slugs.length)).toEqual([4, 4, 3, 3]);

    const groupedSlugs = MODULE_NAV_GROUPS.flatMap((group) => group.slugs);
    expect(new Set(groupedSlugs).size).toBe(groupedSlugs.length);
    expect([...groupedSlugs].sort()).toEqual(MODULES.map((module) => module.slug).sort());

    for (const mod of MODULES) {
      const group = MODULE_NAV_GROUPS.find((candidate) =>
        candidate.slugs.includes(mod.slug),
      );
      expect(group?.key).toBe(mod.group);
    }
  });

  it("keeps the leader decision path in Command while preserving operator declutter", () => {
    const leader = DEMO_USERS.find((user) => user.role === "leader");
    const operator = DEMO_USERS.find((user) => user.id === "content-operator");
    expect(leader).toBeTruthy();
    expect(operator).toBeTruthy();

    const leaderModules = modulesForNavScope(MODULES, leader!, "my");
    const leaderCommand = modulesByNavGroup(leaderModules).find(
      ({ group }) => group.key === "command",
    );
    expect(leaderCommand?.modules.map((module) => module.slug)).toEqual([
      "home",
      "status",
      "dashboard",
      "decisions",
    ]);

    const operatorRbacModules = MODULES.filter((module) => !module.leaderOnly);
    const operatorGroups = modulesByNavGroup(
      modulesForNavScope(operatorRbacModules, operator!, "my"),
    ).filter(({ modules }) => modules.length > 0);

    expect(operatorGroups.some(({ modules }) =>
      modules.some((mod) => mod.slug === "decisions"),
    )).toBe(false);
    expect(operatorGroups.map(({ group }) => group.key)).toEqual([
      "command",
      "channels",
      "operations",
    ]);
  });
});
