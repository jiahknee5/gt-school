// Module 11 — Decision Queue. The Hub's headline RBAC surface: Leadership-only
// view + act. The deny is real at THREE layers — the Edge middleware (route guard),
// this server component (re-checks the session below), and the sidebar (hides the nav
// item for non-Leaders). Operators submit from their own modules and watch outcomes in
// /m/submissions; they never see the full queue.
//
// Data: rendered from the deterministic seed snapshot (the whole Hub is), run through
// the SAME pure intake/idempotency the live engine uses — ensureBudgetVarianceDecision
// folds the >10% budget variance auto-flag in once (idempotent), then queries.ts shapes
// active/history. No DB needed for build/test.

import Link from "next/link";
import { getSession } from "@/lib/auth";
import { ensureBudgetVarianceDecision } from "@/lib/phase2";
import { generate } from "@/lib/seed/generate";
import {
  activeDecisions,
  decisionStats,
  historyDecisions,
  openBadgeCount,
} from "@/lib/decisions/queries";
import { enrichDecisionByCounties, recommendationImpactFromEnrichment } from "@/lib/opendata/enrich";
import { DecisionCard } from "./_components/DecisionCard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Decision Queue | GT Marketing Hub",
};

const TABS = [
  { key: "active", label: "Active decisions" },
  { key: "history", label: "History" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function tabHref(tab: TabKey): string {
  return tab === "active" ? "/m/decisions" : `/m/decisions?tab=${tab}`;
}

export default async function DecisionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
  const session = await getSession();
  const role = session?.role ?? null;
  const isLeader = role === "leader";
  const activeTab: TabKey = TABS.find((t) => t.key === query.tab)?.key ?? "active";

  const dataset = generate({ seed: 424242, families: 1200 });
  const decisions = ensureBudgetVarianceDecision(dataset.budget_workstream, dataset.decisions);
  const stats = decisionStats(decisions);
  const badge = openBadgeCount(decisions);
  const active = activeDecisions(decisions);
  const history = historyDecisions(decisions);
  const enrichment = await enrichDecisionByCounties(["TRAVIS", "DALLAS"], {
    fetchImpl: async () => {
      throw new Error("Use fixture for deterministic server-rendered decision context.");
    },
    now: () => Date.parse("2026-06-26T00:00:00.000Z"),
  });
  const openDataImpact = recommendationImpactFromEnrichment(enrichment, "pilot");

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <section className="border-b border-hairline bg-[linear-gradient(135deg,var(--paper)_0%,var(--paper)_62%,var(--fill)_100%)]">
        <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link href="/" className="mono text-[10px] font-semibold text-gold hover:underline">
                Home
              </Link>
              <div className="mt-4 flex items-center gap-2">
                <p className="mono text-[10px] font-semibold text-label">Module 11</p>
                <span className="mono rounded-card bg-violet-soft px-1.5 py-px text-[10px] font-semibold text-violet">
                  Leadership only
                </span>
              </div>
              <h1 className="mt-1 flex items-center gap-2 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
                Decision Queue
                {isLeader && badge > 0 && (
                  <span className="mono inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-red px-2 text-[13px] font-bold text-white">
                    {badge}
                  </span>
                )}
              </h1>
              <p className="mt-1.5 max-w-[760px] text-[12px] leading-snug text-muted">
                Where leadership rules on cross-module asks — budget reallocations, guerrilla bets,
                hot-family escalations, capacity expansions. View + act is Leadership-only and enforced
                server-side; every other role submits and watches the outcome in My submissions.
              </p>
            </div>

            <div className="rounded-card border border-hairline bg-canvas p-2.5">
              <p className="mono text-[10px] font-semibold text-label">Active role</p>
              <p className="mt-1 text-[12px] font-semibold text-ink">{role ?? "Not signed in"}</p>
              <p className="mt-0.5 text-[11px] text-muted">Leader: view + act · others: submit only</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
        {!isLeader ? (
          <AccessDenied role={role} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
            <div className="space-y-3">
              <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <Tile label="Open" value={String(stats.open)} tone={stats.open ? "watch" : "good"} note="Awaiting a ruling" />
                <Tile label="Urgent open" value={String(stats.urgentOpen)} tone={stats.urgentOpen ? "risk" : "good"} note="Due first" />
                <Tile label="Awaiting info" value={String(stats.inFlight)} tone="neutral" note="Need-more-info loop" />
                <Tile
                  label="Budget at stake"
                  value={`$${stats.budgetAtStake.toLocaleString("en-US")}`}
                  tone="neutral"
                  note="Across active asks"
                />
              </section>

              <nav className="flex flex-wrap gap-1 rounded-card border border-hairline bg-surface p-1">
                {TABS.map((t) => {
                  const isActiveTab = t.key === activeTab;
                  const count = t.key === "active" ? active.length : history.length;
                  return (
                    <Link
                      key={t.key}
                      href={tabHref(t.key)}
                      aria-current={isActiveTab ? "page" : undefined}
                      className={`rounded-card px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        isActiveTab ? "bg-ink-cta text-on-cta shadow-sm" : "text-muted hover:bg-hover hover:text-ink"
                      }`}
                    >
                      {t.label} ({count})
                    </Link>
                  );
                })}
              </nav>

              {activeTab === "active" && (
                <div data-tour="tour-decision-queue" className="space-y-4">
                  {active.length ? (
                    active.map((d) => <DecisionCard key={d.id} decision={d} canAct />)
                  ) : (
                    <EmptyState message="No open decisions. The queue is clear." />
                  )}
                </div>
              )}

              {activeTab === "history" && (
                <div className="space-y-4">
                  {history.length ? (
                    history.map((d) => <DecisionCard key={d.id} decision={d} canAct={false} />)
                  ) : (
                    <EmptyState message="No decided decisions yet." />
                  )}
                </div>
              )}
            </div>

            <aside className="space-y-3">
              <section className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
                <h2 className="font-serif text-[13px] font-bold tracking-[-0.01em] text-ink">How the queue works</h2>
                <ul className="mt-2 space-y-1.5 text-[11px] leading-snug text-muted">
                  <li>Any role can <span className="font-semibold text-ink">submit</span> a decision from their module.</li>
                  <li>Only <span className="font-semibold text-ink">Leadership</span> sees and rules on the full queue.</li>
                  <li>A ruling requires a note; the submitter sees it in My submissions.</li>
                  <li>
                    Budget variance &gt;10% auto-flags here{" "}
                    <span className="font-semibold text-ink">once</span> (idempotent — re-tripping never duplicates).
                  </li>
                  <li>Approvals/rejections are append-only; History keeps the trail.</li>
                </ul>
              </section>

              <section className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
                <h2 className="font-serif text-[13px] font-bold tracking-[-0.01em] text-ink">This queue</h2>
                <dl className="mt-2.5 space-y-1.5 text-[12px]">
                  <Stat label="Total decisions" value={stats.total} />
                  <Stat label="Auto-flagged" value={stats.autoFlagged} />
                  <Stat label="Decided (archived)" value={stats.decided} />
                </dl>
              </section>

              <section className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
                <h2 className="font-serif text-[13px] font-bold tracking-[-0.01em] text-ink">Open Data enrichment</h2>
                <div className="mt-3 rounded-card border border-gold bg-amber-soft p-3">
                  <p className="mono text-[10px] font-semibold uppercase tracking-[0.08em] text-label">
                    Decision impact
                  </p>
                  <p className="mt-1 text-[12px] font-semibold text-ink">
                    {openDataImpact.before} -&gt; {openDataImpact.after}
                    {openDataImpact.changed ? " (recommendation changed)" : ""}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate">
                    {openDataImpact.reason}
                  </p>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-muted">
                  {enrichment.signal}
                </p>
                <p className="mono mt-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-label">
                  Source: {enrichment.source} | {enrichment.counties.join(" + ")} | decision context only
                </p>
                <Link
                  href="/api/opendata/decision-enrichment?counties=TRAVIS,DALLAS"
                  className="mt-2 inline-flex text-[11px] font-semibold text-gold hover:underline"
                >
                  Refresh enrichment →
                </Link>
              </section>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function AccessDenied({ role }: { role: string | null }) {
  return (
    <section className="rounded-card border border-red-soft bg-red-soft p-5 text-red">
      <p className="text-[15px] font-semibold">Decision Queue is Leadership-only</p>
      <p className="mt-2 max-w-[640px] text-[13px] leading-relaxed">
        View + act on the Decision Queue is restricted to the Leader role. The current role
        {role ? ` (${role})` : ""} can submit decisions from its own modules and watch outcomes under{" "}
        <Link href="/m/submissions" className="font-semibold underline">
          My submissions
        </Link>
        , but cannot see the full queue. This check runs server-side from the authenticated session, on
        top of the middleware route guard.
      </p>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <section className="rounded-card border border-hairline bg-surface p-8 text-center">
      <p className="text-[11px] text-muted">{message}</p>
    </section>
  );
}

function Tile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: "neutral" | "good" | "watch" | "risk";
}) {
  const toneClass =
    tone === "good"
      ? "bg-green-soft text-green border-green-soft"
      : tone === "watch"
        ? "bg-amber-soft text-amber border-amber-soft"
        : tone === "risk"
          ? "bg-red-soft text-red border-red-soft"
          : "bg-fill text-slate border-fill";
  return (
    <article className="rounded-card border border-hairline bg-surface p-2.5 shadow-sm">
      <div className={`mono inline-flex rounded-card border px-1.5 py-0.5 text-[10px] font-semibold ${toneClass}`}>
        {label}
      </div>
      <p className="mono num mt-1.5 text-[18px] font-bold leading-none text-ink">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted">{note}</p>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="mono num font-semibold text-ink">{value}</dd>
    </div>
  );
}
