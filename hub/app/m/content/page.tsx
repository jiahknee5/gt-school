// Module 3 — Content & Thought Leadership. The Hub mirrors the Google Sheet (production
// status SoT) with field-level merge + a conflict queue (never a clobber). Channels stay
// distinct (FB/IG/X separate, never a blended "social"). Content-to-conversion is a real
// app_form × UTM join; the "X conversion" figure is MEASURED, not a constant. Brand-voice
// suggests, never gates. HubSpot-consuming → DataConfidenceBanner.

import Link from "next/link";
import { generate } from "@/lib/seed/generate";
import { demoUserByRole } from "@/lib/phase2";
import { DEV_MODE, getSession } from "@/lib/auth";
import { parityThreshold } from "@/lib/parity";
import { seedBannerState } from "@/lib/crm-ops/parity-view";
import { DataConfidenceBanner } from "@/app/_components/DataConfidenceBanner";
import { Card, MetricTile, ModuleHeader, Pill, Tabs } from "@/app/_components/modkit";
import { buildPieces, kanban, calendarConflicts, canAdvance } from "@/lib/content/pieces";
import { contentToConversion, channelConversionShare, xConversionRatio } from "@/lib/content/attribution";
import { channelPerformance, MANUAL_AUDIENCE } from "@/lib/content/metrics";
import { defaultAuditor } from "@/lib/content/brand-voice";
import { seedSyncStates } from "@/lib/content/sync";

export const dynamic = "force-dynamic";
export const metadata = { title: "Content & Thought Leadership | GT Marketing Hub" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "pipeline", label: "Production pipeline" },
  { key: "calendar", label: "Calendar" },
  { key: "performance", label: "Performance" },
  { key: "library", label: "Library + auditor" },
] as const;

type TabKey = (typeof TABS)[number]["key"];
const hrefFor = (tab: TabKey) => (tab === "overview" ? "/m/content" : `/m/content?tab=${tab}`);

const STATUS_LABEL: Record<string, string> = {
  concept: "Concept",
  in_production: "In production",
  review: "Review",
  scheduled: "Scheduled",
  published: "Published",
};

function fmt(n: number): string {
  return n.toLocaleString();
}

export default async function ContentPage({
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

  const pieces = buildPieces(ds);
  const columns = kanban(pieces);
  const conflicts = calendarConflicts(pieces);
  const perPiece = contentToConversion(pieces, ds);
  const shares = channelConversionShare(pieces, ds);
  const xRatio = xConversionRatio(pieces, ds);
  const channels = channelPerformance(ds);
  const syncStates = seedSyncStates();
  const syncConflicts = syncStates.filter((s) => s.conflict);

  const inFlight = pieces.filter((p) => p.status !== "published").length;
  const published = pieces.filter((p) => p.status === "published").length;
  const onTrack = pieces.filter((p) => p.status === "scheduled" || p.status === "published").length;
  const topPieces = [...perPiece].sort((a, b) => b.conversions - a.conversions).slice(0, 5);
  const noUtm = perPiece.filter((p) => p.utmCampaign === "(not set)").length;

  // Auditor demo — suggest-only, never gates.
  const draft = "Our world-class program gives gifted students very unique synergy.";
  const suggestions = defaultAuditor.audit("piece_demo", draft);

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <ModuleHeader
        moduleN={3}
        title="Content & Thought Leadership"
        blurb="The Hub mirrors the Google Sheet (production status stays source of truth) with field-level merge and a conflict queue — never a clobber. Channels stay distinct, content-to-conversion is a real app_form × UTM join, and the X conversion figure is measured (not a constant). The brand-voice auditor suggests; it never gates publish."
        basePath="/m/content"
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
              <MetricTile label="In flight" value={fmt(inFlight)} note={`${onTrack} on track (sched/pub)`} tone="neutral" />
              <MetricTile label="Published" value={fmt(published)} note="this sprint" tone="good" />
              <MetricTile label="X conversion share" value={`${Math.round(xRatio.ratio * 100)}%`} note={`measured · ${xRatio.xConversions}/${xRatio.total}`} tone="watch" />
              <MetricTile label="Sync conflicts" value={fmt(syncConflicts.length)} note="both-sides edits, retained" tone={syncConflicts.length ? "risk" : "good"} />
            </section>

            <Tabs tabs={TABS} active={activeTab} hrefFor={hrefFor} />

            {activeTab === "overview" && (
              <>
                <Card title="Top performers (by conversion)" note={`content_to_conversion = app_form × UTM · ${noUtm} piece(s) with (not set) UTM still counted`}>
                  <div className="space-y-2">
                    {topPieces.map((p) => (
                      <div key={p.pieceId} className="flex items-center justify-between rounded-card border border-hairline bg-canvas px-3 py-2">
                        <div>
                          <p className="text-[13px] font-semibold text-ink">{p.title}</p>
                          <p className="text-[12px] text-muted">{p.channel} · {p.utmCampaign}</p>
                        </div>
                        <Pill tone={p.conversions > 0 ? "good" : "neutral"}>{p.conversions} conv</Pill>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card title="Audience (manual v1)" note="Substack subs + podcast listens are manual until the APIs land.">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MetricTile label="Substack subs" value={fmt(MANUAL_AUDIENCE.substackSubscribers)} note={`+${Math.round(MANUAL_AUDIENCE.substackGrowthPct * 100)}% growth`} tone="neutral" />
                    <MetricTile label="Podcast listens" value={fmt(MANUAL_AUDIENCE.podcastListens)} note="AGL podcast" tone="neutral" />
                    <MetricTile label="Brand-voice tips" value={fmt(suggestions.length)} note="advisory, non-blocking" tone="neutral" />
                  </div>
                </Card>
              </>
            )}

            {activeTab === "pipeline" && (
              <Card title="Production pipeline" note="Card move = status write → pushed to the sheet. Camp cards are read-only; grassroots stubs need consent before leaving concept.">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {columns.map((col) => (
                    <div key={col.status} className="rounded-card border border-hairline bg-canvas p-2">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-label">{STATUS_LABEL[col.status]} · {col.pieces.length}</p>
                      <div className="space-y-2">
                        {col.pieces.map((p) => {
                          const adv = canAdvance(p);
                          return (
                            <div key={p.id} className="rounded-card border border-hairline bg-surface p-2">
                              <p className="text-[12px] font-semibold text-ink">{p.title}</p>
                              <p className="text-[11px] text-muted">{p.channel} · {p.owner}</p>
                              {p.readOnly && <Pill tone="neutral">read-only (camp)</Pill>}
                              {!adv.ok && !p.readOnly && <Pill tone="watch">consent required</Pill>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {activeTab === "calendar" && (
              <Card title="Content calendar" note={`Color-coded by channel. ${conflicts.length} same-day/channel conflict(s) flagged.`}>
                {conflicts.length > 0 ? (
                  <div className="space-y-2">
                    {conflicts.map((c) => (
                      <div key={`${c.day}:${c.channel}`} className="flex items-center justify-between rounded-card border border-hairline bg-canvas px-3 py-2">
                        <p className="text-[13px] text-ink">{c.day} · {c.channel}</p>
                        <Pill tone="risk">{c.count} pieces — conflict</Pill>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-muted">No scheduling conflicts this window.</p>
                )}
                <div className="mt-3 space-y-1">
                  {pieces
                    .filter((p) => p.status === "scheduled" || p.status === "published")
                    .sort((a, b) => a.publishDate.localeCompare(b.publishDate))
                    .map((p) => (
                      <div key={p.id} className="flex items-center justify-between border-b border-hairline py-1 text-[12px]">
                        <span className="text-muted">{p.publishDate}</span>
                        <span className="text-ink">{p.title}</span>
                        <Pill tone="neutral">{p.channel}</Pill>
                      </div>
                    ))}
                </div>
              </Card>
            )}

            {activeTab === "performance" && (
              <>
                <Card title="Channel performance (distinct rows)" note="FB, IG, and X are never blended into one 'social'. Email from HubSpot; Substack/podcast manual.">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] border-collapse text-[13px]">
                      <thead>
                        <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-label">
                          <th className="py-2 pr-3 font-semibold">Channel</th>
                          <th className="py-2 pr-3 font-semibold">Source</th>
                          <th className="py-2 pr-3 font-semibold">Reach</th>
                          <th className="py-2 pr-3 font-semibold">Clicks</th>
                          <th className="py-2 font-semibold">Engagements</th>
                        </tr>
                      </thead>
                      <tbody>
                        {channels.map((c) => (
                          <tr key={c.channel} className="border-b border-hairline">
                            <td className="py-2 pr-3 font-semibold text-ink">{c.channel}</td>
                            <td className="py-2 pr-3 text-muted">{c.source}</td>
                            <td className="mono num py-2 pr-3 text-muted">{fmt(c.reach)}</td>
                            <td className="mono num py-2 pr-3 text-muted">{fmt(c.clicks)}</td>
                            <td className="mono num py-2 text-muted">{fmt(c.engagements)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
                <Card title="Content-to-conversion by channel" note="Measured share of attributed conversions — the X figure changes with the seed.">
                  <div className="space-y-2">
                    {shares.map((s) => (
                      <div key={s.channel} className="flex items-center justify-between rounded-card border border-hairline bg-canvas px-3 py-2">
                        <p className="text-[13px] text-ink">{s.channel}</p>
                        <Pill tone={s.channel === "x" ? "watch" : "neutral"}>{Math.round(s.ratio * 100)}% · {s.conversions} conv</Pill>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            )}

            {activeTab === "library" && (
              <Card title="Library + brand-voice auditor" note="Published archive (flat v1). The auditor is advisory (suggest-only) — it never blocks a status transition.">
                <p className="mb-2 text-[12px] text-muted">Sample draft: &ldquo;{draft}&rdquo; · {suggestions.length} advisory suggestion(s)</p>
                <div className="space-y-2">
                  {suggestions.map((s) => (
                    <div key={s.id} className="rounded-card border border-hairline bg-canvas p-2">
                      <p className="text-[12px] text-ink"><span className="line-through text-muted">{s.originalText}</span> → <span className="font-semibold">{s.suggestedText}</span></p>
                      <p className="text-[11px] text-muted">{s.rationale}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-1">
                  {pieces.filter((p) => p.status === "published").map((p) => (
                    <div key={p.id} className="flex items-center justify-between border-b border-hairline py-1 text-[12px]">
                      <span className="text-ink">{p.title}</span>
                      <Pill tone="neutral">{p.channel} · {p.type}</Pill>
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
                <li>Google Sheet stays SoT for production status; the Hub mirrors + pushes back.</li>
                <li>Both-sides edits conflict (both values retained), never a clobber.</li>
                <li>FB / IG / X are distinct channels — never a blended &ldquo;social&rdquo;.</li>
                <li>Conversion = app_form × UTM; the X figure is measured, not constant.</li>
              </ul>
            </section>
            <section className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
              <h2 className="font-serif text-[18px] font-semibold text-ink">Sync conflicts</h2>
              {syncConflicts.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {syncConflicts.map((s) => (
                    <div key={s.pieceId} className="rounded-card border border-hairline bg-canvas p-2 text-[12px]">
                      <p className="font-semibold text-ink">{s.field} conflict</p>
                      <p className="text-muted">app: {s.appValue} · sheet: {s.sheetValue}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-muted">No open conflicts.</p>
              )}
            </section>
            <section className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
              <h2 className="font-serif text-[18px] font-semibold text-ink">Your access</h2>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">
                Operator (Content Owner): read/write content; submit-only to the Decision Queue (concept approve/kill + founder travel). Camp content is read-only here.
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
