// Weekly Status snapshot refresh. Scheduled by Vercel Cron (vercel.json) for ~Monday
// 07:00 so the verdict is PRE-LOADED, not generated on page load. Secured by CRON_SECRET:
// Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` when the env var is set.
//
//   GET  → cron-triggered refresh of the current reporting week for every program.
//   POST → admin/leader "regenerate now" for demos (same work, role-gated).
//
// Generation uses the LLM provider when ANTHROPIC_API_KEY + STATUS_GEN_MODEL are set,
// and falls back to the deterministic rubric generator otherwise (each run is labeled).

import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { loadDataset } from "@/lib/seed/load-dataset";
import { buildStatusBoard } from "@/lib/status/board";
import { REFRESH_PROGRAMS, refreshSnapshot } from "@/lib/status/store";
import { defaultReportingWeek } from "@/lib/metrics/registry";

export const dynamic = "force-dynamic";

function authorizeCron(req: Request): { ok: boolean; status: 401 | 503 } {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // No secret configured: allow only outside production (dev/demo); never in prod.
    return process.env.NODE_ENV === "production" ? { ok: false, status: 503 } : { ok: true, status: 401 };
  }
  const auth = req.headers.get("authorization") ?? "";
  const url = new URL(req.url);
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : url.searchParams.get("secret") ?? "";
  return { ok: provided === secret, status: 401 };
}

async function runRefresh() {
  const week = defaultReportingWeek();
  const ds = await loadDataset({ seed: 424242, families: 1200 });
  const results = [];
  for (const program of REFRESH_PROGRAMS) {
    const board = buildStatusBoard(ds, program, week);
    const { snapshot, persisted, storeKind } = await refreshSnapshot(board, program);
    results.push({
      program,
      week: snapshot.weekStart,
      source: snapshot.source,
      model: snapshot.model,
      persisted,
      storeKind,
    });
  }
  return { ok: true, week, refreshedAt: new Date().toISOString(), results };
}

export async function GET(req: Request) {
  const auth = authorizeCron(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.status === 503
            ? "CRON_SECRET is not configured. Set it in the environment to enable scheduled refresh."
            : "Unauthorized cron request.",
      },
      { status: auth.status },
    );
  }
  try {
    return NextResponse.json(await runRefresh());
  } catch {
    return NextResponse.json({ error: "Refresh failed." }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await requireRole(["admin", "leader"]);
    const summary = await runRefresh();
    return NextResponse.json({ ...summary, triggeredBy: { id: session.id, role: session.role } });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Refresh failed." }, { status: 500 });
  }
}
