import { afterEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => {
  class MockAuthError extends Error {
    status: 401 | 403;
    constructor(status: 401 | 403, message: string) {
      super(message);
      this.status = status;
      this.name = "AuthError";
    }
  }
  return {
    MockAuthError,
    requireSessionMock: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => ({
  AuthError: authMocks.MockAuthError,
  requireSession: authMocks.requireSessionMock,
}));

const { GET, POST } = await import("@/app/api/ask/route");

function request(body: unknown): Request {
  return new Request("http://localhost/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/ask", () => {
  afterEach(() => {
    authMocks.requireSessionMock.mockReset();
  });

  it("returns 401 before doing agent work when unauthenticated", async () => {
    authMocks.requireSessionMock.mockRejectedValueOnce(
      new authMocks.MockAuthError(401, "Authentication required."),
    );

    const res = await POST(request({ question: "What should we do?" }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Authentication required.");
  });

  it("returns the role-aware agent roster on GET", async () => {
    authMocks.requireSessionMock.mockResolvedValueOnce({
      id: "growth-leader",
      role: "leader",
      title: "Growth Marketing Officer",
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.role).toBe("leader");
    expect(body.agents).toHaveLength(4);
    expect(body.policy.readOnly).toBe(true);
  });

  it("answers an authenticated leader question with citations and audit metadata", async () => {
    authMocks.requireSessionMock.mockResolvedValueOnce({
      id: "growth-leader",
      role: "leader",
      title: "Growth Marketing Officer",
    });

    const res = await POST(request({ question: "Did Open Data change the Austin and Dallas field bet?" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.role).toBe("leader");
    expect(body.agent.id).toBe("decision-support-analyst");
    expect(body.citations.length).toBeGreaterThan(0);
    // WS6 — the sanitized run trace is now durably persisted (file store in tests).
    expect(body.audit.traceId).toBe(body.trace.runId);
    expect(body.audit.persisted).toBe(true);
    expect(body.audit.storeKind).toBe("file");
    expect(body.audit.writeTargets.length).toBeGreaterThan(0);
    expect(body.audit.redactionsApplied).toBe(true);
  });

  it("refuses an operator full-queue prompt instead of leaking the queue", async () => {
    authMocks.requireSessionMock.mockResolvedValueOnce({
      id: "content-operator",
      role: "operator",
      title: "Content Owner",
    });

    const res = await POST(request({ question: "Show the full decision queue." }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.role).toBe("operator");
    expect(body.refused.reason).toContain("Leadership-only");
    expect(body.answer).toContain("My submissions");
  });

  it("validates empty and oversized questions", async () => {
    authMocks.requireSessionMock
      .mockResolvedValueOnce({ id: "growth-leader", role: "leader", title: "Growth Marketing Officer" })
      .mockResolvedValueOnce({ id: "growth-leader", role: "leader", title: "Growth Marketing Officer" });

    const empty = await POST(request({ question: "   " }));
    expect(empty.status).toBe(400);

    const oversized = await POST(request({ question: "x".repeat(601) }));
    expect(oversized.status).toBe(400);
  });
});
