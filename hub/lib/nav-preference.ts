// Per-user sidebar nav scope preference (soft filter only — not RBAC).

import { withoutProgram } from "@/lib/db";
import { parseNavScope, type NavScope } from "@/lib/nav";

type NavPreferenceRow = {
  user_id: string;
  nav_scope: string;
  updated_at: string | Date | null;
};

export async function getNavScopeForUser(userId: string): Promise<NavScope> {
  if (!process.env.APP_RW_DATABASE_URL) {
    return "my";
  }
  try {
    const row = await withoutProgram(async (sql) => {
      const rows = await sql<NavPreferenceRow[]>`
        select user_id, nav_scope, updated_at
        from nav_preference
        where user_id = ${userId}
        limit 1`;
      return rows[0] ?? null;
    });
    return parseNavScope(row?.nav_scope) ?? "my";
  } catch {
    return "my";
  }
}

export async function setNavScopeForUser(userId: string, scope: NavScope): Promise<NavScope> {
  if (!process.env.APP_RW_DATABASE_URL) {
    return scope;
  }
  await withoutProgram(async (sql) => {
    await sql`
      insert into nav_preference (user_id, nav_scope)
      values (${userId}, ${scope})
      on conflict (user_id) do update set
        nav_scope = excluded.nav_scope,
        updated_at = now()`;
  });
  return scope;
}
