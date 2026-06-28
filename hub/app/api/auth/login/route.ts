// Dev-mode login. With AUTH_DEV_MODE enabled, accepts a role (or userId), issues a
// real signed session cookie, and redirects. This is the password-less competition
// switcher; the session it mints is still enforced server-side everywhere. When dev
// mode is off and no real IdP is configured, login is refused (no insecure fallback).

import { NextResponse, type NextRequest } from "next/server";
import { DEV_MODE, createSessionToken, sessionCookie, resolveUserById, resolveUserByRole } from "@/lib/auth";

function safeNext(value: string | null): string {
  // Same-origin absolute PATHS only. Reject protocol-relative ("//", "/\") and any
  // backslash so `next` can never become an open redirect to another host (SEC-06).
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const params = url.searchParams;

  let role = params.get("role");
  let userId = params.get("userId");
  let next = params.get("next");

  if (req.method === "POST") {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      role = (body.role as string) ?? role;
      userId = (body.userId as string) ?? userId;
      next = (body.next as string) ?? next;
    } else {
      const form = await req.formData().catch(() => null);
      if (form) {
        role = (form.get("role") as string) ?? role;
        userId = (form.get("userId") as string) ?? userId;
        next = (form.get("next") as string) ?? next;
      }
    }
  }

  if (!DEV_MODE) {
    return NextResponse.json(
      { error: "Dev login is disabled. Configure a real identity provider (AUTH_DEV_MODE is off)." },
      { status: 403 },
    );
  }

  const user = userId
    ? await resolveUserById(userId)
    : role
      ? await resolveUserByRole(role)
      : undefined;
  if (!user) {
    return NextResponse.json({ error: "Unknown dev user or role." }, { status: 400 });
  }

  const token = await createSessionToken(user.id);
  const res = NextResponse.redirect(new URL(safeNext(next), url.origin));
  res.cookies.set(sessionCookie(token));
  return res;
}

export const GET = handle;
export const POST = handle;
