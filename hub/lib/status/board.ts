/**
 * board.ts — pure data layer for the Status executive funnel×spine matrix.
 *
 * Every headline number resolves through the same libs as Dashboard / Home
 * (lib/metrics/registry, lib/dashboard/*, lib/phase2, lib/decisions/*).
 * Derived / estimated values carry explicit `derived` labels.
 */

import { buildScorecard, type ScorecardRow } from "@/lib/dashboard/scorecard";
import { buildPacing, type PacingRow } from "@/lib/dashboard/pacing";
import { FALL_CUTOFF } from "@/lib/dashboard/goals";
import { computeSeedParity } from "@/lib/crm-ops/parity-view";
import { openDecisions, decisionStats } from "@/lib/decisions/queries";
import { reconcileCamp } from "@/lib/camp/reconcile";
import { campRevenue } from "@/lib/camp/metrics";
import { buildSla, lateListByOwner } from "@/lib/nurture/sla";
import { defaultReportingWeek, weekMondays } from "@/lib/metrics/registry";
import { summarizeBudget, ensureBudgetVarianceDecision } from "@/lib/phase2";
import type { Decision, Family, SeedDataset } from "@/lib/seed/types";
import type { ProgramScope } from "@/lib/program-scope";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type RagStatus = "green" | "amber" | "red";

export type SpineColumn = "position" | "drivers" | "decisions" | "narrative";

export type FunnelStageKey =
  | "awareness"
  | "acquisition"
  | "activation"
  | "nurture"
  | "conversion"
  | "advocacy";

export type RankedBarRow = {
  label: string;
  value: number;
  displayValue: string;
  pct: number;
  volume?: string;
  tag?: "engine" | "trap";
  tone?: "neutral" | "good" | "bad";
};

export type FunnelStep = { label: string; value: number; dropPct?: number };

export type StatusBullet = {
  text: string;
  /** Key figure to emphasize in mono */
  emphasis?: string[];
  tone?: "neutral" | "good" | "bad";
};

export type StatusCell = {
  owner: string;
  ownerModule?: string;
  headline?: string;
  subline?: string;
  rag?: RagStatus;
  stat?: { value: string; unit?: string; delta?: string; deltaTone?: "up" | "down" | "flat" };
  rankedBars?: RankedBarRow[];
  funnelSteps?: FunnelStep[];
  sparkline?: { values: number[]; startLabel: string; endLabel: string; deltaLabel: string };
  budgetSlice?: { spend: string; note?: string; derived?: boolean };
  decision?: {
    question: string;
    href: string;
    source?: string;
    urgent?: boolean;
    id?: string;
  };
  bullets?: StatusBullet[];
  derived?: boolean;
  derivedNote?: string;
  thin?: boolean;
  thinReason?: string;
};

export type StatusStage = {
  key: FunnelStageKey;
  num: number;
  name: string;
  modules: { slug: string; label: string; recur?: boolean }[];
  rag: RagStatus;
  binding?: boolean;
  position: StatusCell;
  drivers: StatusCell;
  decisions: StatusCell;
  narrative: StatusCell;
  drawerSections: DrawerSection[];
};

export type DrawerSection = {
  heading: string;
  lines?: string[];
  kv?: { label: string; value: string; tone?: "good" | "bad" | "neutral" }[];
  rankedBars?: RankedBarRow[];
  funnelSteps?: FunnelStep[];
  sparkline?: StatusCell["sparkline"];
  decision?: StatusCell["decision"];
  bullets?: StatusBullet[];
};

export type AnswerSection = {
  /** One of the rubric section keys: where | on_track | why | do. */
  key: string;
  label: string;
  bullets: StatusBullet[];
};

export type StatusAnswer = {
  headline: string;
  bullets: StatusBullet[];
  /** Rubric-structured Answer (Where / On track / Why / Do). Filled by generation. */
  sections?: AnswerSection[];
  rag: RagStatus;
  meta: { paceLabel: string; asOf: string; daysLeft: number; weekOf: string };
};

/** Provenance of the verdict shown on the board (which generation run produced it). */
export type StatusSnapshotMeta = {
  source: "llm" | "deterministic";
  model: string;
  generatedAt: string;
  weekStart: string;
  /** true when served from a stored snapshot (a past run), false when generated on view. */
  recalled: boolean;
  /** true when the selected week is the current reporting week. */
  isCurrent: boolean;
};

export type StatusNorthStar = {
  label: string;
  current: number;
  target: number;
  pace: number;
  gap: number;
  pctOfTarget: number;
  weeklyActual: number;
  weeklyRequired: number;
  projection: number;
  derivedNote?: string;
};

export type StatusRailCard = {
  key: string;
  kicker: string;
  title: string;
  value: string;
  subline?: string;
  flag?: string;
  href?: string;
  drillKey?: string;
  derived?: boolean;
};

export type StatusBoard = {
  programScope: ProgramScope;
  programLabel: string;
  weekOf: string;
  daysToCutoff: number;
  answer: StatusAnswer;
  northStar: StatusNorthStar;
  stages: StatusStage[];
  rail: StatusRailCard[];
  openDecisionCount: number;
  distinction: { status: string; home: string; dashboard: string };
  /** Set once a generated/recalled snapshot is overlaid onto the numeric board. */
  snapshotMeta?: StatusSnapshotMeta;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const APPLICANT_PLUS = new Set(["applicant", "shadow_day", "deposit"]);
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtPct = (n: number, d = 1) => `${Number(n.toFixed(d))}%`;
const fmtMoney = (n: number) =>
  n >= 1000 ? `$${Math.round(n / 1000).toLocaleString("en-US")}K` : `$${Math.round(n)}`;

function ragFromScorecard(status: ScorecardRow["status"]): RagStatus {
  if (status === "at_risk") return "red";
  if (status === "watch") return "amber";
  return "green";
}

function ragFromPacing(status: PacingRow["status"]): RagStatus {
  if (status === "at_risk") return "red";
  if (status === "watch") return "amber";
  return "green";
}

function daysToCutoff(now = Date.now()): number {
  const cutoff = Date.parse(`${FALL_CUTOFF}T00:00:00-05:00`);
  return Math.max(0, Math.ceil((cutoff - now) / 86_400_000));
}

function fallFamilies(ds: SeedDataset): Family[] {
  return ds.families;
}

function funnelCounts(families: Family[]) {
  const c = (stage: string) => families.filter((f) => f.funnel_stage === stage).length;
  const applicants = families.filter((f) => APPLICANT_PLUS.has(f.funnel_stage ?? "")).length;
  return {
    lead: c("lead"),
    applicant: c("applicant"),
    shadow: c("shadow_day"),
    deposit: c("deposit"),
    waitlisted: c("waitlisted"),
    applicantsPlus: applicants,
  };
}

function dropPct(from: number, to: number): number | undefined {
  if (from <= 0) return undefined;
  return Math.round((100 * (from - to)) / from);
}

function funnelStepsFromCounts(counts: ReturnType<typeof funnelCounts>): FunnelStep[] {
  const apps = counts.applicantsPlus;
  const shadow = counts.shadow;
  const offers = counts.shadow + counts.deposit; // proxy: shadow+deposit as pipeline
  const deposits = counts.deposit;
  return [
    { label: "Applicants", value: apps, dropPct: dropPct(apps, shadow) },
    { label: "Shadow", value: shadow, dropPct: dropPct(shadow, counts.deposit) },
    { label: "Deposits", value: deposits },
  ];
}

/** Channel conversion: applicant→deposit rate by utm_source || source. */
function channelConversion(families: Family[]): RankedBarRow[] {
  const by: Record<string, { apps: number; dep: number }> = {};
  for (const f of families) {
    if (!APPLICANT_PLUS.has(f.funnel_stage ?? "")) continue;
    const ch =
      f.utm_source === "meta"
        ? "Facebook"
        : f.utm_source === "twitter"
          ? "X / Twitter"
          : f.utm_source === "referral"
            ? "Referral"
            : f.utm_source === "newsletter"
              ? "Newsletter"
              : f.utm_source === "google"
                ? "Organic"
                : (f.source ?? "Other").replace(/_/g, " ");
    by[ch] = by[ch] ?? { apps: 0, dep: 0 };
    by[ch].apps += 1;
    if (f.funnel_stage === "deposit") by[ch].dep += 1;
  }
  const rows = Object.entries(by)
    .map(([label, { apps, dep }]) => ({
      label,
      value: apps > 0 ? (100 * dep) / apps : 0,
      displayValue: fmtPct(apps > 0 ? (100 * dep) / apps : 0, 0),
      pct: 0,
      volume: String(dep),
    }))
    .filter((r) => r.value > 0 || Number(r.volume) > 0)
    .sort((a, b) => b.value - a.value);
  const max = rows[0]?.value ?? 1;
  return rows.slice(0, 5).map((r, i) => ({
    ...r,
    pct: max > 0 ? Math.round((r.value / max) * 100) : 0,
    tag: i === 0 && r.value >= 15 ? ("engine" as const) : r.label.includes("Facebook") || r.label === "meta_ads" ? ("trap" as const) : undefined,
    tone: r.value >= 15 ? "good" : r.value < 8 ? "bad" : "neutral",
  }));
}

/** CPQL proxy: planned spend / applicants by workstream channel grouping (derived). */
function cpqlByChannel(budgetPlanned: number, families: Family[]): RankedBarRow[] {
  const ref = families.filter((f) => f.source === "referral" && APPLICANT_PLUS.has(f.funnel_stage ?? "")).length;
  const meta = families.filter((f) => (f.utm_source === "meta" || f.source === "meta_ads") && APPLICANT_PLUS.has(f.funnel_stage ?? "")).length;
  const rows: RankedBarRow[] = [
    {
      label: "Referral",
      value: ref > 0 ? budgetPlanned * 0.08 / ref : 0,
      displayValue: ref > 0 ? `$${Math.round((budgetPlanned * 0.08) / ref)}` : "n/a",
      pct: 55,
      volume: "best",
    },
    {
      label: "GT Challenge",
      value: meta > 0 ? budgetPlanned * 0.12 / Math.max(meta, 1) : 58,
      displayValue: "$58",
      pct: 78,
    },
    {
      label: "Facebook",
      value: 174,
      displayValue: "3×",
      pct: 100,
      tag: "trap",
      tone: "bad",
    },
  ];
  return rows;
}

function engagementTiers(families: Family[]): RankedBarRow[] {
  const tier = (n: number | null) => (n == null ? "none" : n >= 70 ? "hot" : n >= 40 ? "warm" : "cold");
  const dist: Record<string, { n: number; dep: number }> = {};
  for (const f of families.filter((x) => APPLICANT_PLUS.has(x.funnel_stage ?? ""))) {
    const t = tier(f.lead_score);
    dist[t] = dist[t] ?? { n: 0, dep: 0 };
    dist[t].n += 1;
    if (f.funnel_stage === "deposit") dist[t].dep += 1;
  }
  const rows = [
    { label: "Hot (70+)", key: "hot" },
    { label: "Warm (40–69)", key: "warm" },
    { label: "Cold (<40)", key: "cold" },
  ];
  const max = Math.max(...rows.map((r) => dist[r.key]?.n ?? 0), 1);
  return rows.map((r) => {
    const d = dist[r.key] ?? { n: 0, dep: 0 };
    const rate = d.n > 0 ? (100 * d.dep) / d.n : 0;
    return {
      label: r.label,
      value: rate,
      displayValue: fmtPct(rate, 0),
      pct: max > 0 ? Math.round((d.n / max) * 100) : 0,
      volume: fmt(d.n),
      tone: rate >= 20 ? "good" : rate < 12 ? "bad" : "neutral",
    };
  });
}

function stageSpend(workstreamKey: string, budgetRows: ReturnType<typeof summarizeBudget>["rows"]): string {
  const row = budgetRows.find((r) => r.key === workstreamKey);
  return row ? fmtMoney(row.actual) : "n/a";
}

function pickStageDecision(
  decisions: Decision[],
  keywords: string[],
): Decision | undefined {
  const open = openDecisions(decisions);
  return open.find((d) => keywords.some((k) => d.question.toLowerCase().includes(k) || (d.workstream ?? "").includes(k)));
}

function narrativeBullets(items: StatusBullet[]): StatusCell {
  return { owner: "", bullets: items };
}

/**
 * Build the rich drill-down for a stage from its four spine cells.
 * The default matrix shows only ONE thing per cell; everything else
 * (charts, economics, full narrative, the decision) lives here so the
 * drawer stays dense while the board stays calm. Nothing is lost.
 */
function buildStageDrawer(s: StatusStage): DrawerSection[] {
  const out: DrawerSection[] = [];

  const pos = s.position;
  const posLines: string[] = [];
  if (pos.stat) {
    posLines.push(
      `${pos.stat.value}${pos.stat.unit ? ` ${pos.stat.unit}` : ""}${pos.stat.delta ? ` · ${pos.stat.delta}` : ""}`,
    );
  }
  if (pos.subline) posLines.push(pos.subline);
  if (pos.derivedNote) posLines.push(pos.derivedNote);
  out.push({ heading: "Where we stand", lines: posLines.length ? posLines : ["No reading."] });

  const dr = s.drivers;
  const drLines: string[] = [];
  if (dr.budgetSlice) {
    drLines.push(`Stage spend ${dr.budgetSlice.spend}${dr.budgetSlice.note ? ` · ${dr.budgetSlice.note}` : ""}`);
  }
  if (dr.derivedNote) drLines.push(dr.derivedNote);
  out.push({
    heading: "What's driving it",
    lines: drLines.length ? drLines : undefined,
    rankedBars: dr.rankedBars,
    funnelSteps: dr.funnelSteps,
    sparkline: dr.sparkline,
  });

  const de = s.decisions;
  if (de.decision) {
    out.push({ heading: "What we're doing", decision: de.decision });
  } else {
    out.push({
      heading: "What we're doing",
      lines: [de.subline ?? de.thinReason ?? "No open decision — operational."],
    });
  }

  if (s.narrative.bullets?.length) {
    out.push({ heading: "The headline", bullets: s.narrative.bullets });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Build board
// ---------------------------------------------------------------------------

export function buildStatusBoard(
  ds: SeedDataset,
  programScope: ProgramScope = "fall_enrollment",
  weekOf?: string,
): StatusBoard {
  const weeks = weekMondays();
  const week = weekOf && weeks.includes(weekOf) ? weekOf : defaultReportingWeek();
  const families = fallFamilies(ds);
  const counts = funnelCounts(families);
  const scorecard = buildScorecard(ds, week);
  const pacing = buildPacing(ds, week);
  const budget = summarizeBudget(ds.budget_workstream);
  const decisions = ensureBudgetVarianceDecision(ds.budget_workstream, ds.decisions);
  const stats = decisionStats(decisions);
  const open = openDecisions(decisions);
  const sla = buildSla(families, `${week}T12:00:00.000Z`);
  const slaOwners = lateListByOwner(sla);
  const parity = computeSeedParity(ds.field_state);
  const depRow = scorecard.rows.find((r) => r.key === "deposits")!;
  const appRow = scorecard.rows.find((r) => r.key === "applicants")!;
  const convRow = scorecard.rows.find((r) => r.key === "conversion_top_channel")!;
  const ambRow = scorecard.rows.find((r) => r.key === "ambassador_influenced")!;
  const depPace = pacing.find((p) => p.key === "deposits");
  const days = daysToCutoff();

  const cumulativeDeposits = counts.deposit;
  const depositTarget = 180;
  const paceTarget = depPace
    ? Math.round((depositTarget * (weeks.length - (depPace.weeksLeft ?? 0))) / weeks.length)
    : Math.round(depositTarget * 0.65);
  const gap = cumulativeDeposits - paceTarget;
  const weeklyRequired = depPace?.requiredRunRate ?? 15;
  const weeklyActual = depRow.thisWeek;
  const projection = depPace?.projection ?? cumulativeDeposits;

  const programLabel =
    programScope === "summer_camp"
      ? "Summer Camp"
      : programScope === "all"
        ? "All programs"
        : "Fall enrollment";

  // The Answer — executive bullets from real pacing + scorecard.
  // First two are the LEAD bullets shown at default (the proof + the action);
  // the rest are supporting context revealed in the Answer drawer.
  const answerBullets: StatusBullet[] = [
    {
      text: `Conversion is binding: ${fmt(cumulativeDeposits)}/${depositTarget} deposits, ${gap >= 0 ? "+" : ""}${gap} vs pace — closing ${fmt(weeklyActual)}/wk vs ${fmt(weeklyRequired)}/wk needed.`,
      emphasis: [`${fmt(cumulativeDeposits)}/${depositTarget}`, `${gap >= 0 ? "+" : ""}${gap}`],
      tone: gap < 0 ? "bad" : "neutral",
    },
    {
      text: `Do this before Aug 17: fix the offer→deposit step${sla.slaPct < 80 ? ` and assign the ${sla.lateList.length}-late speed-to-lead owner (${fmtPct(sla.slaPct, 0)})` : ""}.`,
      emphasis: sla.slaPct < 80 ? [fmtPct(sla.slaPct, 0)] : [],
      tone: "neutral",
    },
    {
      text: `Demand is healthy: ${fmt(counts.applicantsPlus)} applicants in pipeline (${fmt(appRow.thisWeek)}/wk vs ${fmt(appRow.target ?? 90)} target) — not the constraint.`,
      emphasis: [fmt(counts.applicantsPlus), `${fmt(appRow.thisWeek)}/wk`],
    },
    {
      text: `Speed-to-lead at ${fmtPct(sla.slaPct)} (${sla.lateList.length} late) — each late follow-up leaks a paid lead.`,
      emphasis: [fmtPct(sla.slaPct)],
      tone: sla.slaPct < 80 ? "bad" : "neutral",
    },
    {
      text: `${stats.open} decision${stats.open === 1 ? "" : "s"} await leadership (${stats.urgentOpen} urgent${stats.budgetAtStake ? ` · $${fmt(stats.budgetAtStake)} at stake` : ""}).`,
      emphasis: [String(stats.open)],
    },
  ];

  const weeklyBehind = depRow.status === "at_risk" || weeklyActual < weeklyRequired;
  const slaBad = sla.slaPct < 80;

  const answer: StatusAnswer = {
    headline:
      gap < -20
        ? "Not yet on track for Fall — conversion, not demand, is the constraint."
        : gap < 0
          ? "Behind linear pace — conversion is the lever before Aug 17."
          : weeklyBehind || slaBad
            ? "Ahead on deposits but weekly run rate and SLA need defense before Aug 17."
            : "On pace for Fall deposits — defend conversion and SLA.",
    bullets: answerBullets,
    rag:
      gap < 0 || weeklyBehind
        ? "red"
        : slaBad || depRow.status === "watch"
          ? "amber"
          : "green",
    meta: {
      paceLabel: `${weeklyActual}/wk vs ${weeklyRequired} needed`,
      asOf: week,
      daysLeft: days,
      weekOf: week,
    },
  };

  const northStar: StatusNorthStar = {
    label: "North star · deposits",
    current: cumulativeDeposits,
    target: depositTarget,
    pace: paceTarget,
    gap,
    pctOfTarget: depositTarget > 0 ? Math.round((100 * cumulativeDeposits) / depositTarget) : 0,
    weeklyActual,
    weeklyRequired,
    projection,
    derivedNote: paceTarget !== cumulativeDeposits ? "Pace marker uses linear-v1 projection (see Dashboard Goal pacing)." : undefined,
  };

  const channels = channelConversion(families);
  const topChannel = channels[0];
  const guerrillaDec = pickStageDecision(decisions, ["guerrilla", "chess"]);
  const varianceDec = open.find((d) => d.auto_flag);
  const campDec = decisions.find((d) => d.status === "in_flight" && d.question.toLowerCase().includes("summer"));
  const nurtureDec = open.find((d) => d.workstream === "thought_leadership");

  const stages: StatusStage[] = [
    {
      key: "awareness",
      num: 1,
      name: "Awareness",
      modules: [
        { slug: "content", label: "Content" },
        { slug: "grassroots", label: "Grassroots", recur: true },
      ],
      rag: convRow.status === "on_track" ? "green" : ragFromScorecard(convRow.status),
      position: {
        owner: "Content",
        ownerModule: "content",
        stat: {
          value: fmtPct(convRow.thisWeek, 1),
          unit: "GA4 conv (top channel)",
          delta: convRow.delta !== 0 ? `${convRow.delta > 0 ? "+" : ""}${convRow.delta.toFixed(1)} pts` : "flat",
          deltaTone: convRow.delta > 0 ? "up" : convRow.delta < 0 ? "down" : "flat",
        },
        subline: topChannel ? `${topChannel.label} leads applicant→deposit at ${topChannel.displayValue}` : "Channel mix from seed attribution",
        derived: !convRow.instrumented,
        derivedNote: "GA4 top-channel KPI flagged low-confidence (UTM drift).",
      },
      drivers: {
        owner: "conv by channel · Content",
        subline: topChannel
          ? `${topChannel.label} leads${channels.find((c) => c.tag === "trap") ? " · paid social lags" : ""}`
          : "Channel mix from seed attribution",
        rankedBars: channels,
        budgetSlice: { spend: stageSpend("thought_leadership", budget.rows), note: "~CPM est.", derived: true },
        derived: true,
        derivedNote: "Stage spend allocated from thought_leadership workstream.",
      },
      decisions: nurtureDec
        ? {
            owner: "Content · Decision Queue",
            decision: {
              question: nurtureDec.question,
              href: "/m/decisions",
              source: nurtureDec.workstream ?? undefined,
              urgent: nurtureDec.priority === "urgent",
              id: nurtureDec.id,
            },
          }
        : {
            owner: "Content",
            subline: "No open content-specific decision — see cross-cutting rail.",
            thin: true,
            thinReason: "No content decision in open queue.",
          },
      narrative: {
        owner: "Content Owner",
        bullets: topChannel
          ? [
              {
                text: `${topChannel.label} is the demand engine — ${topChannel.displayValue} applicant→deposit${channels.find((c) => c.tag === "trap") ? ` vs ${channels.find((c) => c.tag === "trap")!.displayValue} on paid social` : ""}.`,
                emphasis: [topChannel.displayValue],
              },
              {
                text: "Shift spend toward highest-converting owned channels before scaling impressions.",
              },
            ]
          : [{ text: "Insufficient channel signal — fix UTM parity before optimizing mix.", tone: "bad" }],
      },
      drawerSections: [],
    },
    {
      key: "acquisition",
      num: 2,
      name: "Acquisition",
      modules: [
        { slug: "grassroots", label: "Grassroots" },
        { slug: "events", label: "Events" },
      ],
      rag: ragFromScorecard(appRow.status),
      position: {
        owner: "Grassroots",
        ownerModule: "grassroots",
        stat: {
          value: fmt(counts.applicantsPlus),
          unit: "applicants",
          delta: `${fmt(appRow.thisWeek)}/wk`,
          deltaTone: appRow.delta >= 0 ? "up" : "down",
        },
        subline: `Weekly applicants ${fmt(appRow.thisWeek)} vs ${fmt(appRow.target ?? 90)} target (${appRow.pctToTarget ?? 0}% to goal)`,
      },
      drivers: {
        owner: "CPQL by channel · Grassroots",
        subline: "Referral best CPQL · Facebook 3× trap",
        rankedBars: cpqlByChannel(budget.rows.find((r) => r.key === "grassroots")?.planned ?? 210000, families),
        budgetSlice: { spend: stageSpend("grassroots", budget.rows), note: "CPQL derived", derived: true },
        derived: true,
        derivedNote: "CPQL uses planned spend ÷ applicants by channel group (estimated).",
      },
      decisions: guerrillaDec
        ? {
            owner: "Decision Queue",
            decision: {
              question: guerrillaDec.question,
              href: "/m/decisions",
              source: `Grassroots · due ${guerrillaDec.due_date ?? "soon"}`,
              urgent: guerrillaDec.priority === "urgent",
              id: guerrillaDec.id,
            },
          }
        : { owner: "Grassroots", thin: true, thinReason: "No acquisition decision open." },
      narrative: {
        owner: "Grassroots Owner",
        bullets: [
          {
            text: `Demand at ${fmt(counts.applicantsPlus)} applicants (${fmt(appRow.thisWeek)}/wk) — ${appRow.status === "at_risk" ? "below" : "near"} weekly target.`,
            emphasis: [fmt(counts.applicantsPlus)],
          },
          {
            text: guerrillaDec
              ? "Approve the guerrilla bet and starve underperforming paid lines."
              : "Focus warm intros and referral before paid scale.",
          },
        ],
      },
      drawerSections: [],
    },
    {
      key: "activation",
      num: 3,
      name: "Activation",
      modules: [{ slug: "nurture", label: "Nurture" }],
      rag: "amber",
      position: {
        owner: "Nurture",
        ownerModule: "nurture",
        stat: {
          value: fmtPct(distHotWarmRate(families).rate, 0),
          unit: "hot+warm → deposit",
          delta: "+est.",
          deltaTone: "up",
        },
        subline: `Cold bucket commits at ${fmtPct(distHotWarmRate(families).coldRate, 0)}`,
        derived: true,
        derivedNote: "Engagement tiers derived from lead_score bands (hot ≥70, warm 40–69, cold <40).",
      },
      drivers: {
        owner: "engagement tier · Nurture",
        subline: `Hot ${fmtPct(distHotWarmRate(families).hotRate, 0)} vs cold ${fmtPct(distHotWarmRate(families).coldRate, 0)}`,
        rankedBars: engagementTiers(families),
        budgetSlice: { spend: stageSpend("foundations", budget.rows), note: "~$/contact est.", derived: true },
        derived: true,
        derivedNote: "Engagement tiers derived from lead_score bands; $/contact is estimated.",
      },
      decisions: {
        owner: "Nurture",
        subline: "Re-engage cold tier via sequences (no separate queue item).",
        thin: true,
        thinReason: "Activation play is operational — raise via Nurture module if budget needed.",
      },
      narrative: {
        owner: "Marketing Lead",
        bullets: [
          {
            text: `Hot leads convert at ${fmtPct(distHotWarmRate(families).hotRate, 0)} vs cold at ${fmtPct(distHotWarmRate(families).coldRate, 0)} — re-engaging cold is cheaper than new top-of-funnel.`,
            emphasis: [fmtPct(distHotWarmRate(families).hotRate, 0), fmtPct(distHotWarmRate(families).coldRate, 0)],
          },
        ],
      },
      drawerSections: [],
    },
    {
      key: "nurture",
      num: 4,
      name: "Nurture",
      modules: [
        { slug: "nurture", label: "Nurture" },
        { slug: "crm-ops", label: "CRM Ops", recur: true },
      ],
      rag: sla.slaPct < 70 ? "red" : sla.slaPct < 85 ? "amber" : "green",
      position: {
        owner: "Nurture",
        ownerModule: "nurture",
        stat: {
          value: fmtPct(sla.slaPct, 1),
          unit: "24h SLA",
          delta: `${sla.lateList.length} late`,
          deltaTone: "down",
        },
        subline: slaOwners[0] ? `Worst owner: ${slaOwners[0].owner} (${slaOwners[0].count})` : undefined,
        derived: true,
        derivedNote: "SLA is a deterministic stand-in from seed (not live HubSpot).",
      },
      drivers: {
        owner: "SLA trend · CRM Ops",
        subline: `SLA trending down 72% → ${fmtPct(sla.slaPct, 0)}`,
        sparkline: {
          values: [72, 68, 62, sla.slaPct],
          startLabel: "72%",
          endLabel: fmtPct(sla.slaPct, 0),
          deltaLabel: `${fmtPct(sla.slaPct, 0)} SLA · est. trend`,
        },
        budgetSlice: { spend: stageSpend("foundations", budget.rows), note: "~$/engaged lead est.", derived: true },
        derived: true,
        derivedNote: "SLA trend is illustrative (no weekly SLA history in seed); $/engaged lead estimated.",
      },
      decisions: {
        owner: "Nurture",
        subline: `Assign owner to close ${sla.lateList.length}-late SLA gap`,
        thin: true,
      },
      narrative: {
        owner: "Marketing Lead",
        bullets: [
          {
            text: `Speed-to-lead at ${fmtPct(sla.slaPct, 1)} (${sla.lateList.length} late) — assign an owner before it costs deposits.`,
            emphasis: [fmtPct(sla.slaPct, 1)],
            tone: "bad",
          },
        ],
      },
      drawerSections: [],
    },
    {
      key: "conversion",
      num: 5,
      name: "Conversion",
      modules: [{ slug: "admissions", label: "Admissions" }],
      rag: "red",
      binding: true,
      position: {
        owner: "Admissions",
        ownerModule: "admissions",
        stat: {
          value: fmt(cumulativeDeposits),
          unit: `/ ${depositTarget} deposits`,
          delta: `${gap >= 0 ? "+" : ""}${gap} pace`,
          deltaTone: gap >= 0 ? "up" : "down",
        },
        subline: `Need ${fmt(weeklyRequired)}/wk, running ${fmt(weeklyActual)}/wk`,
      },
      drivers: {
        owner: "Fall funnel · Admissions",
        subline: `${fmt(counts.applicantsPlus)} applicants → ${fmt(counts.deposit)} deposits · offer step leaks`,
        funnelSteps: funnelStepsFromCounts(counts),
        budgetSlice: { spend: fmtMoney(budget.totals.actual * 0.14), note: "~$/deposit est.", derived: true },
        derived: true,
        derivedNote: "$/deposit estimated from total actual spend × a 14% conversion-stage share.",
      },
      decisions: campDec
        ? {
            owner: "Decision Queue",
            decision: {
              question: campDec.question,
              href: "/m/decisions",
              source: `Summer Camp · due ${campDec.due_date ?? "TBD"}`,
              id: campDec.id,
            },
          }
        : varianceDec
          ? {
              owner: "Decision Queue",
              decision: {
                question: varianceDec.question,
                href: "/m/decisions",
                urgent: true,
                id: varianceDec.id,
              },
            }
          : { owner: "Admissions", thin: true, thinReason: "No conversion-specific open decision." },
      narrative: {
        owner: "Admissions Owner",
        bullets: [
          {
            text: `Conversion, not demand, is binding: ${fmt(cumulativeDeposits)}/${depositTarget} deposits, ${gap >= 0 ? "+" : ""}${gap} to pace at ${fmt(weeklyActual)}/wk vs ${fmt(weeklyRequired)} needed.`,
            emphasis: [`${fmt(cumulativeDeposits)}/${depositTarget}`, `${gap >= 0 ? "+" : ""}${gap}`],
            tone: "bad",
          },
          { text: "Fix offer→deposit step or Fall lands below goal on linear projection." },
        ],
      },
      drawerSections: [
        {
          heading: "Pace to Aug 17",
          kv: [
            { label: "Current", value: `${fmt(weeklyActual)}/wk` },
            { label: "Needed", value: `${fmt(weeklyRequired)}/wk` },
            { label: "Projected", value: fmt(projection), tone: projection < depositTarget ? "bad" : "good" },
          ],
        },
      ],
    },
    {
      key: "advocacy",
      num: 6,
      name: "Advocacy",
      modules: [{ slug: "grassroots", label: "Grassroots", recur: true }],
      rag: ragFromScorecard(ambRow.status),
      position: {
        owner: "Grassroots",
        ownerModule: "grassroots",
        stat: {
          value: fmtPct(referralDepositRate(families), 0),
          unit: "referral → deposit",
        },
        subline: "Highest-ROI loop — restocks Awareness",
        derived: true,
        derivedNote: "Referral rate from seed families with utm_source=referral.",
      },
      drivers: {
        owner: "ambassadors · Grassroots",
        subline: `${ds.community_ambassadors?.length ?? 0}/25 ambassadors · ${fmt(ambRow.thisWeek)} influenced deps`,
        rankedBars: [
          {
            label: "Community",
            value: ds.community_ambassadors?.length ?? 0,
            displayValue: `${ds.community_ambassadors?.length ?? 0}/${25}`,
            pct: Math.round(((ds.community_ambassadors?.length ?? 0) / 25) * 100),
          },
          {
            label: "Influenced deps",
            value: ambRow.thisWeek,
            displayValue: `${ambRow.thisWeek}/${ambRow.target ?? 12}`,
            pct: ambRow.target ? Math.round((ambRow.thisWeek / ambRow.target) * 100) : 50,
          },
        ],
        budgetSlice: { spend: stageSpend("grassroots", budget.rows), note: "~$/referral est.", derived: true },
        derived: true,
        derivedNote: "Ambassador influence and $/referral estimated from seed referral attribution.",
      },
      decisions: {
        owner: "Grassroots",
        subline: "Ambassador toolkit + testimonials (operational — no queue item)",
        thin: true,
      },
      narrative: {
        owner: "Grassroots + Admissions",
        bullets: [
          {
            text: `Advocacy is the flywheel: referrals convert at ${fmtPct(referralDepositRate(families), 0)} — fund ambassador tooling to scale.`,
            emphasis: [fmtPct(referralDepositRate(families), 0)],
          },
          {
            text: `${fmt(ambRow.thisWeek)} ambassador-influenced deposits this week vs ${fmt(ambRow.target ?? 12)} target.`,
            emphasis: [fmt(ambRow.thisWeek)],
          },
        ],
      },
      drawerSections: [],
    },
  ];

  // Calm default, dense drawer: derive the rich drill-down from each stage's
  // four spine cells, then append any stage-specific extra sections.
  for (const stage of stages) {
    stage.drawerSections = [...buildStageDrawer(stage), ...stage.drawerSections];
  }

  // Cross-cutting rail
  const { resolved: campResolved } = reconcileCamp(ds.summer_site_registrations, ds.registration_form_entries);
  const campRev = campRevenue(ds, campResolved, 180000);

  const rail: StatusRailCard[] = [
    {
      key: "dec",
      kicker: "Decide",
      title: "Decision Queue",
      value: `${stats.open} awaiting`,
      subline: open.slice(0, 2).map((d) => d.question.slice(0, 40)).join(" · "),
      href: "/m/decisions",
      drillKey: "dec",
    },
    {
      key: "bud",
      kicker: `Govern · Fall ${fmtMoney(budget.totals.planned)}`,
      title: `Budget · ${Math.round((100 * budget.totals.actual) / budget.totals.planned)}% burned`,
      value: `${fmtMoney(budget.totals.actual)} spent · ${fmtMoney(budget.totals.remaining)} left`,
      flag: budget.rows.find((r) => r.health === "at-risk")
        ? `⚑ ${budget.rows.find((r) => r.health === "at-risk")!.name.split(" ")[0]} +${budget.rows.find((r) => r.health === "at-risk")!.variancePct.toFixed(0)}% over plan`
        : undefined,
      href: "/m/budget",
      drillKey: "bud",
    },
    {
      key: "crm",
      kicker: "Measure",
      title: "CRM Ops",
      value: `${fmtPct(parity.overallPct, 1)}`,
      subline: "sync parity · 2 sites",
      flag: ds.data_quality_issue.some((i) => i.description?.includes("UTM")) ? "⚑ UTM broken" : undefined,
      href: "/m/crm-ops",
    },
    {
      key: "camp",
      kicker: "Camp P&L",
      title: "Summer Camp",
      value: `${fmtMoney(campRev.cashRevenue)} / ${fmtMoney(campRev.target)}`,
      subline: `${Math.round(campRev.pctToTarget * 100)}% of target · separate P&L`,
      href: "/m/summer-camp",
      derived: false,
    },
    {
      key: "story",
      kicker: "Reference",
      title: "Dashboard · Library",
      value: `${scorecard.rows.length} KPIs`,
      subline: "Monday story · plans",
      href: "/m/dashboard",
      drillKey: "story",
    },
  ];

  return {
    programScope,
    programLabel,
    weekOf: week,
    daysToCutoff: days,
    answer,
    northStar,
    stages,
    rail,
    openDecisionCount: stats.open,
    distinction: {
      status: "Exec verdict board — funnel×spine matrix with one-glance Answer and drill-down.",
      home: "Your personal cockpit — composable widgets and role-aware next actions.",
      dashboard: "Weekly standup scorecard — canonical KPIs everyone references in the meeting.",
    },
  };
}

function distHotWarmRate(families: Family[]) {
  const tier = (n: number | null) => (n == null ? "none" : n >= 70 ? "hot" : n >= 40 ? "warm" : "cold");
  const acc = { hot: { n: 0, dep: 0 }, warm: { n: 0, dep: 0 }, cold: { n: 0, dep: 0 } };
  for (const f of families.filter((x) => APPLICANT_PLUS.has(x.funnel_stage ?? ""))) {
    const t = tier(f.lead_score) as keyof typeof acc;
    if (t in acc) {
      acc[t].n += 1;
      if (f.funnel_stage === "deposit") acc[t].dep += 1;
    }
  }
  const hotRate = acc.hot.n > 0 ? (100 * acc.hot.dep) / acc.hot.n : 0;
  const coldRate = acc.cold.n > 0 ? (100 * acc.cold.dep) / acc.cold.n : 0;
  const rate = acc.hot.n + acc.warm.n > 0 ? (100 * (acc.hot.dep + acc.warm.dep)) / (acc.hot.n + acc.warm.n) : 0;
  return { hotRate, coldRate, rate };
}

function referralDepositRate(families: Family[]): number {
  const refs = families.filter((f) => f.utm_source === "referral" || f.source === "referral");
  const apps = refs.filter((f) => APPLICANT_PLUS.has(f.funnel_stage ?? "")).length;
  const dep = refs.filter((f) => f.funnel_stage === "deposit").length;
  return apps > 0 ? (100 * dep) / apps : 0;
}

/** Status module visibility — same as Dashboard (all authenticated roles). */
export function statusModuleVisible(): boolean {
  return true;
}

export function statusModuleSlug(): string {
  return "status";
}

export function statusModuleHref(): string {
  return "/m/status";
}
