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
      // Fail fast if the pooler connection can't be established quickly. Without this,
      // a slow/hung connect from the serverless render context blocked the request until
      // the gateway 504'd (~25s); every DB read in the app has a graceful fallback
      // (cookie store / deterministic-on-view), so failing fast is strictly better.
      connect_timeout: 6,
      onnotice: () => {},
    });
  }
  return _sql;
}

/**
 * Hard ceiling on any single scoped DB operation. A render must never hang on the DB —
 * if the pooler is slow/unreachable, we reject after `DB_OP_TIMEOUT_MS` so the caller's
 * fallback (cookie preference store, deterministic-on-view status) takes over instead of
 * the request hanging to the gateway timeout. Generous enough that a healthy query
 * (~50ms) always wins the race.
 */
const DB_OP_TIMEOUT_MS = 6000;
const DB_BREAKER_COOLDOWN_MS = 30_000;

// Circuit breaker: once a DB op times out / fails to connect, short-circuit subsequent ops
// for a cooldown so a single slow render doesn't stack N × timeout (layout reads prefs +
// the page reads the snapshot — 3-4 ops) toward the gateway limit. While tripped, ops fail
// INSTANTLY and the caller's fallback runs. It self-heals after the cooldown.
let _breakerUntil = 0;

function breakerOpen(): boolean {
  return Date.now() < _breakerUntil;
}
function tripBreaker(): void {
  _breakerUntil = Date.now() + DB_BREAKER_COOLDOWN_MS;
}

const TIMEOUT_SENTINEL = "__db_op_timeout__";

async function withDeadline<T>(p: Promise<T>): Promise<T> {
  if (breakerOpen()) {
    throw new Error("DB circuit breaker open — failing fast to the app fallback.");
  }
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(TIMEOUT_SENTINEL)), DB_OP_TIMEOUT_MS)),
    ]);
  } catch (err) {
    // Trip the breaker only when the DB is UNRESPONSIVE (timeout or connection failure) —
    // an ordinary query error means the DB answered, so leave the breaker closed.
    const msg = err instanceof Error ? err.message : String(err);
    const isUnresponsive = msg === TIMEOUT_SENTINEL || /connect|timeout|ECONN|terminat|socket/i.test(msg);
    if (isUnresponsive) tripBreaker();
    throw err instanceof Error && msg === TIMEOUT_SENTINEL
      ? new Error(`DB operation exceeded ${DB_OP_TIMEOUT_MS}ms — falling back.`)
      : err;
  }
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
  await withDeadline(
    sql.begin(async (tx) => {
      await assumeAppRw(tx);
      await tx`select set_config('app.current_program', ${programId}, true)`;
      result = await fn(tx);
    }),
  );
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
  await withDeadline(
    sql.begin(async (tx) => {
      await assumeAppRw(tx);
      result = await fn(tx);
    }),
  );
  return result;
}

/** Close the shared pool (used by tests so the runner can exit cleanly). */
export async function closeDb(): Promise<void> {
  if (_sql) {
    await _sql.end({ timeout: 5 });
    _sql = null;
  }
}
