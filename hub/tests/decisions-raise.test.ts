// Raise-a-decision (the SUBMIT half of Module 11). Proves: any authenticated role can
// create an OPEN decision attributed to the submitter; validation rejects empty/bad input;
// the per-user cookie store round-trips; and the route policy opens /api/decisions/raise to
// all roles WITHOUT widening the Leader-only Decision Queue.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RaiseDecisionError,
  appendRaise,
  buildRaisedDecision,
  decodeRaises,
  encodeRaises,
  ownRaises,
  RAISED_CAP,
  type StoredRaise,
} from "@/lib/decisions/raise";
import { isDecisionRaisePath, isLeaderOnlyPath, routeDecision } from "@/lib/auth/policy";

const operator = { id: "content-owner", name: "Maya Patel", title: "the Content Owner" };

describe("buildRaisedDecision — pure builder + validation", () => {
  it("creates an OPEN decision attributed to the submitter", () => {
    const raise = buildRaisedDecision(
      { question: "  Approve a $4,800 Austin test reallocation?  " },
      operator,
      { id: "fixed-id", now: new Date("2026-06-26T15:00:00.000Z") },
    );
    expect(raise.id).toBe("fixed-id");
    expect(raise.question).toBe("Approve a $4,800 Austin test reallocation?");
    expect(raise.status).toBe("open");
    expect(raise.auto_flag).toBe(false);
    expect(raise.response).toBeNull();
    expect(raise.resolved_at).toBeNull();
    // submitter is captured both as the queue's raised_by AND a private scope tag.
    expect(raise.raised_by).toBe("the Content Owner");
    expect(raise.submitter_id).toBe("content-owner");
    expect(raise.created_at).toBe("2026-06-26T15:00:00.000Z");
    expect(raise.priority).toBe("normal");
  });

  it("parses optional workstream / budget_ask / priority / due_date", () => {
    const raise = buildRaisedDecision(
      {
        question: "Reallocate to guerrilla?",
        workstream: "guerrilla",
        budget_ask: "$4,800",
        priority: "URGENT",
        due_date: "2026-09-01",
        recommendation: "Shift unspent Foundations budget.",
      },
      operator,
    );
    expect(raise.workstream).toBe("guerrilla");
    expect(raise.budget_ask).toBe(4800);
    expect(raise.priority).toBe("urgent");
    expect(raise.due_date).toBe("2026-09-01");
    expect(raise.recommendation).toBe("Shift unspent Foundations budget.");
  });

  it("rejects an empty question, bad number, and bad date (400)", () => {
    expect(() => buildRaisedDecision({ question: "   " }, operator)).toThrow(RaiseDecisionError);
    expect(() => buildRaisedDecision({ question: "" }, operator)).toThrow(/question/i);
    expect(() =>
      buildRaisedDecision({ question: "ok?", budget_ask: "lots" }, operator),
    ).toThrow(/number/i);
    expect(() =>
      buildRaisedDecision({ question: "ok?", budget_ask: "-5" }, operator),
    ).toThrow(/negative/i);
    expect(() =>
      buildRaisedDecision({ question: "ok?", due_date: "Sept 1" }, operator),
    ).toThrow(/date/i);
  });

  it("requires a signed-in submitter", () => {
    expect(() =>
      buildRaisedDecision({ question: "ok?" }, { id: "", title: "" }),
    ).toThrow(RaiseDecisionError);
  });

  it("normalizes an unknown priority to normal", () => {
    expect(buildRaisedDecision({ question: "ok?", priority: "whenever" }, operator).priority).toBe(
      "normal",
    );
  });
});

describe("cookie store codec", () => {
  function make(id: string, submitterId = "content-owner"): StoredRaise {
    return buildRaisedDecision({ question: `q-${id}` }, { ...operator, id: submitterId }, { id });
  }

  it("round-trips encode → decode", () => {
    const raises = [make("a"), make("b")];
    expect(decodeRaises(encodeRaises(raises)).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("decodes malformed / empty values to []", () => {
    expect(decodeRaises(undefined)).toEqual([]);
    expect(decodeRaises("")).toEqual([]);
    expect(decodeRaises("not-base64-json!!")).toEqual([]);
    expect(decodeRaises(Buffer.from("{}", "utf8").toString("base64"))).toEqual([]);
  });

  it("appendRaise caps the stored list", () => {
    let list: StoredRaise[] = [];
    for (let i = 0; i < RAISED_CAP + 5; i += 1) list = appendRaise(list, make(`r${i}`));
    expect(list).toHaveLength(RAISED_CAP);
    expect(list[list.length - 1].id).toBe(`r${RAISED_CAP + 4}`);
  });

  it("ownRaises returns only the current user's raises, newest first", () => {
    const mine1 = buildRaisedDecision({ question: "mine-old" }, operator, {
      id: "m1",
      now: new Date("2026-06-01T00:00:00.000Z"),
    });
    const mine2 = buildRaisedDecision({ question: "mine-new" }, operator, {
      id: "m2",
      now: new Date("2026-06-10T00:00:00.000Z"),
    });
    const theirs = buildRaisedDecision(
      { question: "theirs" },
      { id: "someone-else", title: "the Budget Owner" },
      { id: "x1" },
    );
    const cookie = encodeRaises([mine1, theirs, mine2]);
    const mine = ownRaises(cookie, "content-owner");
    expect(mine.map((d) => d.id)).toEqual(["m2", "m1"]);
    // and the submitter tag is stripped on the way out (plain Decision shape)
    expect(mine[0]).not.toHaveProperty("submitter_id");
  });
});

describe("route policy — raise is open to all roles, queue stays Leader-only", () => {
  it("classifies the raise submit path distinctly", () => {
    expect(isDecisionRaisePath("/api/decisions/raise")).toBe(true);
    expect(isDecisionRaisePath("/api/decisions")).toBe(false);
    expect(isDecisionRaisePath("/api/decisions/abc/decide")).toBe(false);
  });

  it("lets every authenticated role POST a raise", () => {
    expect(routeDecision("operator", "/api/decisions/raise").allowed).toBe(true);
    expect(routeDecision("admin", "/api/decisions/raise").allowed).toBe(true);
    expect(routeDecision("leader", "/api/decisions/raise").allowed).toBe(true);
  });

  it("still requires authentication for the raise path", () => {
    expect(routeDecision(null, "/api/decisions/raise").status).toBe(401);
  });

  it("does NOT widen the Leader-only Decision Queue (regression guard)", () => {
    expect(routeDecision("operator", "/api/decisions").status).toBe(403);
    expect(routeDecision("operator", "/api/decisions/abc/decide").status).toBe(403);
    expect(routeDecision("admin", "/api/decisions").status).toBe(403);
    // the raise path is a subpath of the queue subtree, but the carve-out wins first.
    expect(isLeaderOnlyPath("/api/decisions/raise")).toBe(true);
  });
});

// ---------------------------- route handler ----------------------------

const authMock = vi.hoisted(() => {
  class AuthError extends Error {
    status: 401 | 403;
    constructor(status: 401 | 403, message: string) {
      super(message);
      this.status = status;
      this.name = "AuthError";
    }
  }
  return { AuthError, requireSession: vi.fn() };
});

vi.mock("@/lib/auth", () => authMock);

const { POST } = await import("@/app/api/decisions/raise/route");

function jsonRequest(body: unknown, cookie?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  return new Request("http://localhost/api/decisions/raise", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/decisions/raise", () => {
  beforeEach(() => {
    authMock.requireSession.mockResolvedValue({
      id: "content-owner",
      name: "Maya Patel",
      role: "operator",
      title: "the Content Owner",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a raise and sets the per-user round-trip cookie (any role)", async () => {
    const res = await POST(jsonRequest({ question: "Approve the Austin test?" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.decision.status).toBe("open");
    expect(typeof body.decision.id).toBe("string");

    const cookie = res.cookies.get("gt_raised");
    expect(cookie).toBeTruthy();
    const stored = decodeRaises(cookie!.value);
    expect(stored).toHaveLength(1);
    expect(stored[0].question).toBe("Approve the Austin test?");
    expect(stored[0].submitter_id).toBe("content-owner");
    expect(stored[0].raised_by).toBe("the Content Owner");
  });

  it("appends to the existing cookie on a second raise (round-trip continuity)", async () => {
    const first = await POST(jsonRequest({ question: "First?" }));
    const firstCookie = `gt_raised=${encodeURIComponent(first.cookies.get("gt_raised")!.value)}`;

    const second = await POST(jsonRequest({ question: "Second?" }, firstCookie));
    const stored = decodeRaises(second.cookies.get("gt_raised")!.value);
    expect(stored.map((r) => r.question)).toEqual(["First?", "Second?"]);
  });

  it("rejects an empty question with 400 and sets no cookie", async () => {
    const res = await POST(jsonRequest({ question: "   " }));
    expect(res.status).toBe(400);
    expect(res.cookies.get("gt_raised")).toBeFalsy();
  });

  it("returns 401 for an unauthenticated caller", async () => {
    authMock.requireSession.mockRejectedValueOnce(
      new authMock.AuthError(401, "Authentication required."),
    );
    const res = await POST(jsonRequest({ question: "Anything?" }));
    expect(res.status).toBe(401);
  });
});
