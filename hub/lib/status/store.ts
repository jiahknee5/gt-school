/**
 * store.ts — persist + recall Status snapshots, with graceful degradation.
 *
 * Resolution order (most durable first):
 *   1. DB store    — when APP_RW_DATABASE_URL is set (status_snapshot table, migration 0017).
 *   2. File store  — otherwise: a JSON-per-(program,week) directory. Default is a tmp dir
 *                    (ephemeral on Vercel) but a committed seed baseline can be shipped via
 *                    STATUS_SNAPSHOT_DIR for offline demos.
 *
 * On TOP of either store, `loadOrGenerateSnapshot` guarantees the page NEVER crashes:
 * if a week has no stored snapshot, it generates one deterministically on view (and
 * best-effort persists it). So the board + week selector work with no DB and no key.
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ProgramScope } from "@/lib/program-scope";
import type { StatusBoard } from "./board";
import {
  generateStatusSnapshot,
  type GenerateOptions,
  type StatusSnapshot,
} from "./generate";

export interface SnapshotStore {
  kind: "db" | "file";
  get(program: ProgramScope, weekStart: string): Promise<StatusSnapshot | null>;
  save(snapshot: StatusSnapshot): Promise<void>;
  listWeeks(program: ProgramScope): Promise<string[]>;
}

export const REFRESH_PROGRAMS: ProgramScope[] = ["fall_enrollment", "summer_camp", "all"];

// ---------------------------------------------------------------------------
// DB store
// ---------------------------------------------------------------------------

type SnapshotRow = {
  program: string;
  week_start: string | Date;
  generated_at: string | Date;
  source: "llm" | "deterministic";
  model: string;
  inputs_hash: string;
  content: unknown;
};

function rowToSnapshot(row: SnapshotRow): StatusSnapshot {
  const week =
    typeof row.week_start === "string" ? row.week_start.slice(0, 10) : row.week_start.toISOString().slice(0, 10);
  return {
    program: row.program as ProgramScope,
    weekStart: week,
    generatedAt:
      typeof row.generated_at === "string" ? row.generated_at : row.generated_at.toISOString(),
    source: row.source,
    model: row.model,
    inputsHash: row.inputs_hash,
    content: row.content as StatusSnapshot["content"],
  };
}

class DbSnapshotStore implements SnapshotStore {
  kind = "db" as const;

  async get(program: ProgramScope, weekStart: string): Promise<StatusSnapshot | null> {
    const { withoutProgram } = await import("@/lib/db");
    return withoutProgram(async (sql) => {
      const rows = await sql<SnapshotRow[]>`
        select program, week_start, generated_at, source, model, inputs_hash, content
        from status_snapshot
        where program = ${program} and week_start = ${weekStart}
        limit 1`;
      return rows[0] ? rowToSnapshot(rows[0]) : null;
    });
  }

  async save(snapshot: StatusSnapshot): Promise<void> {
    const { withoutProgram } = await import("@/lib/db");
    await withoutProgram(async (sql) => {
      await sql`
        insert into status_snapshot (program, week_start, generated_at, source, model, inputs_hash, content)
        values (
          ${snapshot.program}, ${snapshot.weekStart}, ${snapshot.generatedAt},
          ${snapshot.source}, ${snapshot.model}, ${snapshot.inputsHash}, ${sql.json(
            snapshot.content as unknown as Parameters<typeof sql.json>[0],
          )}
        )
        on conflict (program, week_start) do update set
          generated_at = excluded.generated_at,
          source = excluded.source,
          model = excluded.model,
          inputs_hash = excluded.inputs_hash,
          content = excluded.content,
          updated_at = now()`;
    });
  }

  async listWeeks(program: ProgramScope): Promise<string[]> {
    const { withoutProgram } = await import("@/lib/db");
    return withoutProgram(async (sql) => {
      const rows = await sql<{ week_start: string | Date }[]>`
        select week_start from status_snapshot where program = ${program} order by week_start`;
      return rows.map((r) =>
        typeof r.week_start === "string" ? r.week_start.slice(0, 10) : r.week_start.toISOString().slice(0, 10),
      );
    });
  }
}

// ---------------------------------------------------------------------------
// File store
// ---------------------------------------------------------------------------

function snapshotDir(): string {
  return process.env.STATUS_SNAPSHOT_DIR || path.join(os.tmpdir(), "gt-status-snapshots");
}

function fileFor(program: ProgramScope, weekStart: string): string {
  return path.join(snapshotDir(), `${program}__${weekStart}.json`);
}

class FileSnapshotStore implements SnapshotStore {
  kind = "file" as const;

  async get(program: ProgramScope, weekStart: string): Promise<StatusSnapshot | null> {
    try {
      const raw = await fs.readFile(fileFor(program, weekStart), "utf8");
      return JSON.parse(raw) as StatusSnapshot;
    } catch {
      return null;
    }
  }

  async save(snapshot: StatusSnapshot): Promise<void> {
    const dir = snapshotDir();
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fileFor(snapshot.program, snapshot.weekStart), JSON.stringify(snapshot, null, 2), "utf8");
  }

  async listWeeks(program: ProgramScope): Promise<string[]> {
    try {
      const files = await fs.readdir(snapshotDir());
      return files
        .filter((f) => f.startsWith(`${program}__`) && f.endsWith(".json"))
        .map((f) => f.slice(program.length + 2, -5))
        .sort();
    } catch {
      return [];
    }
  }
}

// ---------------------------------------------------------------------------
// Resolution + high-level recall
// ---------------------------------------------------------------------------

export function resolveStore(): SnapshotStore {
  return process.env.APP_RW_DATABASE_URL ? new DbSnapshotStore() : new FileSnapshotStore();
}

/** Best-effort persist that never throws into the request path. */
export async function persistSnapshot(snapshot: StatusSnapshot, store: SnapshotStore = resolveStore()): Promise<boolean> {
  try {
    await store.save(snapshot);
    return true;
  } catch {
    return false;
  }
}

export interface LoadResult {
  snapshot: StatusSnapshot;
  /** true = served from the store (a prior run); false = generated on this view. */
  recalled: boolean;
  storeKind: SnapshotStore["kind"];
}

/**
 * The page entry point: return the stored verdict for (program, week) if one exists,
 * else generate deterministically on view and best-effort persist it. Never throws.
 */
export async function loadOrGenerateSnapshot(
  board: StatusBoard,
  program: ProgramScope,
  opts: { generate?: GenerateOptions; persistOnGenerate?: boolean } = {},
): Promise<LoadResult> {
  const store = resolveStore();
  const week = board.weekOf;

  let stored: StatusSnapshot | null = null;
  try {
    stored = await store.get(program, week);
  } catch {
    stored = null;
  }
  if (stored) {
    return { snapshot: stored, recalled: true, storeKind: store.kind };
  }

  const fresh = await generateStatusSnapshot(board, program, opts.generate ?? {});
  if (opts.persistOnGenerate !== false) {
    await persistSnapshot(fresh, store);
  }
  return { snapshot: fresh, recalled: false, storeKind: store.kind };
}

/** Cron / admin path: always (re)generate + persist for a program+week board. */
export async function refreshSnapshot(
  board: StatusBoard,
  program: ProgramScope,
  opts: GenerateOptions = {},
): Promise<{ snapshot: StatusSnapshot; persisted: boolean; storeKind: SnapshotStore["kind"] }> {
  const store = resolveStore();
  const snapshot = await generateStatusSnapshot(board, program, opts);
  const persisted = await persistSnapshot(snapshot, store);
  return { snapshot, persisted, storeKind: store.kind };
}
