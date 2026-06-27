// Nav scope API — proves the demo cookie round-trip when no DB is configured.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decodeNavScopeStore,
  NAV_SCOPE_COOKIE,
  navScopeFromStore,
} from "@/lib/nav-preference";

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

const { PUT } = await import("@/app/api/nav/scope/route");

function jsonRequest(body: { navScope: string }, cookie?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  return new Request("http://localhost/api/nav/scope", {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
}

describe("PUT /api/nav/scope", () => {
  const originalDbUrl = process.env.APP_RW_DATABASE_URL;

  beforeEach(() => {
    delete process.env.APP_RW_DATABASE_URL;
    authMock.requireSession.mockResolvedValue({
      id: "grassroots-operator",
      name: "Alex Rivera",
      role: "operator",
      title: "the Grassroots Operator",
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
    const res = await PUT(jsonRequest({ navScope: "all" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, navScope: "all" });

    const cookie = res.cookies.get(NAV_SCOPE_COOKIE);
    expect(cookie).toBeTruthy();
    const store = decodeNavScopeStore(cookie!.value);
    expect(navScopeFromStore(store, "grassroots-operator")).toBe("all");
  });

  it("appends to the existing cookie without clobbering other users", async () => {
    const first = await PUT(jsonRequest({ navScope: "all" }));
    const firstCookie = `${NAV_SCOPE_COOKIE}=${encodeURIComponent(first.cookies.get(NAV_SCOPE_COOKIE)!.value)}`;

    authMock.requireSession.mockResolvedValueOnce({
      id: "content-owner",
      name: "Maya Patel",
      role: "operator",
      title: "the Content Owner",
    });
    const second = await PUT(jsonRequest({ navScope: "agenda" }, firstCookie));
    const store = decodeNavScopeStore(second.cookies.get(NAV_SCOPE_COOKIE)!.value);
    expect(navScopeFromStore(store, "grassroots-operator")).toBe("all");
    expect(navScopeFromStore(store, "content-owner")).toBe("agenda");
  });

  it("rejects invalid scope with 400 and sets no cookie", async () => {
    const res = await PUT(jsonRequest({ navScope: "invalid" }));
    expect(res.status).toBe(400);
    expect(res.cookies.get(NAV_SCOPE_COOKIE)).toBeFalsy();
  });

  it("returns 401 for an unauthenticated caller", async () => {
    authMock.requireSession.mockRejectedValueOnce(
      new authMock.AuthError(401, "Authentication required."),
    );
    const res = await PUT(jsonRequest({ navScope: "all" }));
    expect(res.status).toBe(401);
  });
});
