import { withoutProgram, type ScopedSql } from "../db";
import {
  hubspotConnector,
  patchDeal,
  type HsError,
} from "../connectors/hubspot";
import type { SourceConnector } from "../connectors/SourceConnector";

/**
 * outbox-worker.ts — drains the transactional outbox (durable app→HubSpot intent)
 * that payments.ts and reconcile.ts write into.
 *
 * drainOutbox():
 *   - Claims due `pending` rows with SELECT … FOR UPDATE SKIP LOCKED inside ONE
 *     transaction, dispatches each via the HubSpot connector (patchDeal for deals,
 *     pushUpdate for contacts), and marks `done`. Because the rows stay row-locked
 *     for the whole transaction, two concurrent drains claim DISJOINT batches —
 *     every row is dispatched at most once.
 *   - On a RETRYABLE failure (429 / 5xx / network) it backs off via next_attempt_at
 *     (exponential) and leaves the row `pending`. On a non-retryable client error
 *     (4xx ≠ 429) or after maxAttempts it marks the row `dead` AND auto-files a
 *     data_quality_issue so CRM Ops sees the stuck write.
 *   - Idempotent on dedupe_key (the unique enqueue key) and on dispatch: a HubSpot
 *     PATCH is itself idempotent, so a redelivered claim cannot corrupt state.
 */

export interface OutboxRow {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  target_system: string;
  op: string;
  payload: Record<string, unknown>;
  dedupe_key: string;
  attempts: number;
}

export type Dispatcher = (row: OutboxRow) => Promise<void>;

export interface DrainOptions {
  limit?: number; // max rows to claim this pass (default 50)
  maxAttempts?: number; // attempts before a row is declared dead (default 5)
  dedupeKeyLike?: string; // optional LIKE filter — scopes a drain to specific rows (tests)
  connector?: SourceConnector; // contact pushUpdate target (default live HubSpot)
  dispatch?: Dispatcher; // override the whole dispatch (tests inject controlled outcomes)
}

export interface DrainResult {
  claimed: number;
  done: string[]; // dedupe_keys dispatched + marked done
  retried: { dedupeKey: string; attempts: number; nextAttemptInSec: number; error: string }[];
  dead: { dedupeKey: string; attempts: number; error: string }[];
}

const BASE_BACKOFF_SEC = 30;
const MAX_BACKOFF_SEC = 3600;

/** The real dispatch: route an outbox row to the correct HubSpot write. */
function makeDispatcher(connector: SourceConnector): Dispatcher {
  return async (row: OutboxRow): Promise<void> => {
    if (row.op === "patch_deal") {
      const p = row.payload as { deal_id?: string; dealId?: string; properties?: Record<string, string> };
      const dealId = p.deal_id ?? p.dealId;
      if (!dealId) throw new Error("patch_deal payload missing deal_id");
      if (!p.properties) throw new Error("patch_deal payload missing properties");
      await patchDeal(dealId, p.properties);
      return;
    }
    if (row.op === "upsert_contact" || row.op === "patch_contact") {
      const p = row.payload as { externalId?: string; hubspot_contact_id?: string } & Record<string, unknown>;
      const externalId = p.externalId ?? p.hubspot_contact_id;
      if (!externalId) {
        // No HubSpot id to PATCH against — non-retryable. (The demo's seeded
        // upsert_contact rows have only an email; a real path would resolve/create
        // the contact first. We surface this rather than silently create junk.)
        throw new Error("contact op payload has no HubSpot id (externalId/hubspot_contact_id)");
      }
      const { externalId: _a, hubspot_contact_id: _b, ...fields } = p;
      await connector.pushUpdate({ externalId, fields });
      return;
    }
    throw new Error(`unknown outbox op: ${row.op}`);
  };
}

/** Classify a dispatch error: retryable (429/5xx/network) vs terminal (4xx ≠ 429). */
function isRetryable(err: unknown): boolean {
  const status = (err as HsError)?.status;
  if (status == null) return true; // network/timeout/exhausted-retry throw → retry
  if (status === 429) return true;
  if (status >= 500) return true;
  return false; // 4xx client error — retrying won't help
}

function backoffSeconds(attempts: number): number {
  return Math.min(BASE_BACKOFF_SEC * 2 ** (attempts - 1), MAX_BACKOFF_SEC);
}

export async function drainOutbox(opts: DrainOptions = {}): Promise<DrainResult> {
  const limit = opts.limit ?? 50;
  const maxAttempts = opts.maxAttempts ?? 5;
  const connector = opts.connector ?? hubspotConnector();
  const dispatch = opts.dispatch ?? makeDispatcher(connector);

  return withoutProgram(async (sql: ScopedSql) => {
    const claimed = await sql<OutboxRow[]>`
      select id, aggregate_type, aggregate_id, target_system, op, payload, dedupe_key, attempts
      from sync_outbox
      where status = 'pending'
        and next_attempt_at <= now()
        ${opts.dedupeKeyLike ? sql`and dedupe_key like ${opts.dedupeKeyLike}` : sql``}
      order by next_attempt_at
      for update skip locked
      limit ${limit}`;

    const result: DrainResult = { claimed: claimed.length, done: [], retried: [], dead: [] };

    for (const row of claimed) {
      try {
        await dispatch(row);
        await sql`
          update sync_outbox
             set status = 'done', attempts = attempts + 1, last_error = null
           where id = ${row.id}`;
        result.done.push(row.dedupe_key);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const attempts = row.attempts + 1;
        const terminal = !isRetryable(err) || attempts >= maxAttempts;

        if (terminal) {
          await sql`
            update sync_outbox
               set status = 'dead', attempts = ${attempts}, last_error = ${msg}
             where id = ${row.id}`;
          // Auto-file the stuck write so CRM Ops surfaces it.
          await sql`
            insert into data_quality_issue
              (category, severity, entity, entity_id, field, description, status)
            values
              ('sync', 'high', ${row.aggregate_type}, ${row.aggregate_id}, null,
               ${`Outbox ${row.op} → ${row.target_system} is dead after ${attempts} attempt(s): ${msg}`},
               'open')`;
          result.dead.push({ dedupeKey: row.dedupe_key, attempts, error: msg });
        } else {
          const sec = backoffSeconds(attempts);
          await sql`
            update sync_outbox
               set status = 'pending', attempts = ${attempts}, last_error = ${msg},
                   next_attempt_at = now() + (${sec} * interval '1 second')
             where id = ${row.id}`;
          result.retried.push({ dedupeKey: row.dedupe_key, attempts, nextAttemptInSec: sec, error: msg });
        }
      }
    }

    return result;
  });
}
