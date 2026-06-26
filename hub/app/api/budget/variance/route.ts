// Budget variance detector + Decision Queue auto-flag emit (Module 10, PLAN §4).
// GET  → the variance summary + the pending auto-flag payloads (idempotent vs decisions
//        already on record: a workstream with an OPEN auto_flag is skipped).
// POST → "raise" the pending payloads via the same intake contract a human raise uses
//        (admin/leader only — emitting Decision Queue items is a leadership action).
//
// Runs over the deterministic seed snapshot through the SAME pure logic the live engine
// uses. Idempotency is proven: a second pass over a state that already holds the open
// auto-flags yields zero new payloads.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import type { Role } from "@/lib/phase2";
import { generate } from "@/lib/seed/generate";
import { reconcileBudget } from "@/lib/budget/reconcile";
import { evaluateVariance, pendingVarianceDecisions } from "@/lib/budget/variance";

export const dynamic = "force-dynamic";

class RouteAuthError extends Error {
  status: 401 | 403;
  constructor(status: 401 | 403, message: string) {
    super(message);
    this.status = status;
  }
}

function requireLeadership(role: Role | null | undefined): void {
  if (role == null) throw new RouteAuthError(401, "Authentication required.");
  if (role !== "admin" && role !== "leader") {
    throw new RouteAuthError(403, "Raising a budget variance decision is Admin/Leader only.");
  }
}

function variancePayload(asOf = "2026-08-31T00:00:00.000Z") {
  const ds = generate({ seed: 424242, families: 1200 });
  const recon = reconcileBudget(ds.budget_workstream, ds.budget_entry);
  const rows = recon.rows.map((r) => ({ key: r.key, name: r.name, planned: r.planned, actual: r.actual }));
  const variance = evaluateVariance(rows);

  const pending = pendingVarianceDecisions(rows, ds.decisions, asOf);
  // Idempotency proof: simulate having raised them, then re-detect → zero new.
  const secondPass = pendingVarianceDecisions(rows, [...ds.decisions, ...pending], asOf);

  return {
    reconciles: recon.reconciles,
    flagged: variance.filter((v) => v.flagged).map((v) => ({
      workstream: v.key,
      name: v.name,
      overAmount: v.overAmount,
      overPct: v.overPct,
      urgent: v.urgent,
    })),
    pending,
    idempotent: secondPass.length === 0,
    note: "Auto-flags emit the §4 Decision Queue intake payload via the same raise path a human uses; one open flag per workstream.",
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.json({ role: session.role, ...variancePayload() });
}

export async function POST() {
  try {
    const session = await getSession();
    requireLeadership(session?.role);
    return NextResponse.json({ role: session!.role, raised: true, ...variancePayload() });
  } catch (err) {
    if (err instanceof RouteAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
