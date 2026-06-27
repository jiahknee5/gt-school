// Per-user sidebar nav scope (soft filter). Session user is the only row key.

import { NextResponse } from "next/server";
import { AuthError, requireSession } from "@/lib/auth";
import { getNavScopeForUser, setNavScopeForUser } from "@/lib/nav-preference";
import { parseNavScope, type NavScope } from "@/lib/nav";

export const dynamic = "force-dynamic";

async function parseBody(req: Request): Promise<NavScope | null> {
  const contentType = req.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};
  if (contentType.includes("application/json")) {
    body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  } else {
    const form = await req.formData().catch(() => null);
    if (form) body = { navScope: form.get("navScope") };
  }
  return parseNavScope(body.navScope);
}

export async function GET() {
  try {
    const session = await requireSession();
    const navScope = await getNavScopeForUser(session.id);
    return NextResponse.json({ ok: true, navScope });
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
    const scope = await parseBody(req);
    if (!scope) {
      return NextResponse.json(
        { error: "navScope must be my, all, or agenda." },
        { status: 400 },
      );
    }
    const navScope = await setNavScopeForUser(session.id, scope);
    return NextResponse.json({ ok: true, navScope });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
