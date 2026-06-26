// Module 13 — Website & Digital Analytics. GA4 is the single source of truth (stood-in as
// ga4_days); per-site + aggregate reconcile BY SUMMATION (no cross-property double-count).
// bounce has one definition (1 − engagedSessions/sessions). `(not set)` UTM is an explicit,
// counted bucket. This module reads GA4 not HubSpot, so the sync-parity banner does NOT
// gate it — it shows its own GA4-confidence note instead. Conversion paths / cross-site
// flow are badged stand-in (BigQuery/path-exploration TBD).

import Link from "next/link";
import { generate } from "@/lib/seed/generate";
import { demoUserByRole } from "@/lib/phase2";
import { DEV_MODE, getSession } from "@/lib/auth";
import { Card, MetricTile, ModuleHeader, Pill, Tabs } from "@/app/_components/modkit";
import {
  siteTotals,
  bounce,
  newVsReturning,
  avgSessionDuration,
  subpagePerformance,
  topLandingPages,
  trafficSources,
  validateUtms,
  utmValidationSummary,
  downloads,
  totalPdfDownloads,
  conversionPaths,
  preFunnelJourney,
  canFlagPage,
} from "@/lib/metrics/analytics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Website & Digital Analytics | GT Marketing Hub" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "subpages", label: "Subpage performance" },
  { key: "sources", label: "Traffic sources" },
  { key: "downloads", label: "Downloads" },
  { key: "paths", label: "Conversion paths" },
] as const;

type TabKey = (typeof TABS)[number]["key"];
const hrefFor = (tab: TabKey) => (tab === "overview" ? "/m/analytics" : `/m/analytics?tab=${tab}`);

const fmt = (n: number) => n.toLocaleString();
const pct = (n: number) => `${Math.round(n * 100)}%`;

export default async function AnalyticsPage({
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
  const rows = ds.ga4_days;

  const totals = siteTotals(rows);
  const agg = totals.find((t) => t.site === "aggregate")!;
  const sites = totals.filter((t) => t.site !== "aggregate");
  const reconciled = agg.sessions === sites.reduce((a, s) => a + s.sessions, 0);
  const nvr = newVsReturning(agg);
  const pages = subpagePerformance(rows);
  const top = topLandingPages(rows);
  const sources = trafficSources(rows);
  const utm = validateUtms(rows);
  const utmSummary = utmValidationSummary(rows);
  const dl = downloads(rows);
  const totalPdf = totalPdfDownloads(rows);
  const paths = conversionPaths(rows);
  const journey = preFunnelJourney(rows);
  const thresholdedCount = pages.filter((p) => p.thresholded).length;

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <ModuleHeader
        moduleN={13}
        title="Website & Digital Analytics"
        blurb="GA4 is the single source of truth for gt.school + anywhere.gt.school. Per-site and aggregate reconcile by summation (no cross-property double-count); bounce has one definition; (not set) UTMs are explicit and counted. This module reads GA4, not HubSpot — it is not gated by the sync-parity banner and shows its own GA4-confidence note."
        basePath="/m/analytics"
        viewerName={viewer.name}
        viewerTitle={viewer.title}
        viewerRole={viewer.role}
        devMode={DEV_MODE}
      />

      <div className="mx-auto max-w-[1280px] px-5 py-6 sm:px-7 lg:px-9">
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            <section role="note" className="rounded-card border border-hairline bg-fill p-3 text-[12px] leading-relaxed text-slate">
              <span className="font-semibold text-ink">GA4-confidence note:</span> figures reflect GA4 realities — data
              thresholding (low-volume suppression), sampling, an explicit <code>(not set)</code> bucket, and
              consent-mode-modeled conversions. {thresholdedCount} subpage row(s) are below the threshold and flagged,
              not dropped. This module is not gated by the HubSpot sync-parity banner.
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Total sessions" value={fmt(agg.sessions)} note={reconciled ? "aggregate = sum of sites ✓" : "reconcile error"} tone={reconciled ? "good" : "risk"} />
              <MetricTile label="Bounce (aggregate)" value={pct(bounce(agg.sessions, agg.engagedSessions))} note="1 − engaged/sessions" tone="neutral" />
              <MetricTile label="Avg duration" value={`${avgSessionDuration(agg)}s`} note="modeled from engagement" tone="neutral" />
              <MetricTile label="PDF downloads" value={fmt(totalPdf)} note="this sprint window" tone="neutral" />
            </section>

            <Tabs tabs={TABS} active={activeTab} hrefFor={hrefFor} />

            {activeTab === "overview" && (
              <>
                <Card title="Sessions by site (small-multiples, shared baseline)" note="Aggregate must equal the sum of the two properties — no cross-property double-count.">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {sites.map((s) => (
                      <div key={s.site} className="rounded-card border border-hairline bg-canvas p-3">
                        <p className="text-[12px] font-semibold text-ink">{s.site}</p>
                        <p className="mono num mt-1 text-[22px] font-semibold text-ink">{fmt(s.sessions)}</p>
                        <p className="text-[11px] text-muted">bounce {pct(bounce(s.sessions, s.engagedSessions))} · {fmt(s.totalUsers)} users</p>
                      </div>
                    ))}
                  </div>
                </Card>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Card title="New vs returning" note="derived split (newUsers not in current seed)">
                    <div className="flex gap-2">
                      <Pill tone="good">new {fmt(nvr.newUsers)}</Pill>
                      <Pill tone="neutral">returning {fmt(nvr.returningUsers)}</Pill>
                    </div>
                  </Card>
                  <Card title="Top landing pages" note="by sessions (same ranking emitted to Content)">
                    <div className="space-y-1">
                      {top.map((p) => (
                        <div key={p.landingPage} className="flex items-center justify-between border-b border-hairline py-1 text-[12px]">
                          <span className="text-ink">{p.landingPage}</span>
                          <span className="mono num text-muted">{fmt(p.sessions)}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </>
            )}

            {activeTab === "subpages" && (
              <Card title="Subpage performance" note="Thresholded rows are flagged, not omitted. Bounce uses the single shared definition.">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-label">
                        <th className="py-2 pr-3 font-semibold">Page</th>
                        <th className="py-2 pr-3 font-semibold">Site</th>
                        <th className="py-2 pr-3 font-semibold">Type</th>
                        <th className="py-2 pr-3 font-semibold">Sessions</th>
                        <th className="py-2 pr-3 font-semibold">Bounce</th>
                        <th className="py-2 font-semibold">Flag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pages.slice(0, 20).map((p) => (
                        <tr key={`${p.site}|${p.landingPage}`} className="border-b border-hairline">
                          <td className="py-2 pr-3 font-semibold text-ink">{p.landingPage}</td>
                          <td className="py-2 pr-3 text-muted">{p.site}</td>
                          <td className="py-2 pr-3 text-muted">{p.pageType}</td>
                          <td className="mono num py-2 pr-3 text-muted">{fmt(p.sessions)}</td>
                          <td className="mono num py-2 pr-3 text-muted">{pct(p.bounce)}</td>
                          <td className="py-2">{p.thresholded ? <Pill tone="watch">thresholded</Pill> : <Pill tone="neutral">ok</Pill>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {activeTab === "sources" && (
              <>
                <Card title="Traffic source breakdown" note="Channel rollup from GA4 sessionDefaultChannelGroup.">
                  <div className="space-y-1">
                    {sources.map((s) => (
                      <div key={s.channel} className="flex items-center justify-between border-b border-hairline py-1 text-[12px]">
                        <span className="text-ink">{s.channel}</span>
                        <span className="mono num text-muted">{fmt(s.sessions)} sess · {fmt(s.leads)} leads</span>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card title="UTM validation → CRM Ops" note="This module is the UTM origin. (not set) is missing, counted — never silent pass-through.">
                  <div className="mb-3 flex gap-2">
                    <Pill tone="good">valid {fmt(utmSummary.valid)}</Pill>
                    <Pill tone="risk">invalid {fmt(utmSummary.invalid)}</Pill>
                    <Pill tone="watch">missing {fmt(utmSummary.missing)}</Pill>
                  </div>
                  <div className="space-y-1">
                    {utm.slice(0, 10).map((u) => (
                      <div key={u.utm_campaign} className="flex items-center justify-between border-b border-hairline py-1 text-[12px]">
                        <span className="text-ink">{u.utm_campaign}</span>
                        <Pill tone={u.status === "valid" ? "good" : u.status === "invalid" ? "risk" : "watch"}>{u.status} · {fmt(u.sessions)}</Pill>
                      </div>
                    ))}
                  </div>
                  <Link href="/m/crm-ops" className="mt-3 inline-flex text-[12px] font-semibold text-gold hover:underline">
                    Open CRM Ops attribution health →
                  </Link>
                </Card>
              </>
            )}

            {activeTab === "downloads" && (
              <Card title="PDF & download tracking" note={`Per-file rollup reconciles to the PDF widget: sum = ${fmt(totalPdf)}. File names are a stand-in until GA4 file_download params are configured.`}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-label">
                        <th className="py-2 pr-3 font-semibold">File</th>
                        <th className="py-2 pr-3 font-semibold">Weekly</th>
                        <th className="py-2 pr-3 font-semibold">Cumulative</th>
                        <th className="py-2 font-semibold">Top referrer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dl.map((d) => (
                        <tr key={d.file} className="border-b border-hairline">
                          <td className="py-2 pr-3 font-semibold text-ink">{d.file}</td>
                          <td className="mono num py-2 pr-3 text-muted">{fmt(d.downloadsWeekly)}</td>
                          <td className="mono num py-2 pr-3 text-muted">{fmt(d.downloadsCumulative)}</td>
                          <td className="py-2 text-muted">{d.topReferringPage}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {activeTab === "paths" && (
              <Card title="Conversion paths" note="Measured step counts to the application form. Multi-hop / cross-site flow is a stand-in (BigQuery / path-exploration TBD) and badged as such.">
                <div className="mb-3 rounded-card border border-hairline bg-fill p-3 text-[12px] text-slate">
                  Pre-funnel journey: entry <span className="font-semibold text-ink">{journey.entryPage}</span> · {journey.stepsToForm} steps to form · {pct(journey.dropOffRate)} drop-off
                  <Pill tone="watch">stand-in (BigQuery TBD)</Pill>
                </div>
                <div className="space-y-2">
                  {paths.map((p) => (
                    <div key={`${p.fromPage}->${p.toPage}`} className="flex items-center justify-between rounded-card border border-hairline bg-canvas px-3 py-2 text-[12px]">
                      <span className="text-ink">{p.fromPage} → {p.toPage}</span>
                      <span className="flex items-center gap-2">
                        <span className="mono num text-muted">{fmt(p.count)}</span>
                        <Pill tone="watch">stand-in</Pill>
                      </span>
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
                <li>GA4 Data API — gt.school + anywhere.gt.school (stood-in as ga4_days).</li>
                <li>Aggregate = sum of the two properties; no cross-property double-count.</li>
                <li>One bounce definition: 1 − engagedSessions/sessions.</li>
                <li>This is the UTM origin — validated before it reaches CRM Ops.</li>
              </ul>
            </section>
            <section className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
              <h2 className="font-serif text-[18px] font-semibold text-ink">Your access</h2>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">
                {canFlagPage(viewer.role)
                  ? "Admin/Leader: request a page/campaign analysis and flag an underperforming page (emits a Content hypothesis with the source-mix caveat)."
                  : "Operator: read-only. Request-analysis and flag-page are denied."}
              </p>
              {!canFlagPage(viewer.role) && <Pill tone="neutral">flag page — denied</Pill>}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
