// Budget Tracker spend-entry API. The Hub owns the budget system of record:
// function owners append committed/actual spend for their own workstream, and the
// aggregate row is recomputed from the append-only ledger in the same transaction.

import { NextResponse } from "next/server";
import { AuthError, requireSession } from "@/lib/auth";
import { withoutProgram } from "@/lib/db";
import {
  BudgetValidationError,
  normalizeBudgetEntryInput,
} from "@/lib/budget/reconcile";
import {
  BudgetAuthError,
  WORKSTREAM_OWNER_ROLE,
  assertCanWriteEntry,
  ownerRoleFor,
} from "@/lib/budget/rbac";

export const dynamic = "force-dynamic";

type EntryRow = {
  id: string;
  workstream_key: string;
  kind: "committed" | "actual";
  origin: "manual" | "campaign";
  amount: string | number;
  entered_by: string;
  owner_role: string;
  note: string | null;
  campaign_key: string | null;
  created_at: string;
};

const WORKSTREAMS = Object.keys(WORKSTREAM_OWNER_ROLE);

function toEntry(row: EntryRow) {
  return {
    ...row,
    amount: Number(row.amount),
    created_at: new Date(row.created_at).toISOString(),
  };
}

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
    const body = await parseBody(req);
    const workstreamKey = String(body.workstream_key ?? "").trim();
    if (!WORKSTREAMS.includes(workstreamKey)) {
      throw new BudgetValidationError("Unknown budget workstream.");
    }
    assertCanWriteEntry(session, workstreamKey);

    const entry = normalizeBudgetEntryInput({
      workstream_key: workstreamKey,
      kind: body.kind as string | null | undefined,
      origin: body.origin as string | null | undefined,
      amount: body.amount as number | string | null | undefined,
      entered_by: session.id,
      owner_role: ownerRoleFor(workstreamKey),
      note: body.note as string | null | undefined,
      campaign_key: body.campaign_key as string | null | undefined,
    });

    const inserted = await withoutProgram(async (sql) => {
      const rows = await sql<EntryRow[]>`
        insert into budget_entry (
          workstream_key, kind, origin, amount, entered_by, owner_role, note, campaign_key
        ) values (
          ${entry.workstream_key}, ${entry.kind}, ${entry.origin}, ${entry.amount},
          ${entry.entered_by}, ${entry.owner_role}, ${entry.note}, ${entry.campaign_key}
        )
        returning id, workstream_key, kind, origin, amount, entered_by, owner_role,
                  note, campaign_key, created_at`;

      const totals = await sql<{ committed: string | number; actual: string | number }[]>`
        select
          coalesce(sum(amount) filter (where kind = 'committed'), 0) as committed,
          coalesce(sum(amount) filter (where kind = 'actual'), 0) as actual
        from budget_entry
        where workstream_key = ${entry.workstream_key}`;
      const committed = Number(totals[0]?.committed ?? 0);
      const actual = Number(totals[0]?.actual ?? 0);

      await sql`
        update budget_workstream set
          committed = ${committed},
          actual = ${actual}
        where key = ${entry.workstream_key}`;

      return toEntry(rows[0]);
    });

    return NextResponse.json({ ok: true, entry: inserted });
  } catch (err) {
    if (err instanceof AuthError || err instanceof BudgetAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof BudgetValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await requireSession();
    const writableWorkstreams = WORKSTREAMS.filter((key) => {
      try {
        assertCanWriteEntry(session, key);
        return true;
      } catch {
        return false;
      }
    });
    return NextResponse.json({ role: session.role, writableWorkstreams });
  } catch (err) {
    if (err instanceof AuthError || err instanceof BudgetAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
