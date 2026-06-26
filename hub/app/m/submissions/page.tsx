// My submissions — the submitter own-status view for the Decision Queue (Module 11).
// Open to ALL authenticated roles (it lives OUTSIDE the Leader-only /m/decisions prefix
// on purpose, so it isn't caught by the Decision Queue route guard). You can always see
// your OWN raises and leadership's response — but never anyone else's, and never the
// full queue. This closes the "submitter black hole" the panel flagged: raise → decide
// → outcome is visible end-to-end without the act controls.

import Link from "next/link";
import { getSession } from "@/lib/auth";
import { ensureBudgetVarianceDecision } from "@/lib/phase2";
import { generate } from "@/lib/seed/generate";
import { outcomeLabel, outcomeTone, submittedBy, type OutcomeTone } from "@/lib/decisions/queries";

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

export default async function SubmissionsPage() {
  const session = await getSession();
  const dataset = generate({ seed: 424242, families: 1200 });
  const decisions = ensureBudgetVarianceDecision(dataset.budget_workstream, dataset.decisions);
  const mine = session ? submittedBy(decisions, session.title) : [];
  const decided = mine.filter((d) => d.status === "decided" || d.status === "in_flight").length;

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
              You haven&apos;t raised any decisions yet. Raise one from your module to request a leadership ruling.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
