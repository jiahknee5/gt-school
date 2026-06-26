import { DEMO_USERS, type DemoUser, type Role } from "@/lib/phase2";

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
