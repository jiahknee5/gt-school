/**
 * trace-store.ts — durable persistence for LLM run traces (WS6).
 *
 * Fixes the prior `audit.persisted=false` gap: every Ask-the-Hub (and status-gen) run
 * trace is written to a durable store so it can be audited later, not just returned once.
 *
 * Resolution mirrors lib/status/store.ts (most durable first):
 *   1. DB store   — when APP_RW_DATABASE_URL is set (agent_run_trace table, migration 0018).
 *   2. File store — otherwise: one JSON per runId under AGENT_TRACE_DIR (or a tmp dir).
 *
 * Only the SANITIZED trace is stored (node/eval rows, decisions, provider/model) — never
 * raw CRM/family rows; the question text is the user's own business prompt.
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type postgres from "postgres";
import type { AgentRunTrace } from "./agents";

export interface StoredTrace {
  runId: string;
  location: "ask-the-hub" | "status-gen";
  role: string | null;
  provider: AgentRunTrace["provider"];
  model: string;
  startedAt: string;
  /** The sanitized trace payload (graph nodes, decisions, eval rows). */
  trace: AgentRunTrace;
}

export interface PersistResult {
  persisted: boolean;
  storeKind: "db" | "file";
  writeTargets: string[];
}

function traceDir(): string {
  return process.env.AGENT_TRACE_DIR || path.join(os.tmpdir(), "gt-agent-traces");
}

function fileFor(runId: string): string {
  return path.join(traceDir(), `${runId}.json`);
}

async function fileSave(stored: StoredTrace): Promise<void> {
  const dir = traceDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(fileFor(stored.runId), JSON.stringify(stored, null, 2), "utf8");
}

async function fileList(limit: number): Promise<StoredTrace[]> {
  try {
    const files = await fs.readdir(traceDir());
    const traces = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => JSON.parse(await fs.readFile(path.join(traceDir(), f), "utf8")) as StoredTrace),
    );
    return traces.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)).slice(0, limit);
  } catch {
    return [];
  }
}

async function dbSave(stored: StoredTrace): Promise<void> {
  const { withoutProgram } = await import("@/lib/db");
  await withoutProgram(async (sql) => {
    await sql`
      insert into agent_run_trace (run_id, location, role, provider, model, started_at, trace)
      values (
        ${stored.runId}, ${stored.location}, ${stored.role}, ${stored.provider},
        ${stored.model}, ${stored.startedAt}, ${sql.json(stored.trace as unknown as postgres.JSONValue)}
      )
      on conflict (run_id) do update set
        location = excluded.location, role = excluded.role, provider = excluded.provider,
        model = excluded.model, started_at = excluded.started_at, trace = excluded.trace`;
  });
}

function dbConfigured(): boolean {
  return Boolean(process.env.APP_RW_DATABASE_URL);
}

/** Best-effort durable persist — never throws into the request path; reports the real result. */
export async function persistTrace(stored: StoredTrace): Promise<PersistResult> {
  const storeKind = dbConfigured() ? "db" : "file";
  try {
    if (storeKind === "db") await dbSave(stored);
    else await fileSave(stored);
    return { persisted: true, storeKind, writeTargets: [storeKind === "db" ? "agent_run_trace" : traceDir()] };
  } catch {
    return { persisted: false, storeKind, writeTargets: [] };
  }
}

/** Build the stored record from a run trace + its call-site context. */
export function toStoredTrace(
  trace: AgentRunTrace,
  location: StoredTrace["location"],
  role: string | null,
): StoredTrace {
  return {
    runId: trace.runId,
    location,
    role,
    provider: trace.provider,
    model: trace.model,
    startedAt: trace.startedAt,
    trace,
  };
}

async function dbList(limit: number): Promise<StoredTrace[]> {
  const { withoutProgram } = await import("@/lib/db");
  return withoutProgram(async (sql) => {
    const rows = await sql<
      {
        run_id: string;
        location: string;
        role: string | null;
        provider: string;
        model: string;
        started_at: Date | string;
        trace: unknown;
      }[]
    >`
      select run_id, location, role, provider, model, started_at, trace
      from agent_run_trace
      order by started_at desc
      limit ${limit}`;
    return rows.map((r) => ({
      runId: r.run_id,
      location: r.location as StoredTrace["location"],
      role: r.role,
      provider: r.provider as AgentRunTrace["provider"],
      model: r.model,
      startedAt: r.started_at instanceof Date ? r.started_at.toISOString() : String(r.started_at),
      trace: r.trace as AgentRunTrace,
    }));
  });
}

/**
 * Recent traces for the /dev observability surface. MUST mirror persistTrace's resolution:
 * read the DB when it's configured (that's where the writes go — otherwise the page reads an
 * empty tmp dir and shows "no runs yet" even though every run persisted to the DB), and fall
 * back to the file store when there's no DB or the DB read fails.
 */
export async function listRecentTraces(limit = 25): Promise<StoredTrace[]> {
  if (dbConfigured()) {
    try {
      return await dbList(limit);
    } catch {
      return fileList(limit);
    }
  }
  return fileList(limit);
}
