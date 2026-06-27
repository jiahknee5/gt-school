import { describe, expect, it } from "vitest";
import { MODULES } from "@/lib/modules";
import {
  moduleMatchesViewer,
  modulesForNavScope,
  parseNavScope,
} from "@/lib/nav";
import {
  buildNavScopeCookieValue,
  decodeNavScopeStore,
  encodeNavScopeStore,
  navScopeFromStore,
  readNavScopeCookieFromHeader,
  storeWithNavScope,
} from "@/lib/nav-preference";
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
    expect(parseNavScope("invalid")).toBeNull();
  });

  it("maps the legacy agenda scope to all (agenda moved to the Dashboard)", () => {
    expect(parseNavScope("agenda")).toBe("all");
    expect(parseNavScope(" AGENDA ")).toBe("all");
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

  it("matches modules by functional role owners array", () => {
    const admissions = MODULES.find((m) => m.slug === "admissions")!;
    const fieldOwner = DEMO_USERS.find((u) => u.id === "field-events-operator")!;
    expect(moduleMatchesViewer(admissions, viewer(fieldOwner))).toBe(true);
  });
});

describe("nav scope cookie store (demo fallback, no DB)", () => {
  it("round-trips per-user scope through encode/decode", () => {
    const store = storeWithNavScope({}, "grassroots-operator", "all");
    const decoded = decodeNavScopeStore(encodeNavScopeStore(store));
    expect(navScopeFromStore(decoded, "grassroots-operator")).toBe("all");
    expect(navScopeFromStore(decoded, "other-user")).toBe("my");
  });

  it("keeps independent scopes for multiple users in one cookie", () => {
    let store = storeWithNavScope({}, "user-a", "all");
    store = storeWithNavScope(store, "user-b", "my");
    const encoded = encodeNavScopeStore(store);
    const header = `gt_nav_scope=${encodeURIComponent(encoded)}`;
    const parsed = readNavScopeCookieFromHeader(header);
    expect(navScopeFromStore(parsed, "user-a")).toBe("all");
    expect(navScopeFromStore(parsed, "user-b")).toBe("my");
  });

  it("buildNavScopeCookieValue appends without clobbering other users", () => {
    const existing = buildNavScopeCookieValue("", "user-a", "all");
    const header = `gt_nav_scope=${encodeURIComponent(existing)}`;
    const next = buildNavScopeCookieValue(header, "user-b", "my");
    const store = decodeNavScopeStore(next);
    expect(navScopeFromStore(store, "user-a")).toBe("all");
    expect(navScopeFromStore(store, "user-b")).toBe("my");
  });

  it("ignores malformed cookie values and defaults to my", () => {
    expect(navScopeFromStore(decodeNavScopeStore("not-valid-base64!!!"), "anyone")).toBe("my");
    expect(navScopeFromStore(readNavScopeCookieFromHeader(""), "anyone")).toBe("my");
  });
});
