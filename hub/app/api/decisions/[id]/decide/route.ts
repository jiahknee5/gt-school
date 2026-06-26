// Leadership-only Decision Queue mutation route. The read API and middleware gate
// /api/decisions*, but this handler re-checks the session and applies a small
// state machine before persisting response fields to the Hub-owned decisions table.

import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { withoutProgram } from "@/lib/db";
import {
  applyDecisionTransition,
  DecisionTransitionError,
} from "@/lib/decisions/transitions";
import type { Decision } from "@/lib/seed/types";

export const dynamic = "force-dynamic";

type DecisionRow = Omit<Decision, "budget_ask" | "auto_flag"> & {
  budget_ask: string | number | null;
  auto_flag: boolean | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toDecision(row: DecisionRow): Decision {
  return {
    ...row,
    budget_ask: row.budget_ask == null ? null : Number(row.budget_ask),
    auto_flag: Boolean(row.auto_flag),
    created_at: new Date(row.created_at).toISOString(),
    resolved_at: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
  };
}

async function parseBody(req: Request): Promise<{ response?: string; note?: string }> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await req.json().catch(() => ({}))) as { response?: string; note?: string };
  }

  const form = await req.formData().catch(() => null);
  if (!form) return {};
  return {
    response: (form.get("response") as string | null) ?? undefined,
    note: ((form.get("note") ?? form.get("response_note")) as string | null) ?? undefined,
  };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole("leader");

    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Decision id must be a UUID." }, { status: 400 });
    }
    const body = await parseBody(req);

    const updated = await withoutProgram(async (sql) => {
      const rows = await sql<DecisionRow[]>`
        select id, question, raised_by, workstream, recommendation, budget_ask,
               due_date, priority, status, response, response_note, auto_flag,
               resolved_at, created_at
        from decisions
        where id = ${id}
        limit 1
        for update`;
      const current = rows[0];
      if (!current) return null;

      const next = applyDecisionTransition(toDecision(current), {
        response: body.response,
        note: body.note,
      });

      const written = await sql<DecisionRow[]>`
        update decisions set
          status = ${next.status},
          response = ${next.response},
          response_note = ${next.response_note},
          resolved_at = ${next.resolved_at}
        where id = ${id}
          and status = 'open'
        returning id, question, raised_by, workstream, recommendation, budget_ask,
                  due_date, priority, status, response, response_note, auto_flag,
                  resolved_at, created_at`;

      if (!written[0]) {
        throw new DecisionTransitionError(409, "Only open decisions can receive a ruling.");
      }

      return toDecision(written[0]);
    });

    if (!updated) {
      return NextResponse.json({ error: "Decision not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, decision: updated });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof DecisionTransitionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
