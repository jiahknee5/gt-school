// Module 9 — Admissions & Voice of Customer. Objections are the product: real spans,
// de-duped per thread, theme-validated (closed 8-theme set), consent-gated before any
// quote goes public. Pipeline numbers read app_form funnel_stage (SSOT). The bridge
// stubs one open content brief per theme (idempotent) and reports a correlational pre/
// post delta. Feedback is submit-not-view for Operators. HubSpot-consuming → banner.

import Link from "next/link";
import { generate } from "@/lib/seed/generate";
import { demoUserByRole } from "@/lib/phase2";
import { getSession } from "@/lib/auth";
import { parityThreshold } from "@/lib/parity";
import { seedBannerState } from "@/lib/crm-ops/parity-view";
import { DataConfidenceBanner } from "@/app/_components/DataConfidenceBanner";
import { Card, MetricTile, ModuleHeader, Pill, Tabs } from "@/app/_components/modkit";
import { buildObjections, buildFamilyQuotes, publicQuotes, quoteOfWeek } from "@/lib/admissions/ingest";
import { pipelineNumbers, themeFrequencies, topObjections, sentimentRatio } from "@/lib/admissions/metrics";
import { stubBrief, bridgeHitRate, type ContentBrief } from "@/lib/admissions/bridge";
import { seedFeedback, closureRate, canViewDecisionQueue } from "@/lib/admissions/feedback";
import { decisionStatusHref, decisionStatusLabel } from "@/lib/decisions/routes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admissions & Voice of Customer | GT Marketing Hub" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "objections", label: "Objection log" },
  { key: "bridge", label: "Content bridge" },
  { key: "voice", label: "Voice of Families" },
  { key: "feedback", label: "Feedback loop" },
] as const;

type TabKey = (typeof TABS)[number]["key"];
const hrefFor = (tab: TabKey) => (tab === "overview" ? "/m/admissions" : `/m/admissions?tab=${tab}`);

const TREND_ARROW = { up: "↑", stable: "→", down: "↓" } as const;

export default async function AdmissionsPage({
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
  const asOf = ds.manifest.generatedAt;
  const thresholdPct = Number((parityThreshold() * 100).toFixed(2));
  const banner = seedBannerState(ds.field_state, thresholdPct);

  const objections = buildObjections(ds);
  const quotes = buildFamilyQuotes(ds);
  const pipeline = pipelineNumbers(ds.families);
  const freqs = themeFrequencies(objections, asOf);
  const top = topObjections(objections, asOf);
  const feedback = seedFeedback(asOf);
  const closure = closureRate(feedback);
  const flags = ds.decisions.length; // stand-in for inbound hot-family chips

  // Build the bridge for the top theme + one published example for hit-rate.
  let briefs: ContentBrief[] = [];
  if (top[0]) {
    const stub = stubBrief(briefs, top[0].theme, [top[0].exampleVerbatim ?? ""], top[0].cumulative, asOf, "high");
    briefs = stub.briefs;
  }
  const publishedBriefs = briefs.map((b, i) => (i === 0 ? { ...b, status: "published" as const, publishedAt: asOf, freqAfter: Math.max(0, b.freqBefore - 1) } : b));
  const hitRate = bridgeHitRate(publishedBriefs);

  const pubQuotes = publicQuotes(quotes);
  const qow = quoteOfWeek(quotes);
  const sent = sentimentRatio(pubQuotes);

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <ModuleHeader
        moduleN={9}
        title="Admissions & Voice of Customer"
        blurb="The feedback-to-marketing loop: objections logged as real spans (de-duped, theme-validated), the objection→content bridge, consent-gated Voice of Families, and a closure-tracked feedback loop. Pipeline numbers read app_form; quotes never surface without consent."
        viewerName={viewer.name}
        viewerTitle={viewer.title}
        viewerRole={viewer.role}
      />

      <div className="mx-auto max-w-[1280px] px-5 py-6 sm:px-7 lg:px-9">
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            <DataConfidenceBanner state={banner} />

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Applicants" value={pipeline.applicants.toLocaleString()} note="from app_form funnel_stage" tone="neutral" />
              <MetricTile label="Shadow days" value={pipeline.shadowDays.toLocaleString()} note="funnel_stage = shadow_day" tone="neutral" />
              <MetricTile label="Top objections" value={String(freqs.length)} note="distinct themes logged" tone="watch" />
              <MetricTile label="Closure rate" value={`${Math.round(closure * 100)}%`} note="feedback actioned ≤7d" tone={closure >= 0.5 ? "good" : "risk"} />
            </section>

            <Tabs tabs={TABS} active={activeTab} hrefFor={hrefFor} />

            {activeTab === "overview" && (
              <Card title="Top objections this period" note={`${flags} inbound hot-family/decision signals · pipeline reads app_form`}>
                <div className="space-y-2">
                  {top.map((t) => (
                    <div key={t.theme} className="flex items-center justify-between rounded-card border border-hairline bg-canvas px-3 py-2">
                      <div>
                        <p className="text-[13px] font-semibold text-ink">{t.theme.replace("_", " ")}</p>
                        <p className="text-[12px] text-muted">{t.exampleVerbatim}</p>
                      </div>
                      <Pill tone={t.trend === "up" ? "risk" : t.trend === "down" ? "good" : "neutral"}>
                        {t.cumulative} {TREND_ARROW[t.trend]}
                      </Pill>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {activeTab === "objections" && (
              <Card title="Objection log" note="Closed 8-theme set. One objection = one tagged span; re-surfaced threads do not inflate frequency.">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-label">
                        <th className="py-2 pr-3 font-semibold">Theme</th>
                        <th className="py-2 pr-3 font-semibold">This/prior</th>
                        <th className="py-2 pr-3 font-semibold">Trend</th>
                        <th className="py-2 font-semibold">Example verbatim</th>
                      </tr>
                    </thead>
                    <tbody>
                      {freqs.map((f) => (
                        <tr key={f.theme} className="border-b border-hairline">
                          <td className="py-2 pr-3 font-semibold text-ink">{f.theme.replace("_", " ")}</td>
                          <td className="mono num py-2 pr-3 text-muted">{f.thisPeriod}/{f.priorPeriod}</td>
                          <td className="py-2 pr-3">
                            <Pill tone={f.trend === "up" ? "risk" : f.trend === "down" ? "good" : "neutral"}>{TREND_ARROW[f.trend]} {f.trend}</Pill>
                          </td>
                          <td className="py-2 text-[12px] text-muted">{f.exampleVerbatim}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {activeTab === "bridge" && (
              <Card title="Objection→content bridge" note="One open brief per theme (idempotent). Effectiveness is a correlational pre/post delta — never a causal claim.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetricTile label="Bridge hit-rate" value={`${Math.round(hitRate * 100)}%`} note="briefs produced ÷ sent" tone="neutral" />
                  <MetricTile label="Open briefs" value={String(publishedBriefs.filter((b) => b.status === "open").length)} note="awaiting production" tone="watch" />
                </div>
                <div className="mt-3 space-y-2">
                  {publishedBriefs.map((b) => (
                    <div key={b.id} className="rounded-card border border-hairline bg-canvas p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-semibold text-ink">Brief: {b.objectionTheme.replace("_", " ")}</p>
                        <Pill tone={b.status === "published" ? "good" : "watch"}>{b.status}</Pill>
                      </div>
                      <p className="mt-1 text-[12px] text-muted">{b.suggestedAngle}</p>
                      {b.freqAfter !== null && (
                        <p className="mt-1 text-[12px] text-muted">
                          freq {b.freqBefore} → {b.freqAfter} (correlational, 14-day window)
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {activeTab === "voice" && (
              <Card title="Voice of Families (consent-gated)" note="Only consented + redacted quotes surface. Unconsented quotes never appear here or on Home.">
                {qow && (
                  <div className="mb-3 rounded-card border border-gold bg-amber-soft p-3">
                    <p className="mono text-[11px] font-semibold text-label">Quote of the week</p>
                    <p className="mt-1 text-[14px] font-semibold text-ink">&ldquo;{qow.quote}&rdquo;</p>
                  </div>
                )}
                <div className="mb-3 flex gap-2">
                  <Pill tone="good">pos {sent.pos}</Pill>
                  <Pill tone="risk">neg {sent.neg}</Pill>
                  <Pill tone="neutral">neutral {sent.neutral}</Pill>
                </div>
                <div className="space-y-2">
                  {pubQuotes.map((q) => (
                    <div key={q.id} className="rounded-card border border-hairline bg-canvas p-3">
                      <p className="text-[13px] text-ink">&ldquo;{q.quote}&rdquo;</p>
                      <p className="mt-1 text-[11px] text-muted">{q.source} · consented{q.redacted ? " · redacted" : ""}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {activeTab === "feedback" && (
              <Card title="Feedback-to-marketing loop" note="Actionable items chip into Nurture and submit to the Decision Queue. Closure rate keeps it from being write-only.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetricTile label="Closure rate" value={`${Math.round(closure * 100)}%`} note="actioned ≤7d ÷ flagged" tone={closure >= 0.5 ? "good" : "risk"} />
                  <MetricTile label="Open items" value={String(feedback.filter((f) => f.status === "open").length)} note="awaiting action" tone="watch" />
                </div>
                <div className="mt-3 space-y-2">
                  {feedback.map((f) => (
                    <div key={f.id} className="rounded-card border border-hairline bg-canvas p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-semibold text-ink">{f.category.replace("_", " ")}</p>
                        <Pill tone={f.status === "actioned" ? "good" : f.status === "open" ? "watch" : "neutral"}>{f.status}</Pill>
                      </div>
                      <p className="mt-1 text-[12px] text-muted">{f.note}</p>
                      {f.actionable && <p className="mt-1 text-[11px] text-gold">→ chip in Nurture{f.decisionId ? " · submitted to Decision Queue" : ""}</p>}
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
                <li>Objections from HubSpot Conversations + manual; de-duped per thread.</li>
                <li>Pipeline numbers read app_form funnel_stage — never HubSpot lifecycle.</li>
                <li>Quotes never surface without consent (Home + Voice of Families).</li>
                <li>Bridge effect is correlational (pre/post delta), not a causal claim.</li>
              </ul>
            </section>
            <section className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
              <h2 className="font-serif text-[18px] font-semibold text-ink">Your access</h2>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">
                {canViewDecisionQueue(viewer.role)
                  ? "Leader: act on Decision Queue items raised from feedback."
                  : "Operator/Admin: you may submit feedback to the Decision Queue but not view/act on it here."}
              </p>
              <Link href={decisionStatusHref(viewer.role)} className="mt-3 inline-flex text-[12px] font-semibold text-gold hover:underline">
                {decisionStatusLabel(viewer.role)} →
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
