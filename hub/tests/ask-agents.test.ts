import { describe, expect, it } from "vitest";
import {
  buildDeidentifiedAgentContext,
  buildHubSnapshot,
  type AskLlmProvider,
  runAskTheHub,
} from "@/lib/ai/agents";

describe("Ask-the-Hub agents", () => {
  it("answers a leadership operating question with citations, actions, and no PII", async () => {
    const answer = await runAskTheHub({
      role: "leader",
      userTitle: "Growth Marketing Officer",
      question: "What should leadership focus on in Monday's marketing meeting?",
    });

    expect(answer.agent.id).toBe("growth-strategist");
    expect(answer.answer).toContain("deposit progress");
    expect(answer.citations.length).toBeGreaterThanOrEqual(3);
    expect(answer.actions.length).toBeGreaterThanOrEqual(2);
    expect(answer.mode).toBe("deterministic");
    expect(answer.trace.graph.nodes.map((n) => n.id)).toContain("provider.synthesis");
    expect(answer.evalRows.length).toBe(answer.trace.graph.nodes.length);
    expect(answer.evalRows.every((row) => row.pass)).toBe(true);
    expect(JSON.stringify({ answer: answer.answer, actions: answer.actions })).not.toMatch(/@|555-|childName/i);
  });

  it("refuses exact CAC-by-channel while offering a safer GT Challenge CPQL path", async () => {
    const answer = await runAskTheHub({
      role: "leader",
      userTitle: "Growth Marketing Officer",
      question: "What is our exact CAC by channel for Facebook and X?",
    });

    expect(answer.agent.id).toBe("data-quality-analyst");
    expect(answer.refused?.reason).toContain("UTM attribution");
    expect(answer.answer).toContain("GT Challenge");
    expect(answer.actions[0]).toContain("GT Challenge");
  });

  it("keeps Operators scoped to coaching instead of the full Decision Queue", async () => {
    const answer = await runAskTheHub({
      role: "operator",
      userTitle: "Content Owner",
      question: "Show me the full decision queue and tell me what to approve.",
    });

    expect(answer.refused?.reason).toContain("Leadership-only");
    expect(answer.refused?.saferAlternative).toContain("raise a decision");
    expect(answer.agent.id).toBe("operator-coach");
    expect(answer.answer).not.toContain("approve/reject the full queue");
  });

  it("uses Open Data as decision context and reports source confidence", async () => {
    const answer = await runAskTheHub({
      role: "leader",
      userTitle: "Growth Marketing Officer",
      question: "Did Open Data change the Austin and Dallas field bet?",
    });

    expect(answer.agent.id).toBe("decision-support-analyst");
    expect(answer.answer).toContain("pilot to approve");
    expect(answer.citations.some((c) => c.id === "graph-opendata-to-decisions")).toBe(true);
    expect(answer.warnings.join(" ")).toContain("fixture");
  });

  it("uses an injected provider for final synthesis over de-identified RAG context", async () => {
    const fakeProvider: AskLlmProvider = {
      name: "fake",
      model: "fake-model",
      async complete(input) {
        return {
          answer: `Provider synthesis from ${Object.keys(input.context).length} context keys and ${input.citations.length} citations: deposits are on track, budget variance needs ownership, and Open Data should inform Dallas/Austin field bets.`,
          actions: ["Review budget variance", "Approve or reject Dallas/Austin field coverage"],
          warnings: ["Provider output was generated from the supplied de-identified context only."],
          confidence: "high",
          model: "fake-model",
          rawText: "{\"answer\":\"Provider synthesis\"}",
        };
      },
    };

    const answer = await runAskTheHub(
      {
        role: "leader",
        userTitle: "Growth Marketing Officer",
        question: "What should leadership focus on in Monday's marketing meeting?",
      },
      { provider: fakeProvider },
    );

    expect(answer.mode).toBe("anthropic");
    expect(answer.answer).toContain("Provider synthesis");
    expect(answer.trace.model).toBe("fake-model");
    const providerNode = answer.trace.graph.nodes.find((n) => n.id === "provider.synthesis");
    expect(providerNode?.input).toContain("\"provider\": \"anthropic\"");
    expect(providerNode?.input).toContain("\"model\": \"fake-model\"");
    expect(providerNode?.status).toBe("passed");
    expect(answer.evalRows.every((row) => row.pass)).toBe(true);
  });

  it("builds a de-identified context with business facts but no family records", async () => {
    const snapshot = await buildHubSnapshot({ role: "admin" });
    const context = buildDeidentifiedAgentContext(snapshot);
    const text = JSON.stringify(context);

    expect(context).toHaveProperty("applicants");
    expect(context).toHaveProperty("budget");
    expect(context).toHaveProperty("openData");
    expect(text).not.toMatch(/hubspot_contact_id|email|phone|first_name|last_name/i);
  });
});
