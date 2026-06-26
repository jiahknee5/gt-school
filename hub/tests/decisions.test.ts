import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyDecisionTransition,
  DecisionTransitionError,
} from "@/lib/decisions/transitions";
import { buildDecisionEvent } from "@/lib/decisions/audit";
import type { Decision } from "@/lib/seed/types";

const authMock = vi.hoisted(() => {
  class AuthError extends Error {
    status: 401 | 403;
    constructor(status: 401 | 403, message: string) {
      super(message);
      this.status = status;
      this.name = "AuthError";
    }
  }
  return {
    AuthError,
    requireRole: vi.fn(),
  };
});

const dbMock = vi.hoisted(() => ({
  withoutProgram: vi.fn(),
}));

vi.mock("@/lib/auth", () => authMock);
vi.mock("@/lib/db", () => dbMock);

const { POST } = await import("@/app/api/decisions/[id]/decide/route");

const baseDecision: Decision = {
  id: "11111111-1111-4111-8111-111111111111",
  question: "Approve guerrilla overage?",
  raised_by: "the Budget Owner",
  workstream: "guerrilla",
  recommendation: "Approve the overage.",
  budget_ask: 6000,
  due_date: "2026-07-08",
  priority: "urgent",
  status: "open",
  response: null,
  response_note: null,
  auto_flag: true,
  resolved_at: null,
  created_at: "2026-06-26T00:00:00.000Z",
};

function request(body: unknown): Request {
  return new Request(`http://localhost/api/decisions/${baseDecision.id}/decide`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

type SqlMock = {
  <T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  calls: { text: string; values: unknown[] }[];
};

function sqlForResponses(...responses: Decision[][]) {
  const calls: { text: string; values: unknown[] }[] = [];
  const sql = (<T>(_strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: _strings.join("?"), values });
    return Promise.resolve((responses[calls.length - 1] ?? []) as T);
  }) as SqlMock;
  sql.calls = calls;
  return sql;
}

describe("Decision Queue transitions", () => {
  it("records a leadership approval with note and resolution timestamp", () => {
    const decided = applyDecisionTransition(
      baseDecision,
      { response: "approve", note: " Approved for the Austin test. " },
      new Date("2026-07-01T12:00:00.000Z"),
    );

    expect(decided.status).toBe("decided");
    expect(decided.response).toBe("approve");
    expect(decided.response_note).toBe("Approved for the Austin test.");
    expect(decided.resolved_at).toBe("2026-07-01T12:00:00.000Z");
    expect(decided.id).toBe(baseDecision.id);
  });

  it("normalizes need-info spelling", () => {
    const decided = applyDecisionTransition(baseDecision, {
      response: "need-info",
      note: "Need attendance forecast before ruling.",
    });

    expect(decided.response).toBe("need_info");
    expect(decided.status).toBe("in_flight");
    expect(decided.resolved_at).toBeNull();
  });

  it("rejects missing notes and already-decided rows", () => {
    expect(() =>
      applyDecisionTransition(baseDecision, { response: "reject", note: " " }),
    ).toThrow(DecisionTransitionError);
    expect(() =>
      applyDecisionTransition({ ...baseDecision, status: "decided" }, {
        response: "approve",
        note: "Too late.",
      }),
    ).toThrow(DecisionTransitionError);
  });
});

describe("Decision audit trail (buildDecisionEvent)", () => {
  const actor = { id: "growth-leader", name: "David Chen", role: "leader" };

  it("captures who/when/what for an approval, carrying the status transition", () => {
    const after = applyDecisionTransition(
      baseDecision,
      { response: "approve", note: "Approved." },
      new Date("2026-07-02T09:30:00.000Z"),
    );
    const event = buildDecisionEvent(baseDecision, after, actor, new Date("2026-07-02T09:30:05.000Z"));

    expect(event).toEqual({
      decisionId: baseDecision.id,
      actorId: "growth-leader",
      actorName: "David Chen",
      actorRole: "leader",
      action: "approve",
      fromStatus: "open",
      toStatus: "decided",
      note: "Approved.",
      createdAt: "2026-07-02T09:30:05.000Z",
    });
  });

  it("records a need_info round-trip as open -> in_flight", () => {
    const after = applyDecisionTransition(baseDecision, {
      response: "need-info",
      note: "Need attendance forecast.",
    });
    const event = buildDecisionEvent(baseDecision, after, actor);

    expect(event.action).toBe("need_info");
    expect(event.fromStatus).toBe("open");
    expect(event.toStatus).toBe("in_flight");
  });

  it("refuses to build an event without a ruling or an actor id", () => {
    expect(() => buildDecisionEvent(baseDecision, baseDecision, actor)).toThrow(
      "without a ruling response",
    );
    const after = applyDecisionTransition(baseDecision, { response: "reject", note: "No." });
    expect(() => buildDecisionEvent(baseDecision, after, { id: "", role: "leader" })).toThrow(
      "without an actor id",
    );
  });
});

describe("POST /api/decisions/[id]/decide", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-02T09:30:00.000Z"));
    authMock.requireRole.mockResolvedValue({
      id: "growth-leader",
      name: "David Chen",
      role: "leader",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("requires Leader role and persists response fields to the decisions table", async () => {
    const written = {
      ...baseDecision,
      status: "decided",
      response: "approve",
      response_note: "Proceed.",
      resolved_at: "2026-07-02T09:30:00.000Z",
    };
    const sql = sqlForResponses([baseDecision], [written]);
    dbMock.withoutProgram.mockImplementation(async (cb) => cb(sql));

    const res = await POST(request({ response: "approve", note: "Proceed." }), {
      params: Promise.resolve({ id: baseDecision.id }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(authMock.requireRole).toHaveBeenCalledWith("leader");
    expect(body.decision.status).toBe("decided");
    expect(body.decision.response).toBe("approve");
    expect(body.decision.response_note).toBe("Proceed.");
    expect(body.decision.resolved_at).toBe("2026-07-02T09:30:00.000Z");
    expect(sql.calls).toHaveLength(3);
    expect(sql.calls[0].text).toContain("for update");
    expect(sql.calls[1].text).toContain("and status = 'open'");
    // The ruling row now also records who decided it (S6 attribution).
    expect(sql.calls[1].text).toContain("decided_by");
    expect(sql.calls[1].values).toEqual([
      "decided",
      "approve",
      "Proceed.",
      "2026-07-02T09:30:00.000Z",
      "growth-leader",
      baseDecision.id,
    ]);
  });

  it("writes an append-only decision_event audit row with who/when/action", async () => {
    const written = {
      ...baseDecision,
      status: "decided",
      response: "reject",
      response_note: "Out of budget this sprint.",
      resolved_at: "2026-07-02T09:30:00.000Z",
    };
    const sql = sqlForResponses([baseDecision], [written]);
    dbMock.withoutProgram.mockImplementation(async (cb) => cb(sql));

    const res = await POST(request({ response: "reject", note: "Out of budget this sprint." }), {
      params: Promise.resolve({ id: baseDecision.id }),
    });

    expect(res.status).toBe(200);
    // Three statements: SELECT ... FOR UPDATE, UPDATE decisions, INSERT decision_event.
    expect(sql.calls).toHaveLength(3);
    const insert = sql.calls[2];
    expect(insert.text).toContain("insert into decision_event");
    // who (actor id, name, role) · what (action, from/to status, note). created_at is the DB default.
    expect(insert.values).toEqual([
      baseDecision.id,
      "growth-leader",
      "David Chen",
      "leader",
      "reject",
      "open",
      "decided",
      "Out of budget this sprint.",
    ]);
  });

  it("does not write an audit row when the ruling update loses a race (no row updated)", async () => {
    const sql = sqlForResponses([baseDecision], []);
    dbMock.withoutProgram.mockImplementation(async (cb) => cb(sql));

    const res = await POST(request({ response: "approve", note: "Proceed." }), {
      params: Promise.resolve({ id: baseDecision.id }),
    });

    expect(res.status).toBe(409);
    // SELECT + failed UPDATE only — the append-only insert never runs.
    expect(sql.calls).toHaveLength(2);
    expect(sql.calls.some((c) => c.text.includes("insert into decision_event"))).toBe(false);
  });

  it("returns 403 before DB access for non-leaders", async () => {
    authMock.requireRole.mockRejectedValueOnce(
      new authMock.AuthError(403, "Requires role: leader."),
    );

    const res = await POST(request({ response: "approve", note: "Proceed." }), {
      params: Promise.resolve({ id: baseDecision.id }),
    });

    expect(res.status).toBe(403);
    expect(dbMock.withoutProgram).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid decision ids before DB access", async () => {
    const res = await POST(request({ response: "approve", note: "Proceed." }), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });

    expect(res.status).toBe(400);
    expect(dbMock.withoutProgram).not.toHaveBeenCalled();
  });

  it("returns 401 before DB access for unauthenticated callers", async () => {
    authMock.requireRole.mockRejectedValueOnce(
      new authMock.AuthError(401, "Authentication required."),
    );

    const res = await POST(request({ response: "reject", note: "No budget left." }), {
      params: Promise.resolve({ id: baseDecision.id }),
    });

    expect(res.status).toBe(401);
    expect(dbMock.withoutProgram).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown decisions and 409 for closed decisions", async () => {
    dbMock.withoutProgram.mockImplementationOnce(async (cb) => cb(sqlForResponses([])));
    const missing = await POST(request({ response: "approve", note: "Proceed." }), {
      params: Promise.resolve({ id: baseDecision.id }),
    });
    expect(missing.status).toBe(404);

    dbMock.withoutProgram.mockImplementationOnce(async (cb) =>
      cb(sqlForResponses([{ ...baseDecision, status: "decided" }])),
    );
    const closed = await POST(request({ response: "approve", note: "Proceed." }), {
      params: Promise.resolve({ id: baseDecision.id }),
    });
    expect(closed.status).toBe(409);
  });

  it("returns 409 when a concurrent ruling wins before the update", async () => {
    dbMock.withoutProgram.mockImplementationOnce(async (cb) =>
      cb(sqlForResponses([baseDecision], [])),
    );

    const res = await POST(request({ response: "reject", note: "Over budget." }), {
      params: Promise.resolve({ id: baseDecision.id }),
    });

    expect(res.status).toBe(409);
  });
});
