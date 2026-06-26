// Module 2 — Grassroots Engine. The ambassador program with the HubSpot + community
// dual-source reconcile (reconciliation showcase #2). Ambassadors collapse to one golden
// record by survivorship; influenced enrollments READ app_form (not a checkbox); intros/
// P2P are de-duplicated; parent-led events are owned here (Field Marketing reads only).
// HubSpot-consuming → mounts the data-confidence banner.

import Link from "next/link";
import { generate } from "@/lib/seed/generate";
import { demoUserByRole } from "@/lib/phase2";
import { DEV_MODE, getSession } from "@/lib/auth";
import { parityThreshold } from "@/lib/parity";
import { seedBannerState } from "@/lib/crm-ops/parity-view";
import { DataConfidenceBanner } from "@/app/_components/DataConfidenceBanner";
import { Bar, Card, MetricTile, ModuleHeader, Pill, Tabs } from "@/app/_components/modkit";
import { reconcileAmbassadors, ALL_STAGES } from "@/lib/grassroots/reconcile";
import {
  activeAmbassadors,
  influencedEnrollments,
  ambassadorActivity,
  warmIntros,
  p2pCalls,
  marketCoverage,
} from "@/lib/grassroots/metrics";
import { PARENT_EVENTS, REFERRAL_SPRINTS } from "@/lib/grassroots/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Grassroots Engine | GT Marketing Hub" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "roster", label: "Ambassador roster" },
  { key: "market", label: "Market map" },
  { key: "sprints", label: "Referral sprints" },
  { key: "community", label: "Parent community" },
  { key: "events", label: "Parent events" },
] as const;

type TabKey = (typeof TABS)[number]["key"];
const hrefFor = (tab: TabKey) => (tab === "overview" ? "/m/grassroots" : `/m/grassroots?tab=${tab}`);

export default async function GrassrootsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; role?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
  const session = await getSession();
  const role = session?.role ?? (query.role as "admin" | "leader" | "operator" | undefined);
  const viewer = session ?? demoUserByRole(role);
  const activeTab: TabKey = TABS.find((t) => t.key === query.tab)?.key ?? "overview";

  const ds = generate({ seed: 424242, families: 1200 });
  const thresholdPct = Number((parityThreshold() * 100).toFixed(2));
  const banner = seedBannerState(ds.field_state, thresholdPct);

  const { ambassadors, conflicts } = reconcileAmbassadors(ds.community_ambassadors, ds.hubspot_ambassadors);
  const activity = ambassadorActivity(ambassadors);
  const active = activeAmbassadors(ambassadors);
  const intros = warmIntros(activity);
  const calls = p2pCalls(activity);
  const influenced = influencedEnrollments(ds.families);
  const coverage = marketCoverage();

  const stageCounts = ALL_STAGES.map((s) => ({ stage: s, count: ambassadors.filter((a) => a.stage === s).length }));

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <ModuleHeader
        moduleN={2}
        title="Grassroots Engine"
        blurb="Ambassador program reconciled from community.gt.school + HubSpot (dual-source, survivorship-resolved), referral sprints, a market map with a real coverage denominator, and parent-led events owned here. Influenced enrollments trace to app_form attribution — measured, not asserted."
        basePath="/m/grassroots"
        viewerName={viewer.name}
        viewerTitle={viewer.title}
        viewerRole={viewer.role}
        devMode={DEV_MODE}
      />

      <div className="mx-auto max-w-[1280px] px-5 py-6 sm:px-7 lg:px-9">
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            <DataConfidenceBanner state={banner} />

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Active ambassadors" value={String(active)} note="stage Active or Champion (counted once)" tone="good" />
              <MetricTile label="Warm intros" value={String(intros)} note="de-duplicated activity log" tone="neutral" />
              <MetricTile label="P2P calls" value={String(calls)} note="de-duplicated activity log" tone="neutral" />
              <MetricTile label="Influenced enroll." value={String(influenced.length)} note="traced to app_form referral" tone="good" />
            </section>

            <Tabs tabs={TABS} active={activeTab} hrefFor={hrefFor} />

            {activeTab === "overview" && (
              <Card title="Goal bars (single-defined, computed)" note="Each bar is one definition; 2a and 2b reconcile. Influenced ≠ incremental (no holdout in v1).">
                <div className="space-y-3">
                  {[
                    { label: "Active ambassadors", value: active, goal: 25 },
                    { label: "Warm intros", value: intros, goal: 200 },
                    { label: "P2P calls", value: calls, goal: 50 },
                    { label: "Influenced enrollments", value: influenced.length, goal: 30 },
                  ].map((b) => (
                    <div key={b.label} className="grid grid-cols-[180px_1fr_90px] items-center gap-3">
                      <span className="text-[13px] font-semibold text-ink">{b.label}</span>
                      <Bar pct={Math.min(100, (100 * b.value) / b.goal)} tone={b.value >= b.goal ? "good" : "watch"} />
                      <span className="mono num text-right text-[13px] text-ink">{b.value} / {b.goal}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {activeTab === "roster" && (
              <Card title="Ambassador roster (reconciled)" note={`${ambassadors.length} golden records from two feeds · ${conflicts.length} survivorship conflict(s) logged to CRM Ops`}>
                <div className="mb-3 flex flex-wrap gap-2">
                  {stageCounts.map((s) => (
                    <Pill key={s.stage} tone={s.stage === "Champion" || s.stage === "Active" ? "good" : "neutral"}>
                      {s.stage}: {s.count}
                    </Pill>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-label">
                        <th className="py-2 pr-3 font-semibold">Name</th>
                        <th className="py-2 pr-3 font-semibold">Stage</th>
                        <th className="py-2 pr-3 font-semibold">Source winner</th>
                        <th className="py-2 font-semibold">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ambassadors.slice(0, 22).map((a) => (
                        <tr key={a.matchKey} className="border-b border-hairline">
                          <td className="py-2 pr-3 text-ink">{a.name}</td>
                          <td className="py-2 pr-3">
                            <Pill tone={a.stage === "Champion" || a.stage === "Active" ? "good" : "neutral"}>{a.stage}</Pill>
                          </td>
                          <td className="py-2 pr-3 text-muted">{a.sourceWinner}</td>
                          <td className="py-2">
                            <Pill tone={a.statusConfidence === "low" ? "watch" : "good"}>{a.statusConfidence}</Pill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {conflicts.length > 0 && (
                  <p className="mt-3 text-[12px] text-muted">
                    Survivorship example: {conflicts[0].name} — community {conflicts[0].communityStage} vs HubSpot {conflicts[0].hubspotStage} → golden {conflicts[0].winner}.
                  </p>
                )}
              </Card>
            )}

            {activeTab === "market" && (
              <Card title="Market map coverage" note="Coverage % = contacted ÷ total per category. Ungeocoded nodes land in an explicit bucket, never dropped.">
                <div className="space-y-2">
                  {coverage.map((c) => (
                    <div key={c.category} className="grid grid-cols-[200px_1fr_120px] items-center gap-3">
                      <span className="text-[13px] text-ink">{c.category}</span>
                      <Bar pct={c.coveragePct} tone={c.coveragePct >= 60 ? "good" : c.coveragePct >= 30 ? "watch" : "risk"} />
                      <span className="mono num text-right text-[12px] text-muted">
                        {c.contacted}/{c.total}{c.ungeocoded ? ` · ${c.ungeocoded} ungeo` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {activeTab === "sprints" && (
              <Card title="Referral sprints (14-day windows)" note="Enlist ambassadors; track families identified → conversions; archive on close.">
                <div className="space-y-2">
                  {REFERRAL_SPRINTS.map((s) => (
                    <div key={s.id} className="rounded-card border border-hairline bg-canvas p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-semibold text-ink">{s.name}</p>
                        <Pill tone={s.status === "active" ? "good" : "neutral"}>{s.status}</Pill>
                      </div>
                      <p className="mt-1 text-[12px] text-muted">
                        {s.windowStart} → {s.windowEnd} · {s.enlisted} enlisted · {s.familiesIdentified} families · {s.conversions} conversions
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {activeTab === "community" && (
              <Card title="Parent community" note="Active parents + event attendance. NPS / forum is manual/stand-in unless a community API is wired.">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricTile label="Parent events" value={String(PARENT_EVENTS.length)} note="hosted this sprint" tone="neutral" />
                  <MetricTile label="Total attendance" value={String(PARENT_EVENTS.reduce((s, e) => s + e.attendance, 0))} note="across events" tone="good" />
                  <MetricTile label="NPS" value="not instrumented" note="needs a community API" tone="watch" />
                </div>
              </Card>
            )}

            {activeTab === "events" && (
              <Card title="Parent-led event calendar (source of truth)" note="Owned here. Field Marketing (Module 8) shows these read-only.">
                <div className="space-y-2">
                  {PARENT_EVENTS.map((e) => (
                    <div key={e.id} className="rounded-card border border-hairline bg-canvas p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-semibold text-ink">{e.name}</p>
                        <Pill tone="neutral">{e.type.replace("_", " ")}</Pill>
                      </div>
                      <p className="mt-1 text-[12px] text-muted">
                        {e.date} · {e.location} · host {e.host} · {e.attendance}/{e.rsvpCount} attended · {e.conversionsInfluenced} influenced
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          <aside className="space-y-4">
            <section className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
              <h2 className="font-serif text-[18px] font-semibold text-ink">Source of truth</h2>
              <ul className="mt-3 space-y-2 text-[12px] leading-relaxed text-muted">
                <li>Ambassadors = community.gt.school + HubSpot, reconciled by survivorship (no double-count).</li>
                <li>Influenced enrollments read app_form referral attribution — measured.</li>
                <li>parent_events are writable only here; Field Marketing reads them.</li>
                <li>Status conflicts surface as a data-quality issue in CRM Ops.</li>
              </ul>
            </section>
            <section className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
              <h2 className="font-serif text-[18px] font-semibold text-ink">Your access</h2>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">
                {viewer.role === "operator"
                  ? "Grassroots Owner (Operator): read/write this module; you may SUBMIT a budget ask to the Decision Queue but cannot view the full queue."
                  : viewer.role === "leader"
                    ? "Leader: read all + approve grassroots budget asks in the Decision Queue."
                    : "Admin: full read/write."}
              </p>
              <Link href="/m/decisions" className="mt-3 inline-flex text-[12px] font-semibold text-gold hover:underline">
                Decision Queue →
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
