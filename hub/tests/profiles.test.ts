import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  AUTH_PROFILES,
  ProfileRoleError,
  buildFunctionalRoleChangeAudit,
  buildRoleChangeAudit,
  parseFunctionalRoles,
  parseOwnedModuleSlugs,
  parseRole,
} from "@/lib/auth/profiles";

const authMock = vi.hoisted(() => ({
  requireRole: vi.fn(),
}));

const dbMock = vi.hoisted(() => ({
  withoutProgram: vi.fn(),
}));

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    requireRole: authMock.requireRole,
  };
});
vi.mock("@/lib/db", () => dbMock);

const { PATCH } = await import("@/app/api/admin/profiles/[id]/role/route");

const admin = AUTH_PROFILES.find((profile) => profile.role === "admin")!;
const leader = AUTH_PROFILES.find((profile) => profile.role === "leader")!;
const operator = AUTH_PROFILES.find((profile) => profile.role === "operator")!;

type ProfileRoleRow = {
  id: string;
  email: string;
  display_name: string;
  permission_tier: "admin" | "leader" | "operator";
  title: string | null;
  functional_roles: string[];
  owned_module_slugs: string[];
  status: "active" | "disabled";
  role_updated_at: string | Date | null;
  role_updated_by: string | null;
  updated_at: string | Date | null;
};

type SqlMock = {
  <T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  calls: { text: string; values: unknown[] }[];
};

function profileRow(profile = operator, role = profile.role): ProfileRoleRow {
  return {
    id: profile.id,
    email: profile.email,
    display_name: profile.displayName,
    permission_tier: role,
    title: profile.title,
    functional_roles: [...profile.functionalRoles],
    owned_module_slugs: [...profile.ownsModules],
    status: "active",
    role_updated_at: null,
    role_updated_by: null,
    updated_at: "2026-06-26T12:00:00.000Z",
  };
}

function sqlForResponses(...responses: unknown[][]) {
  const calls: { text: string; values: unknown[] }[] = [];
  const sql = (<T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?"), values });
    return Promise.resolve((responses[calls.length - 1] ?? []) as T);
  }) as SqlMock;
  sql.calls = calls;
  return sql;
}

function request(body: unknown, id = operator.id): Request {
  return new Request(`http://localhost/api/admin/profiles/${id}/role`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("profile role model", () => {
  it("keeps permission tiers separate from functional roles and module ownership", () => {
    expect(operator.role).toBe("operator");
    expect(operator.permissionTier).toBe("operator");
    expect(operator.functionalRoles).toContain("Content Owner");
    expect(operator.ownsModules).toContain("content");

    expect(leader.role).toBe("leader");
    expect(leader.functionalRoles).toContain("Growth Marketing Officer");

    expect(admin.role).toBe("admin");
    expect(admin.functionalRoles).toContain("Marketing Lead");
  });

  it("parses only the three hard-gate permission tiers", () => {
    expect(parseRole("leader")).toBe("leader");
    expect(parseRole(" Grassroots Owner ")).toBeNull();
    expect(parseRole("super_admin")).toBeNull();
  });

  it("parses functional roles and owned module slugs", () => {
    expect(parseFunctionalRoles(["Content Owner", "Grassroots Owner"])).toEqual([
      "Content Owner",
      "Grassroots Owner",
    ]);
    expect(parseFunctionalRoles(["Not A Role"])).toBeNull();
    expect(parseOwnedModuleSlugs(["content", "grassroots"])).toEqual([
      "content",
      "grassroots",
    ]);
    expect(parseOwnedModuleSlugs(["not-a-module"])).toBeNull();
  });

  it("allows Admin to change someone else's tier but blocks self-tier changes", () => {
    expect(
      buildRoleChangeAudit({
        actor: { id: admin.id, role: "admin" },
        target: { id: operator.id, role: "operator" },
        nextRole: "leader",
        reason: "Temporary leadership coverage.",
      }),
    ).toMatchObject({
      actorId: admin.id,
      targetProfileId: operator.id,
      fromRole: "operator",
      toRole: "leader",
    });

    expect(() =>
      buildRoleChangeAudit({
        actor: { id: admin.id, role: "admin" },
        target: { id: admin.id, role: "admin" },
        nextRole: "leader",
      }),
    ).toThrow(ProfileRoleError);
  });

  it("builds functional role audit when roles or modules change", () => {
    const audit = buildFunctionalRoleChangeAudit({
      actor: { id: admin.id, role: "admin" },
      target: {
        id: operator.id,
        functionalRoles: ["Content Owner"],
        ownsModules: ["content", "summer-camp"],
      },
      nextFunctionalRoles: ["Content Owner", "Grassroots Owner"],
      nextOwnedModuleSlugs: ["content", "summer-camp", "grassroots"],
    });
    expect(audit?.toFunctionalRoles).toEqual(["Content Owner", "Grassroots Owner"]);
    expect(audit?.toOwnedModuleSlugs).toContain("grassroots");
  });
});

describe("PATCH /api/admin/profiles/[id]/role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.requireRole.mockResolvedValue(admin);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates permission_tier and appends an audit row in one transaction", async () => {
    const current = profileRow(operator, "operator");
    const written = {
      ...current,
      permission_tier: "leader" as const,
      role_updated_by: admin.id,
      role_updated_at: "2026-06-26T12:10:00.000Z",
    };
    const sql = sqlForResponses([current], [written], []);
    dbMock.withoutProgram.mockImplementation(async (cb) => cb(sql));

    const res = await PATCH(request({ role: "leader", reason: "Coverage" }), {
      params: Promise.resolve({ id: operator.id }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(authMock.requireRole).toHaveBeenCalledWith("admin");
    expect(body.changed).toBe(true);
    expect(body.profile.role).toBe("leader");
    expect(body.profile.permission_tier).toBe("leader");
    expect(sql.calls).toHaveLength(3);
    expect(sql.calls[0].text).toContain("for update");
    expect(sql.calls[1].text).toContain("permission_tier");
    expect(sql.calls[2].text).toContain("profile_role_event");
  });

  it("updates functional roles and owned modules with audit", async () => {
    const current = profileRow(operator, "operator");
    const written = {
      ...current,
      functional_roles: ["Content Owner", "Grassroots Owner"],
      owned_module_slugs: ["content", "summer-camp", "grassroots"],
    };
    const sql = sqlForResponses([current], [written], []);
    dbMock.withoutProgram.mockImplementation(async (cb) => cb(sql));

    const res = await PATCH(
      request({
        functionalRoles: ["Content Owner", "Grassroots Owner"],
        ownedModuleSlugs: ["content", "summer-camp", "grassroots"],
        reason: "Dual coverage",
      }),
      { params: Promise.resolve({ id: operator.id }) },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.changed).toBe(true);
    expect(body.profile.functional_roles).toEqual(["Content Owner", "Grassroots Owner"]);
    expect(sql.calls.some((c) => c.text.includes("profile_functional_role_event"))).toBe(
      true,
    );
  });

  it("rejects an invalid functional role as a permission tier", async () => {
    const sql = sqlForResponses([profileRow(operator, "operator")]);
    dbMock.withoutProgram.mockImplementation(async (cb) => cb(sql));

    const res = await PATCH(request({ role: "Grassroots Owner" }), {
      params: Promise.resolve({ id: operator.id }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid permission tier/i);
    expect(sql.calls).toHaveLength(0);
  });
});
