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
  return { MockAuthError, requireSessionMock: vi.fn() };
});

vi.mock("@/lib/auth", () => ({
  AuthError: authMocks.MockAuthError,
  requireSession: authMocks.requireSessionMock,
}));

const { POST } = await import("@/app/api/status/ask/route");

function request(body: unknown): Request {
  return new Request("http://localhost/api/status/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/status/ask (inline, no redirect)", () => {
  afterEach(() => authMocks.requireSessionMock.mockReset());

  it("returns 401 when unauthenticated", async () => {
    authMocks.requireSessionMock.mockRejectedValueOnce(
      new authMocks.MockAuthError(401, "Authentication required."),
    );
    const res = await POST(request({ question: "Why are we behind on Fall deposits?" }));
    expect(res.status).toBe(401);
  });

  it("answers a status question inline with board-grounded numbers + citations", async () => {
    authMocks.requireSessionMock.mockResolvedValueOnce({
      id: "growth-leader",
      role: "leader",
      title: "Growth Marketing Officer",
    });
    const res = await POST(request({ question: "Why are we behind on Fall deposits?" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.source).toBe("status-deterministic");
    expect(body.answer).toMatch(/deposits/i);
    expect(body.citations.length).toBeGreaterThan(0);
    expect(body.statusContext.week).toBeTruthy();
  });

  it("hands free-form questions to the agent (deterministic w/o key), never redirects", async () => {
    authMocks.requireSessionMock.mockResolvedValueOnce({
      id: "growth-leader",
      role: "leader",
      title: "Growth Marketing Officer",
    });
    const res = await POST(request({ question: "Did Open Data change the Austin and Dallas field bet?" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(["ask-deterministic", "ask-llm"]).toContain(body.source);
    expect(body.answer.length).toBeGreaterThan(0);
  });

  it("validates an empty question", async () => {
    authMocks.requireSessionMock.mockResolvedValueOnce({ id: "x", role: "leader", title: "t" });
    const res = await POST(request({ question: "   " }));
    expect(res.status).toBe(400);
  });
});
