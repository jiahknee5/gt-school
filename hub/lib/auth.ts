// Server-side auth utilities. Usable from server components AND API route handlers.
// (Imports next/headers, so this is server-only; the Edge middleware uses the
// dependency-free lib/auth/policy.ts + lib/auth/token.ts instead.)
//
// Dev auth mode: with AUTH_DEV_MODE=true (default outside production) the app ships a
// password-less role switcher — pick Admin / Leader / Operator — that still issues a
// real signed session cookie and is still enforced server-side by the same middleware
// and guards. Swap in a real IdP later without changing call sites. See .env.example.

import { cookies } from "next/headers";
import { DEMO_USERS, type DemoUser, type Role } from "@/lib/phase2";
import { signToken, verifyToken } from "@/lib/auth/token";
import { routeDecision } from "@/lib/auth/policy";

export const SESSION_COOKIE = "gt_session";
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

/** Dev auth mode is on outside production unless explicitly disabled. */
export const DEV_MODE =
  process.env.AUTH_DEV_MODE === "true" ||
  (process.env.AUTH_DEV_MODE !== "false" && process.env.NODE_ENV !== "production");

export type SessionUser = DemoUser;

export function userById(id: string): DemoUser | undefined {
  return DEMO_USERS.find((user) => user.id === id);
}

export function userByRole(role: string): DemoUser | undefined {
  return DEMO_USERS.find((user) => user.role === role);
}

/** Read + verify the session from the request cookies. Returns null if signed out. */
export async function getSession(): Promise<SessionUser | null> {
  let token: string | undefined;
  try {
    const store = await cookies();
    token = store.get(SESSION_COOKIE)?.value;
  } catch {
    // cookies() is unavailable outside a request scope (e.g. unit-rendering a page
    // component directly in a test). Treat that as "no session".
    return null;
  }
  const userId = await verifyToken(token);
  if (!userId) return null;
  return userById(userId) ?? null;
}

export async function getRole(): Promise<Role | null> {
  return (await getSession())?.role ?? null;
}

export class AuthError extends Error {
  status: 401 | 403;
  constructor(status: 401 | 403, message: string) {
    super(message);
    this.status = status;
    this.name = "AuthError";
  }
}

/** Require an authenticated session (any role). Throws AuthError(401) otherwise. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new AuthError(401, "Authentication required.");
  return session;
}

/** Require one of the given roles. Throws AuthError(401/403). For API handlers + server components. */
export async function requireRole(roles: Role | Role[]): Promise<SessionUser> {
  const session = await requireSession();
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(session.role)) {
    throw new AuthError(403, `Requires role: ${allowed.join(", ")}.`);
  }
  return session;
}

/** Authorize the current session against a path using the shared route policy. */
export async function authorizePath(pathname: string) {
  const role = await getRole();
  return routeDecision(role, pathname);
}

/** Build the signed session cookie attributes for a login route handler. */
export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

/** Cookie attributes that clear the session (logout). */
export function clearedSessionCookie() {
  return { name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 };
}

/** Mint a signed session token for a user id. */
export async function createSessionToken(userId: string): Promise<string> {
  return signToken(userId);
}

// Re-export the pure helpers so callers can `import { ... } from "@/lib/auth"`.
export {
  routeDecision,
  decisionQueueRoleAllowed,
  isAdminOnlyPath,
  isLeaderOnlyPath,
  isPublicPath,
} from "@/lib/auth/policy";
export { allowedPrograms, resolveProgramScope, ProgramScopeError } from "@/lib/auth/program";
export type { Role } from "@/lib/phase2";
