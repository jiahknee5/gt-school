// Deny-by-default app auth gate (security finding S1). Runs on every request that
// isn't a static asset; verifies the signed session cookie, derives the role from
// server-side data, and applies the shared route policy (lib/auth/policy.ts):
//   - unauthenticated  → page routes redirect to /login?next=…, API routes get 401 JSON
//   - admin-only        → /dev/*, /opendata/*, /api/opendata/*
//   - leader-only       → /m/decisions*, /api/decisions* (Decision Queue)
// No privilege is read from the request — only the verified user id from the cookie.

import { NextResponse, type NextRequest } from "next/server";
import { loadProfileById } from "@/lib/auth/profile-store";
import { verifyToken } from "@/lib/auth/token";
import { routeDecision } from "@/lib/auth/policy";

const SESSION_COOKIE = "gt_session";

function safeNext(pathname: string): string {
  // Only allow internal, single-slash relative paths to avoid open redirects.
  return pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : "/";
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const userId = await verifyToken(token);
  const role = userId ? ((await loadProfileById(userId))?.role ?? null) : null;

  const decision = routeDecision(role, pathname);
  if (decision.allowed) return NextResponse.next();

  const isApi = pathname.startsWith("/api/");

  if (decision.status === 401) {
    if (isApi) {
      return NextResponse.json({ error: decision.reason }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", safeNext(pathname));
    return NextResponse.redirect(url);
  }

  // 403 forbidden
  if (isApi) {
    return NextResponse.json({ error: decision.reason }, { status: 403 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/forbidden";
  url.search = "";
  url.searchParams.set("reason", decision.reason);
  return NextResponse.redirect(url);
}

export const config = {
  // Match everything except Next internals and static assets (deny-by-default scope).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|txt|xml|woff2?|css|js|map)$).*)",
  ],
};
