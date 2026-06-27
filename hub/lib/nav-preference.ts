// Per-user sidebar nav scope preference (soft filter only — not RBAC).
//
// Live path: `nav_preference` row when APP_RW_DATABASE_URL is configured.
// Demo round-trip: a per-user cookie store (same pattern as raise-a-decision) so
// My / All / Agenda sticks after router.refresh() with no provisioned Postgres.

import { cookies } from "next/headers";
import { withoutProgram } from "@/lib/db";
import { parseNavScope, type NavScope } from "@/lib/nav";

export const NAV_SCOPE_COOKIE = "gt_nav_scope";
export const NAV_SCOPE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year — UI preference

type NavPreferenceRow = {
  user_id: string;
  nav_scope: string;
  updated_at: string | Date | null;
};

type NavScopeStore = Record<string, NavScope>;

/** Encode per-user scopes for the cookie. base64 of JSON — compact + transport-safe. */
export function encodeNavScopeStore(store: NavScopeStore): string {
  return Buffer.from(JSON.stringify(store), "utf8").toString("base64");
}

/** Decode the cookie value back to a per-user store; returns {} on malformed/missing input. */
export function decodeNavScopeStore(value: string | null | undefined): NavScopeStore {
  if (!value) return {};
  try {
    const json = Buffer.from(value, "base64").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const store: NavScopeStore = {};
    for (const [key, val] of Object.entries(parsed)) {
      const scope = parseNavScope(val);
      if (scope) store[key] = scope;
    }
    return store;
  } catch {
    return {};
  }
}

export function navScopeFromStore(store: NavScopeStore, userId: string): NavScope {
  return parseNavScope(store[userId]) ?? "my";
}

export function storeWithNavScope(
  store: NavScopeStore,
  userId: string,
  scope: NavScope,
): NavScopeStore {
  return { ...store, [userId]: scope };
}

/** Parse the nav-scope cookie from a raw Cookie request header. */
export function readNavScopeCookieFromHeader(cookieHeader: string): NavScopeStore {
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${NAV_SCOPE_COOKIE}=`));
  if (!match) return {};
  return decodeNavScopeStore(decodeURIComponent(match.slice(NAV_SCOPE_COOKIE.length + 1)));
}

export function buildNavScopeCookieValue(
  cookieHeader: string,
  userId: string,
  scope: NavScope,
): string {
  const next = storeWithNavScope(readNavScopeCookieFromHeader(cookieHeader), userId, scope);
  return encodeNavScopeStore(next);
}

export function navScopeCookieAttributes(value: string) {
  return {
    name: NAV_SCOPE_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: NAV_SCOPE_COOKIE_MAX_AGE,
  };
}

async function readNavScopeFromCookie(userId: string): Promise<NavScope> {
  try {
    const jar = await cookies();
    const value = jar.get(NAV_SCOPE_COOKIE)?.value;
    return navScopeFromStore(decodeNavScopeStore(value), userId);
  } catch {
    return "my";
  }
}

export async function getNavScopeForUser(userId: string): Promise<NavScope> {
  if (process.env.APP_RW_DATABASE_URL) {
    try {
      const row = await withoutProgram(async (sql) => {
        const rows = await sql<NavPreferenceRow[]>`
          select user_id, nav_scope, updated_at
          from nav_preference
          where user_id = ${userId}
          limit 1`;
        return rows[0] ?? null;
      });
      const scope = parseNavScope(row?.nav_scope);
      if (scope) return scope;
    } catch {
      // Demo or transient DB failure — fall through to the cookie store.
    }
  }
  return readNavScopeFromCookie(userId);
}

export type SetNavScopeResult = {
  scope: NavScope;
  /** When true, the route handler must set the demo cookie on the response. */
  cookieFallback: boolean;
};

export async function setNavScopeForUser(
  userId: string,
  scope: NavScope,
): Promise<SetNavScopeResult> {
  if (process.env.APP_RW_DATABASE_URL) {
    try {
      await withoutProgram(async (sql) => {
        await sql`
          insert into nav_preference (user_id, nav_scope)
          values (${userId}, ${scope})
          on conflict (user_id) do update set
            nav_scope = excluded.nav_scope,
            updated_at = now()`;
      });
      return { scope, cookieFallback: false };
    } catch {
      return { scope, cookieFallback: true };
    }
  }
  return { scope, cookieFallback: true };
}
