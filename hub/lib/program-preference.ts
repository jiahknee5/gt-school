// Per-user "active program" preference (soft view lens — not RBAC).
//
// Mirrors lib/nav-preference.ts exactly:
//   Live path:  `program_preference` row when APP_RW_DATABASE_URL is configured.
//   Demo path:  a per-user cookie store (base64 JSON) so the selection sticks after
//               router.refresh() with no provisioned Postgres.
//
// The stored value is the raw ProgramScope the user picked. RBAC clamping
// (resolveViewerProgramScope) happens at the read boundary in the layout / API,
// where the session role is known — this layer is role-agnostic, like nav scope.

import { cookies } from "next/headers";
import { withoutProgram } from "@/lib/db";
import { parseProgramScope, type ProgramScope } from "@/lib/program-scope";

export const PROGRAM_SCOPE_COOKIE = "gt_program_scope";
export const PROGRAM_SCOPE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year — UI preference

type ProgramPreferenceRow = {
  user_id: string;
  program_scope: string;
  updated_at: string | Date | null;
};

type ProgramScopeStore = Record<string, ProgramScope>;

/** Encode per-user scopes for the cookie. base64 of JSON — compact + transport-safe. */
export function encodeProgramScopeStore(store: ProgramScopeStore): string {
  return Buffer.from(JSON.stringify(store), "utf8").toString("base64");
}

/** Decode the cookie value back to a per-user store; returns {} on malformed/missing input. */
export function decodeProgramScopeStore(value: string | null | undefined): ProgramScopeStore {
  if (!value) return {};
  try {
    const json = Buffer.from(value, "base64").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const store: ProgramScopeStore = {};
    for (const [key, val] of Object.entries(parsed)) {
      const scope = parseProgramScope(val);
      if (scope) store[key] = scope;
    }
    return store;
  } catch {
    return {};
  }
}

/** The stored scope for a user, or null when unset (caller applies the role default). */
export function programScopeFromStore(store: ProgramScopeStore, userId: string): ProgramScope | null {
  return parseProgramScope(store[userId]);
}

export function storeWithProgramScope(
  store: ProgramScopeStore,
  userId: string,
  scope: ProgramScope,
): ProgramScopeStore {
  return { ...store, [userId]: scope };
}

/** Parse the program-scope cookie from a raw Cookie request header. */
export function readProgramScopeCookieFromHeader(cookieHeader: string): ProgramScopeStore {
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${PROGRAM_SCOPE_COOKIE}=`));
  if (!match) return {};
  return decodeProgramScopeStore(
    decodeURIComponent(match.slice(PROGRAM_SCOPE_COOKIE.length + 1)),
  );
}

export function buildProgramScopeCookieValue(
  cookieHeader: string,
  userId: string,
  scope: ProgramScope,
): string {
  const next = storeWithProgramScope(
    readProgramScopeCookieFromHeader(cookieHeader),
    userId,
    scope,
  );
  return encodeProgramScopeStore(next);
}

export function programScopeCookieAttributes(value: string) {
  return {
    name: PROGRAM_SCOPE_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PROGRAM_SCOPE_COOKIE_MAX_AGE,
  };
}

async function readProgramScopeFromCookie(userId: string): Promise<ProgramScope | null> {
  try {
    const jar = await cookies();
    const value = jar.get(PROGRAM_SCOPE_COOKIE)?.value;
    return programScopeFromStore(decodeProgramScopeStore(value), userId);
  } catch {
    return null;
  }
}

/**
 * The user's stored program scope, or null when unset. DB-first when a database is
 * configured, otherwise the demo cookie store. The caller resolves null + RBAC via
 * resolveViewerProgramScope(role, scope).
 */
export async function getProgramScopeForUser(userId: string): Promise<ProgramScope | null> {
  if (process.env.APP_RW_DATABASE_URL) {
    try {
      const row = await withoutProgram(async (sql) => {
        const rows = await sql<ProgramPreferenceRow[]>`
          select user_id, program_scope, updated_at
          from program_preference
          where user_id = ${userId}
          limit 1`;
        return rows[0] ?? null;
      });
      const scope = parseProgramScope(row?.program_scope);
      if (scope) return scope;
    } catch {
      // Demo or transient DB failure (incl. table not provisioned) — fall through
      // to the cookie store, exactly like nav scope.
    }
  }
  return readProgramScopeFromCookie(userId);
}

export type SetProgramScopeResult = {
  scope: ProgramScope;
  /** When true, the route handler must set the demo cookie on the response. */
  cookieFallback: boolean;
};

export async function setProgramScopeForUser(
  userId: string,
  scope: ProgramScope,
): Promise<SetProgramScopeResult> {
  if (process.env.APP_RW_DATABASE_URL) {
    try {
      await withoutProgram(async (sql) => {
        await sql`
          insert into program_preference (user_id, program_scope)
          values (${userId}, ${scope})
          on conflict (user_id) do update set
            program_scope = excluded.program_scope,
            updated_at = now()`;
      });
      return { scope, cookieFallback: false };
    } catch {
      return { scope, cookieFallback: true };
    }
  }
  return { scope, cookieFallback: true };
}
