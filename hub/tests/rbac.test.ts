// Tier 0 RBAC + auth tests. Covers the security review's two named falsifiable asks
// (SECURITY-REVIEW.md §4): "Operator denied Decision Queue (server) → 403" and
// "/dev requires auth", plus program-scope-can't-be-forged and token integrity.

import { beforeAll, describe, expect, it } from "vitest";

// Ensure the isomorphic token signer has a secret before anything signs/verifies.
beforeAll(() => {
  process.env.AUTH_DEV_MODE = "true";
  process.env.AUTH_SECRET = "test-secret-at-least-16-chars-long";
});

import {
  isAskHubPath,
  isDecisionEnrichmentPath,
  decisionQueueRoleAllowed,
  isAdminOnlyPath,
  isLeaderOnlyPath,
  isPublicPath,
  routeDecision,
} from "@/lib/auth/policy";
import { allowedPrograms, ProgramScopeError, resolveProgramScope } from "@/lib/auth/program";
import { signToken, verifyToken } from "@/lib/auth/token";
import { DEMO_USERS } from "@/lib/phase2";

const operator = DEMO_USERS.find((u) => u.role === "operator")!;
const leader = DEMO_USERS.find((u) => u.role === "leader")!;
const admin = DEMO_USERS.find((u) => u.role === "admin")!;

describe("route policy — deny by default", () => {
  it("requires authentication for any non-public route (401 → /login)", () => {
    const decision = routeDecision(null, "/m/crm-ops");
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe(401);
    expect(decision.redirectTo).toBe("/login");
  });

  it("allows only the explicit public paths without a session", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/forbidden")).toBe(true);
    expect(isPublicPath("/api/auth/login")).toBe(true);
    expect(isPublicPath("/api/webhooks/stripe")).toBe(true);
    expect(isPublicPath("/m/budget")).toBe(false);
    expect(isPublicPath("/")).toBe(false);
    expect(routeDecision(null, "/login").allowed).toBe(true);
  });

  it("exposes the GT Challenge public capture funnel without a session", () => {
    // A parent arriving from a paid-social ad has no Hub account — the public
    // landing + consent-gated capture endpoint must not be blocked by the auth gate.
    expect(isPublicPath("/gifted-quiz")).toBe(true);
    expect(isPublicPath("/api/gifted-quiz")).toBe(true);
    expect(routeDecision(null, "/gifted-quiz").allowed).toBe(true);
    expect(routeDecision(null, "/api/gifted-quiz").allowed).toBe(true);
    // But the funnel is a single exact surface — it must not open a public subtree.
    expect(isPublicPath("/api/gifted-quiz/admin")).toBe(false);
    expect(isPublicPath("/m/gifted-quiz")).toBe(false);
  });

  it("lets an authenticated operator into a normal module", () => {
    expect(routeDecision("operator", "/m/crm-ops").allowed).toBe(true);
  });
});

describe("Decision Queue — Leadership-exclusive (view + act)", () => {
  it("denies an Operator the Decision Queue page and API with 403", () => {
    expect(isLeaderOnlyPath("/m/decisions")).toBe(true);
    expect(isLeaderOnlyPath("/api/decisions")).toBe(true);
    expect(isLeaderOnlyPath("/api/decisions/abc/decide")).toBe(true);
    const pageDecision = routeDecision("operator", "/m/decisions");
    const apiDecision = routeDecision("operator", "/api/decisions");
    const mutationDecision = routeDecision("operator", "/api/decisions/abc/decide");
    expect(pageDecision.allowed).toBe(false);
    expect(pageDecision.status).toBe(403);
    expect(apiDecision.allowed).toBe(false);
    expect(apiDecision.status).toBe(403);
    expect(mutationDecision.status).toBe(403);
  });

  it("allows the Leader and denies Admin (exclusive to Leadership)", () => {
    expect(decisionQueueRoleAllowed("leader")).toBe(true);
    expect(decisionQueueRoleAllowed("operator")).toBe(false);
    expect(decisionQueueRoleAllowed("admin")).toBe(false);
    expect(routeDecision("leader", "/m/decisions").allowed).toBe(true);
    expect(routeDecision("leader", "/api/decisions").allowed).toBe(true);
    expect(routeDecision("leader", "/api/decisions/abc/decide").allowed).toBe(true);
    expect(routeDecision("admin", "/m/decisions").status).toBe(403);
    expect(routeDecision("admin", "/api/decisions").status).toBe(403);
    expect(routeDecision("admin", "/api/decisions/abc/decide").status).toBe(403);
  });
});

describe("internal/dev surfaces — Admin only", () => {
  it("classifies /dev and /opendata (and their APIs) as admin-only", () => {
    expect(isAdminOnlyPath("/dev")).toBe(true);
    expect(isAdminOnlyPath("/dev/data-model")).toBe(true);
    expect(isAdminOnlyPath("/opendata")).toBe(true);
    expect(isDecisionEnrichmentPath("/api/opendata/decision-enrichment")).toBe(true);
    expect(isAdminOnlyPath("/api/opendata/decision-enrichment")).toBe(false);
    expect(isAdminOnlyPath("/m/budget")).toBe(false);
  });

  it("/dev requires auth (401 unauthenticated) and is forbidden to non-admins (403)", () => {
    expect(routeDecision(null, "/dev").status).toBe(401);
    expect(routeDecision("operator", "/dev").status).toBe(403);
    expect(routeDecision("leader", "/dev").status).toBe(403);
    expect(routeDecision("admin", "/dev").allowed).toBe(true);
  });

  it("allows Leader/Admin decision enrichment while denying Operators", () => {
    expect(routeDecision("leader", "/api/opendata/decision-enrichment").allowed).toBe(true);
    expect(routeDecision("admin", "/api/opendata/decision-enrichment").allowed).toBe(true);
    expect(routeDecision("operator", "/api/opendata/decision-enrichment").status).toBe(403);
  });

  it("classifies Ask-the-Hub as authenticated, role-aware, read-only assistance", () => {
    expect(isAskHubPath("/api/ask")).toBe(true);
    expect(routeDecision(null, "/api/ask").status).toBe(401);
    expect(routeDecision("leader", "/api/ask").allowed).toBe(true);
    expect(routeDecision("admin", "/api/ask").allowed).toBe(true);
    expect(routeDecision("operator", "/api/ask").allowed).toBe(true);
  });
});

describe("program scope derives from session, never the client", () => {
  it("scopes operators to their allowed program and leadership to both", () => {
    expect(allowedPrograms("operator")).toEqual(["fall_enrollment"]);
    expect(allowedPrograms("leader")).toContain("summer_camp");
    expect(allowedPrograms("admin")).toContain("summer_camp");
  });

  it("rejects a forged/out-of-scope program id (IDOR/BOLA guard)", () => {
    expect(() =>
      resolveProgramScope({ role: "operator", requestedProgram: "summer_camp" }),
    ).toThrow(ProgramScopeError);
    // a leader MAY request summer_camp
    expect(resolveProgramScope({ role: "leader", requestedProgram: "summer_camp" })).toBe(
      "summer_camp",
    );
    // no request → role's primary program
    expect(resolveProgramScope({ role: "operator" })).toBe("fall_enrollment");
  });
});

describe("session token integrity", () => {
  it("round-trips a signed token back to its user id", async () => {
    const token = await signToken(operator.id);
    expect(await verifyToken(token)).toBe(operator.id);
  });

  it("rejects a tampered or malformed token", async () => {
    const token = await signToken(leader.id);
    const tampered = `${token.slice(0, -2)}xx`;
    expect(await verifyToken(tampered)).toBeNull();
    expect(await verifyToken("not-a-token")).toBeNull();
    expect(await verifyToken(undefined)).toBeNull();
  });

  it("rejects expired or future-dated signed tokens", async () => {
    const nineHoursAgo = Date.now() - 9 * 60 * 60 * 1000;
    const oneMinuteAhead = Date.now() + 60 * 1000;
    expect(await verifyToken(await signToken(operator.id, nineHoursAgo))).toBeNull();
    expect(await verifyToken(await signToken(operator.id, oneMinuteAhead))).toBeNull();
  });
});

describe("middleware enforces the policy end-to-end", () => {
  it("redirects an unauthenticated page request to /login", async () => {
    const { middleware } = await import("../middleware");
    const { NextRequest } = await import("next/server");
    const res = await middleware(new NextRequest("http://localhost/dev"));
    expect([302, 307].includes(res.status)).toBe(true);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("returns 403 JSON when an Operator hits the Decision Queue API", async () => {
    const { middleware } = await import("../middleware");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/decisions");
    req.cookies.set("gt_session", await signToken(operator.id));
    const res = await middleware(req);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/Leadership-only/i);
  });

  it("redirects an Operator away from the Decision Queue page", async () => {
    const { middleware } = await import("../middleware");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/m/decisions");
    req.cookies.set("gt_session", await signToken(operator.id));
    const res = await middleware(req);
    expect([302, 307].includes(res.status)).toBe(true);
    expect(res.headers.get("location")).toContain("/forbidden");
  });

  it("returns 401 JSON for an unauthenticated API request", async () => {
    const { middleware } = await import("../middleware");
    const { NextRequest } = await import("next/server");
    const res = await middleware(new NextRequest("http://localhost/api/decisions"));
    expect(res.status).toBe(401);
  });

  it("lets a Leader through to the Decision Queue API", async () => {
    const { middleware } = await import("../middleware");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/decisions");
    req.cookies.set("gt_session", await signToken(leader.id));
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("lets a Leader through to the Decision Queue page", async () => {
    const { middleware } = await import("../middleware");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/m/decisions");
    req.cookies.set("gt_session", await signToken(leader.id));
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("lets the Admin into /dev", async () => {
    const { middleware } = await import("../middleware");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/dev");
    req.cookies.set("gt_session", await signToken(admin.id));
    const res = await middleware(req);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
