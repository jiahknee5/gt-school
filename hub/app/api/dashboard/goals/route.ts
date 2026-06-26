// Dashboard KPI-goal API. The scorecard is shared + read-only for everyone; ONLY a
// Leader may edit a goal target. RBAC is enforced SERVER-side here (not just the UI):
// Admin and Operator are denied. Every successful edit appends an immutable audit row.

import { NextResponse } from "next/server";
import { AuthError, requireSession } from "@/lib/auth";
import { withoutProgram } from "@/lib/db";
import {
  GoalAuthError,
  assertCanEditGoal,
  goalFor,
} from "@/lib/dashboard/goals";

export const dynamic = "force-dynamic";

async function parseBody(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await req.json().catch(() => ({}))) as Record<string, unknown>;
  }
  const form = await req.formData().catch(() => null);
  if (!form) return {};
  return Object.fromEntries(form.entries());
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    // Deny-by-default: only a Leader passes this. Admin/Operator → 403.
    assertCanEditGoal(session.role);

    const body = await parseBody(req);
    const kpiKey = String(body.kpi_key ?? "").trim();
    const newValue = Number(body.target_value);
    if (!goalFor(kpiKey)) {
      return NextResponse.json({ error: "Unknown KPI goal." }, { status: 400 });
    }
    if (!Number.isFinite(newValue) || newValue < 0) {
      return NextResponse.json({ error: "target_value must be a non-negative number." }, { status: 400 });
    }

    const existing = goalFor(kpiKey)!;

    const result = await withoutProgram(async (sql) => {
      await sql`
        insert into kpi_goal (kpi_key, period, target_value, cutoff_date, set_by)
        values (${kpiKey}, ${existing.period}, ${newValue}, ${existing.cutoffDate}, ${session.id})
        on conflict (kpi_key, period) do update
          set target_value = excluded.target_value, set_by = excluded.set_by, updated_at = now()`;
      await sql`
        insert into kpi_goal_audit (kpi_key, actor, old_value, new_value)
        values (${kpiKey}, ${session.id}, ${existing.targetValue}, ${newValue})`;
      return { kpiKey, oldValue: existing.targetValue, newValue };
    });

    return NextResponse.json({ ok: true, goal: result });
  } catch (err) {
    if (err instanceof AuthError || err instanceof GoalAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await requireSession();
    return NextResponse.json({ role: session.role, canEditGoals: session.role === "leader" });
  } catch (err) {
    if (err instanceof AuthError || err instanceof GoalAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
