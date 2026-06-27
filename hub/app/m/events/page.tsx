// Module 8 — Field Marketing & Events. GT-organized events only, manual entry (no API in
// v1). event→consult is uninstrumented and always badged "manual v1" — never faked. The
// ambassador overlay is read-only (owned by Module 2) and excluded from GT-organized counts.
// Priority proposals submit exactly one Decision Queue row (Operators submit, can't view).
// Event spend rolls into a workstream actual — the $365K plan is unchanged.

import Link from "next/link";
import { generate } from "@/lib/seed/generate";
import { demoUserByRole } from "@/lib/phase2";
import { getSession } from "@/lib/auth";
import { Card, MetricTile, ModuleHeader, Pill, Tabs } from "@/app/_components/modkit";
import { PageObjective } from "@/app/_components/PageObjective";
import { Explain } from "@/app/_components/InfoTip";
import { FIELD_EVENTS } from "@/lib/events/data";
import {
  dedupeEvents,
  duplicateFlags,
  upcoming30d,
  completedThisMonth,
  attendanceRate,
  eventToConsult,
  topTypeByAttendance,
  staleEvents,
  spendByWorkstream,
} from "@/lib/events/metrics";
import { buildCalendar, gtOrganizedCount } from "@/lib/events/calendar";
import { SEED_PROPOSALS, canViewDecisionQueue, canEditEvents } from "@/lib/events/proposals";
import { decisionStatusHref, decisionStatusLabel } from "@/lib/decisions/routes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Field Marketing & Events | GT Marketing Hub" };

const ASOF = "2026-07-01";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "tracker", label: "Event tracker" },
  { key: "calendar", label: "Calendar" },
  { key: "proposals", label: "Priority events" },
] as const;

type TabKey = (typeof TABS)[number]["key"];
const hrefFor = (tab: TabKey) => (tab === "overview" ? "/m/events" : `/m/events?tab=${tab}`);

const fmt = (n: number) => n.toLocaleString();
const usd = (n: number) => `$${n.toLocaleString()}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

export default async function EventsPage({
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

  const events = dedupeEvents(FIELD_EVENTS);
  const dupes = duplicateFlags(FIELD_EVENTS);
  const upcoming = upcoming30d(ASOF);
  const completed = completedThisMonth(ASOF);
  const attRate = attendanceRate();
  const e2c = eventToConsult();
  const topTypes = topTypeByAttendance();
  const stale = staleEvents(ASOF);
  const spend = spendByWorkstream();
  const calendar = buildCalendar();
  const gtCount = gtOrganizedCount(calendar);
  const budgetTotal = ds.budget_workstream.reduce((a, w) => a + w.recommended, 0);

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <ModuleHeader
        moduleN={8}
        title="Field Marketing & Events"
        blurb="GT-organized events only — Shadow Days, chess, AMAs, festivals, webinars — captured by manual entry (no API in v1). Event→consult is uninstrumented and shown with a loud 'manual v1' badge, never faked. Ambassador events appear read-only from Grassroots and are never counted here; event spend rolls into a workstream so the $365K plan stays intact."
        viewerName={viewer.name}
        viewerTitle={viewer.title}
        viewerRole={viewer.role}
      />

      <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            <PageObjective slug="events" />
            <section role="note" className="rounded-card border border-hairline bg-fill p-2.5 text-[11px] leading-snug text-slate">
              <span className="font-semibold text-ink">Events source note:</span> GT-organized events are manual-entry
              records, not HubSpot-consuming rows. This module does not mount the shared CRM Ops data-confidence banner,
              and event→consult is <span className="font-semibold">uninstrumented in v1</span>.
            </section>

            <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="relative">
                <MetricTile label="Upcoming (30d)" value={fmt(upcoming.length)} note="event_date within +30d" tone="neutral" />
                <span className="absolute right-1.5 top-1.5"><Explain k="events.upcoming" /></span>
              </div>
              <div className="relative">
                <MetricTile label="Completed this month" value={fmt(completed.length)} note="status = completed" tone="good" />
                <span className="absolute right-1.5 top-1.5"><Explain k="events.completed" /></span>
              </div>
              <div className="relative">
                <MetricTile label="Attendance rate" value={pct(attRate)} note="Σ attendance / Σ rsvp" tone="neutral" />
                <span className="absolute right-1.5 top-1.5"><Explain k="events.attendance" /></span>
              </div>
              <div className="relative">
                <MetricTile label="Event→consult" value={pct(e2c.rate)} note="manual v1 · uninstrumented" tone="watch" />
                <span className="absolute right-1.5 top-1.5"><Explain k="events.consult" /></span>
              </div>
            </section>

            <Tabs tabs={TABS} active={activeTab} hrefFor={hrefFor} />

            {activeTab === "overview" && (
              <>
                <Card title="Top type by attendance" note="Single metric definitions; figures compute purely from field_events.">
                  <div className="space-y-1">
                    {topTypes.map((t) => (
                      <div key={t.type} className="flex items-center justify-between border-b border-hairline py-1 text-[11px]">
                        <span className="text-ink">{t.type.replace("_", " ")}</span>
                        <span className="mono num text-muted">{fmt(t.attendance)} attended · {t.events} event(s)</span>
                      </div>
                    ))}
                  </div>
                </Card>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Card title="Event→consult (manual v1)" note="Uninstrumented estimate — auto-tracking is a deferred gap. Never labeled tracked.">
                    <div className="flex items-center gap-2">
                      <MetricTile label="Conversion" value={pct(e2c.rate)} note={`${e2c.consults} consults / ${e2c.rsvp} rsvp`} tone="watch" />
                    </div>
                    <Pill tone="watch">manual v1 / uninstrumented</Pill>
                  </Card>
                  <Card title="Budget reconcile" note="Event spend is a component of a workstream actual — no new line.">
                    {Object.entries(spend).map(([ws, amt]) => (
                      <div key={ws} className="flex items-center justify-between border-b border-hairline py-1 text-[11px]">
                        <span className="text-ink">{ws}</span>
                        <span className="mono num text-muted">{usd(amt)}</span>
                      </div>
                    ))}
                    <p className="mt-2 text-[11px] text-muted">Plan total: {usd(budgetTotal)} {budgetTotal === 365000 ? "✓" : "✗"}</p>
                  </Card>
                </div>
              </>
            )}

            {activeTab === "tracker" && (
              <Card title="Event tracker" note={`${dupes.length} duplicate (name+date) flag(s) · ${stale.length} stale/incomplete. Required fields validated on write.`}>
                {dupes.length > 0 && (
                  <div className="mb-2.5 rounded-card border border-amber-soft bg-amber-soft p-2 text-[11px] text-amber">
                    Duplicate flagged (not counted twice): {dupes.map((d) => `${d.name} (${d.eventDate})`).join(", ")}
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-hairline text-left text-[10px] uppercase tracking-wide text-label">
                        <th className="py-1 pr-2.5 font-semibold">Event</th>
                        <th className="py-1 pr-2.5 font-semibold">Type</th>
                        <th className="py-1 pr-2.5 font-semibold">Date</th>
                        <th className="py-1 pr-2.5 font-semibold">RSVP</th>
                        <th className="py-1 pr-2.5 font-semibold">Attended</th>
                        <th className="py-1 pr-2.5 font-semibold">Consults</th>
                        <th className="py-1 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((e) => (
                        <tr key={e.id} className="border-b border-hairline">
                          <td className="py-1 pr-2.5 font-semibold text-ink">{e.name}</td>
                          <td className="py-1 pr-2.5 text-muted">{e.type.replace("_", " ")}</td>
                          <td className="py-1 pr-2.5 text-muted">{e.eventDate}</td>
                          <td className="mono num py-1 pr-2.5 text-muted">{fmt(e.rsvpCount)}</td>
                          <td className="mono num py-1 pr-2.5 text-muted">{fmt(e.attendance)}</td>
                          <td className="mono num py-1 pr-2.5 text-muted">{fmt(e.consultsBooked)}</td>
                          <td className="py-1"><Pill tone={e.status === "completed" ? "good" : e.status === "planning" ? "watch" : "neutral"}>{e.status}</Pill></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {activeTab === "calendar" && (
              <Card title="Calendar" note={`${gtCount} GT-organized events. Ambassador events (read-only, from Grassroots) are shown distinctly and never counted here. Type encoded by color + text/shape.`}>
                <div className="space-y-1">
                  {calendar.map((c) => (
                    <div key={c.id} className="flex items-center justify-between border-b border-hairline py-1 text-[11px]">
                      <span className="flex items-center gap-2">
                        <span style={{ color: c.color }} className="font-semibold">{c.glyph}</span>
                        <span className="text-ink">{c.name}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-muted">{c.date}</span>
                        {c.readOnly ? <Pill tone="neutral">read-only</Pill> : <Pill tone="good">GT</Pill>}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {activeTab === "proposals" && (
              <Card title="Priority event proposals" note="Submit emits exactly one Decision Queue row (idempotent). Operators submit but cannot view/act on the queue.">
                <div className="space-y-1.5">
                  {SEED_PROPOSALS.map((p) => (
                    <div key={p.id} className="rounded-card border border-hairline bg-canvas p-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] font-semibold text-ink">{p.name}</p>
                        <Pill tone={p.status === "approved" ? "good" : p.status === "submitted" ? "watch" : "neutral"}>{p.status}</Pill>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">{p.rationale}</p>
                      <p className="mt-0.5 text-[11px] text-muted">{p.type} · {p.proposedDate} · ask {usd(p.budgetAsk)} · {p.workstreamKey}</p>
                    </div>
                  ))}
                </div>
                {!canViewDecisionQueue(viewer.role) && (
                  <p className="mt-2.5 text-[11px] text-red">You can submit proposals but cannot view/act on the Decision Queue (submit-only).</p>
                )}
              </Card>
            )}
          </div>

          <aside className="space-y-3">
            <section className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
              <h2 className="font-serif text-[13px] font-bold tracking-[-0.01em] text-ink">Source of truth</h2>
              <ul className="mt-2 space-y-1.5 text-[11px] leading-snug text-muted">
                <li>GT-organized events = manual Hub entry (no API in v1).</li>
                <li>Event→consult is uninstrumented — shown as a manual estimate.</li>
                <li>Ambassador events are read-only from Grassroots; never counted here.</li>
                <li>Event spend rolls into a workstream; the $365K plan is unchanged.</li>
              </ul>
            </section>
            <section className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
              <h2 className="font-serif text-[13px] font-bold tracking-[-0.01em] text-ink">Your access</h2>
              <p className="mt-1 text-[11px] leading-snug text-muted">
                {canEditEvents(viewer.role, true)
                  ? "Operator/Admin: add/edit events and submit proposals."
                  : "Read access. Event editing is limited to the Field & Events Owner + Admin."}
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
