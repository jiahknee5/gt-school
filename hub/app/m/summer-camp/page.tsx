// Module 4 — Summer Camp. A self-contained P&L built on dual-source reconciliation:
// summer.gt.school (primary: payments + status) ⇄ the registration form (alternate),
// collapsed by match_key into one golden record (counted once everywhere). Per-campus
// capacity is real (60/48/40/30); revenue is measured from Stripe; the roster (minors' PII)
// is role-gated; camp revenue stays OUT of the $365K budget.

import Link from "next/link";
import { generate } from "@/lib/seed/generate";
import { demoUserByRole } from "@/lib/phase2";
import { getSession } from "@/lib/auth";
import { Card, MetricTile, ModuleHeader, Pill, Bar, Tabs } from "@/app/_components/modkit";
import { reconcileFromDataset } from "@/lib/camp/reconcile";
import { capacityByCampus, campFunnel, campRevenue, topChannels, budgetUnchangedByCamp } from "@/lib/camp/metrics";
import { canViewRoster, canSetTarget, maskName } from "@/lib/camp/rbac";
import { decisionStatusHref, decisionStatusLabel } from "@/lib/decisions/routes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Summer Camp | GT Marketing Hub" };

const TARGET = 180_000; // Leader-set revenue target (stand-in default)

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "funnel", label: "Funnel" },
  { key: "content", label: "Content + campaigns" },
  { key: "sessions", label: "Sessions" },
] as const;

type TabKey = (typeof TABS)[number]["key"];
const hrefFor = (tab: TabKey) => (tab === "overview" ? "/m/summer-camp" : `/m/summer-camp?tab=${tab}`);

const fmt = (n: number) => n.toLocaleString();
const usd = (n: number) => `$${n.toLocaleString()}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

export default async function SummerCampPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; role?: string; campOwner?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
  const session = await getSession();
  const role = session?.role ?? (query.role as "admin" | "leader" | "operator" | undefined);
  const viewer = session ?? demoUserByRole(role);
  const activeTab: TabKey = TABS.find((t) => t.key === query.tab)?.key ?? "overview";

  const ds = generate({ seed: 424242, families: 1200 });

  const { resolved, conflicts } = reconcileFromDataset(ds);
  const campuses = capacityByCampus(resolved);
  const funnel = campFunnel(resolved);
  const revenue = campRevenue(ds, resolved, TARGET);
  const channels = topChannels(resolved);
  const budgetTotal = budgetUnchangedByCamp(ds);
  const campContent = ds.content_sheet.filter((c) => c.utm_campaign === "summer_camp_2026");
  const mergedCount = resolved.filter((r) => r.sourceFeeds.length === 2).length;
  const aggCapacity = campuses.reduce((a, c) => a + c.capacity, 0);
  const aggPaid = campuses.reduce((a, c) => a + c.paid, 0);

  const isCampOwner = session ? viewer.title === "Content Owner" : query.campOwner !== "false";
  const rosterAllowed = canViewRoster(viewer.role, isCampOwner);

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <ModuleHeader
        moduleN={4}
        title="Summer Camp"
        blurb="A self-contained P&L on dual-source reconciliation: summer.gt.school (primary) and the registration form (alternate) collapse by match_key into one golden record — counted once in capacity, funnel, and revenue. Per-campus capacity is real, revenue is measured from Stripe, and the roster (minors' PII) is role-gated."
        viewerName={viewer.name}
        viewerTitle={viewer.title}
        viewerRole={viewer.role}
      />

      <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            <section role="note" className="rounded-card border border-hairline bg-fill p-2.5 text-[11px] leading-snug text-slate">
              <span className="font-semibold text-ink">Camp source note:</span> Summer Camp reads summer.gt.school,
              the registration form, and Stripe camp payments. It is a separate P&amp;L and does not mount the shared
              HubSpot data-confidence banner.
            </section>
            {conflicts.length > 0 && (
              <section role="alert" className="rounded-card border border-red-soft bg-red-soft p-3 text-[12px] text-red">
                {conflicts.length} dual-source reconciliation conflict(s) — site value kept, raised as a data-quality issue (never averaged).
              </section>
            )}

            <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Capacity sold" value={pct(aggCapacity ? aggPaid / aggCapacity : 0)} note={`${aggPaid}/${aggCapacity} seats (sum of campuses)`} tone="neutral" />
              <MetricTile label="Cash revenue" value={usd(revenue.cashRevenue)} note={`${pct(revenue.pctToTarget)} of ${usd(revenue.target)} target`} tone={revenue.pctToTarget >= 0.5 ? "good" : "watch"} />
              <MetricTile label="Reconciled dupes" value={fmt(mergedCount)} note="site + form merged to one" tone="good" />
              <MetricTile label="Waitlist" value={fmt(campuses.reduce((a, c) => a + c.waitlist, 0))} note="status = waitlisted" tone="watch" />
            </section>

            <Tabs tabs={TABS} active={activeTab} hrefFor={hrefFor} />

            {activeTab === "overview" && (
              <>
                <Card title="Revenue vs target" note="Cash = Stripe succeeded payments (program=summer_camp). Booked = Σ resolved amount. Target is Leader-set.">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <MetricTile label="Cash (Stripe)" value={usd(revenue.cashRevenue)} note="cash truth" tone="good" />
                    <MetricTile label="Booked" value={usd(revenue.bookedRevenue)} note="expected" tone="neutral" />
                    <MetricTile label="Rev / family" value={usd(revenue.revenuePerFamily)} note={`${revenue.distinctFamilies} distinct families`} tone="neutral" />
                  </div>
                </Card>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Card title="Top channels (organic / owned only)" note="No ad-spend row — ads are paused. Shares sum to 100%.">
                    <div className="space-y-1">
                      {channels.map((c) => (
                        <div key={c.channel} className="flex items-center justify-between border-b border-hairline py-1 text-[11px]">
                          <span className="text-ink">{c.channel}</span>
                          <span className="mono num text-muted">{pct(c.pct)}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card title="P&L isolation" note="Camp is a separate P&L — it does not roll into the $365K marketing budget.">
                    <MetricTile label="Marketing budget total" value={usd(budgetTotal)} note="unchanged by camp activity" tone={budgetTotal === 365000 ? "good" : "risk"} />
                  </Card>
                </div>
              </>
            )}

            {activeTab === "funnel" && (
              <Card title="Registration funnel" note="Lead → Registered → Paid → Attended. Each family counted once (reconciled). Attended pending an attendance roster source.">
                <div className="space-y-1.5">
                  {([
                    ["Lead", funnel.lead],
                    ["Registered", funnel.registered],
                    ["Paid", funnel.paid],
                    ["Attended", funnel.attended],
                  ] as const).map(([label, n], i, arr) => {
                    const prev = i === 0 ? n : arr[i - 1][1];
                    const drop = prev > 0 ? 1 - n / prev : 0;
                    return (
                      <div key={label} className="rounded-card border border-hairline bg-canvas p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-semibold text-ink">{label}</span>
                          <span className="mono num text-[12px] text-ink">{fmt(n)}</span>
                        </div>
                        <Bar pct={funnel.lead > 0 ? (n / funnel.lead) * 100 : 0} tone={label === "Paid" ? "good" : "neutral"} />
                        {i > 0 && <p className="mt-0.5 text-[11px] text-muted">drop-off {pct(drop)} from {arr[i - 1][0]}</p>}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {activeTab === "content" && (
              <Card title="Camp content + campaigns" note="content_sheet filtered to utm_campaign=summer_camp_2026 (mirrors Module 3). Retiring a card archives to the Module 3 library.">
                {campContent.length > 0 ? (
                  <div className="space-y-1">
                    {campContent.map((c, i) => (
                      <div key={i} className="flex items-center justify-between border-b border-hairline py-1 text-[11px]">
                        <span className="text-ink">{c.piece}</span>
                        <Pill tone="neutral">{c.status}</Pill>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted">No camp-tagged content this window. Tag pieces with summer_camp_2026 in Module 3.</p>
                )}
                <Link href="/m/content" className="mt-2 inline-flex text-[11px] font-semibold text-gold hover:underline">
                  Open Content pipeline →
                </Link>
              </Card>
            )}

            {activeTab === "sessions" && (
              <Card title="Sessions — 4 campus cards" note="Per-campus capacity is real (Georgetown 60 / Austin 48 / Dallas 40 / Houston 30). Roster drill-in is role-gated (minors' PII).">
                <div className="grid gap-2 sm:grid-cols-2">
                  {campuses.map((c) => (
                    <div key={c.campusKey} className="rounded-card border border-hairline bg-canvas p-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[14px] font-semibold text-ink">{c.name}</p>
                        {c.overflow ? <Pill tone="risk">overflow</Pill> : <Pill tone="neutral">{c.capacity} cap</Pill>}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">{c.registered} registered · {c.paid} paid · {c.waitlist} waitlist</p>
                      <Bar pct={c.capacitySoldPct * 100} tone={c.capacitySoldPct > 0.9 ? "risk" : "good"} />
                      <p className="mt-0.5 text-[11px] text-muted">{pct(c.capacitySoldPct)} capacity sold</p>
                      {c.capacitySoldPct > 0.9 && <p className="mt-1 text-[11px] text-gold">→ auto-suggest: add a session? (Decision Queue)</p>}
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-card border border-hairline bg-surface p-3">
                  <p className="text-[12px] font-semibold text-ink">Roster + attendance (minors&rsquo; PII)</p>
                  {rosterAllowed ? (
                    <div className="mt-2 space-y-1">
                      {resolved.slice(0, 6).map((r) => (
                        <div key={r.resolvedKey} className="flex items-center justify-between border-b border-hairline py-1 text-[11px]">
                          <span className="text-ink">{maskName(r.matchKey)} · {r.campusName}</span>
                          <span className="text-muted">{r.weeks}wk · {r.funnelStage}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[12px] text-red">Denied — roster is gated to the camp Operator + Leader (minors&rsquo; PII).</p>
                  )}
                </div>
              </Card>
            )}
          </div>

          <aside className="space-y-3">
            <section className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
              <h2 className="font-serif text-[13px] font-bold tracking-[-0.01em] text-ink">Source of truth</h2>
              <ul className="mt-2 space-y-1.5 text-[11px] leading-snug text-muted">
                <li>summer.gt.school is primary (payment + status); form is alternate intake.</li>
                <li>One golden record per match_key + campus — counted once everywhere.</li>
                <li>Week conflict → site value kept + a data-quality issue (never averaged).</li>
                <li>Stripe is cash truth; site amount is booked/expected.</li>
                <li>Camp is a separate P&L — out of the $365K marketing budget.</li>
              </ul>
            </section>
            <section className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
              <h2 className="font-serif text-[13px] font-bold tracking-[-0.01em] text-ink">Your access</h2>
              <p className="mt-1 text-[11px] leading-snug text-muted">
                {canSetTarget(viewer.role)
                  ? "Leader: approve pricing/session changes and set the revenue target."
                  : "Operator/Admin: read/write camp; submit pricing + add-session proposals to the Decision Queue (Operators can't view/act on the full queue)."}
              </p>
              <Link href={decisionStatusHref(viewer.role)} className="mt-2 inline-flex text-[11px] font-semibold text-gold hover:underline">
                {decisionStatusLabel(viewer.role)} →
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
