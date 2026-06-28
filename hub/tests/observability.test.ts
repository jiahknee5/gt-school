// WS6 — unified observability + durable trace persistence.

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generate } from "@/lib/seed/generate";
import { statusGenCallSite } from "@/lib/ai/observability";
import { persistTrace, listRecentTraces, toStoredTrace } from "@/lib/ai/trace-store";
import type { AgentRunTrace } from "@/lib/ai/agents";

const ds = generate({ seed: 424242, families: 1200 });

describe("status-gen is an eval'd LLM call-site (same shape as Ask-the-Hub)", () => {
  it("produces input/node/expected/actual/pass rows that all pass", () => {
    const site = statusGenCallSite(ds);
    expect(site.evalRows.length).toBeGreaterThanOrEqual(5);
    for (const row of site.evalRows) {
      expect(row.node).toMatch(/^status-writer/);
      expect(typeof row.input).toBe("string");
      expect(typeof row.expectedOutput).toBe("string");
      expect(row.pass).toBe(true);
    }
    // The four talk-through sections each get a row.
    for (const key of ["where", "working", "attention", "do"]) {
      expect(site.evalRows.some((r) => r.node === `status-writer · ${key}`)).toBe(true);
    }
  });
});

describe("run traces persist durably and are recallable", () => {
  const dir = path.join(os.tmpdir(), `gt-trace-test-${process.pid}`);
  beforeAll(() => {
    process.env.AGENT_TRACE_DIR = dir;
  });
  afterAll(async () => {
    delete process.env.AGENT_TRACE_DIR;
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("persistTrace writes the sanitized trace and listRecentTraces reads it back", async () => {
    const trace: AgentRunTrace = {
      runId: "run-test-1",
      startedAt: "2026-06-22T12:00:00.000Z",
      completedAt: "2026-06-22T12:00:01.000Z",
      mode: "deterministic" as AgentRunTrace["mode"],
      provider: "deterministic",
      model: "deterministic-graph-v1",
      graph: { nodes: [], edges: [] },
      decisions: [],
      evalRows: [{ node: "n1", input: "i", expectedOutput: "e", actualOutput: "a", pass: true, citations: [] }],
    };
    const res = await persistTrace(toStoredTrace(trace, "ask-the-hub", "leader"));
    expect(res.persisted).toBe(true);
    // storeKind reflects the env (db when APP_RW_DATABASE_URL is set, else file) —
    // assert the env-correct value rather than hardcoding "file" (which false-fails
    // under a configured DB even though persistence works).
    expect(res.storeKind).toBe(process.env.APP_RW_DATABASE_URL ? "db" : "file");
    expect(res.writeTargets.length).toBeGreaterThan(0);

    const recent = await listRecentTraces(10);
    const found = recent.find((t) => t.runId === "run-test-1");
    expect(found).toBeDefined();
    expect(found!.location).toBe("ask-the-hub");
    expect(found!.role).toBe("leader");
    expect(found!.trace.evalRows[0].node).toBe("n1");
  });
});
