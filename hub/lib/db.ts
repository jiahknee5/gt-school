import postgres from "postgres";

/**
 * Program isolation lives in the database (RLS + FORCE on program_membership,
 * enrollments, payments — see supabase/migrations/0001_backbone.sql). The app's
 * only job is to enter the scope correctly and never bypass it.
 *
 * The scoped path, in ONE transaction:
 *   1. SET LOCAL ROLE app_rw   — the NOBYPASSRLS role; RLS is then enforced.
 *   2. select set_config('app.current_program', $1, true)  — transaction-local GUC.
 *      (set_config(..., true) is the parameterizable form of SET LOCAL — SET LOCAL
 *       itself cannot take a bind parameter.)
 *   3. run the caller's statements; COMMIT (ROLLBACK on throw).
 *
 * We use SET LOCAL ROLE (not bare SET ROLE) so the role reverts at COMMIT and
 * never leaks back into the pooled connection. service_role / any BYPASSRLS role
 * is NEVER used here — it would silently bypass the isolation guarantee.
 */

export type ScopedSql = postgres.TransactionSql;

let _sql: postgres.Sql | null = null;

function getClient(): postgres.Sql {
  const url = process.env.APP_RW_DATABASE_URL;
  if (!url) {
    throw new Error(
      "APP_RW_DATABASE_URL is not set. Set it to the restricted app_rw login " +
        "(via the Supavisor pooler) — NOT service_role.",
    );
  }
  if (!_sql) {
    _sql = postgres(url, {
      // Supavisor transaction pooling does not support server-side prepared
      // statements; disabling prepare keeps the pooled path working.
      prepare: false,
      max: 5,
      idle_timeout: 20,
      onnotice: () => {},
    });
  }
  return _sql;
}

async function assumeAppRw(tx: postgres.TransactionSql): Promise<void> {
  try {
    await tx.unsafe("set local role app_rw");
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `SET ROLE app_rw failed: ${detail}. The connecting role must be a MEMBER of ` +
        `app_rw for SET ROLE to work (the migration grants app_rw to postgres). ` +
        `If the pooler connects as a different role, grant app_rw to it. ` +
        `R1 exists to catch exactly this.`,
    );
  }
}

/**
 * Run `fn` inside a single program-scoped transaction. Returns whatever `fn`
 * returns; rolls back (and rethrows) if `fn` throws.
 */
export async function withProgram<T>(
  programId: string,
  fn: (sql: ScopedSql) => Promise<T>,
): Promise<T> {
  if (!programId) {
    throw new Error("withProgram requires a program id (the RLS scope).");
  }
  const sql = getClient();
  let result!: T;
  await sql.begin(async (tx) => {
    await assumeAppRw(tx);
    await tx`select set_config('app.current_program', ${programId}, true)`;
    result = await fn(tx);
  });
  return result;
}

/**
 * Run `fn` as app_rw with NO program scope set. Because RLS is FORCEd and the
 * GUC is unset, the policy predicate is NULL → scoped tables return 0 rows
 * (fail-closed). Use for global-table reads and for the R1 fail-closed probe.
 */
export async function withoutProgram<T>(
  fn: (sql: ScopedSql) => Promise<T>,
): Promise<T> {
  const sql = getClient();
  let result!: T;
  await sql.begin(async (tx) => {
    await assumeAppRw(tx);
    result = await fn(tx);
  });
  return result;
}

/** Close the shared pool (used by tests so the runner can exit cleanly). */
export async function closeDb(): Promise<void> {
  if (_sql) {
    await _sql.end({ timeout: 5 });
    _sql = null;
  }
}
