import { describe, expect, it } from "vitest";
import {
  ASK_EVAL_CASES,
  runAskEvalCase,
  runAskEvalSuite,
} from "@/lib/ai/agents";

describe("Ask-the-Hub evals and traceability", () => {
  it("defines unique business eval cases with expected graph assertions", () => {
    const ids = ASK_EVAL_CASES.map((c) => c.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      "ask.monday-meeting",
      "ask.cac-refusal",
      "ask.open-data-field-bet",
      "ask.operator-full-queue",
      "ask.pii-refusal",
    ]);
    expect(ASK_EVAL_CASES.every((c) => c.expectedCitationIds.length > 0)).toBe(true);
  });

  it("emits node rows with input, expected output, actual output, pass/fail, and citations", async () => {
    const result = await runAskEvalCase(ASK_EVAL_CASES[0]);
    const nodes = result.answer.trace.graph.nodes;
    const rows = result.answer.evalRows;

    expect(result.pass).toBe(true);
    expect(nodes.map((n) => n.id)).toEqual([
      "request.validate",
      "snapshot.build",
      "policy.refusal",
      "router.classify-agent",
      "retrieval.knowledge",
      "graph.expand",
      "provider.synthesis",
      "answer.compose",
      "guardrail.output-scan",
    ]);
    expect(rows).toHaveLength(nodes.length);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        node: "request.validate",
        pass: true,
      }),
    );
    expect(rows.every((row) => row.input.length > 0)).toBe(true);
    expect(rows.every((row) => row.expectedOutput.length > 0)).toBe(true);
    expect(rows.every((row) => row.actualOutput.length > 0)).toBe(true);
    expect(rows.some((row) => row.citations.includes("hub-snapshot"))).toBe(true);
  });

  it("runs the full deterministic suite and keeps all cases passing", async () => {
    const suite = await runAskEvalSuite();

    expect(suite.total).toBe(5);
    expect(suite.failed).toBe(0);
    expect(suite.passed).toBe(5);
    expect(suite.results.every((result) => result.answer.mode === "deterministic")).toBe(true);
  });
});
