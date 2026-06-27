// Active-program view lens — pure codec, RBAC scope lists, and the demo cookie
// round-trip (mirror of nav.test.ts for the program selector).

import { describe, expect, it } from "vitest";
import {
  defaultProgramScope,
  isProgramScope,
  parseProgramScope,
  programScopesForRole,
  programsForScope,
  resolveViewerProgramScope,
} from "@/lib/program-scope";
import {
  buildProgramScopeCookieValue,
  decodeProgramScopeStore,
  encodeProgramScopeStore,
  programScopeFromStore,
  readProgramScopeCookieFromHeader,
  storeWithProgramScope,
} from "@/lib/program-preference";

describe("program scope codec", () => {
  it("recognizes the canonical scopes", () => {
    expect(isProgramScope("fall_enrollment")).toBe(true);
    expect(isProgramScope("summer_camp")).toBe(true);
    expect(isProgramScope("all")).toBe(true);
    expect(isProgramScope("xyz")).toBe(false);
  });

  it("parses canonical values and brand/legacy aliases", () => {
    expect(parseProgramScope("fall_enrollment")).toBe("fall_enrollment");
    expect(parseProgramScope(" SUMMER_CAMP ")).toBe("summer_camp");
    expect(parseProgramScope("all")).toBe("all");
    // GT Anywhere is the brand for fall_enrollment — never a new ProgramKey.
    expect(parseProgramScope("gt_anywhere")).toBe("fall_enrollment");
    expect(parseProgramScope("anywhere")).toBe("fall_enrollment");
    expect(parseProgramScope("fall")).toBe("fall_enrollment");
    expect(parseProgramScope("camp")).toBe("summer_camp");
    expect(parseProgramScope("both")).toBe("all");
  });

  it("returns null for invalid / non-string values", () => {
    expect(parseProgramScope("invalid")).toBeNull();
    expect(parseProgramScope(null)).toBeNull();
    expect(parseProgramScope(42)).toBeNull();
    expect(parseProgramScope(undefined)).toBeNull();
  });
});

describe("program scope RBAC (allowedPrograms)", () => {
  it("gives admin and leader both programs plus the all-up view", () => {
    for (const role of ["admin", "leader"] as const) {
      expect(programScopesForRole(role)).toEqual(["fall_enrollment", "summer_camp", "all"]);
      expect(defaultProgramScope(role)).toBe("fall_enrollment");
    }
  });

  it("locks operators to fall_enrollment only — no summer_camp, no all", () => {
    expect(programScopesForRole("operator")).toEqual(["fall_enrollment"]);
    expect(defaultProgramScope("operator")).toBe("fall_enrollment");
  });

  it("never lets an operator resolve to a program they aren't allowed", () => {
    expect(resolveViewerProgramScope("operator", "summer_camp")).toBe("fall_enrollment");
    expect(resolveViewerProgramScope("operator", "all")).toBe("fall_enrollment");
    expect(resolveViewerProgramScope("operator", "fall_enrollment")).toBe("fall_enrollment");
  });

  it("honors a valid scope for multi-program roles and falls back otherwise", () => {
    expect(resolveViewerProgramScope("leader", "summer_camp")).toBe("summer_camp");
    expect(resolveViewerProgramScope("leader", "all")).toBe("all");
    expect(resolveViewerProgramScope("leader", "garbage")).toBe("fall_enrollment");
    expect(resolveViewerProgramScope("admin", null)).toBe("fall_enrollment");
  });

  it("expands a scope to the concrete program keys to query", () => {
    expect(programsForScope("leader", "summer_camp")).toEqual(["summer_camp"]);
    expect(programsForScope("leader", "all")).toEqual(["fall_enrollment", "summer_camp"]);
    // "all" for an operator can only ever expand to its single allowed program.
    expect(programsForScope("operator", "all")).toEqual(["fall_enrollment"]);
  });
});

describe("program scope cookie store (demo fallback, no DB)", () => {
  it("round-trips per-user scope through encode/decode", () => {
    const store = storeWithProgramScope({}, "marketing-lead", "summer_camp");
    const decoded = decodeProgramScopeStore(encodeProgramScopeStore(store));
    expect(programScopeFromStore(decoded, "marketing-lead")).toBe("summer_camp");
    expect(programScopeFromStore(decoded, "other-user")).toBeNull();
  });

  it("keeps independent scopes for multiple users in one cookie", () => {
    let store = storeWithProgramScope({}, "user-a", "all");
    store = storeWithProgramScope(store, "user-b", "summer_camp");
    const header = `gt_program_scope=${encodeURIComponent(encodeProgramScopeStore(store))}`;
    const parsed = readProgramScopeCookieFromHeader(header);
    expect(programScopeFromStore(parsed, "user-a")).toBe("all");
    expect(programScopeFromStore(parsed, "user-b")).toBe("summer_camp");
  });

  it("buildProgramScopeCookieValue appends without clobbering other users", () => {
    const existing = buildProgramScopeCookieValue("", "user-a", "all");
    const header = `gt_program_scope=${encodeURIComponent(existing)}`;
    const next = buildProgramScopeCookieValue(header, "user-b", "summer_camp");
    const store = decodeProgramScopeStore(next);
    expect(programScopeFromStore(store, "user-a")).toBe("all");
    expect(programScopeFromStore(store, "user-b")).toBe("summer_camp");
  });

  it("ignores malformed cookie values and returns null", () => {
    expect(programScopeFromStore(decodeProgramScopeStore("not-valid-base64!!!"), "anyone")).toBeNull();
    expect(programScopeFromStore(readProgramScopeCookieFromHeader(""), "anyone")).toBeNull();
  });
});
