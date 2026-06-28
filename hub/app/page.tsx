import Link from "next/link";
import {
  DEMO_USERS,
  MARKETING_KEY_DATES,
  WIDGET_LIBRARY,
  type DemoUser,
  type Role,
  buildConfidenceBanner,
  ensureBudgetVarianceDecision,
  summarizeBudget,
} from "@/lib/phase2";
import { loadDataset } from "@/lib/seed/load-dataset";
import { getSession } from "@/lib/auth";
import { withoutProgram } from "@/lib/db";
import { buildScorecard, type ScorecardRow } from "@/lib/dashboard/scorecard";
import { layoutForUser, resolveHomeWidgets } from "@/lib/home/layout";
import { guideBySlug } from "@/lib/help/guides";
import { PageObjective } from "@/app/_components/PageObjective";
import { availableWeeks, defaultReportingWeek } from "@/lib/metrics/registry";

export const dynamic = "force-dynamic";

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const percent = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatKpiValue(row: ScorecardRow | undefined): string {
  if (!row) return "n/a";
  if (row.unit === "pct") return `${Number(row.thisWeek.toFixed(1))}%`;
  if (row.unit === "ratio") return row.thisWeek.toFixed(2);
  return compact.format(row.thisWeek);
}

function formatKpiDelta(row: ScorecardRow | undefined): string {
  if (!row) return "No weekly KPI row";
  if (row.delta === 0) return "Flat vs last week";
  const sign = row.delta > 0 ? "+" : "";
  if (row.unit === "pct") return `${sign}${Number(row.delta.toFixed(1))} pts vs last week`;
  if (row.unit === "ratio") return `${sign}${row.delta.toFixed(2)} vs last week`;
  return `${sign}${compact.format(row.delta)} vs last week`;
}

function cleanCopy(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2192/g, "to")
    .replace(/\u2248/g, "about")
    .replace(/\u00b7/g, "|");
}

function sourceCount(rows: { source: string | null }[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const source = row.source ?? "unknown";
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

type HomeLayoutRow = {
  user_id: string;
  role: Role;
  widgets: unknown;
  version: number;
  updated_at: string | Date | null;
};

async function readHomeLayout(user: DemoUser, canReadDb: boolean) {
  if (!canReadDb || !process.env.APP_RW_DATABASE_URL) return layoutForUser(user);
  try {
    return await withoutProgram(async (sql) => {
      const rows = await sql<HomeLayoutRow[]>`
        select user_id, role, widgets, version, updated_at
        from home_layout
        where user_id = ${user.id}
        limit 1`;
      return layoutForUser(user, rows[0] ?? null);
    });
  } catch {
    return layoutForUser(user);
  }
}

type StartAction = { title: string; note: string; href: string };

function ConfidenceBanner({
  message,
  href,
  fields,
}: {
  message: string;
  href: string;
  fields: { field: string; pct: number; expectedUnreliable: boolean }[];
}) {
  return (
    <div className="rounded-card border border-gold bg-amber-soft p-3 shadow-sm">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[12px] font-semibold text-ink">Data confidence needs review</p>
          <p className="mt-1 text-[11px] leading-snug text-slate">{cleanCopy(message)}</p>
        </div>
        <Link
          href={href}
          className="inline-flex h-8 items-center justify-center rounded-card bg-ink-cta px-3 text-[11px] font-semibold text-on-cta transition-transform active:translate-y-px"
        >
          Open CRM Ops
        </Link>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {fields.slice(0, 4).map((field) => (
          <span
            key={field.field}
            className="mono rounded-card border border-border bg-surface px-1.5 py-0.5 text-[10px] text-ink"
          >
            {field.field}: {percent.format(field.pct)}%
            {field.expectedUnreliable ? " expected unreliable" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ week?: string }>;
} = {}) {
  const query = searchParams ? await searchParams : {};
  const session = await getSession();
  const dataset = await loadDataset({ seed: 424242, families: 1200 });
  const viewer = session ?? DEMO_USERS.find((user) => user.role === "leader") ?? DEMO_USERS[0];
  const canViewDecisions = viewer.role === "leader";
  const weeks = availableWeeks();
  const selectedWeek =
    query.week && weeks.includes(query.week) ? query.week : defaultReportingWeek();
  const scorecard = buildScorecard(dataset, selectedWeek);
  const kpis = new Map(scorecard.rows.map((row) => [row.key, row]));
  const layout = await readHomeLayout(viewer, Boolean(session));
  const widgets = resolveHomeWidgets(layout.widgets);
  const budget = summarizeBudget(dataset.budget_workstream);
  const decisions = ensureBudgetVarianceDecision(dataset.budget_workstream, dataset.decisions);
  const openDecisions = canViewDecisions
    ? decisions.filter((decision) => decision.status === "open")
    : [];
  const confidence = buildConfidenceBanner(dataset.field_state);
  const tierRows = dataset.field_state.filter((row) => row.field === "engagement_tier");
  const tierCounts = sourceCount(
    tierRows.map((row) => ({ source: row.app_value ?? "unknown" })),
  );
  const nextKeyDate =
    MARKETING_KEY_DATES.find((item) => item.date >= selectedWeek) ??
    MARKETING_KEY_DATES[MARKETING_KEY_DATES.length - 1];
  const applicantsKpi = kpis.get("applicants");
  const depositsKpi = kpis.get("deposits");
  const conversionKpi = kpis.get("conversion_top_channel");
  const ambassadorKpi = kpis.get("ambassador_influenced");
  const eventConsultKpi = kpis.get("event_to_consult");

  const widgetValues: Record<string, { value: string; note: string }> = {
    "applicants-total": {
      value: formatKpiValue(applicantsKpi),
      note: `${formatKpiDelta(applicantsKpi)} | week of ${selectedWeek}`,
    },
    "deposits-goal": {
      value: `${formatKpiValue(depositsKpi)}/${depositsKpi?.target ?? 55}`,
      note: `${formatKpiDelta(depositsKpi)} | weekly run-rate target`,
    },
    "conversion-channel": {
      value: formatKpiValue(conversionKpi),
      note: `${formatKpiDelta(conversionKpi)} | GA4 top-channel conversion`,
    },
    "tier-counts": {
      value: tierCounts
        .slice(0, 3)
        .map(([tier, count]) => `${tier}:${count}`)
        .join(" "),
      note: "T1, T2, and T3 read from seeded segmentation state",
    },
    "engagement-mix": {
      value: tierCounts[0]
        ? `${tierCounts[0][0]} ${percent.format((tierCounts[0][1] / Math.max(1, tierRows.length)) * 100)}%`
        : "No tier",
      note: "Engagement tier is a predictor, not a lever",
    },
    "sla-24": {
      value: `${dataset.sync_outbox.filter((row) => row.status === "pending").length} pending`,
      note: "HubSpot outbox items still awaiting processing",
    },
    "executive-narrative": {
      value: "Scale paid proof",
      note: "Working: K-2 TX signal. Stuck: UTM attribution drift.",
    },
    "workstream-health": {
      value: `${budget.rows.filter((row) => row.health === "at-risk").length} at risk`,
      note: "Budget health grid reads the same workstream rows as Module 10",
    },
    "decision-preview": {
      value: canViewDecisions ? `${openDecisions.length} open` : "Restricted",
      note: canViewDecisions
        ? "Leader-only preview from the Decision Queue"
        : "Leader-only preview hidden for this role",
    },
    "key-dates": {
      value: nextKeyDate ? shortDate.format(new Date(`${nextKeyDate.date}T00:00:00.000Z`)) : "No date",
      note: nextKeyDate
        ? `${nextKeyDate.label}: ${nextKeyDate.detail}`
        : "No configured campaign milestone.",
    },
    "ambassador-enrollments": {
      value: formatKpiValue(ambassadorKpi),
      note: `${formatKpiDelta(ambassadorKpi)} | week of ${selectedWeek}`,
    },
    "events-rsvps": {
      value: formatKpiValue(eventConsultKpi),
      note: `${formatKpiDelta(eventConsultKpi)} | manual event-to-consult KPI`,
    },
  };

  // Role-aware "Start here" launchpad — 2-3 next actions, reusing the cross-module
  // guides (lib/help/guides.ts). Home is where I act, so it leads with what to do next.
  const meetingGuide = guideBySlug("weekly-meeting");
  const raiseGuide = guideBySlug("raise-a-decision");
  const composeGuide = guideBySlug("compose-home");
  const startHere: StartAction[] = (
    canViewDecisions
      ? [
          meetingGuide && {
            title: "Run the Monday meeting",
            note: meetingGuide.objective,
            href: "/help/weekly-meeting",
          },
          {
            title: "Clear the decision queue",
            note: `${openDecisions.length} open — approve, reject, or request more info.`,
            href: "/m/decisions",
          },
          {
            title: "Open the shared scorecard",
            note: "The week's canonical numbers the whole team meets on.",
            href: "/m/dashboard",
          },
        ]
      : [
          raiseGuide && {
            title: "Raise a decision",
            note: raiseGuide.objective,
            href: "/m/submissions",
          },
          {
            title: "Track my submissions",
            note: "Follow the asks you raised through to a leadership ruling.",
            href: "/m/submissions",
          },
          composeGuide && {
            title: "Compose your Home",
            note: composeGuide.objective,
            href: "/help/compose-home",
          },
        ]
  ).filter(Boolean) as StartAction[];

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <section className="border-b border-hairline bg-[linear-gradient(135deg,var(--paper)_0%,var(--paper)_55%,var(--fill)_100%)]">
        <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
          <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">Your Home</p>
          <h1 className="mt-1 max-w-[760px] font-serif text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
            Your Home, {viewer.name} &mdash; your composable cockpit.
          </h1>
          <p className="mt-1.5 max-w-[720px] text-[12px] leading-snug text-slate">
            This layout is yours: add or remove widgets to match how you work, and act on what needs you.{" "}
            <Link href="/m/dashboard" className="font-semibold text-gold hover:underline">
              Looking for the numbers everyone references? &rarr; Dashboard / Weekly Standup.
            </Link>
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1280px] gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_320px] lg:px-8">
        <div className="space-y-3">
          <PageObjective slug="home" />

          {confidence.show && (
            <ConfidenceBanner
              message={confidence.message}
              href={confidence.href}
              fields={confidence.below}
            />
          )}

          <section className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-serif text-[15px] font-bold tracking-[-0.01em] text-ink">Home widgets</h2>
                <p className="mt-0.5 text-[11px] text-muted">
                  {layout.persisted
                    ? `Saved layout for this signed-in role lens | week of ${selectedWeek}.`
                    : `Starter pack for the weekly meeting, personalized by role | week of ${selectedWeek}.`}
                </p>
              </div>
              <span className="mono w-fit rounded-card bg-fill px-1.5 py-0.5 text-[10px] font-semibold text-slate">
                {WIDGET_LIBRARY.length} widgets
              </span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {widgets.map(({ item, widget }) => {
                const data = widget
                  ? widgetValues[widget.id] ?? {
                    value: widget.size,
                    note: `${widget.source} source`,
                  }
                  : {
                    value: item.size,
                    note: "Saved widget key is no longer available in the library",
                  };
                return (
                  <article
                    key={item.widget_key}
                    data-tour={widget?.id === "executive-narrative" ? "tour-executive-narrative" : undefined}
                    className={`rounded-card border border-hairline bg-canvas p-2.5 ${
                      item.size === "large" ? "md:col-span-2 xl:col-span-3" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[12px] font-semibold text-ink">
                          {widget?.label ?? "Unavailable widget"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {widget?.category ?? item.widget_key}
                        </p>
                      </div>
                      <span className="mono shrink-0 rounded-card bg-fill px-1.5 py-0.5 text-[10px] text-slate">
                        {widget?.source ?? "Saved layout"}
                      </span>
                    </div>
                    {widget?.id === "key-dates" ? (
                      <div className="mt-2 grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
                        {MARKETING_KEY_DATES.slice(0, 6).map((date) => {
                          const active = date.date === nextKeyDate?.date;
                          return (
                            <div
                              key={date.date}
                              className={`grid grid-cols-[48px_1fr] gap-2 rounded-card border px-2 py-1.5 ${
                                active
                                  ? "border-gold bg-amber-soft"
                                  : "border-hairline bg-surface"
                              }`}
                            >
                              <span className="mono text-[10px] font-semibold text-slate">
                                {shortDate.format(new Date(`${date.date}T00:00:00.000Z`))}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-[11px] font-semibold text-ink">
                                  {date.label}
                                </span>
                                <span className="block truncate text-[10px] text-muted">
                                  {date.owner}
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <>
                        <p className="mono num mt-2 text-[18px] font-bold leading-none text-ink">
                          {data.value}
                        </p>
                        <p className="mt-1 text-[11px] leading-snug text-muted">{data.note}</p>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-card border border-hairline bg-ink-cta p-3 text-on-cta shadow-sm">
            {canViewDecisions ? (
              <>
                <h2 className="font-serif text-[15px] font-bold tracking-[-0.01em]">Decision preview</h2>
                <p className="mt-1 text-[11px] leading-snug text-on-cta/80">
                  Leader-only queue cards land here so the meeting can close with rulings.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {openDecisions.slice(0, 2).map((decision) => (
                    <Link
                      key={decision.id}
                      href="/m/decisions"
                      className="block rounded-card border border-white/20 bg-white/10 p-2.5 transition-colors hover:bg-white/15"
                    >
                      <p className="text-[12px] font-semibold leading-snug">
                        {cleanCopy(decision.question)}
                      </p>
                      <p className="mono mt-1 text-[10px] text-on-cta/70">
                        {decision.priority} | {decision.workstream ?? "general"}
                      </p>
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="font-serif text-[15px] font-bold tracking-[-0.01em]">Decision Queue restricted</h2>
                <p className="mt-1 text-[11px] leading-snug text-on-cta/80">
                  This role can submit decision requests, but the full queue and ruling controls are leadership-only.
                </p>
                <p className="mono mt-3 text-[10px] font-semibold text-on-cta/70">
                  Full queue hidden from this role
                </p>
              </>
            )}
          </section>
        </div>

        <aside className="space-y-3">
          <section className="rounded-card border border-hairline bg-surface p-3 shadow-sm">
            <h2 className="font-serif text-[13px] font-bold tracking-[-0.01em] text-ink">Start here</h2>
            <p className="mt-0.5 text-[11px] text-muted">Your next actions, by role.</p>
            <div className="mt-2 space-y-1.5">
              {startHere.map((action) => (
                <Link
                  key={action.title}
                  href={action.href}
                  className="block rounded-card border border-hairline bg-canvas p-2.5 transition-colors hover:border-border hover:bg-hover"
                >
                  <p className="text-[12px] font-semibold text-ink">{action.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">{cleanCopy(action.note)}</p>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
