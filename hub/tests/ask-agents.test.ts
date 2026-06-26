import { describe, expect, it } from "vitest";
import {
  buildDeidentifiedAgentContext,
  buildHubSnapshot,
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
    expect(JSON.stringify(answer)).not.toMatch(/@|555-|phone|childName/i);
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

