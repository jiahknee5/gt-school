// Module 6 — Dashboard / KPI Tracking. The canonical shared scorecard everyone
// references in the Monday meeting. It is a READ-ONLY aggregator: every number resolves
// through the single KPI registry (lib/metrics/registry.ts) — Home, Dashboard, and the
// source module render the SAME value, to the digit (no drift).
//
// RBAC: the scorecard is identical for ALL roles (shared, not personal). ONLY a Leader
// may edit a goal (the goal API enforces it server-side; this page mirrors the state).
//
// Sub-views: 6a Scorecard · 6b Trends · 6c SLA & ops health · 6d Goal pacing · 6e
// HubSpot mirror — switchable via ?tab=, with a ?week= selector over the frozen weeks.

import Link from "next/link";
import { generate } from "@/lib/seed/generate";
import { demoUserByRole } from "@/lib/phase2";
import { getSession } from "@/lib/auth";
import { parityThreshold } from "@/lib/parity";
import { seedBannerState } from "@/lib/crm-ops/parity-view";
import { DataConfidenceBanner } from "@/app/_components/DataConfidenceBanner";
import { PageObjective } from "@/app/_components/PageObjective";
import { Explain } from "@/app/_components/InfoTip";
import { buildScorecard } from "@/lib/dashboard/scorecard";
import { buildPacing } from "@/lib/dashboard/pacing";
import { canEditGoal } from "@/lib/dashboard/goals";
import { defaultReportingWeek, weekMondays } from "@/lib/metrics/registry";
import { guideBySlug } from "@/lib/help/guides";
import { fmtValue, MetricTile, statusTone } from "./_components/primitives";
import { Scorecard } from "./_components/Scorecard";
import { Trends } from "./_components/Trends";
import { GoalPacing } from "./_components/GoalPacing";
import { SlaOpsHealth } from "./_components/SlaOpsHealth";
import { HubspotMirror } from "./_components/HubspotMirror";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard / KPI Tracking | GT Marketing Hub",
};

// Tab order follows the Monday-meeting read order: scan the scorecard, then check
// pacing to the Aug-17 goal, then operational health, then context, then reference.
const TABS = [
  { key: "scorecard", label: "Scorecard" },
  { key: "pacing", label: "Goal pacing" },
  { key: "sla", label: "SLA & ops health" },
  { key: "trends", label: "Trends" },
  { key: "mirror", label: "HubSpot mirror" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function tabHref(tab: TabKey, week: string): string {
  const params = new URLSearchParams();
  if (tab !== "scorecard") params.set("tab", tab);
  if (week) params.set("week", week);
  const qs = params.toString();
  return qs ? `/m/dashboard?${qs}` : "/m/dashboard";
}

// The Aug-17 Fall-enrollment cutoff is the pacing deadline; its authoritative home is
// Goal pacing (6d). This countdown is rendered here and on that tab, never as a fork.
function daysToCutoff(): number {
  const cutoff = new Date("2026-08-17T00:00:00-05:00").getTime();
  return Math.max(0, Math.ceil((cutoff - Date.now()) / 86_400_000));
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; role?: string; week?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
  const session = await getSession();
  const role = session?.role ?? (query.role as "admin" | "leader" | "operator" | undefined);
  const viewer = session ?? demoUserByRole(role);
  const activeTab: TabKey = TABS.find((t) => t.key === query.tab)?.key ?? "scorecard";

  const ds = generate({ seed: 424242, families: 1200 });
  const thresholdPct = Number((parityThreshold() * 100).toFixed(2));
  const banner = seedBannerState(ds.field_state, thresholdPct);

  const weeks = weekMondays();
  const selectedWeek = query.week && weeks.includes(query.week) ? query.week : defaultReportingWeek();
  const scorecard = buildScorecard(ds, selectedWeek);
  const pacing = buildPacing(ds, selectedWeek);
  const editable = canEditGoal(viewer.role);

  const measured = scorecard.rows.filter((r) => r.instrumented).length;
  const atRisk = scorecard.redFlags.length;
  const stale = scorecard.rows.filter((r) => r.stale).length;
  const days = daysToCutoff();
  const meetingGuide = guideBySlug("weekly-meeting");

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <section className="border-b border-hairline bg-[linear-gradient(135deg,var(--paper)_0%,var(--paper)_62%,var(--fill)_100%)]">
        <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <Link href="/" className="mono text-[10px] font-semibold text-gold hover:underline">
              &larr; Home (your cockpit)
            </Link>
            <p className="mono mt-2 text-[10px] font-semibold text-label">Module 6 &middot; Dashboard / KPI Tracking</p>
            <h1 className="mt-1 font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
              Weekly Standup &mdash; our shared board
            </h1>
            <p className="mt-1.5 max-w-[760px] text-[12px] leading-snug text-muted">
              The single canonical scorecard the whole team meets on &mdash; identical for everyone and
              versioned by week. A read-only aggregator: every number resolves through ONE KPI definition, so
              the Home widget, this board, and the owning module show the same value. Uninstrumented inputs are
              flagged low-confidence; stale connectors show a badge; goals are Leader-editable only.{" "}
              <Link href="/" className="font-semibold text-gold hover:underline">
                Want your own view? &rarr; Home.
              </Link>
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-3">
            <PageObjective slug="dashboard" />
            {/* Inbound contract: a parity drop shows the data-confidence banner here too. */}
            <DataConfidenceBanner state={banner} />

            <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="relative">
                <MetricTile
                  label="Measured KPIs"
                  value={`${measured} / ${scorecard.rows.length}`}
                  note="Instrumented vs total (rest are low-confidence)"
                  tone="neutral"
                />
                <span className="absolute right-1.5 top-1.5"><Explain k="dashboard.measured" /></span>
              </div>
              <div className="relative">
                <MetricTile
                  label="Biggest mover"
                  value={
                    scorecard.biggestMover
                      ? fmtValue(scorecard.biggestMover.thisWeek, scorecard.biggestMover.unit)
                      : "—"
                  }
                  note={scorecard.biggestMover ? scorecard.biggestMover.label : "No instrumented mover"}
                  tone={scorecard.biggestMover ? statusTone(scorecard.biggestMover.status) : "neutral"}
                />
                <span className="absolute right-1.5 top-1.5"><Explain k="dashboard.biggest-mover" /></span>
              </div>
              <div className="relative">
                <MetricTile
                  label="At risk"
                  value={String(atRisk)}
                  note="KPIs below 90% of required run-rate"
                  tone={atRisk ? "risk" : "good"}
                />
                <span className="absolute right-1.5 top-1.5"><Explain k="dashboard.at-risk" /></span>
              </div>
              <div className="relative">
                <MetricTile
                  label="Stale connectors"
                  value={String(stale)}
                  note="Source last-sync exceeded its SLA"
                  tone={stale ? "watch" : "good"}
                />
                <span className="absolute right-1.5 top-1.5"><Explain k="dashboard.stale" /></span>
              </div>
            </section>

            {/* Reporting context — the week selector's authoritative home is this board (it
                versions the scorecard), and the Aug-17 countdown links to its pacing home. */}
            <section
              data-tour="tour-week-selector"
              className="rounded-card border border-hairline bg-surface p-2.5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mono inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-label">
                    Reporting week <Explain k="shared.reporting-week" />
                  </span>
                  {weeks.map((w) => (
                    <Link
                      key={w}
                      href={tabHref(activeTab, w)}
                      aria-current={w === selectedWeek ? "page" : undefined}
                      className={`mono rounded-card border px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                        w === selectedWeek
                          ? "border-gold bg-amber-soft text-ink"
                          : "border-hairline bg-surface text-muted hover:text-ink"
                      }`}
                    >
                      {w}
                    </Link>
                  ))}
                </div>
                <Link
                  href={tabHref("pacing", selectedWeek)}
                  className={`mono shrink-0 rounded-card px-2 py-1 text-[11px] font-semibold transition-colors ${
                    days < 14
                      ? "bg-amber-soft text-amber hover:opacity-80"
                      : "bg-fill text-slate hover:text-ink"
                  }`}
                  title={`Fall 2026 enrollment deadline is August 17. ${days} ${
                    days === 1 ? "day" : "days"
                  } left. Opens Goal pacing.`}
                >
                  {days} {days === 1 ? "day" : "days"} to Fall enrollment (Aug 17) &rarr; pacing
                </Link>
              </div>
            </section>

            <nav className="flex flex-wrap gap-1 rounded-card border border-hairline bg-surface p-1">
              {TABS.map((t) => {
                const active = t.key === activeTab;
                return (
                  <Link
                    key={t.key}
                    href={tabHref(t.key, selectedWeek)}
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

            {activeTab === "scorecard" && <Scorecard scorecard={scorecard} />}
            {activeTab === "trends" && <Trends ds={ds} window={8} />}
            {activeTab === "sla" && <SlaOpsHealth ds={ds} />}
            {activeTab === "pacing" && <GoalPacing rows={pacing} canEdit={editable} />}
            {activeTab === "mirror" && <HubspotMirror />}
          </div>

          <aside className="space-y-3">
            {meetingGuide && (
              <section className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
                <h2 className="font-serif text-[13px] font-bold tracking-[-0.01em] text-ink">Run the meeting</h2>
                <p className="mt-1 text-[11px] leading-snug text-muted">
                  The Monday standup is a journey, not one screen. Follow the agenda across the Hub &mdash;
                  this board is the shared scan in the middle.
                </p>
                <ol className="mt-2.5 space-y-1.5">
                  {meetingGuide.steps.map((step, index) => (
                    <li key={step.where}>
                      <Link
                        href={step.href ?? "/m/dashboard"}
                        className="flex items-start gap-2 rounded-card border border-hairline bg-canvas px-2.5 py-1.5 transition-colors hover:border-border hover:bg-hover"
                      >
                        <span className="mono mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-card bg-fill text-[10px] font-semibold text-slate">
                          {index + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[12px] font-semibold leading-snug text-ink">{step.do}</span>
                          <span className="mono block truncate text-[10px] text-muted">{step.where}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
                <Link
                  href="/help/weekly-meeting"
                  className="mono mt-2.5 inline-block text-[10px] font-semibold text-gold hover:underline"
                >
                  Full agenda &amp; run-of-show &rarr;
                </Link>
              </section>
            )}

            <section className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
              <h2 className="font-serif text-[13px] font-bold tracking-[-0.01em] text-ink">Single source of truth</h2>
              <ul className="mt-2 space-y-1.5 text-[11px] leading-snug text-muted">
                <li>Every KPI is computed in one place: lib/metrics/registry.ts.</li>
                <li>This board reads home-module values; it never re-derives a number.</li>
                <li>The Home widget reuses the same Scorecard component + data (no drift).</li>
                <li>The HubSpot mirror is display-only and never reconciled into a Hub KPI.</li>
              </ul>
            </section>

            <section className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
              <h2 className="font-serif text-[13px] font-bold tracking-[-0.01em] text-ink">Goal-edit scope</h2>
              <p className="mt-1 text-[11px] leading-snug text-muted">
                {editable
                  ? "Leader: you may edit KPI targets; every change is logged to the goal audit."
                  : `${viewer.role === "admin" ? "Admin" : "Operator"}: goals are read-only — only Leaders edit targets.`}
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
