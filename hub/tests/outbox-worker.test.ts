import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type postgres from "postgres";
import { loadEnvLocal } from "../scripts/_env";

loadEnvLocal();

import { closeDb, withoutProgram } from "../lib/db";
import { drainOutbox, type Dispatcher, type OutboxRow } from "../lib/sync/outbox-worker";
import { archiveDeal, createDeal, getDeal } from "../lib/connectors/hubspot";
import type { HsError } from "../lib/connectors/hubspot";

const HAS_DB = Boolean(process.env.APP_RW_DATABASE_URL);
const HAS_HS = Boolean(process.env.HUBSPOT_PRIVATE_APP_TOKEN?.startsWith("pat-"));
const T = 30000;
const RUN = `obw${randomBytes(3).toString("hex")}`;
const PREFIX = `test-ob-${RUN}`;
const LIKE = `${PREFIX}:%`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function enqueue(opts: {
  op: string;
  payload: postgres.JSONValue;
  dedupeKey: string;
  aggregateId?: string;
}): Promise<void> {
  await withoutProgram(
    (sql) => sql`
      insert into sync_outbox (aggregate_type, aggregate_id, target_system, op, payload, dedupe_key)
      values ('test', ${opts.aggregateId ?? randomUUID()}, 'hubspot', ${opts.op}, ${sql.json(opts.payload)}, ${opts.dedupeKey})
      on conflict (dedupe_key) do nothing`,
  );
}

async function rowStatus(dedupeKey: string) {
  return withoutProgram(
    (sql) => sql<{ status: string; attempts: number; next_attempt_at: string; last_error: string | null }[]>`
      select status, attempts, next_attempt_at, last_error from sync_outbox where dedupe_key = ${dedupeKey}`,
  ).then((r) => r[0]);
}

// Honest skip when live services aren't configured (shows SKIPPED, not passed-empty).
(HAS_DB && HAS_HS ? describe : describe.skip)("outbox worker (live Supabase + live HubSpot)", () => {
  const dealsToClean: string[] = [];

  beforeAll(async () => {
    // Safety: never touch the seeded demo outbox rows — our drains are all scoped to LIKE.
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await withoutProgram(async (sql) => {
      await sql`delete from sync_outbox where dedupe_key like ${LIKE}`;
      await sql`delete from data_quality_issue where description like ${`Outbox %${RUN}%`}`;
    });
    for (const id of dealsToClean) {
      try {
        await archiveDeal(id);
      } catch {
        /* best-effort cleanup */
      }
    }
    if (HAS_DB) await closeDb();
  }, T);

  it("dispatches a real patch_deal to HubSpot and marks the row done (pending→done)", async () => {
    if (!HAS_DB || !HAS_HS) {
      console.log("SKIP: needs APP_RW_DATABASE_URL + HUBSPOT_PRIVATE_APP_TOKEN");
      return;
    }
    const deal = await createDeal({
      dealname: `GT outbox test ${RUN}`,
      pipeline: "default",
      dealstage: "appointmentscheduled",
    });
    dealsToClean.push(deal.id);

    const dedupeKey = `${PREFIX}:patch_deal:${deal.id}`;
    await enqueue({
      op: "patch_deal",
      payload: { deal_id: deal.id, properties: { dealstage: "closedwon" }, reason: "test" },
      dedupeKey,
    });

    const before = await rowStatus(dedupeKey);
    expect(before.status).toBe("pending");

    const res = await drainOutbox({ dedupeKeyLike: LIKE }); // real HubSpot dispatch
    console.log(`drain: claimed=${res.claimed} done=${res.done.length} retried=${res.retried.length} dead=${res.dead.length}`);
    expect(res.done).toContain(dedupeKey);

    const after = await rowStatus(dedupeKey);
    expect(after.status).toBe("done");
    expect(after.attempts).toBe(1);

    // The HubSpot deal was ACTUALLY patched — re-fetch and confirm.
    const fetched = await getDeal(deal.id, ["dealstage", "dealname"]);
    console.log(`hubspot deal ${deal.id} dealstage=${fetched.properties.dealstage}`);
    expect(fetched.properties.dealstage).toBe("closedwon");
  }, T);

  it("two concurrent drains over the same batch dispatch each row at most once (SKIP LOCKED)", async () => {
    if (!HAS_DB) {
      console.log("SKIP");
      return;
    }
    const N = 6;
    const keys: string[] = [];
    for (let i = 0; i < N; i++) {
      const k = `${PREFIX}:conc:${i}`;
      keys.push(k);
      await enqueue({ op: "noop", payload: { i }, dedupeKey: k });
    }

    // Counting dispatcher with a delay so both drains are genuinely in-flight together.
    const dispatched: string[] = [];
    const counting: Dispatcher = async (row: OutboxRow) => {
      dispatched.push(row.dedupe_key);
      await sleep(120);
    };

    const [a, b] = await Promise.all([
      drainOutbox({ dedupeKeyLike: LIKE, limit: 4, dispatch: counting }),
      drainOutbox({ dedupeKeyLike: LIKE, limit: 4, dispatch: counting }),
    ]);
    console.log(`concurrent: A.done=${a.done.length} B.done=${b.done.length} totalDispatched=${dispatched.length}`);

    // Every row dispatched EXACTLY once across both workers.
    const counts = new Map<string, number>();
    for (const k of dispatched) counts.set(k, (counts.get(k) ?? 0) + 1);
    for (const k of keys) expect(counts.get(k) ?? 0).toBe(1);
    expect(dispatched.length).toBe(N);
    expect(a.done.length + b.done.length).toBe(N);
    // No overlap between the two workers' claimed sets.
    const overlap = a.done.filter((k) => b.done.includes(k));
    expect(overlap).toEqual([]);
  }, T);

  it("backs off a retryable (429) failure and leaves the row pending with a future next_attempt_at", async () => {
    if (!HAS_DB) {
      console.log("SKIP");
      return;
    }
    const key = `${PREFIX}:retry`;
    await enqueue({ op: "patch_deal", payload: { deal_id: "nope" }, dedupeKey: key });
    const throw429: Dispatcher = async () => {
      const e: HsError = new Error("rate limited");
      e.status = 429;
      throw e;
    };
    const res = await drainOutbox({ dedupeKeyLike: key, dispatch: throw429 });
    expect(res.retried.map((r) => r.dedupeKey)).toContain(key);

    const row = await rowStatus(key);
    expect(row.status).toBe("pending");
    expect(row.attempts).toBe(1);
    expect(new Date(row.next_attempt_at).getTime()).toBeGreaterThan(Date.now() + 1000);
  }, T);

  it("marks a row dead after maxAttempts and auto-files a data_quality_issue", async () => {
    if (!HAS_DB) {
      console.log("SKIP");
      return;
    }
    const key = `${PREFIX}:dead`;
    const aggId = randomUUID();
    await enqueue({ op: "patch_deal", payload: { deal_id: "nope" }, dedupeKey: key, aggregateId: aggId });
    const throw429: Dispatcher = async () => {
      const e: HsError = new Error(`rate limited ${RUN}`);
      e.status = 429;
      throw e;
    };
    // maxAttempts=1 ⇒ first failure is terminal.
    const res = await drainOutbox({ dedupeKeyLike: key, dispatch: throw429, maxAttempts: 1 });
    expect(res.dead.map((d) => d.dedupeKey)).toContain(key);

    const row = await rowStatus(key);
    expect(row.status).toBe("dead");

    const issues = await withoutProgram(
      (sql) => sql<{ c: number }[]>`
        select count(*)::int as c from data_quality_issue
        where entity_id = ${aggId} and category = 'sync' and status = 'open'`,
    );
    expect(issues[0].c).toBe(1);
  }, T);

  it("non-retryable client error (4xx) goes straight to dead", async () => {
    if (!HAS_DB) {
      console.log("SKIP");
      return;
    }
    const key = `${PREFIX}:notfound`;
    await enqueue({ op: "patch_deal", payload: { deal_id: "nope" }, dedupeKey: key });
    const throw404: Dispatcher = async () => {
      const e: HsError = new Error(`not found ${RUN}`);
      e.status = 404;
      throw e;
    };
    const res = await drainOutbox({ dedupeKeyLike: key, dispatch: throw404, maxAttempts: 5 });
    expect(res.dead.map((d) => d.dedupeKey)).toContain(key);
    const row = await rowStatus(key);
    expect(row.status).toBe("dead");
    expect(row.attempts).toBe(1); // dead on first attempt — no pointless retries
  }, T);
});
