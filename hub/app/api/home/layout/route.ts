// Per-user Home layout persistence. The session user is the only row key: callers
// cannot supply or mutate another user's layout id. Widgets are stored as a small
// jsonb array of {widget_key,size,order}; metrics still read from owning modules.

import { NextResponse } from "next/server";
import { AuthError, requireSession } from "@/lib/auth";
import { withoutProgram } from "@/lib/db";
import {
  layoutForUser,
  normalizeHomeLayoutItems,
  starterHomeLayout,
} from "@/lib/home/layout";
import type { Role } from "@/lib/phase2";

export const dynamic = "force-dynamic";

type HomeLayoutRow = {
  user_id: string;
  role: Role;
  widgets: unknown;
  version: number;
  updated_at: string | Date | null;
};

async function parseBody(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await req.json().catch(() => ({}))) as Record<string, unknown>;
  }
  const form = await req.formData().catch(() => null);
  if (!form) return {};
  const widgets = form.get("widgets");
  return {
    widgets:
      typeof widgets === "string"
        ? JSON.parse(widgets || "[]")
        : widgets,
  };
}

export async function GET() {
  try {
    const session = await requireSession();
    const layout = await withoutProgram(async (sql) => {
      const rows = await sql<HomeLayoutRow[]>`
        select user_id, role, widgets, version, updated_at
        from home_layout
        where user_id = ${session.id}
        limit 1`;
      return layoutForUser(session, rows[0] ?? null);
    });

    return NextResponse.json({ ok: true, layout });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireSession();
    const body = await parseBody(req);
    const normalized = normalizeHomeLayoutItems(body.widgets, starterHomeLayout(session), {
      allowEmpty: true,
    });
    const widgetsJson = JSON.stringify(normalized.widgets);

    const layout = await withoutProgram(async (sql) => {
      const rows = await sql<HomeLayoutRow[]>`
        insert into home_layout (user_id, role, widgets, version)
        values (${session.id}, ${session.role}, ${widgetsJson}::jsonb, 1)
        on conflict (user_id) do update set
          role = excluded.role,
          widgets = excluded.widgets,
          version = home_layout.version + 1
        returning user_id, role, widgets, version, updated_at`;
      return layoutForUser(session, rows[0]);
    });

    return NextResponse.json({ ok: true, layout: { ...layout, warnings: normalized.warnings } });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
