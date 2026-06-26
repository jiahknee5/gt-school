// CRM Ops auto-detector API (PRD §3 Module 7e). Admin (Marketing Lead) + Leader only;
// Operators are denied (403, not 200-with-hidden-UI). The middleware does not class
// /api/crm-ops as restricted, so this handler is the authoritative server-side RBAC
// gate — it re-checks the session role itself and never trusts the client.
//
// GET  → the current detector result + queue summary.
// POST → "run" the detector (idempotent): re-deriving over unchanged state opens 0 new
//        issues, which the response proves via openedCount.
//
// The detector runs over the deterministic seed snapshot through the same pure logic the
// live path would use. Persisting issues to data_quality_issue is deferred: that table
// is not granted INSERT/UPDATE to app_rw in the committed backbone, and this build is
// additive-only (no migration). The detection BEHAVIOR is fully exercised here.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import type { Role } from "@/lib/phase2";
import { generate } from "@/lib/seed/generate";
import { parityThreshold } from "@/lib/parity";
import { asIssueRow, runDetect } from "@/lib/crm-ops/detect";
import { buildQueue, canViewCrmOps } from "@/lib/crm-ops/queue";

export const dynamic = "force-dynamic";

class RouteAuthError extends Error {
  status: 401 | 403;
  constructor(status: 401 | 403, message: string) {
    super(message);
    this.status = status;
  }
}

function requireCrmOps(role: Role | null | undefined): void {
  if (role == null) throw new RouteAuthError(401, "Authentication required.");
  if (!canViewCrmOps(role)) {
    throw new RouteAuthError(403, "CRM Ops is Admin/Leader only. Operators are denied.");
  }
}

function detectPayload() {
  const ds = generate({ seed: 424242, families: 1200 });
  const thresholdPct = Number((parityThreshold() * 100).toFixed(2));

  // First pass over the issues already on record.
  const first = runDetect(ds, ds.data_quality_issue, thresholdPct);
  // Second pass simulating persistence of the first pass — proves idempotency:
  // re-deriving over unchanged state opens 0 new and resolves 0.
  const persisted = [
    ...ds.data_quality_issue,
    ...first.plan.toOpen.map((d) => asIssueRow(d, "2026-08-31T00:00:00.000Z")),
  ];
  const second = runDetect(ds, persisted, thresholdPct);

  const queue = buildQueue(ds.data_quality_issue, first.plan.desired);
  return {
    thresholdPct: first.thresholdPct,
    desiredCount: first.desiredCount,
    openedCount: first.openedCount,
    resolvedCount: first.resolvedCount,
    byCategory: first.byCategory,
    idempotent: second.openedCount === 0 && second.resolvedCount === 0,
    secondPassOpened: second.openedCount,
    queue: {
      openCount: queue.openCount,
      bySeverity: queue.bySeverity,
      byCategory: queue.byCategory,
    },
    note: "Detection runs over the seed snapshot; persistence to data_quality_issue is deferred (additive grant required).",
  };
}

export async function GET() {
  try {
    const session = await getSession();
    requireCrmOps(session?.role);
    return NextResponse.json({ role: session!.role, ...detectPayload() });
  } catch (err) {
    if (err instanceof RouteAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await getSession();
    requireCrmOps(session?.role);
    const payload = detectPayload();
    return NextResponse.json({ role: session!.role, ran: true, ...payload });
  } catch (err) {
    if (err instanceof RouteAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
