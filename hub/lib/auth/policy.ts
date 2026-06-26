// Pure, dependency-free RBAC route policy. No next/headers, no crypto, no DB —
// so it is safe to import from BOTH the Edge middleware and Node server components,
// and is fully unit-testable (see tests/rbac.test.ts).
//
// Roles (PRD §2 + skills):
//   admin    (Marketing Lead) — full access to every module + internal/dev surfaces.
//   leader                    — Decision Queue view + act (exclusive); broad read.
//   operator                  — own module r/w, others read-only; Decision Queue
//                               submit-only (NEVER view).
//
// The route policy is DENY-BY-DEFAULT: anything that isn't an explicitly public
// path requires an authenticated session, and the admin/leader-gated prefixes are
// enforced on top of that.

import type { Role } from "@/lib/phase2";

export type { Role };

/** 200 = allowed, 401 = needs authentication, 403 = authenticated but forbidden. */
export type RouteDecision = {
  allowed: boolean;
  status: 200 | 401 | 403;
  reason: string;
  /** Where an unauthenticated caller should be sent (page routes only). */
  redirectTo?: string;
};

// Reachable WITHOUT a session. Webhooks authenticate by signature (not session),
// the auth endpoints bootstrap the session, and /login + /forbidden must render
// for signed-out users. The GT Challenge capture surface is a PUBLIC marketing
// funnel (a parent on a social ad lands here with no Hub account) — the public
// landing page and its consent-gated capture endpoint must bypass the auth gate.
// Abuse is contained at the route by consent validation + rate limiting, not by
// requiring a session (security findings S7-c).
const PUBLIC_PREFIXES = ["/api/auth/", "/api/webhooks/"];
const PUBLIC_EXACT = new Set(["/login", "/forbidden", "/gifted-quiz", "/api/gifted-quiz"]);

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

/** Internal architecture/data surfaces — admin only (security finding S7). */
export function isAdminOnlyPath(pathname: string): boolean {
  return (
    pathname === "/dev" ||
    pathname.startsWith("/dev/") ||
    pathname === "/opendata" ||
    pathname.startsWith("/opendata/")
  );
}

/** Decision-context Open Data is a product surface for Leaders, not a dev browser. */
export function isDecisionEnrichmentPath(pathname: string): boolean {
  return pathname === "/api/opendata/decision-enrichment";
}

/** Ask-the-Hub is authenticated, role-aware, read-only business assistance. */
export function isAskHubPath(pathname: string): boolean {
  return pathname === "/api/ask";
}

/**
 * The Decision Queue module and data surface are Leadership-only (view + act).
 * Operators can submit decision requests from their own modules, but the full queue
 * page/API is not accessible to them per PRD §11.
 */
export function isLeaderOnlyPath(pathname: string): boolean {
  return (
    pathname === "/m/decisions" ||
    pathname.startsWith("/m/decisions/") ||
    pathname === "/api/decisions" ||
    pathname.startsWith("/api/decisions/")
  );
}

/** Leadership-exclusive: only the Leader role may view/act on the Decision Queue. */
export function decisionQueueRoleAllowed(role: Role | null | undefined): boolean {
  return role === "leader";
}

/**
 * The single deny-by-default authorization decision used by both the middleware and
 * server-side guards. `role` is null for an unauthenticated request.
 */
export function routeDecision(role: Role | null, pathname: string): RouteDecision {
  if (isPublicPath(pathname)) {
    return { allowed: true, status: 200, reason: "Public route." };
  }

  if (!role) {
    return {
      allowed: false,
      status: 401,
      reason: "Authentication required.",
      redirectTo: "/login",
    };
  }

  if (isAdminOnlyPath(pathname)) {
    if (role !== "admin") {
      return {
        allowed: false,
        status: 403,
        reason: "Internal/dev surfaces are restricted to Admin.",
      };
    }
    return { allowed: true, status: 200, reason: "Admin access to internal surface." };
  }

  if (isDecisionEnrichmentPath(pathname)) {
    if (role !== "admin" && role !== "leader") {
      return {
        allowed: false,
        status: 403,
        reason: "Open Data decision enrichment is restricted to Admin/Leader decision support.",
      };
    }
    return { allowed: true, status: 200, reason: "Decision enrichment access." };
  }

  if (isAskHubPath(pathname)) {
    return { allowed: true, status: 200, reason: "Authenticated Ask-the-Hub access." };
  }

  if (isLeaderOnlyPath(pathname)) {
    if (!decisionQueueRoleAllowed(role)) {
      return {
        allowed: false,
        status: 403,
        reason: "Decision Queue is Leadership-only (view + act). Operators may submit, not view.",
      };
    }
    return { allowed: true, status: 200, reason: "Leader access to Decision Queue." };
  }

  return { allowed: true, status: 200, reason: "Authenticated access." };
}
