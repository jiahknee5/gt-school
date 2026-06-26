// Decision Queue data API — Leadership-only (PRD §2; security finding: an Operator
// session GETting this must receive 403, not 200-with-hidden-UI). The middleware
// already gates the Decision Queue page/API to the Leader role; this handler re-checks
// server-side (defense in depth) and never trusts the client for role/scope.

import { NextResponse } from "next/server";
import { AuthError, getSession } from "@/lib/auth";
import { decisionQueueRoleAllowed } from "@/lib/auth/policy";
import { ensureBudgetVarianceDecision } from "@/lib/phase2";
import { generate } from "@/lib/seed/generate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new AuthError(401, "Authentication required.");
    if (!decisionQueueRoleAllowed(session.role)) {
      throw new AuthError(
        403,
        "Decision Queue is Leadership-only (view + act). Operators may submit, not view.",
      );
    }

    const dataset = generate({ seed: 424242, families: 1200 });
    const decisions = ensureBudgetVarianceDecision(dataset.budget_workstream, dataset.decisions);
    const open = decisions.filter((d) => d.status === "open");

    return NextResponse.json({
      role: session.role,
      total: decisions.length,
      open: open.length,
      decisions: decisions.map((d) => ({
        id: d.id,
        question: d.question,
        priority: d.priority,
        status: d.status,
        workstream: d.workstream,
        auto_flag: d.auto_flag,
      })),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
