import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generate } from "@/lib/seed/generate";
import { buildStatusBoard } from "@/lib/status/board";
import {
  applySnapshotToBoard,
  generateDeterministic,
  generateStatusSnapshot,
  type StatusGenProvider,
} from "@/lib/status/generate";
import { loadOrGenerateSnapshot, persistSnapshot, refreshSnapshot, resolveStore } from "@/lib/status/store";

const ds = generate({ seed: 424242, families: 1200 });
let tmpDir = "";

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gt-status-test-"));
  process.env.STATUS_SNAPSHOT_DIR = tmpDir;
  delete process.env.APP_RW_DATABASE_URL;
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  delete process.env.STATUS_SNAPSHOT_DIR;
});

describe("Status generation pipeline", () => {
  it("falls back to the deterministic rubric generator with no provider", async () => {
    const board = buildStatusBoard(ds);
    const snap = await generateStatusSnapshot(board, "fall_enrollment", { provider: null });
    expect(snap.source).toBe("deterministic");
    expect(snap.model).toBe("deterministic-rubric-v1");
    expect(snap.inputsHash).toMatch(/^[0-9a-f]{8}$/);
    expect(snap.content.answerSections.map((s) => s.key)).toEqual(["where", "on_track", "why", "do"]);
  });

  it("uses a pluggable LLM provider when one is supplied", async () => {
    const board = buildStatusBoard(ds);
    const fake: StatusGenProvider = {
      name: "fake",
      model: "fake-model-1",
      async generate(input) {
        return { ...input.deterministicDraft, headline: `LLM · ${input.deterministicDraft.headline}` };
      },
    };
    const snap = await generateStatusSnapshot(board, "fall_enrollment", { provider: fake });
    expect(snap.source).toBe("llm");
    expect(snap.model).toBe("fake-model-1");
    expect(snap.content.headline.startsWith("LLM · ")).toBe(true);
  });

  it("keeps the deterministic draft when the LLM throws or returns non-conformant output", async () => {
    const board = buildStatusBoard(ds);
    const thrower: StatusGenProvider = { name: "fake", model: "x", async generate() { throw new Error("boom"); } };
    const empty: StatusGenProvider = {
      name: "fake",
      model: "y",
      async generate(input) { return { ...input.deterministicDraft, answerSections: [] }; },
    };
    expect((await generateStatusSnapshot(board, "fall_enrollment", { provider: thrower })).source).toBe("deterministic");
    expect((await generateStatusSnapshot(board, "fall_enrollment", { provider: empty })).source).toBe("deterministic");
  });

  it("overlays a snapshot onto the numeric board and records provenance", () => {
    const board = buildStatusBoard(ds);
    const content = generateDeterministic(board);
    const snap = {
      program: "fall_enrollment" as const,
      weekStart: board.weekOf,
      generatedAt: "2026-06-22T12:00:00.000Z",
      source: "llm" as const,
      model: "fake-model-1",
      inputsHash: "deadbeef",
      content: { ...content, headline: "OVERLAID HEADLINE" },
    };
    applySnapshotToBoard(board, snap, { recalled: true, isCurrent: false });
    expect(board.answer.headline).toBe("OVERLAID HEADLINE");
    expect(board.answer.sections?.length).toBe(4);
    expect(board.snapshotMeta).toMatchObject({ source: "llm", recalled: true, isCurrent: false });
  });
});

describe("Status snapshot store (file fallback) + recall", () => {
  it("resolves the file store when no DB is configured", () => {
    expect(resolveStore().kind).toBe("file");
  });

  it("save → get → listWeeks roundtrips", async () => {
    const board = buildStatusBoard(ds);
    const snap = await generateStatusSnapshot(board, "summer_camp", { provider: null });
    expect(await persistSnapshot(snap)).toBe(true);
    const got = await resolveStore().get("summer_camp", snap.weekStart);
    expect(got?.content.headline).toBe(snap.content.headline);
    expect(await resolveStore().listWeeks("summer_camp")).toContain(snap.weekStart);
  });

  it("loadOrGenerateSnapshot generates on miss, recalls on hit (history, not recompute)", async () => {
    const board1 = buildStatusBoard(ds, "all");
    const first = await loadOrGenerateSnapshot(board1, "all");
    expect(first.recalled).toBe(false);

    const board2 = buildStatusBoard(ds, "all");
    const second = await loadOrGenerateSnapshot(board2, "all");
    expect(second.recalled).toBe(true);
    expect(second.snapshot.generatedAt).toBe(first.snapshot.generatedAt);
  });

  it("refreshSnapshot regenerates and persists (cron path)", async () => {
    const board = buildStatusBoard(ds, "fall_enrollment");
    const res = await refreshSnapshot(board, "fall_enrollment", { provider: null });
    expect(res.persisted).toBe(true);
    expect(res.storeKind).toBe("file");
    expect(res.snapshot.source).toBe("deterministic");
  });
});
