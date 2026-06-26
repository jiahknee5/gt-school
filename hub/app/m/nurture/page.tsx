// Module 5 — Nurture & Lifecycle. The most data-rich module and the Hub's engagement
// centre. SSOT: app_form (families) for funnel/TEFA/income/grade; HubSpot for engagement,
// pipeline, sequences, SMS. Engagement tier and conversion are computed from DISJOINT
// fields (no circularity). SMS is the highest-PII surface: raw phone/body are gated to
// Admin/Leader; Operators see masked phone and no body. Decision acts (hot-family,
// approve/kill) are Leader-only and land in the Decision Queue — never a HubSpot write.

import { generate } from "@/lib/seed/generate";
import { demoUserByRole } from "@/lib/phase2";
import { DEV_MODE, getSession } from "@/lib/auth";
import { parityThreshold } from "@/lib/parity";
import { seedBannerState } from "@/lib/crm-ops/parity-view";
import { DataConfidenceBanner } from "@/app/_components/DataConfidenceBanner";
import { Bar, Card, MetricTile, ModuleHeader, Pill, Tabs, toneClass } from "@/app/_components/modkit";
import { tierMix } from "@/lib/nurture/engagement";
import { buildHeatmap, tierConversion, MIN_CELL_N } from "@/lib/nurture/heatmap";
import { segmentSummaries, t3Buckets } from "@/lib/nurture/segments";
import { parentStageDistribution, handoffMetrics, stuckInStage } from "@/lib/nurture/pipeline";
import { buildSla, lateListByOwner } from "@/lib/nurture/sla";
import { buildInbox, filterInbox, canQuickReply } from "@/lib/nurture/sms";
import { sequenceHealth } from "@/lib/nurture/sequences";
import { canViewSmsPii, canActHotFamily, maskPhone } from "@/lib/nurture/rbac";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nurture & Lifecycle | GT Marketing Hub" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "segments", label: "Segments" },
  { key: "pipeline", label: "Pipeline" },
  { key: "sequences", label: "Sequences" },
  { key: "sms", label: "SMS inbox" },
  { key: "sla", label: "SLA tracker" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function hrefFor(tab: TabKey): string {
  return tab === "overview" ? "/m/nurture" : `/m/nurture?tab=${tab}`;
}

const pct = (n: number) => `${Number(n.toFixed(1))}%`;

export default async function NurturePage({
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

  const mix = tierMix(ds.families);
  const segments = segmentSummaries(ds.families);
  const sla = buildSla(ds.families, asOf);
  const handoff = handoffMetrics(ds.enrollments);
  const tierConv = tierConversion(ds.families);
  const showPii = canViewSmsPii(viewer.role);
  const canHot = canActHotFamily(viewer.role);

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <ModuleHeader
        moduleN={5}
        title="Nurture & Lifecycle"
        blurb="Segments, the engagement×attribute heatmap, pipeline + handoff, read-only sequence health, the PII-gated SMS inbox, and the 24-hour follow-up SLA. Engagement tier and conversion are measured from disjoint fields, so the heatmap is a real predictor — not a tautology."
        basePath="/m/nurture"
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
              <MetricTile label="Clicked tier" value={mix.clicked.toLocaleString()} note="Most engaged cohort" tone="good" />
              <MetricTile label="Cold tier" value={mix.cold.toLocaleString()} note="Re-engagement targets" tone="watch" />
              <MetricTile label="24h SLA" value={pct(sla.slaPct)} note={`${sla.contactedWithin24h}/${sla.newApplicants} new applicants`} tone={sla.slaPct >= 80 ? "good" : "risk"} />
              <MetricTile label="Handoff conv." value={pct(handoff.convRate * 100)} note={`${handoff.onboarded}/${handoff.handedOff} onboarded`} tone="neutral" />
            </section>

            <Tabs tabs={TABS} active={activeTab} hrefFor={hrefFor} />

            {activeTab === "overview" && (
              <Card title="Engagement tier is a measured conversion predictor" note="Tier reads HubSpot engagement; conversion reads app_form funnel. Disjoint by construction.">
                <div className="space-y-2">
                  {tierConv.map((t) => (
                    <div key={t.tier} className="grid grid-cols-[110px_1fr_70px] items-center gap-3">
                      <span className="text-[13px] font-semibold capitalize text-ink">{t.tier}</span>
                      <Bar pct={t.pct} tone={t.tier === "clicked" ? "good" : t.tier === "cold" ? "risk" : "watch"} />
                      <span className="mono num text-right text-[13px] text-ink">{pct(t.pct)}</span>
                    </div>
                  ))}
                  <p className="pt-2 text-[12px] text-muted">
                    n per tier: {tierConv.map((t) => `${t.tier} ${t.n}`).join(" · ")}
                  </p>
                </div>
              </Card>
            )}

            {activeTab === "segments" && (
              <div className="space-y-4">
                <Card title="Nurture segments + reachability" note="T1/T2/T3 read app_form (the SSOT). Reachability = share with an email on file.">
                  <div className="space-y-2">
                    {segments.map((s) => (
                      <div key={s.tier} className="flex items-center justify-between rounded-card border border-hairline bg-canvas px-3 py-2">
                        <div>
                          <p className="text-[13px] font-semibold text-ink">{s.tier} · {s.name}</p>
                          <p className="text-[12px] text-muted">{s.count.toLocaleString()} families · {pct(s.reachablePct)} reachable</p>
                        </div>
                        <Pill tone={s.reachablePct >= 90 ? "good" : "watch"}>{pct(s.reachablePct)}</Pill>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {t3Buckets(ds.families).map((b) => (
                      <Pill key={b.key} tone="neutral">{b.label}: {b.count}</Pill>
                    ))}
                  </div>
                </Card>
                <Heatmap families={ds.families} />
              </div>
            )}

            {activeTab === "pipeline" && (
              <Card title="Parent pipeline + marketing→onboarding handoff" note="Each fall deal counted once; parent and child are never merged. Handoff conversion ≤ 1.">
                <div className="space-y-2">
                  {parentStageDistribution(ds.enrollments).map((s) => (
                    <div key={s.stage} className="flex items-center justify-between border-b border-hairline py-2">
                      <span className="text-[13px] capitalize text-ink">{s.stage.replace("_", " ")}</span>
                      <span className="mono num text-[13px] text-ink">{s.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <Pill tone="neutral">Handed off: {handoff.handedOff}</Pill>
                  <Pill tone="good">Onboarded: {handoff.onboarded}</Pill>
                  <Pill tone="neutral">Conv: {pct(handoff.convRate * 100)}</Pill>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {stuckInStage(ds.enrollments, asOf).map((st) => (
                    <Pill key={st.stage} tone="watch">Stuck in {st.stage}: {st.count} (&gt;{st.thresholdDays}d)</Pill>
                  ))}
                </div>
              </Card>
            )}

            {activeTab === "sequences" && (
              <Card title="Sequence health (read-only)" note="HubSpot is the system of record. Approve/kill raises a Decision Queue item — it never mutates HubSpot.">
                <div className="space-y-2">
                  {sequenceHealth().map((s) => (
                    <div key={s.seqId} className="rounded-card border border-hairline bg-canvas p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-semibold text-ink">{s.name}</p>
                        <Pill tone={s.healthy ? "good" : "risk"}>{s.healthy ? "healthy" : "review"}</Pill>
                      </div>
                      <p className="mt-1 text-[12px] text-muted">
                        {s.type} · {s.audienceSize.toLocaleString()} in audience · open {pct(s.openRate * 100)} · click {pct(s.clickRate * 100)} · conv {pct(s.convRate * 100)}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <Pill tone="neutral">Approve → Decision</Pill>
                        <Pill tone="neutral">Kill → Decision</Pill>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {activeTab === "sms" && (
              <SmsInbox ds={ds} asOf={asOf} showPii={showPii} canHot={canHot} role={viewer.role} />
            )}

            {activeTab === "sla" && (
              <Card title="24-hour first-contact SLA" note="Clock starts at app_form funnel entry. SLA% = contacted within 24h ÷ new applicants. Late-list is owner-attributable.">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricTile label="SLA %" value={pct(sla.slaPct)} note="contacted within 24h" tone={sla.slaPct >= 80 ? "good" : "risk"} />
                  <MetricTile label="New applicants" value={sla.newApplicants.toLocaleString()} note="in the SLA window" tone="neutral" />
                  <MetricTile label="Late (uncontacted)" value={String(sla.lateList.length)} note=">24h, no first contact" tone={sla.lateList.length ? "risk" : "good"} />
                </div>
                <div className="mt-3">
                  <p className="mono text-[11px] font-semibold text-label">Red list by owner</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {lateListByOwner(sla).map((o) => (
                      <Pill key={o.owner} tone="risk">{o.owner}: {o.count}</Pill>
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </div>

          <aside className="space-y-4">
            <section className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
              <h2 className="font-serif text-[18px] font-semibold text-ink">Source of truth</h2>
              <ul className="mt-3 space-y-2 text-[12px] leading-relaxed text-muted">
                <li>Funnel / TEFA / income / grade read app_form (families) — never HubSpot values.</li>
                <li>Engagement tier reads HubSpot signals only; conversion reads funnel only.</li>
                <li>Sequences are read-only; approve/kill raises a Decision, not a HubSpot write.</li>
                <li>Heatmap cells with n&lt;{MIN_CELL_N} are suppressed, never reported.</li>
              </ul>
            </section>
            <section className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
              <h2 className="font-serif text-[18px] font-semibold text-ink">Your access</h2>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">
                {showPii
                  ? "Admin/Leader: raw SMS phone + body visible."
                  : "Operator: SMS phone masked, message body hidden (PII gate)."}
                {canHot ? " You may act on hot-family decisions." : " Hot-family decisions are Leader-only."}
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Heatmap({ families }: { families: ReturnType<typeof generate>["families"] }) {
  const heat = buildHeatmap(families, "income_band");
  const tiers = ["clicked", "opened", "cold"] as const;
  return (
    <Card title="Engagement × income conversion heatmap" note={`Cell = commit% + n (Wilson 95% CI). Cells with n<${MIN_CELL_N} are suppressed.`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[12px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-label">
              <th className="py-2 pr-3 font-semibold">tier \ income</th>
              {heat.cols.map((c) => (
                <th key={c} className="py-2 pr-3 font-semibold">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier) => (
              <tr key={tier} className="border-t border-hairline">
                <td className="py-2 pr-3 font-semibold capitalize text-ink">{tier}</td>
                {heat.cols.map((col) => {
                  const cell = heat.cells.find((x) => x.tier === tier && x.col === col)!;
                  if (cell.suppressed) {
                    return (
                      <td key={col} className="py-2 pr-3 text-muted" title={`n=${cell.n} (suppressed)`}>
                        <span className="mono text-[11px]">n&lt;{MIN_CELL_N}</span>
                      </td>
                    );
                  }
                  const tone = (cell.pct ?? 0) >= 30 ? "good" : (cell.pct ?? 0) >= 15 ? "watch" : "risk";
                  return (
                    <td key={col} className="py-2 pr-3">
                      <span className={`mono inline-flex rounded-card border px-2 py-1 text-[11px] font-semibold ${toneClass(tone)}`}>
                        {cell.pct}% ±{cell.ci} · n{cell.n}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SmsInbox({
  ds,
  asOf,
  showPii,
  canHot,
  role,
}: {
  ds: ReturnType<typeof generate>;
  asOf: string;
  showPii: boolean;
  canHot: boolean;
  role: string;
}) {
  const inbox = buildInbox(ds.families, asOf);
  const objections = filterInbox(inbox, "objection");
  return (
    <Card
      title="SMS inbox (PII-gated)"
      note="GT Anywhere / HubSpot Conversations. v1 keyword theming. STOP suppresses quick-reply. Raw phone/body gated to Admin/Leader."
      right={<Pill tone={showPii ? "good" : "watch"}>{showPii ? "PII visible" : "PII masked"}</Pill>}
    >
      <p className="mb-3 text-[12px] text-muted">
        {objections.length} objection thread(s) · viewing as {role}
      </p>
      <div className="space-y-2">
        {inbox.slice(0, 8).map((t) => (
          <div key={t.threadId} className="rounded-card border border-hairline bg-canvas p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="mono text-[12px] font-semibold text-ink">
                {showPii ? t.responderPhone ?? "(no phone)" : maskPhone(t.responderPhone)}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {t.themes.map((th) => (
                  <Pill key={th} tone={th === "tuition" ? "risk" : th === "opt_out" ? "watch" : "neutral"}>{th}</Pill>
                ))}
                {t.unread && <Pill tone="watch">unread</Pill>}
              </div>
            </div>
            <p className="mt-1 text-[13px] leading-snug text-ink">
              {showPii ? t.body : "[message body hidden — Admin/Leader only]"}
            </p>
            <div className="mt-2 flex gap-2">
              {canQuickReply(t) ? (
                <Pill tone="neutral">Quick reply</Pill>
              ) : (
                <Pill tone="risk">Opted out (STOP)</Pill>
              )}
              <Pill tone={canHot ? "good" : "neutral"}>
                {canHot ? "Flag hot-family → Decision" : "Flag (Leader-only)"}
              </Pill>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
