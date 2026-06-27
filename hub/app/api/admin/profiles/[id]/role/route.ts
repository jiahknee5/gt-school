// Admin-only profile mutation: permission tier + functional roles + owned modules.
// Audited writes; tier and functional layers are updated independently.

import { NextResponse } from "next/server";
import {
  AuthError,
  ProfileRoleError,
  buildFunctionalRoleChangeAudit,
  buildRoleChangeAudit,
  normalizeRoleChangeReason,
  parseFunctionalRoles,
  parseOwnedModuleSlugs,
  parseRole,
  requireRole,
} from "@/lib/auth";
import { withoutProgram } from "@/lib/db";
import type { FunctionalRole, Role } from "@/lib/phase2";

export const dynamic = "force-dynamic";

type ProfileRoleRow = {
  id: string;
  email: string;
  display_name: string;
  permission_tier: Role;
  title: string | null;
  functional_roles: string[];
  owned_module_slugs: string[];
  status: "active" | "disabled";
  role_updated_at: string | Date | null;
  role_updated_by: string | null;
  updated_at: string | Date | null;
};

async function parseBody(req: Request): Promise<{
  role: Role | null | undefined;
  functionalRoles: FunctionalRole[] | null | undefined;
  ownedModuleSlugs: string[] | null | undefined;
  reason: string | null;
}> {
  const contentType = req.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};

  if (contentType.includes("application/json")) {
    body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  } else {
    const form = await req.formData().catch(() => null);
    if (form) {
      body = {
        role: form.get("role"),
        functionalRoles: form.getAll("functionalRoles"),
        ownedModuleSlugs: form.getAll("ownedModuleSlugs"),
        reason: form.get("reason"),
      };
    }
  }

  const hasRole = Object.prototype.hasOwnProperty.call(body, "role");
  const hasFunctionalRoles = Object.prototype.hasOwnProperty.call(body, "functionalRoles");
  const hasOwnedModules = Object.prototype.hasOwnProperty.call(body, "ownedModuleSlugs");

  return {
    role: hasRole ? parseRole(body.role) : undefined,
    functionalRoles: hasFunctionalRoles ? parseFunctionalRoles(body.functionalRoles) : undefined,
    ownedModuleSlugs: hasOwnedModules ? parseOwnedModuleSlugs(body.ownedModuleSlugs) : undefined,
    reason: normalizeRoleChangeReason(body.reason),
  };
}

function serializeProfile(row: ProfileRoleRow) {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    role: row.permission_tier,
    permission_tier: row.permission_tier,
    title: row.title,
    functional_roles: row.functional_roles,
    functionalRoles: row.functional_roles,
    owned_module_slugs: row.owned_module_slugs,
    ownedModuleSlugs: row.owned_module_slugs,
    status: row.status,
    role_updated_at: row.role_updated_at
      ? new Date(row.role_updated_at).toISOString()
      : null,
    role_updated_by: row.role_updated_by,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireRole("admin");
    const { id } = await params;
    const body = await parseBody(req);

    if (body.role === null) {
      return NextResponse.json(
        { error: "Invalid permission tier. Must be admin, leader, or operator." },
        { status: 400 },
      );
    }
    if (body.functionalRoles === null) {
      return NextResponse.json({ error: "Invalid functional role(s)." }, { status: 400 });
    }
    if (body.ownedModuleSlugs === null) {
      return NextResponse.json({ error: "Invalid owned module slug(s)." }, { status: 400 });
    }

    if (
      body.role === undefined &&
      body.functionalRoles === undefined &&
      body.ownedModuleSlugs === undefined
    ) {
      return NextResponse.json({ error: "No profile fields to update." }, { status: 400 });
    }

    const result = await withoutProgram(async (sql) => {
      const rows = await sql<ProfileRoleRow[]>`
        select id, email, display_name, permission_tier, title,
               functional_roles, owned_module_slugs, status,
               role_updated_at, role_updated_by, updated_at
        from profiles
        where id = ${id}
        limit 1
        for update`;
      const current = rows[0] ?? null;
      if (!current) {
        throw new ProfileRoleError(404, "Profile not found.");
      }

      let tierChanged = false;
      let functionalChanged = false;
      let profile = current;

      if (body.role !== undefined) {
        const audit = buildRoleChangeAudit({
          actor: { id: actor.id, role: actor.role },
          target: { id: current.id, role: current.permission_tier },
          nextRole: body.role,
          reason: body.reason,
        });

        if (current.permission_tier !== audit.toRole) {
          const written = await sql<ProfileRoleRow[]>`
            update profiles set
              permission_tier = ${audit.toRole},
              role_updated_by = ${audit.actorId},
              role_updated_at = now(),
              updated_at = now()
            where id = ${audit.targetProfileId}
            returning id, email, display_name, permission_tier, title,
                      functional_roles, owned_module_slugs, status,
                      role_updated_at, role_updated_by, updated_at`;
          profile = written[0] ?? profile;
          tierChanged = true;

          await sql`
            insert into profile_role_event
              (actor_id, target_profile_id, from_permission_tier, to_permission_tier, reason)
            values
              (${audit.actorId}, ${audit.targetProfileId}, ${audit.fromRole},
               ${audit.toRole}, ${audit.reason})`;
        }
      }

      const functionalAudit = buildFunctionalRoleChangeAudit({
        actor: { id: actor.id, role: actor.role },
        target: {
          id: profile.id,
          functionalRoles: profile.functional_roles as FunctionalRole[],
          ownsModules: profile.owned_module_slugs,
        },
        nextFunctionalRoles: body.functionalRoles,
        nextOwnedModuleSlugs: body.ownedModuleSlugs,
        reason: body.reason,
      });

      if (functionalAudit) {
        const written = await sql<ProfileRoleRow[]>`
          update profiles set
            functional_roles = ${functionalAudit.toFunctionalRoles},
            owned_module_slugs = ${functionalAudit.toOwnedModuleSlugs},
            updated_at = now()
          where id = ${functionalAudit.targetProfileId}
          returning id, email, display_name, permission_tier, title,
                    functional_roles, owned_module_slugs, status,
                    role_updated_at, role_updated_by, updated_at`;
        profile = written[0] ?? profile;
        functionalChanged = true;

        await sql`
          insert into profile_functional_role_event
            (actor_id, target_profile_id,
             from_functional_roles, to_functional_roles,
             from_owned_module_slugs, to_owned_module_slugs, reason)
          values
            (${functionalAudit.actorId}, ${functionalAudit.targetProfileId},
             ${functionalAudit.fromFunctionalRoles}, ${functionalAudit.toFunctionalRoles},
             ${functionalAudit.fromOwnedModuleSlugs}, ${functionalAudit.toOwnedModuleSlugs},
             ${functionalAudit.reason})`;
      }

      return { changed: tierChanged || functionalChanged, profile };
    });

    return NextResponse.json({
      ok: true,
      changed: result.changed,
      profile: serializeProfile(result.profile),
    });
  } catch (err) {
    if (err instanceof AuthError || err instanceof ProfileRoleError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
