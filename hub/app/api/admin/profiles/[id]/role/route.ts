// Admin-only profile role mutation. The PRD requires hard role gates, but does
// not define self-service role editing; roles therefore live on server-owned
// profile data and can only be changed through this audited Admin path.

import { NextResponse } from "next/server";
import {
  AuthError,
  ProfileRoleError,
  buildRoleChangeAudit,
  normalizeRoleChangeReason,
  parseRole,
  requireRole,
} from "@/lib/auth";
import { withoutProgram } from "@/lib/db";
import type { Role } from "@/lib/phase2";

export const dynamic = "force-dynamic";

type ProfileRoleRow = {
  id: string;
  email: string;
  display_name: string;
  permission_tier: Role;
  title: string | null;
  status: "active" | "disabled";
  role_updated_at: string | Date | null;
  role_updated_by: string | null;
  updated_at: string | Date | null;
};

async function parseBody(req: Request): Promise<{ role: Role | null; reason: string | null }> {
  const contentType = req.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};

  if (contentType.includes("application/json")) {
    body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  } else {
    const form = await req.formData().catch(() => null);
    if (form) {
      body = {
        role: form.get("role"),
        reason: form.get("reason"),
      };
    }
  }

  return {
    role: parseRole(body.role),
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

    const result = await withoutProgram(async (sql) => {
      const rows = await sql<ProfileRoleRow[]>`
        select id, email, display_name, permission_tier, title, status,
               role_updated_at, role_updated_by, updated_at
        from profiles
        where id = ${id}
        limit 1
        for update`;
      const current = rows[0] ?? null;

      const audit = buildRoleChangeAudit({
        actor: { id: actor.id, role: actor.role },
        target: current ? { id: current.id, role: current.permission_tier } : null,
        nextRole: body.role,
        reason: body.reason,
      });

      if (current && current.permission_tier === audit.toRole) {
        return { changed: false, profile: current };
      }

      const written = await sql<ProfileRoleRow[]>`
        update profiles set
          permission_tier = ${audit.toRole},
          role_updated_by = ${audit.actorId},
          role_updated_at = now(),
          updated_at = now()
        where id = ${audit.targetProfileId}
        returning id, email, display_name, permission_tier, title, status,
                  role_updated_at, role_updated_by, updated_at`;
      const profile = written[0];
      if (!profile) {
        throw new ProfileRoleError(404, "Profile not found.");
      }

      await sql`
        insert into profile_role_event
          (actor_id, target_profile_id, from_permission_tier, to_permission_tier, reason)
        values
          (${audit.actorId}, ${audit.targetProfileId}, ${audit.fromRole},
           ${audit.toRole}, ${audit.reason})`;

      return { changed: true, profile };
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
