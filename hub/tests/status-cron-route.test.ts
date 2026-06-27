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
  return { MockAuthError, requireRoleMock: vi.fn() };
});

vi.mock("@/lib/auth", () => ({
  AuthError: authMocks.MockAuthError,
  requireRole: authMocks.requireRoleMock,
}));

const { GET, POST } = await import("@/app/api/cron/status-refresh/route");

function req(headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/cron/status-refresh", { headers });
}

describe("/api/cron/status-refresh", () => {
  afterEach(() => {
    authMocks.requireRoleMock.mockReset();
    delete process.env.CRON_SECRET;
  });

  it("GET refreshes every program when no secret is configured (dev/demo)", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(3);
    expect(body.results.every((r: { source: string }) => r.source === "deterministic")).toBe(true);
  });

  it("GET rejects an absent or wrong bearer when CRON_SECRET is set", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req({ authorization: "Bearer wrong" }))).status).toBe(401);
  });

  it("GET accepts the correct bearer", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await GET(req({ authorization: "Bearer s3cret" }));
    expect(res.status).toBe(200);
  });

  it("POST (manual regenerate) is admin/leader only", async () => {
    authMocks.requireRoleMock.mockRejectedValueOnce(
      new authMocks.MockAuthError(403, "Requires role: admin, leader."),
    );
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("POST regenerates for an admin", async () => {
    authMocks.requireRoleMock.mockResolvedValueOnce({ id: "root-admin", role: "admin", title: "Admin" });
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.triggeredBy.role).toBe("admin");
    expect(body.results).toHaveLength(3);
  });
});
