// Loads user profiles from the DB when configured, falling back to the in-code seed.

import { withoutProgram } from "@/lib/db";
import type { FunctionalRole, Role, WorkstreamKey } from "@/lib/phase2";
import {
  AUTH_PROFILES,
  profileById as seedProfileById,
  type ProfileStatus,
  type UserProfile,
} from "@/lib/auth/profiles";

type ProfileRow = {
  id: string;
  email: string;
  display_name: string;
  permission_tier: Role;
  title: string | null;
  functional_roles: string[];
  owned_module_slugs: string[];
  owned_workstreams: string[];
  status: ProfileStatus;
  role_updated_at: string | Date | null;
  role_updated_by: string | null;
};

export function dbConfigured(): boolean {
  return Boolean(process.env.APP_RW_DATABASE_URL);
}

function rowToProfile(row: ProfileRow): UserProfile {
  const seed = seedProfileById(row.id);
  const functionalRoles = row.functional_roles as FunctionalRole[];
  const ownsModules = row.owned_module_slugs;
  const owns = row.owned_workstreams as WorkstreamKey[];
  return {
    id: row.id,
    name: row.display_name,
    email: row.email,
    displayName: row.display_name,
    role: row.permission_tier,
    permissionTier: row.permission_tier,
    title: row.title ?? seed?.title ?? row.id,
    functionalRoles,
    ownsModules,
    agendaSlots: seed?.agendaSlots ?? [],
    owns,
    status: row.status,
    roleUpdatedAt: row.role_updated_at
      ? new Date(row.role_updated_at).toISOString()
      : null,
    roleUpdatedBy: row.role_updated_by,
  };
}

export async function loadProfileById(id: string): Promise<UserProfile | undefined> {
  if (!dbConfigured()) {
    return seedProfileById(id);
  }
  try {
    const row = await withoutProgram(async (sql) => {
      const rows = await sql<ProfileRow[]>`
        select id, email, display_name, permission_tier, title,
               functional_roles, owned_module_slugs, owned_workstreams,
               status, role_updated_at, role_updated_by
        from profiles
        where id = ${id} and status = 'active'
        limit 1`;
      return rows[0] ?? null;
    });
    if (row) return rowToProfile(row);
    return seedProfileById(id);
  } catch {
    return seedProfileById(id);
  }
}

export async function loadAllProfiles(): Promise<UserProfile[]> {
  if (!dbConfigured()) {
    return [...AUTH_PROFILES];
  }
  try {
    const rows = await withoutProgram(async (sql) => {
      return sql<ProfileRow[]>`
        select id, email, display_name, permission_tier, title,
               functional_roles, owned_module_slugs, owned_workstreams,
               status, role_updated_at, role_updated_by
        from profiles
        where status = 'active'
        order by display_name`;
    });
    if (rows.length === 0) return [...AUTH_PROFILES];
    return rows.map(rowToProfile);
  } catch {
    return [...AUTH_PROFILES];
  }
}

export async function loadProfileByRole(role: Role): Promise<UserProfile | undefined> {
  const profiles = await loadAllProfiles();
  return profiles.find((p) => p.role === role && p.status === "active");
}
