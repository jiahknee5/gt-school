import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_USERS } from "@/lib/phase2";
import type { Decision } from "@/lib/seed/types";
import {
  activeDecisions,
  decisionStats,
  historyDecisions,
  isActive,
  openBadgeCount,
  outcomeLabel,
  outcomeTone,
  submittedBy,
  visibleToRole,
} from "@/lib/decisions/queries";
import { decisionStatusHref, decisionStatusLabel } from "@/lib/decisions/routes";

const authMock = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => authMock);

// The submissions page now mounts the (client) "Raise a decision" form, which calls
// useRouter. Provide a stub so renderToStaticMarkup of the page doesn't require a mounted
// app-router provider.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

const { default: SubmissionsPage } = await import("@/app/m/submissions/page");

function decision(overrides: Partial<Decision>): Decision {
  return {
    id: overrides.id ?? "00000000-0000-4000-8000-000000000000",
    question: "Question?",
    raised_by: "the Content Owner",
    workstream: "thought_leadership",
    recommendation: "Do it.",
    budget_ask: null,
    due_date: null,
    priority: "normal",
    status: "open",
    response: null,
    response_note: null,
    auto_flag: false,
    resolved_at: null,
    created_at: "2026-06-20T00:00:00.000Z",
    ...overrides,
  };
}

const openUrgent = decision({
  id: "11111111-1111-4111-8111-111111111111",
  status: "open",
  priority: "urgent",
  due_date: "2026-07-05",
  budget_ask: 5000,
  auto_flag: true,
  raised_by: "system (budget variance)",
});
const openNormalSoon = decision({
  id: "22222222-2222-4222-8222-222222222222",
  status: "open",
  priority: "normal",
  due_date: "2026-07-01",
  budget_ask: 8000,
});
const openNormalNoDue = decision({
  id: "33333333-3333-4333-8333-333333333333",
  status: "open",
  priority: "normal",
  due_date: null,
});
const inFlight = decision({
  id: "44444444-4444-4444-8444-444444444444",
  status: "in_flight",
  response: "need_info",
  response_note: "Confirm availability.",
  budget_ask: 2000,
});
const decided = decision({
  id: "55555555-5555-4555-8555-555555555555",
  status: "decided",
  response: "approve",
  response_note: "Ship it.",
  resolved_at: "2026-06-22T00:00:00.000Z",
  raised_by: "the Marketing Lead",
});

const all = [decided, openNormalNoDue, openUrgent, inFlight, openNormalSoon];

describe("Decision Queue read helpers", () => {
  it("active = anything not decided; history = decided only", () => {
    expect(activeDecisions(all).every(isActive)).toBe(true);
    expect(activeDecisions(all)).toHaveLength(4);
    expect(historyDecisions(all)).toEqual([decided]);
  });

  it("orders active urgent-first, then soonest due, then oldest raised", () => {
    const ordered = activeDecisions(all).map((d) => d.id);
    // urgent first, then the normal with the soonest due date, then the no-due normal,
    // then the in_flight (normal, no due) — both no-due fall back to created_at.
    expect(ordered[0]).toBe(openUrgent.id);
    expect(ordered[1]).toBe(openNormalSoon.id);
    expect(ordered.indexOf(openNormalSoon.id)).toBeLessThan(ordered.indexOf(openNormalNoDue.id));
  });

  it("badge counts strictly OPEN rows (not in_flight, not decided)", () => {
    expect(openBadgeCount(all)).toBe(3);
  });

  it("rolls up stats including budget-at-stake over active rows only", () => {
    const stats = decisionStats(all);
    expect(stats.total).toBe(5);
    expect(stats.open).toBe(3);
    expect(stats.inFlight).toBe(1);
    expect(stats.decided).toBe(1);
    expect(stats.urgentOpen).toBe(1);
    expect(stats.autoFlagged).toBe(1);
    // active budget asks: 5000 (urgent) + 8000 (soon) + 2000 (in_flight); decided excluded.
    expect(stats.budgetAtStake).toBe(15000);
  });

  it("submittedBy matches the submitter title (the own-status read)", () => {
    expect(submittedBy(all, "Content Owner").map((d) => d.id).sort()).toEqual(
      [openNormalSoon.id, openNormalNoDue.id, inFlight.id].sort(),
    );
    expect(submittedBy(all, "Marketing Lead").map((d) => d.id)).toEqual([decided.id]);
    expect(submittedBy(all, "")).toEqual([]);
  });

  it("RBAC read split: Leader sees all, others see only their own submissions", () => {
    expect(visibleToRole(all, { role: "leader", title: "Growth Marketing Officer" })).toHaveLength(5);

    const operatorView = visibleToRole(all, { role: "operator", title: "Content Owner" });
    expect(operatorView.length).toBeGreaterThan(0);
    expect(operatorView.length).toBeLessThan(all.length);
    expect(operatorView.every((d) => (d.raised_by ?? "").includes("Content Owner"))).toBe(true);
    // an operator NEVER sees the budget-variance auto-flag raised by the system
    expect(operatorView.some((d) => d.id === openUrgent.id)).toBe(false);
  });

  it("routes submitters to own-status, not the Leader-only queue", () => {
    expect(decisionStatusHref("leader")).toBe("/m/decisions");
    expect(decisionStatusLabel("leader")).toBe("Decision Queue");
    expect(decisionStatusHref("operator")).toBe("/m/submissions");
    expect(decisionStatusLabel("operator")).toBe("My submissions");
    expect(decisionStatusHref("admin")).toBe("/m/submissions");
  });

  it("labels and tones outcomes for both queue + own-status", () => {
    expect(outcomeLabel(openUrgent)).toBe("Open");
    expect(outcomeTone(openUrgent)).toBe("risk");
    expect(outcomeLabel(openNormalSoon)).toBe("Open");
    expect(outcomeTone(openNormalSoon)).toBe("watch");
    expect(outcomeLabel(inFlight)).toBe("Awaiting info");
    expect(outcomeTone(inFlight)).toBe("watch");
    expect(outcomeLabel(decided)).toBe("Approved");
    expect(outcomeTone(decided)).toBe("good");
    const rejected = decision({ status: "decided", response: "reject" });
    expect(outcomeLabel(rejected)).toBe("Rejected");
    expect(outcomeTone(rejected)).toBe("risk");
  });
});

async function renderSubmissionsFor(title: string): Promise<string> {
  const user = DEMO_USERS.find((u) => u.title === title);
  if (!user) throw new Error(`Missing demo user: ${title}`);
  authMock.getSession.mockResolvedValueOnce(user);
  return renderToStaticMarkup(await SubmissionsPage());
}

describe("My submissions status view", () => {
  afterEach(() => {
    authMock.getSession.mockReset();
  });

  it("shows an Operator only their own decision statuses and leadership responses", async () => {
    const html = await renderSubmissionsFor("Content Owner");

    expect(html).toContain("My submissions");
    expect(html).toContain("Signed in as Content Owner");
    expect(html).toContain("Add a 4th summer session at Austin");
    expect(html).toContain("Confirm guide availability before committing.");
    expect(html).toContain("Approved; ship to the nurture sequence.");
    expect(html).not.toContain("Approve $18K guerrilla bet");
    expect(html).not.toContain("Guerrilla workstream is 12% over plan");
    expect(html).not.toContain("Launch a T3 ESA-ineligible out-of-pocket nurture sequence");
  });

  it("does not expose full-queue links or ruling controls", async () => {
    const html = await renderSubmissionsFor("Content Owner");

    expect(html).not.toContain('href="/m/decisions"');
    expect(html).not.toContain("/api/decisions/");
    expect(html).not.toContain("Why this ruling");
    expect(html).not.toContain("Need more info");
    expect(html).not.toContain("Reject");
  });
});
