// Active-program API — proves the demo cookie round-trip and the RBAC gate (an
// operator can never select summer_camp / all). Mirror of nav-scope-route.test.ts.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decodeProgramScopeStore,
  PROGRAM_SCOPE_COOKIE,
  programScopeFromStore,
} from "@/lib/program-preference";

const authMock = vi.hoisted(() => ({
  requireSession: vi.fn(),
  AuthError: class AuthError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = "AuthError";
    }
  },
}));

vi.mock("@/lib/auth", () => authMock);

const { GET, PUT } = await import("@/app/api/program/scope/route");

function jsonRequest(body: { programScope: string }, cookie?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  return new Request("http://localhost/api/program/scope", {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
}

function readSetCookie(res: Response, name: string): string | null {
  const raw = res.headers.get("set-cookie");
  if (!raw) return null;
  const part = raw
    .split(/,(?=[^;,]+=)/)
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`));
  if (!part) return null;
  return decodeURIComponent(part.slice(name.length + 1).split(";")[0]);
}

describe("/api/program/scope", () => {
  const originalDbUrl = process.env.APP_RW_DATABASE_URL;

  beforeEach(() => {
    delete process.env.APP_RW_DATABASE_URL;
    authMock.requireSession.mockReset();
    authMock.requireSession.mockResolvedValue({
      id: "marketing-lead",
      name: "Jordan Lee",
      role: "leader",
      title: "the Marketing Lead",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalDbUrl === undefined) {
      delete process.env.APP_RW_DATABASE_URL;
    } else {
      process.env.APP_RW_DATABASE_URL = originalDbUrl;
    }
  });

  it("sets the per-user cookie and returns the scope when no DB is configured", async () => {
    const res = await PUT(jsonRequest({ programScope: "summer_camp" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, programScope: "summer_camp" });

    const cookie = readSetCookie(res, PROGRAM_SCOPE_COOKIE);
    expect(cookie).toBeTruthy();
    const store = decodeProgramScopeStore(cookie!);
    expect(programScopeFromStore(store, "marketing-lead")).toBe("summer_camp");
  });

  it("lets a leader select the all-up view", async () => {
    const res = await PUT(jsonRequest({ programScope: "all" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, programScope: "all" });
  });

  it("appends to the existing cookie without clobbering other users", async () => {
    const first = await PUT(jsonRequest({ programScope: "all" }));
    const firstValue = readSetCookie(first, PROGRAM_SCOPE_COOKIE);
    const firstCookie = `${PROGRAM_SCOPE_COOKIE}=${encodeURIComponent(firstValue!)}`;

    authMock.requireSession.mockResolvedValueOnce({
      id: "admin-user",
      name: "Sam Doe",
      role: "admin",
      title: "the Admin",
    });
    const second = await PUT(jsonRequest({ programScope: "summer_camp" }, firstCookie));
    const store = decodeProgramScopeStore(readSetCookie(second, PROGRAM_SCOPE_COOKIE)!);
    expect(programScopeFromStore(store, "marketing-lead")).toBe("all");
    expect(programScopeFromStore(store, "admin-user")).toBe("summer_camp");
  });

  it("maps brand/legacy aliases instead of erroring", async () => {
    const res = await PUT(jsonRequest({ programScope: "gt_anywhere" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, programScope: "fall_enrollment" });
  });

  it("rejects an operator selecting summer_camp with 403 and sets no cookie", async () => {
    authMock.requireSession.mockResolvedValue({
      id: "grassroots-operator",
      name: "Alex Rivera",
      role: "operator",
      title: "the Grassroots Operator",
    });
    const res = await PUT(jsonRequest({ programScope: "summer_camp" }));
    expect(res.status).toBe(403);
    expect(readSetCookie(res, PROGRAM_SCOPE_COOKIE)).toBeNull();
  });

  it("rejects an operator selecting the all-up view with 403", async () => {
    authMock.requireSession.mockResolvedValue({
      id: "grassroots-operator",
      name: "Alex Rivera",
      role: "operator",
      title: "the Grassroots Operator",
    });
    const res = await PUT(jsonRequest({ programScope: "all" }));
    expect(res.status).toBe(403);
    expect(readSetCookie(res, PROGRAM_SCOPE_COOKIE)).toBeNull();
  });

  it("allows an operator to (re)select fall_enrollment", async () => {
    authMock.requireSession.mockResolvedValue({
      id: "grassroots-operator",
      name: "Alex Rivera",
      role: "operator",
      title: "the Grassroots Operator",
    });
    const res = await PUT(jsonRequest({ programScope: "fall_enrollment" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, programScope: "fall_enrollment" });
  });

  it("rejects an invalid scope with 400 and sets no cookie", async () => {
    const res = await PUT(jsonRequest({ programScope: "invalid" }));
    expect(res.status).toBe(400);
    expect(readSetCookie(res, PROGRAM_SCOPE_COOKIE)).toBeNull();
  });

  it("returns 401 for an unauthenticated caller", async () => {
    authMock.requireSession.mockRejectedValueOnce(
      new authMock.AuthError(401, "Authentication required."),
    );
    const res = await PUT(jsonRequest({ programScope: "all" }));
    expect(res.status).toBe(401);
  });

  it("GET resolves the stored scope and advertises the allowed set", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.programScope).toBe("fall_enrollment");
    expect(body.allowed).toEqual(["fall_enrollment", "summer_camp", "all"]);
  });
});
