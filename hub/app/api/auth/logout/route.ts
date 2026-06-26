// Clear the session cookie and return to the login screen.

import { NextResponse, type NextRequest } from "next/server";
import { clearedSessionCookie } from "@/lib/auth";

async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const res = NextResponse.redirect(new URL("/login", url.origin));
  res.cookies.set(clearedSessionCookie());
  return res;
}

export const GET = handle;
export const POST = handle;
