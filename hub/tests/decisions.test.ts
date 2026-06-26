import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyDecisionTransition,
  DecisionTransitionError,
} from "@/lib/decisions/transitions";
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

describe("POST /api/decisions/[id]/decide", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-02T09:30:00.000Z"));
    authMock.requireRole.mockResolvedValue({ role: "leader" });
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
    expect(sql.calls).toHaveLength(2);
    expect(sql.calls[0].text).toContain("for update");
    expect(sql.calls[1].text).toContain("and status = 'open'");
    expect(sql.calls[1].values).toEqual([
      "decided",
      "approve",
      "Proceed.",
      "2026-07-02T09:30:00.000Z",
      baseDecision.id,
    ]);
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
