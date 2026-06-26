// My submissions — the submitter own-status view for the Decision Queue (Module 11).
// Open to ALL authenticated roles (it lives OUTSIDE the Leader-only /m/decisions prefix
// on purpose, so it isn't caught by the Decision Queue route guard). You can always see
// your OWN raises and leadership's response — but never anyone else's, and never the
// full queue. This closes the "submitter black hole" the panel flagged: raise → decide
// → outcome is visible end-to-end without the act controls.

import Link from "next/link";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { ensureBudgetVarianceDecision } from "@/lib/phase2";
import { generate } from "@/lib/seed/generate";
import { outcomeLabel, outcomeTone, submittedBy, type OutcomeTone } from "@/lib/decisions/queries";
import { RAISED_COOKIE, ownRaises } from "@/lib/decisions/raise";
import { RaiseDecisionForm, type RaisePrefill } from "./_components/RaiseDecisionForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My submissions | GT Marketing Hub",
};

function toneClass(tone: OutcomeTone): string {
  if (tone === "good") return "bg-green-soft text-green border-green-soft";
  if (tone === "watch") return "bg-amber-soft text-amber border-amber-soft";
  if (tone === "risk") return "bg-red-soft text-red border-red-soft";
  return "bg-fill text-slate border-fill";
}

function clean(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2192/g, "to")
    .replace(/\u2248/g, "about")
    .replace(/\u00b7/g, "|");
}

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ intent?: string; workstream?: string; ask?: string; question?: string }>;
} = {}) {
  const query = searchParams ? await searchParams : {};
  const session = await getSession();
  const dataset = generate({ seed: 424242, families: 1200 });
  const decisions = ensureBudgetVarianceDecision(dataset.budget_workstream, dataset.decisions);
  const seeded = session ? submittedBy(decisions, session.title) : [];

  // Demo round-trip: decisions this user raised in-session live in a per-user cookie that
  // the raise endpoint writes. Merge them with their seeded raises (newest first), de-duped.
  // cookies() throws outside a request scope (e.g. unit-rendering the page) — treat as none.
  let raisedCookie: string | undefined;
  try {
    raisedCookie = (await cookies()).get(RAISED_COOKIE)?.value;
  } catch {
    raisedCookie = undefined;
  }
  const raised = session ? ownRaises(raisedCookie, session.id) : [];
  const seenIds = new Set(raised.map((d) => d.id));
  const mine = [...raised, ...seeded.filter((d) => !seenIds.has(d.id))].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const decided = mine.filter((d) => d.status === "decided" || d.status === "in_flight").length;

  // A module (e.g. Budget variance) can hand off a prefilled raise for a non-leader who
  // can't open the Leader-only Decision Queue — turn the intent params into form defaults.
  const prefill: RaisePrefill | undefined =
    query.intent === "reallocation"
      ? {
          question: query.workstream
            ? `Approve a reallocation for the ${query.workstream} workstream${query.ask ? ` ($${Number(query.ask).toLocaleString()})` : ""}?`
            : (query.question ?? ""),
          workstream: query.workstream,
          budget_ask: query.ask,
          priority: "high",
        }
      : query.question
        ? { question: query.question }
        : undefined;

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <section className="border-b border-hairline bg-[linear-gradient(135deg,var(--paper)_0%,var(--paper)_62%,var(--fill)_100%)]">
        <div className="mx-auto max-w-[1024px] px-4 py-5 sm:px-6 lg:px-8">
          <Link href="/" className="mono text-[10px] font-semibold text-gold hover:underline">
            Home
          </Link>
          <p className="mono mt-2 text-[10px] font-semibold text-label">Decision Queue</p>
          <h1 className="mt-1 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">My submissions</h1>
          <p className="mt-1.5 max-w-[680px] text-[12px] leading-snug text-muted">
            Decisions you raised and what leadership decided. You see only your own — the full Decision
            Queue is Leadership-only. {session ? `Signed in as ${session.title}.` : ""}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1024px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-4">
          {session ? (
            <RaiseDecisionForm prefill={prefill} />
          ) : (
            <p className="text-[11px] text-muted">Sign in to raise a decision.</p>
          )}
        </div>

        <p className="mb-4 text-[11px] text-muted">
          {mine.length} submission{mine.length === 1 ? "" : "s"} · {decided} with a leadership response
        </p>

        {mine.length ? (
          <div className="space-y-4">
            {mine.map((d) => {
              const tone = outcomeTone(d);
              return (
                <article key={d.id} className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-[12px] font-semibold leading-snug text-ink">{clean(d.question)}</h2>
                    <span className={`mono shrink-0 rounded-card border px-1.5 py-0.5 text-[10px] font-semibold ${toneClass(tone)}`}>
                      {outcomeLabel(d)}
                    </span>
                  </div>
                  <p className="mono mt-2 text-[12px] text-label">
                    {clean(d.workstream) || "—"} · raised {d.created_at.slice(0, 10)}
                    {d.due_date ? ` · due ${d.due_date}` : ""}
                  </p>
                  {d.response_note ? (
                    <div className="mt-3 rounded-card border border-hairline bg-canvas p-2.5">
                      <p className="mono text-[10px] font-semibold text-label">Leadership response</p>
                      <p className="mt-1 text-[12px] leading-snug text-ink">{clean(d.response_note)}</p>
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] text-muted">Awaiting a leadership ruling.</p>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <section className="rounded-card border border-hairline bg-surface p-8 text-center">
            <p className="text-[11px] text-muted">
              You haven&apos;t raised any decisions yet. Use <span className="font-semibold">+ Raise a decision</span>{" "}
              above to request a leadership ruling.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
