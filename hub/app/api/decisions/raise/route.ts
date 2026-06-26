// "Raise a decision" — the SUBMIT half of Module 11 (PRD §2: any team member can submit
// from their own module). Open to ANY authenticated role (the route policy carves this
// path out of the Leader-only Decision Queue subtree; this handler re-checks the session
// as defense in depth and never trusts the client for identity).
//
// Persistence: the raised decision is appended to a per-user cookie that the "My
// submissions" page reads, so the raise round-trips on the seed-only demo (no DB needed).
// When APP_RW_DATABASE_URL is configured, it is ALSO inserted into the `decisions` table
// (best-effort, non-fatal) so the live Leader queue sees it.

import { NextResponse } from "next/server";
import { AuthError, requireSession } from "@/lib/auth";
import {
  RaiseDecisionError,
  RAISED_COOKIE,
  appendRaise,
  buildRaisedDecision,
  decodeRaises,
  encodeRaises,
  type RaiseDecisionInput,
} from "@/lib/decisions/raise";
import type { StoredRaise } from "@/lib/decisions/raise";

export const dynamic = "force-dynamic";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 14; // 14 days — the user's recent raises.

function readRaisedCookie(req: Request): StoredRaise[] {
  const header = req.headers.get("cookie") ?? "";
  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${RAISED_COOKIE}=`));
  if (!match) return [];
  return decodeRaises(decodeURIComponent(match.slice(RAISED_COOKIE.length + 1)));
}

async function parseBody(req: Request): Promise<RaiseDecisionInput> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await req.json().catch(() => ({}))) as RaiseDecisionInput;
  }
  const form = await req.formData().catch(() => null);
  if (!form) return {};
  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : undefined;
  };
  return {
    question: get("question"),
    recommendation: get("recommendation"),
    workstream: get("workstream"),
    budget_ask: get("budget_ask"),
    priority: get("priority"),
    due_date: get("due_date"),
  };
}

/** Best-effort live insert; only runs with a configured DB and never fails the request. */
async function persistToDb(raise: StoredRaise): Promise<void> {
  if (!process.env.APP_RW_DATABASE_URL) return;
  try {
    const { withoutProgram } = await import("@/lib/db");
    await withoutProgram(async (sql) => {
      await sql`
        insert into decisions
          (id, question, raised_by, workstream, recommendation, budget_ask,
           due_date, priority, status, auto_flag, created_at)
        values
          (${raise.id}, ${raise.question}, ${raise.raised_by}, ${raise.workstream},
           ${raise.recommendation}, ${raise.budget_ask}, ${raise.due_date},
           ${raise.priority}, 'open', false, ${raise.created_at})
        on conflict (id) do nothing`;
    });
  } catch {
    // Demo has no DB (or the insert raced) — the cookie store still round-trips.
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const input = await parseBody(req);

    const raise = buildRaisedDecision(input, {
      id: session.id,
      name: session.name,
      title: session.title,
    });

    const next = appendRaise(readRaisedCookie(req), raise);
    await persistToDb(raise);

    const wantsJson = (req.headers.get("content-type") ?? "").includes("application/json");
    const cookie = {
      name: RAISED_COOKIE,
      value: encodeRaises(next),
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    };

    if (!wantsJson) {
      const url = new URL("/m/submissions", req.url);
      const res = NextResponse.redirect(url, { status: 303 });
      res.cookies.set(cookie);
      return res;
    }

    const res = NextResponse.json(
      { ok: true, decision: { id: raise.id, question: raise.question, status: raise.status } },
      { status: 201 },
    );
    res.cookies.set(cookie);
    return res;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof RaiseDecisionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
