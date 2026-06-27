import { MODULES } from "@/lib/modules";
import {
  DEMO_USERS,
  type DemoUser,
  type FunctionalRole,
  type Role,
} from "@/lib/phase2";

export type ProfileStatus = "active" | "disabled";

export interface UserProfile extends DemoUser {
  email: string;
  displayName: string;
  /** Alias for `role`: the hard permission tier used by route/API gates. */
  permissionTier: Role;
  status: ProfileStatus;
  roleUpdatedAt: string | null;
  roleUpdatedBy: string | null;
}

export class ProfileRoleError extends Error {
  status: 400 | 401 | 403 | 404;

  constructor(status: 400 | 401 | 403 | 404, message: string) {
    super(message);
    this.status = status;
    this.name = "ProfileRoleError";
  }
}

export type RoleManagedProfile = {
  id: string;
  role: Role;
};

export type RoleChangeAudit = {
  actorId: string;
  targetProfileId: string;
  fromRole: Role;
  toRole: Role;
  reason: string | null;
};

export type FunctionalRoleChangeAudit = {
  actorId: string;
  targetProfileId: string;
  fromFunctionalRoles: FunctionalRole[];
  toFunctionalRoles: FunctionalRole[];
  fromOwnedModuleSlugs: string[];
  toOwnedModuleSlugs: string[];
  reason: string | null;
};

export type ProfileUpdatePayload = {
  role?: Role | null;
  functionalRoles?: FunctionalRole[] | null;
  ownedModuleSlugs?: string[] | null;
  reason?: string | null;
};

const VALID_FUNCTIONAL_ROLES = new Set<FunctionalRole>([
  "Marketing Lead",
  "Growth Marketing Officer",
  "Budget Owner",
  "Co-founder",
  "Content Owner",
  "Grassroots Owner",
  "Field & Events Owner",
  "Admissions Owner",
]);

const VALID_MODULE_SLUGS = new Set(MODULES.map((m) => m.slug));

const EMAIL_BY_ID: Record<string, string> = {
  "marketing-lead": "marketing-lead@gt.school",
  "growth-leader": "growth-leader@gt.school",
  "budget-owner": "budget-owner@gt.school",
  cofounder: "cofounder@gt.school",
  "content-operator": "content@gt.school",
  "grassroots-operator": "grassroots@gt.school",
  "field-events-operator": "field-events@gt.school",
  "admissions-operator": "admissions@gt.school",
};

export const AUTH_PROFILES: UserProfile[] = DEMO_USERS.map((user) => ({
  ...user,
  email: EMAIL_BY_ID[user.id] ?? `${user.id}@gt.school`,
  displayName: user.name,
  permissionTier: user.role,
  status: "active",
  roleUpdatedAt: null,
  roleUpdatedBy: null,
}));

export function isRole(value: unknown): value is Role {
  return value === "admin" || value === "leader" || value === "operator";
}

export function parseRole(value: unknown): Role | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return isRole(normalized) ? normalized : null;
}

export function normalizeRoleChangeReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
}

export function isFunctionalRole(value: unknown): value is FunctionalRole {
  return typeof value === "string" && VALID_FUNCTIONAL_ROLES.has(value as FunctionalRole);
}

/** Parse and dedupe functional roles; returns null if any entry is invalid. */
export function parseFunctionalRoles(value: unknown): FunctionalRole[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) return null;
  const parsed: FunctionalRole[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") return null;
    const trimmed = entry.trim();
    if (!isFunctionalRole(trimmed)) return null;
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      parsed.push(trimmed);
    }
  }
  return parsed;
}

/** Parse owned module slugs; returns null if any slug is unknown. */
export function parseOwnedModuleSlugs(value: unknown): string[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) return null;
  const parsed: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") return null;
    const slug = entry.trim();
    if (!VALID_MODULE_SLUGS.has(slug)) return null;
    if (!seen.has(slug)) {
      seen.add(slug);
      parsed.push(slug);
    }
  }
  return parsed;
}

export function allFunctionalRoles(): FunctionalRole[] {
  return [...VALID_FUNCTIONAL_ROLES];
}

export function allAssignableModuleSlugs(): string[] {
  return MODULES.map((m) => m.slug);
}

export function profileById(
  id: string,
  profiles: readonly UserProfile[] = AUTH_PROFILES,
): UserProfile | undefined {
  return profiles.find((profile) => profile.id === id && profile.status === "active");
}

export function profileByRole(
  role: string,
  profiles: readonly UserProfile[] = AUTH_PROFILES,
): UserProfile | undefined {
  return profiles.find((profile) => profile.role === role && profile.status === "active");
}

export function canManageProfileRoles(actor: Pick<RoleManagedProfile, "role"> | null | undefined) {
  return actor?.role === "admin";
}

export function buildRoleChangeAudit(input: {
  actor: RoleManagedProfile | null | undefined;
  target: RoleManagedProfile | null | undefined;
  nextRole: Role | null | undefined;
  reason?: string | null;
}): RoleChangeAudit {
  const { actor, target, nextRole } = input;

  if (!actor) {
    throw new ProfileRoleError(401, "Authentication required.");
  }
  if (!canManageProfileRoles(actor)) {
    throw new ProfileRoleError(403, "Only Admin can change profile roles.");
  }
  if (!target) {
    throw new ProfileRoleError(404, "Profile not found.");
  }
  if (!nextRole) {
    throw new ProfileRoleError(400, "Role must be admin, leader, or operator.");
  }
  if (actor.id === target.id && target.role !== nextRole) {
    throw new ProfileRoleError(
      403,
      "Admins cannot change their own permission tier from inside the Hub.",
    );
  }

  return {
    actorId: actor.id,
    targetProfileId: target.id,
    fromRole: target.role,
    toRole: nextRole,
    reason: input.reason ?? null,
  };
}

export type FunctionalRoleManagedProfile = {
  id: string;
  functionalRoles: FunctionalRole[];
  ownsModules: string[];
};

export function buildFunctionalRoleChangeAudit(input: {
  actor: RoleManagedProfile | null | undefined;
  target: FunctionalRoleManagedProfile | null | undefined;
  nextFunctionalRoles: FunctionalRole[] | null | undefined;
  nextOwnedModuleSlugs: string[] | null | undefined;
  reason?: string | null;
}): FunctionalRoleChangeAudit | null {
  const { actor, target, nextFunctionalRoles, nextOwnedModuleSlugs } = input;

  if (!actor) {
    throw new ProfileRoleError(401, "Authentication required.");
  }
  if (!canManageProfileRoles(actor)) {
    throw new ProfileRoleError(403, "Only Admin can change profile roles.");
  }
  if (!target) {
    throw new ProfileRoleError(404, "Profile not found.");
  }
  if (nextFunctionalRoles == null && nextOwnedModuleSlugs == null) {
    return null;
  }

  const toFunctionalRoles = nextFunctionalRoles ?? target.functionalRoles;
  const toOwnedModuleSlugs = nextOwnedModuleSlugs ?? target.ownsModules;

  const rolesChanged =
    [...toFunctionalRoles].sort().join("|") !== [...target.functionalRoles].sort().join("|");

  const modulesChanged =
    [...toOwnedModuleSlugs].sort().join("|") !== [...target.ownsModules].sort().join("|");

  if (!rolesChanged && !modulesChanged) {
    return null;
  }

  return {
    actorId: actor.id,
    targetProfileId: target.id,
    fromFunctionalRoles: [...target.functionalRoles],
    toFunctionalRoles,
    fromOwnedModuleSlugs: [...target.ownsModules],
    toOwnedModuleSlugs,
    reason: input.reason ?? null,
  };
}

export function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}
