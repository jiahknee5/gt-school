// Active-program API — the program view-lens analog of api/nav/scope.
//
// Persistence: program_preference row when a DB is configured; otherwise a per-user
// cookie store (same demo round-trip pattern as nav scope / raise-a-decision).
//
// SECURITY: the requested scope is validated against programScopesForRole(session.role)
// BEFORE it is stored or returned. An operator (fall_enrollment only) requesting
// summer_camp or "all" gets a 403 and nothing is persisted — a client can never pick
// a program it is not allowed. This is a soft UI lens and never bypasses the RLS scope
// derived server-side in lib/db.ts withProgram().

import { NextResponse } from "next/server";
import { AuthError, requireSession } from "@/lib/auth";
import {
  buildProgramScopeCookieValue,
  getProgramScopeForUser,
  programScopeCookieAttributes,
  setProgramScopeForUser,
} from "@/lib/program-preference";
import {
  parseProgramScope,
  programScopesForRole,
  resolveViewerProgramScope,
  type ProgramScope,
} from "@/lib/program-scope";

export const dynamic = "force-dynamic";

async function parseBody(req: Request): Promise<ProgramScope | null> {
  const contentType = req.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};
  if (contentType.includes("application/json")) {
    body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  } else {
    const form = await req.formData().catch(() => null);
    if (form) body = { programScope: form.get("programScope") };
  }
  return parseProgramScope(body.programScope);
}

export async function GET() {
  try {
    const session = await requireSession();
    const stored = await getProgramScopeForUser(session.id);
    const programScope = resolveViewerProgramScope(session.role, stored);
    return NextResponse.json({
      ok: true,
      programScope,
      allowed: programScopesForRole(session.role),
    });
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
    const requested = await parseBody(req);
    if (!requested) {
      return NextResponse.json(
        { error: "programScope must be fall_enrollment, summer_camp, or all." },
        { status: 400 },
      );
    }
    // RBAC: never store / return a program the role may not access.
    if (!programScopesForRole(session.role).includes(requested)) {
      return NextResponse.json(
        { error: `Program scope not permitted for role "${session.role}".` },
        { status: 403 },
      );
    }
    const { scope: programScope, cookieFallback } = await setProgramScopeForUser(
      session.id,
      requested,
    );
    const res = NextResponse.json({ ok: true, programScope });
    if (cookieFallback) {
      res.cookies.set(
        programScopeCookieAttributes(
          buildProgramScopeCookieValue(
            req.headers.get("cookie") ?? "",
            session.id,
            programScope,
          ),
        ),
      );
    }
    return res;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
