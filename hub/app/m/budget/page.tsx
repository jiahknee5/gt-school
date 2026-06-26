// Module 10 — Budget Tracker. The one module where "watch a budget reconcile to the
// total" is the headline demo signal. Four sub-views (10a Budget table · 10b Burn chart ·
// 10c Spend by workstream · 10d Variance alerts), all derived from the append-only
// budget_entry ledger so the $365K total is a RECOMPUTED invariant, not a seed constant.
//
// RBAC: Budget is readable by every role; per-owner WRITE scoping (Operator edits only
// their own row, Leader/Admin per ownership) is enforced server-side in
// app/api/budget/entries and mirrored VISIBLY here. The dedicated route mirrors the CRM Ops
// pattern (app/m/crm-ops); the generic /m/[slug] budget surface is left intact.
//
// Data: renders from the deterministic seed snapshot through the SAME pure
// reconcile/variance/metrics logic the live engine uses.

import Link from "next/link";
import { generate } from "@/lib/seed/generate";
import { demoUserByRole } from "@/lib/phase2";
import { getSession } from "@/lib/auth";
import { reconcileBudget } from "@/lib/budget/reconcile";
import { buildBurnSeries, actualAllocation } from "@/lib/metrics/budget";
import { BudgetTable } from "./_components/BudgetTable";
import { BurnChart } from "./_components/BurnChart";
import { SpendByWorkstream } from "./_components/SpendByWorkstream";
import { VarianceAlerts } from "./_components/VarianceAlerts";
import { MetricTile, usd } from "./_components/primitives";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Budget Tracker | GT Marketing Hub",
};

const SPRINT_START = "2026-06-01T00:00:00.000Z";
const SPRINT_WEEKS = 13;

const TABS = [
  { key: "table", label: "Budget table" },
  { key: "burn", label: "Burn chart" },
  { key: "spend", label: "Spend by workstream" },
  { key: "variance", label: "Variance alerts" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function tabHref(tab: TabKey): string {
  return tab === "table" ? "/m/budget" : `/m/budget?tab=${tab}`;
}

export default async function BudgetPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; role?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
  const session = await getSession();
  const role = session?.role ?? (query.role as "admin" | "leader" | "operator" | undefined);
  const viewer = session ?? demoUserByRole(role);
  const activeTab: TabKey = TABS.find((t) => t.key === query.tab)?.key ?? "table";

  const ds = generate({ seed: 424242, families: 1200 });
  const recon = reconcileBudget(ds.budget_workstream, ds.budget_entry);
  const varianceRows = recon.rows.map((r) => ({ key: r.key, name: r.name, planned: r.planned, actual: r.actual }));
  const burn = buildBurnSeries(ds.budget_entry, recon.totals.planned, {
    sprintStart: SPRINT_START,
    weeks: SPRINT_WEEKS,
    asOf: ds.manifest.generatedAt,
  });
  const allocation = actualAllocation(recon.rows);
  const flaggedCount = varianceRows.filter((r) => r.actual > r.planned * 1.1 && r.actual - r.planned >= 2500).length;

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <section className="border-b border-hairline bg-[linear-gradient(135deg,var(--paper)_0%,var(--paper)_62%,var(--fill)_100%)]">
        <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <Link href="/" className="mono text-[10px] font-semibold text-gold hover:underline">
              Home
            </Link>
            <p className="mono mt-2 text-[10px] font-semibold text-label">Module 10</p>
            <h1 className="mt-1 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
              Budget Tracker
            </h1>
            <p className="mt-1.5 max-w-[760px] text-[12px] leading-snug text-muted">
              Plan vs committed vs actual vs remaining by workstream. The Hub is the system of record (no
              Google Sheet). Four workstreams reconcile to exactly $365,000; campaign spend (e.g. the GT
              Challenge) rolls into a workstream actual exactly once; a &gt;10% variance auto-flags to the
              Decision Queue.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-3">
            <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile
                label="Recommended total"
                value={recon.reconciles ? "$365,000" : usd(recon.totals.recommended)}
                note={recon.reconciles ? "Reconciles to the PRD total" : recon.reconcileError ?? ""}
                tone={recon.reconciles ? "good" : "risk"}
              />
              <MetricTile
                label="Actual"
                value={usd(recon.totals.actual)}
                note={`${usd(recon.totals.remaining)} remaining vs planned`}
                tone="neutral"
              />
              <MetricTile
                label="Committed"
                value={usd(recon.totals.committed)}
                note={`${usd(recon.totals.available)} available to commit`}
                tone="watch"
              />
              <MetricTile
                label="Variance flags"
                value={String(flaggedCount)}
                note="Rows >10% over plan (and >= $2,500)"
                tone={flaggedCount ? "risk" : "good"}
              />
            </section>

            <nav className="flex flex-wrap gap-1 rounded-card border border-hairline bg-surface p-1">
              {TABS.map((t) => {
                const active = t.key === activeTab;
                return (
                  <Link
                    key={t.key}
                    href={tabHref(t.key)}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-card px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      active ? "bg-ink-cta text-on-cta shadow-sm" : "text-muted hover:bg-hover hover:text-ink"
                    }`}
                  >
                    {t.label}
                  </Link>
                );
              })}
            </nav>

            {activeTab === "table" && (
              <div data-tour="tour-gtc-budget">
                <BudgetTable recon={recon} viewer={viewer} />
              </div>
            )}
            {activeTab === "burn" && <BurnChart burn={burn} />}
            {activeTab === "spend" && <SpendByWorkstream slices={allocation} />}
            {activeTab === "variance" && (
              <VarianceAlerts
                rows={varianceRows}
                decisions={ds.decisions}
                asOf={ds.manifest.generatedAt}
                viewerRole={viewer.role}
              />
            )}
          </div>

          <aside className="space-y-3">
            <section className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
              <h2 className="font-serif text-[13px] font-bold tracking-[-0.01em] text-ink">Source of truth</h2>
              <ul className="mt-2 space-y-1.5 text-[11px] leading-snug text-muted">
                <li>The Hub is the budget system of record. There is no Google Sheet.</li>
                <li>committed/actual are DERIVED from the append-only budget_entry ledger.</li>
                <li>Campaign spend rolls in once as an origin=campaign entry (never re-typed).</li>
                <li>remaining = planned - actual; available = planned - committed.</li>
              </ul>
            </section>

            <section className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
              <h2 className="font-serif text-[13px] font-bold tracking-[-0.01em] text-ink">Your edit scope</h2>
              <p className="mt-1 text-[11px] leading-snug text-muted">
                {viewer.role === "admin"
                  ? "Admin (Marketing Lead): edit every workstream row + planned."
                  : viewer.role === "leader"
                    ? `Leader: edit planned + approve reallocation; write spend for ${viewer.owns.join(", ") || "owned"} row(s).`
                    : `Operator: write spend only for your row (${viewer.owns.join(", ") || "none"}); others are read-only.`}
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
