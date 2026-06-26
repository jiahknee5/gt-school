import Link from "next/link";
import { MODULES, TINT_CLASS, moduleHref } from "@/lib/modules";
import {
  DEMO_USERS,
  PHASE2_REQUIREMENT_AUDIT,
  WIDGET_LIBRARY,
  type DemoUser,
  type Role,
  buildConfidenceBanner,
  ensureBudgetVarianceDecision,
  summarizeBudget,
  summarizeGtChallengeCampaign,
} from "@/lib/phase2";
import { generate } from "@/lib/seed/generate";
import { getSession } from "@/lib/auth";
import { withoutProgram } from "@/lib/db";
import { layoutForUser, resolveHomeWidgets } from "@/lib/home/layout";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const percent = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

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

function MetricTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
      <p className="text-[12px] font-semibold text-muted">{label}</p>
      <p className="mono num mt-2 text-[24px] font-semibold leading-none text-ink">
        {value}
      </p>
      <p className="mt-2 text-[12px] leading-snug text-muted">{note}</p>
    </div>
  );
}

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
    <div className="rounded-card border border-gold bg-amber-soft p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[13px] font-semibold text-ink">Data confidence needs review</p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate">{cleanCopy(message)}</p>
        </div>
        <Link
          href={href}
          className="inline-flex h-9 items-center justify-center rounded-card bg-ink-cta px-3 text-[12px] font-semibold text-on-cta transition-transform active:translate-y-px"
        >
          Open CRM Ops
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {fields.slice(0, 4).map((field) => (
          <span
            key={field.field}
            className="mono rounded-card border border-border bg-surface px-2 py-1 text-[11px] text-ink"
          >
            {field.field}: {percent.format(field.pct)}%
            {field.expectedUnreliable ? " expected unreliable" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export default async function Home() {
  const session = await getSession();
  const dataset = generate({ seed: 424242, families: 1200 });
  const viewer = session ?? DEMO_USERS.find((user) => user.role === "leader") ?? DEMO_USERS[0];
  const canViewDecisions = viewer.role === "leader";
  const layout = await readHomeLayout(viewer, Boolean(session));
  const widgets = resolveHomeWidgets(layout.widgets);
  const budget = summarizeBudget(dataset.budget_workstream);
  const decisions = ensureBudgetVarianceDecision(dataset.budget_workstream, dataset.decisions);
  const openDecisions = canViewDecisions
    ? decisions.filter((decision) => decision.status === "open")
    : [];
  const confidence = buildConfidenceBanner(dataset.field_state);
  const challenge = summarizeGtChallengeCampaign(dataset.meta_insights, dataset.families);
  const deposits = dataset.enrollments.filter(
    (row) => row.program_key === "fall_enrollment" && row.paid,
  ).length;
  const topSource = sourceCount(dataset.families)[0];
  const tierRows = dataset.field_state.filter((row) => row.field === "engagement_tier");
  const tierCounts = sourceCount(
    tierRows.map((row) => ({ source: row.app_value ?? "unknown" })),
  );

  const widgetValues: Record<string, { value: string; note: string }> = {
    "applicants-total": {
      value: compact.format(dataset.families.length),
      note: "Supabase app_form applicant pool",
    },
    "deposits-goal": {
      value: `${deposits}/180`,
      note: "Fall goal pacing from the app source of truth",
    },
    "conversion-channel": {
      value: topSource ? `${topSource[0]} ${percent.format((topSource[1] / dataset.families.length) * 100)}%` : "No source",
      note: "Top acquisition source, not HubSpot report copy",
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
  };

  const spineModules = [
    { slug: "budget", label: "Budget", note: "$365K reconciled spend and variance alerts" },
    { slug: "crm-ops", label: "CRM Ops", note: "Parity, UTM health, and data quality queue" },
    ...(canViewDecisions
      ? [{ slug: "decisions", label: "Decision Queue", note: "Leader-only approve, reject, need-info flow" }]
      : []),
    { slug: "gt-challenge", label: "GT Challenge", note: "Quiz lead capture, scoring, routing, CAC loop" },
  ];

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <section className="border-b border-hairline bg-[linear-gradient(135deg,var(--paper)_0%,var(--paper)_55%,var(--fill)_100%)]">
        <div className="mx-auto max-w-[1280px] px-5 py-8 sm:px-7 lg:px-9">
          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
            <div>
              <p className="mono text-[12px] font-semibold text-gold">Phase 2 product spine</p>
              <h1 className="mt-2 max-w-[760px] font-serif text-[36px] font-semibold leading-tight text-ink sm:text-[44px]">
                One trustworthy operating room for GT marketing.
              </h1>
              <p className="mt-3 max-w-[720px] text-[15px] leading-relaxed text-slate">
                Home widgets, budget reconciliation, CRM confidence, decisions, and the GT Challenge now read from the same seeded backbone.
              </p>
            </div>
            <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
              <p className="text-[12px] font-semibold text-muted">Active role</p>
              <p className="mt-2 text-[18px] font-semibold text-ink">{viewer.name}</p>
              <p className="text-[13px] text-muted">{viewer.title}</p>
              <p className="mono mt-4 inline-flex rounded-card border border-hairline bg-canvas px-2.5 py-1.5 text-[11px] font-semibold text-ink">
                {viewer.role}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile
              label="Budget actual"
              value={money.format(budget.totals.actual)}
              note={`${money.format(budget.totals.remaining)} remaining against planned spend`}
            />
            <MetricTile
              label={canViewDecisions ? "Open decisions" : "Decision access"}
              value={canViewDecisions ? String(openDecisions.length) : "Restricted"}
              note={
                canViewDecisions
                  ? `${openDecisions.filter((decision) => decision.auto_flag).length} auto-flagged by system rules`
                  : "Current role can submit requests, not view the leadership queue"
              }
            />
            <MetricTile
              label="CRM confidence"
              value={`${percent.format(confidence.overallPct)}%`}
              note={`${confidence.below.length} fields below threshold`}
            />
            <MetricTile
              label="GT Challenge CPQL"
              value={challenge.costPerQualifiedLead ? money.format(challenge.costPerQualifiedLead) : "n/a"}
              note={`${challenge.qualifiedLeads} CRM-qualified leads from ${challenge.platformLeads} platform leads`}
            />
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1280px] gap-6 px-5 py-6 sm:px-7 lg:grid-cols-[1fr_340px] lg:px-9">
        <div className="space-y-6">
          {confidence.show && (
            <ConfidenceBanner
              message={confidence.message}
              href={confidence.href}
              fields={confidence.below}
            />
          )}

          <section className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-serif text-[24px] font-semibold text-ink">Home widgets</h2>
                <p className="mt-1 text-[13px] text-muted">
                  {layout.persisted
                    ? "Saved layout for this signed-in role lens."
                    : "Starter pack for the weekly meeting, personalized by role."}
                </p>
              </div>
              <span className="mono w-fit rounded-card bg-fill px-2 py-1 text-[11px] font-semibold text-slate">
                {WIDGET_LIBRARY.length} widgets
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                    className={`rounded-card border border-hairline bg-canvas p-4 ${
                      item.size === "large" ? "md:col-span-2 xl:col-span-3" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-semibold text-ink">
                          {widget?.label ?? "Unavailable widget"}
                        </p>
                        <p className="mt-1 text-[12px] text-muted">
                          {widget?.category ?? item.widget_key}
                        </p>
                      </div>
                      <span className="mono shrink-0 rounded-card bg-fill px-2 py-1 text-[10px] text-slate">
                        {widget?.source ?? "Saved layout"}
                      </span>
                    </div>
                    <p className="mono num mt-5 text-[26px] font-semibold leading-none text-ink">
                      {data.value}
                    </p>
                    <p className="mt-2 text-[12px] leading-snug text-muted">{data.note}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-card border border-hairline bg-ink-cta p-5 text-on-cta shadow-sm">
              {canViewDecisions ? (
                <>
                  <h2 className="font-serif text-[24px] font-semibold">Decision preview</h2>
                  <p className="mt-2 text-[13px] leading-relaxed text-on-cta/80">
                    Leader-only queue cards land here so the meeting can close with rulings.
                  </p>
                  <div className="mt-5 space-y-3">
                    {openDecisions.slice(0, 2).map((decision) => (
                      <Link
                        key={decision.id}
                        href="/m/decisions"
                        className="block rounded-card border border-white/20 bg-white/10 p-3 transition-colors hover:bg-white/15"
                      >
                        <p className="text-[13px] font-semibold leading-snug">
                          {cleanCopy(decision.question)}
                        </p>
                        <p className="mono mt-2 text-[11px] text-on-cta/70">
                          {decision.priority} | {decision.workstream ?? "general"}
                        </p>
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="font-serif text-[24px] font-semibold">Decision Queue restricted</h2>
                  <p className="mt-2 text-[13px] leading-relaxed text-on-cta/80">
                    This role can submit decision requests, but the full queue and ruling controls are leadership-only.
                  </p>
                  <p className="mono mt-5 text-[11px] font-semibold text-on-cta/70">
                    Full queue hidden from this role
                  </p>
                </>
              )}
            </div>

            <div className="rounded-card border border-hairline bg-surface p-5 shadow-sm">
              <h2 className="font-serif text-[24px] font-semibold text-ink">Phase 2 audit</h2>
              <div className="mt-4 grid gap-2">
                {PHASE2_REQUIREMENT_AUDIT.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-2 rounded-card border border-hairline bg-canvas p-3 sm:grid-cols-[120px_1fr]"
                  >
                    <div>
                      <p className="mono text-[11px] font-semibold text-muted">{item.id}</p>
                      <span
                        className={`mt-2 inline-flex rounded-card px-2 py-1 text-[11px] font-semibold ${
                          item.status === "covered"
                            ? "bg-green-soft text-green"
                            : item.status === "partial"
                              ? "bg-amber-soft text-amber"
                              : "bg-red-soft text-red"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-ink">{item.requirement}</p>
                      <p className="mt-1 text-[12px] leading-snug text-muted">
                        {cleanCopy(item.evidence)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
            <h2 className="font-serif text-[22px] font-semibold text-ink">Module surfaces</h2>
            <div className="mt-4 space-y-2">
              {spineModules.map((item) => (
                <Link
                  key={item.slug}
                  href={`/m/${item.slug}`}
                  className="block rounded-card border border-hairline bg-canvas p-3 transition-colors hover:border-border hover:bg-hover"
                >
                  <p className="text-[13px] font-semibold text-ink">{item.label}</p>
                  <p className="mt-1 text-[12px] leading-snug text-muted">{item.note}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-card border border-hairline bg-surface p-4 shadow-sm">
            <h2 className="font-serif text-[22px] font-semibold text-ink">All PRD modules</h2>
            <div className="mt-4 grid gap-2">
              {MODULES.filter((module) => module.slug !== "home" && (!module.leaderOnly || canViewDecisions)).map((module) => (
                <Link
                  key={module.slug}
                  href={moduleHref(module.slug)}
                  className="flex items-center gap-2 rounded-card border border-hairline bg-canvas px-3 py-2 transition-colors hover:border-border hover:bg-hover"
                >
                  <span
                    className={`mono grid h-7 w-7 place-items-center rounded-card text-[12px] font-semibold ${TINT_CLASS[module.tint]}`}
                  >
                    {module.n}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-ink">
                      {module.short}
                    </span>
                    <span className="block truncate text-[11px] text-muted">{module.owner}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
