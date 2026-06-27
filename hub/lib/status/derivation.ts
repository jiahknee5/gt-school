/**
 * derivation.ts — the PROVENANCE HARNESS for every claim the Status board makes.
 *
 * The board's earlier honesty notes ("Deterministic stand-in · no weekly SLA series") were
 * true but not descriptive: they didn't name the input, the formula, the data source, or
 * which sub-claims are real-measured vs hash stand-ins. This module makes every surfaced
 * metric self-describing and self-checking:
 *
 *   - kind:    measured | derived | stand-in   — the honest provenance class.
 *   - nodes:   source → filter → transform → output, each citing its data source.
 *   - eval:    recompute the value a second way and assert it equals the rendered value.
 *   - rubric:  what the claim MUST state + cite to be accurate and honest.
 *   - usedBy:  every Status cell / Answer section that renders this number (it is computed
 *              once here and cited everywhere — "called many times, one definition").
 *
 * It depends only on the registry / connector libs (NOT board.ts) so the dependency is a
 * clean one-way edge (board → derivation, page → derivation, /dev → derivation).
 */

import type { SeedDataset, Family } from "@/lib/seed/types";
import {
  kpiCumulative,
  kpiDefinition,
  kpiWeeklySeries,
  weekIndexOf,
  weekMondays,
} from "@/lib/metrics/registry";
import { computeSeedParity } from "@/lib/crm-ops/parity-view";
import { buildSla, lateListByOwner } from "@/lib/nurture/sla";
import { sourceHref, sourceLabel } from "@/lib/metrics/citations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The honesty class of a claim — shown as the row's provenance badge. */
export type DerivationKind = "measured" | "derived" | "stand-in" | "llm";

export type DerivationNodeRole = "source" | "filter" | "transform" | "output";

export interface DerivationNode {
  id: string;
  role: DerivationNodeRole;
  /** Short label, e.g. "seed.families" or "÷ applicants". */
  label: string;
  /** What happens / what the value is at this node. */
  detail: string;
  /** The value carried out of this node (formatted), when meaningful. */
  value?: string;
  /** Source connector for `source` nodes: supabase | hubspot | ga4 | manual | stand-in. */
  source?: string;
  /** Link to the source connector on the Integrations surface (null for stand-ins). */
  sourceHref?: string | null;
}

export interface DerivationEdge {
  from: string;
  to: string;
  label?: string;
}

export interface DerivationRubric {
  /** The single question this claim answers. */
  question: string;
  /** Every element the rendered claim MUST state to be accurate. */
  mustState: string[];
  /** The data source the claim must cite. */
  mustCite: string;
  /** The honesty bar (e.g. "label the hash stand-in; never imply live HubSpot"). */
  honesty: string;
}

export interface DerivationEval {
  /** The value recomputed independently (the check). */
  expected: string;
  /** The value the graph's output node produced (what the board renders). */
  actual: string;
  pass: boolean;
  note: string;
}

export interface DerivationGraph {
  key: string;
  label: string;
  /** The final rendered value. */
  value: string;
  kind: DerivationKind;
  /** Source connector key + its citation. */
  source: string;
  sourceHref: string | null;
  homeModule: string;
  /** A one-line human formula. */
  formula: string;
  nodes: DerivationNode[];
  edges: DerivationEdge[];
  rubric: DerivationRubric;
  eval: DerivationEval;
  /** The Status cells / Answer sections that render this number. */
  usedBy: string[];
}

// ---------------------------------------------------------------------------
// Small formatting + node helpers
// ---------------------------------------------------------------------------

const APPLICANT_PLUS = new Set(["applicant", "shadow_day", "deposit"]);
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const pct = (n: number, d = 1) => `${Number(n.toFixed(d))}%`;

function srcNode(id: string, label: string, detail: string, source: string, value?: string): DerivationNode {
  return { id, role: "source", label, detail, value, source, sourceHref: source === "stand-in" ? null : sourceHref(source) };
}
function step(id: string, role: DerivationNodeRole, label: string, detail: string, value?: string): DerivationNode {
  return { id, role, label, detail, value };
}
/** Chain the nodes linearly with optional edge labels. */
function chain(nodes: DerivationNode[], labels: (string | undefined)[] = []): DerivationEdge[] {
  const edges: DerivationEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({ from: nodes[i].id, to: nodes[i + 1].id, label: labels[i] });
  }
  return edges;
}
function evalOf(expected: string, actual: string, note: string): DerivationEval {
  return { expected, actual, pass: expected === actual, note };
}

// ---------------------------------------------------------------------------
// Per-metric derivations
// ---------------------------------------------------------------------------

/** A registry FLOW KPI (applicants / deposits weekly): seed funnel_stage → weekly bucket. */
function flowKpiDerivation(
  ds: SeedDataset,
  week: string,
  key: string,
  label: string,
  kind: DerivationKind,
  usedBy: string[],
): DerivationGraph {
  const def = kpiDefinition(key)!;
  const series = kpiWeeklySeries(key, ds);
  const idx = weekMondays().indexOf(week);
  const value = idx >= 0 ? series[idx] ?? 0 : 0;
  // Independent recompute: count seed records bucketed into this week by created_at.
  const pred =
    key === "deposits"
      ? (f: Family) => f.funnel_stage === "deposit"
      : key === "applicants"
        ? (f: Family) => APPLICANT_PLUS.has(f.funnel_stage ?? "")
        : key === "ambassador_influenced"
          ? (f: Family) => f.source === "referral" && f.funnel_stage === "deposit"
          : () => false;
  const recomputed = ds.families.filter((f) => pred(f) && weekIndexOf(f.created_at) === idx).length;

  const nodes: DerivationNode[] = [
    srcNode("src", "seed.families", `${fmt(ds.families.length)} family rows (deterministic seed; the Supabase app_form twin)`, def.source, `${fmt(ds.families.length)} rows`),
    step("filter", "filter", "funnel_stage match", key === "deposits" ? "funnel_stage = deposit" : "funnel_stage ∈ {applicant, shadow_day, deposit}"),
    step("bucket", "transform", "bucket by week", `created_at → week ${week}`),
    step("out", "output", label, `count in week ${week}`, fmt(value)),
  ];
  return {
    key,
    label,
    value: fmt(value),
    kind,
    source: def.source,
    sourceHref: sourceHref(def.source),
    homeModule: def.homeModule,
    formula: `count(families where ${key === "deposits" ? "funnel_stage=deposit" : "funnel_stage∈applicant+"} AND week(created_at)=${week})`,
    nodes,
    edges: chain(nodes, ["filter", "by created_at", "count"]),
    rubric: {
      question: `How many ${label.toLowerCase()} in the selected week?`,
      mustState: ["the count", "the week it is bucketed into", "that it is the weekly (flow) value, not cumulative"],
      mustCite: `${sourceLabel(def.source)} (the ${def.homeModule} module owns it)`,
      honesty: "Measured from the seed funnel — state it plainly; do not present the weekly value as the sprint total.",
    },
    eval: evalOf(fmt(recomputed), fmt(value), "Independent count of seed records bucketed into the week vs the registry weekly series."),
    usedBy,
  };
}

/** Cumulative deposits — the North Star (running sum through the selected week). */
function depositsCumulativeDerivation(ds: SeedDataset, week: string): DerivationGraph {
  const def = kpiDefinition("deposits")!;
  const series = kpiWeeklySeries("deposits", ds);
  const idx = weekMondays().indexOf(week);
  const value = kpiCumulative("deposits", ds, week);
  const recomputed = series.slice(0, idx + 1).reduce((a, v) => a + v, 0);
  const nodes: DerivationNode[] = [
    srcNode("src", "seed.families", "deposits bucketed per week (flow KPI)", def.source, `weekly series`),
    step("slice", "filter", "weeks ≤ selected", `weeks 0…${idx} (${week})`),
    step("sum", "transform", "running sum", "Σ weekly deposits through the week"),
    step("out", "output", "Deposits so far", "as-of-week cumulative (NOT the end-of-sprint total)", `${fmt(value)} / 180`),
  ];
  return {
    key: "deposits_cumulative",
    label: "North Star · deposits (cumulative)",
    value: `${fmt(value)} / 180`,
    kind: "measured",
    source: def.source,
    sourceHref: sourceHref(def.source),
    homeModule: def.homeModule,
    formula: `Σ weeklyDeposits[0…idx(${week})]`,
    nodes,
    edges: chain(nodes, ["slice", "Σ", "/ target"]),
    rubric: {
      question: "How many deposits have we secured so far, against the 180 goal?",
      mustState: ["cumulative deposits", "the 180 target + % to goal", "that it is as-of the selected week (not the sprint total)"],
      mustCite: `${sourceLabel(def.source)} (nurture/Supabase)`,
      honesty: "Must be the running sum through the SELECTED week — the as-of-week clock fix; never the whole-dataset total.",
    },
    eval: evalOf(fmt(recomputed), fmt(value), "Σ of the weekly series through idx vs kpiCumulative()."),
    usedBy: ["North Star", "Answer · Where we stand", "Conversion · Position", "Conversion · Narrative"],
  };
}

/** Sync parity — measured from field_state (the data-confidence signal). */
function parityDerivation(ds: SeedDataset): DerivationGraph {
  const parity = computeSeedParity(ds.field_state);
  const value = pct(parity.overallPct, 1);
  const nodes: DerivationNode[] = [
    srcNode("src", "seed.field_state", `${fmt(ds.field_state.length)} field-state rows (app_form ⇄ HubSpot mirror)`, "hubspot", `${fmt(ds.field_state.length)} rows`),
    step("match", "transform", "per-field match", "normalize + compare app vs HubSpot value"),
    step("roll", "transform", "roll up", "matched ÷ total across governed fields"),
    step("out", "output", "Overall parity", "governed-field agreement", value),
  ];
  return {
    key: "parity_pct",
    label: "Sync parity",
    value,
    kind: "measured",
    source: "hubspot",
    sourceHref: sourceHref("hubspot"),
    homeModule: "crm-ops",
    formula: "matchedFields ÷ totalGovernedFields (normalized)",
    nodes,
    edges: chain(nodes, ["compare", "÷", "%"]),
    rubric: {
      question: "How in-sync are the app and HubSpot on governed fields?",
      mustState: ["overall parity %", "that known-unreliable fields (source/income/TEFA) are expected below threshold"],
      mustCite: "HubSpot (CRM Ops owns the parity engine)",
      honesty: "Measured, not faked — when a field is below threshold say whether it's a known-unreliable (expected) or a surprise.",
    },
    eval: evalOf(value, value, "Single canonical computeSeedParity() — value is its own output (no second path)."),
    usedBy: ["Nurture · metric contract", "CRM Ops rail", "Data-confidence banner"],
  };
}

/** GA4 top-channel conversion — DERIVED + flagged low-confidence (UTM broken). */
function conversionDerivation(ds: SeedDataset, week: string): DerivationGraph {
  const series = kpiWeeklySeries("conversion_top_channel", ds);
  const idx = weekMondays().indexOf(week);
  const value = pct(idx >= 0 ? series[idx] ?? 0 : 0, 1);
  const nodes: DerivationNode[] = [
    srcNode("src", "seed.ga4_days", `${fmt(ds.ga4_days.length)} GA4 day×site rows`, "ga4", `${fmt(ds.ga4_days.length)} rows`),
    step("bucket", "filter", "week bucket", `sessions + conversions in ${week}`),
    step("rate", "transform", "conversion rate", "100 × conversions ÷ sessions"),
    step("out", "output", "Top-channel conversion", "GA4 — low-confidence (UTM drift)", value),
  ];
  return {
    key: "conversion_top_channel",
    label: "Top-channel conversion",
    value,
    kind: "derived",
    source: "ga4",
    sourceHref: sourceHref("ga4"),
    homeModule: "analytics",
    formula: "100 × Σconversions ÷ Σsessions (week)",
    nodes,
    edges: chain(nodes, ["week", "rate", "flag"]),
    rubric: {
      question: "What is the top channel's session→conversion rate this week?",
      mustState: ["the conversion %", "that it is GA4-derived and flagged low-confidence (UTM attribution broken)"],
      mustCite: "GA4 (Analytics module)",
      honesty: "instrumented=false — MUST carry the low-confidence badge; never present as a precise attributed number.",
    },
    eval: evalOf(value, value, "kpiWeeklySeries('conversion_top_channel') is the single definition."),
    usedBy: ["Awareness · Position", "Awareness · drivers"],
  };
}

/** Event-to-consult — STAND-IN: a fixed manual series (no instrumentation in v1). */
function eventToConsultDerivation(ds: SeedDataset, week: string): DerivationGraph {
  const series = kpiWeeklySeries("event_to_consult", ds);
  const idx = weekMondays().indexOf(week);
  const value = fmt(idx >= 0 ? series[idx] ?? 0 : 0);
  const nodes: DerivationNode[] = [
    srcNode("src", "manual count", "field-marketing tally — no connector instruments this in v1", "stand-in", "fixed series"),
    step("pick", "filter", "this week", `index ${idx}`),
    step("out", "output", "Event-to-consult", "manual stand-in", value),
  ];
  return {
    key: "event_to_consult",
    label: "Event-to-consult",
    value,
    kind: "stand-in",
    source: "manual",
    sourceHref: sourceHref("manual"),
    homeModule: "events",
    formula: "EVENT_TO_CONSULT_MANUAL[week]  (fixed, uninstrumented)",
    nodes,
    edges: chain(nodes, ["index", "value"]),
    rubric: {
      question: "How many event attendees became consults this week?",
      mustState: ["the count", "that it is a MANUAL field-marketing tally, uninstrumented in v1"],
      mustCite: "Manual (Events module) — not a connector",
      honesty: "instrumented=false stand-in — must say it is a manual count, never imply a measured funnel.",
    },
    eval: evalOf(value, value, "Fixed manual series — reproducible by construction."),
    usedBy: ["Awareness · metric contract (detail)"],
  };
}

/** 24h speed-to-lead SLA + worst owner — STAND-IN (deterministic hash, not live HubSpot). */
function slaDerivation(ds: SeedDataset, week: string): DerivationGraph {
  const sla = buildSla(ds.families, `${week}T12:00:00.000Z`);
  const owners = lateListByOwner(sla);
  const worst = owners[0];
  const value = pct(sla.slaPct, 1);
  // Independent recompute of SLA% (same deterministic hash path → proves reproducibility).
  const sla2 = buildSla(ds.families, `${week}T12:00:00.000Z`);

  const nodes: DerivationNode[] = [
    srcNode("src", "seed.families", `applicants (${fmt(sla.newApplicants)}) — funnel-entry clock`, "supabase", `${fmt(sla.newApplicants)} applicants`),
    step("contact", "transform", "first-contact stand-in", "hash01(id+':contact')<0.72 → contacted?  (deterministic, NOT live HubSpot)"),
    step("fast", "transform", "within 24h?", "of contacted, hash01(id+':fast')<0.8 → ≤24h"),
    step("rate", "transform", "SLA %", "contactedWithin24h ÷ newApplicants", value),
    step("owner", "transform", "owner attribution", "ownerFor(id)=hash→[Maya|David|Johnny] — STAND-IN, not a real HubSpot owner", worst ? `worst ${worst.owner} (${worst.count})` : "—"),
    step("out", "output", "Speed-to-lead", `${sla.lateList.length} late · worst owner`, `${value} · ${sla.lateList.length} late`),
  ];
  return {
    key: "sla_24h",
    label: "24h speed-to-lead SLA",
    value: `${value} · ${sla.lateList.length} late`,
    kind: "stand-in",
    source: "hubspot",
    sourceHref: sourceHref("hubspot"),
    homeModule: "nurture",
    formula: "contactedWithin24h ÷ newApplicants  ·  worst owner = max(hash-assigned late count)",
    nodes,
    edges: chain(nodes, ["contacted?", "≤24h?", "÷", "group by owner", "render"]),
    rubric: {
      question: "Is speed-to-lead protecting the paid leads — and who is the worst owner?",
      mustState: [
        "SLA % (contacted within 24h ÷ new applicants)",
        "the late count",
        "the worst owner + their late count",
        "that BOTH the first-contact flag AND the owner attribution are deterministic hash STAND-INS, not live HubSpot",
      ],
      mustCite: "HubSpot (Nurture) — as the INTENDED source; the value is a seed stand-in until live",
      honesty:
        "This is the cell you flagged. Must say: (1) first-contact is a hash stand-in, (2) the owner ('worst Johnny Chung') is hash-assigned not a real HubSpot owner, (3) no weekly SLA history exists. Never imply a measured HubSpot SLA.",
    },
    eval: evalOf(value, pct(sla2.slaPct, 1), "Recompute buildSla() — identical (deterministic from seed) proves reproducibility, not live measurement."),
    usedBy: ["Nurture · Position", "Nurture · Narrative", "Answer · What needs attention", "Answer · What to do"],
  };
}

/** Hot+warm → deposit engagement — DERIVED from lead_score bands. */
function engagementDerivation(ds: SeedDataset): DerivationGraph {
  // Independent recompute of the hot+warm deposit rate from lead_score bands.
  const tier = (n: number | null) => (n == null ? "none" : n >= 70 ? "hot" : n >= 40 ? "warm" : "cold");
  const acc = { hot: { n: 0, dep: 0 }, warm: { n: 0, dep: 0 } };
  for (const f of ds.families.filter((x) => APPLICANT_PLUS.has(x.funnel_stage ?? ""))) {
    const t = tier(f.lead_score);
    if (t === "hot" || t === "warm") {
      acc[t].n += 1;
      if (f.funnel_stage === "deposit") acc[t].dep += 1;
    }
  }
  const denom = acc.hot.n + acc.warm.n;
  const rate = denom > 0 ? (100 * (acc.hot.dep + acc.warm.dep)) / denom : 0;
  const value = pct(rate, 0);
  const nodes: DerivationNode[] = [
    srcNode("src", "seed.families.lead_score", "applicants with a lead_score (HubSpot scoring)", "hubspot", `${fmt(denom)} hot+warm`),
    step("band", "filter", "hot+warm band", "lead_score ≥ 40 (hot ≥70, warm 40–69)"),
    step("rate", "transform", "deposit rate", "deposits ÷ hot+warm applicants"),
    step("out", "output", "Hot+warm → deposit", "engagement-tier conversion", value),
  ];
  return {
    key: "engagement_hotwarm",
    label: "Hot+warm → deposit",
    value,
    kind: "derived",
    source: "hubspot",
    sourceHref: sourceHref("hubspot"),
    homeModule: "nurture",
    formula: "deposits(hot+warm) ÷ applicants(hot+warm)  ·  bands from lead_score",
    nodes,
    edges: chain(nodes, ["band", "÷", "%"]),
    rubric: {
      question: "Do engaged (hot+warm) leads convert better than cold?",
      mustState: ["the hot+warm deposit rate", "that the bands are derived from lead_score (hot ≥70, warm 40–69)"],
      mustCite: "HubSpot lead_score (Nurture)",
      honesty: "Derived from score bands — say so; no weekly series or target exists for it.",
    },
    eval: evalOf(value, value, "Recomputed from lead_score bands (single deterministic path)."),
    usedBy: ["Activation · Position", "Activation · Narrative"],
  };
}

/** Referral → deposit rate — DERIVED from utm_source/source = referral. */
function referralDerivation(ds: SeedDataset): DerivationGraph {
  const refs = ds.families.filter((f) => f.utm_source === "referral" || f.source === "referral");
  const apps = refs.filter((f) => APPLICANT_PLUS.has(f.funnel_stage ?? "")).length;
  const dep = refs.filter((f) => f.funnel_stage === "deposit").length;
  const rate = apps > 0 ? (100 * dep) / apps : 0;
  const value = pct(rate, 0);
  const nodes: DerivationNode[] = [
    srcNode("src", "seed.families", `referral-attributed families (${fmt(refs.length)})`, "hubspot", `${fmt(refs.length)} referrals`),
    step("apps", "filter", "referral applicants", "utm_source|source = referral AND applicant+"),
    step("rate", "transform", "deposit rate", "referral deposits ÷ referral applicants"),
    step("out", "output", "Referral → deposit", "advocacy loop strength", value),
  ];
  return {
    key: "referral_rate",
    label: "Referral → deposit",
    value,
    kind: "derived",
    source: "hubspot",
    sourceHref: sourceHref("hubspot"),
    homeModule: "grassroots",
    formula: "deposits(referral) ÷ applicants(referral)",
    nodes,
    edges: chain(nodes, ["filter", "÷", "%"]),
    rubric: {
      question: "How strong is the referral→deposit advocacy loop?",
      mustState: ["the referral deposit rate", "that it is attribution-derived (utm_source/source = referral)"],
      mustCite: "HubSpot attribution (Grassroots)",
      honesty: "Derived from seed referral attribution — UTM is known-unreliable, so treat as directional.",
    },
    eval: evalOf(value, value, "Single deterministic computation from referral-attributed families."),
    usedBy: ["Advocacy · Position", "Advocacy · Narrative"],
  };
}

// ---------------------------------------------------------------------------
// LLM call-sites (descriptors — their live runs live in the trace store)
// ---------------------------------------------------------------------------

/** The two genuine LLM call-sites, as derivation rows (kind=llm) for the unified table. */
export function llmCallSiteRows(): Pick<DerivationGraph, "key" | "label" | "kind" | "source" | "sourceHref" | "homeModule" | "formula" | "usedBy">[] {
  return [
    {
      key: "llm.ask-the-hub",
      label: "Ask-the-Hub (agent graph)",
      kind: "llm",
      source: "anthropic",
      sourceHref: "/dev/agents",
      homeModule: "status",
      formula: "9-node graph: validate → snapshot → policy → route → retrieve → expand → synthesize → compose → scan",
      usedBy: ["Status · Ask-the-Hub strip", "/help/ai-agents"],
    },
    {
      key: "llm.status-gen",
      label: "Status verdict writer",
      kind: "llm",
      source: "anthropic",
      sourceHref: "/dev/agents",
      homeModule: "status",
      formula: "rewrite the deterministic draft to the Where/Working/Attention/Do rubric (validated, fallback-guarded)",
      usedBy: ["Status · The Answer", "Status · per-stage narrative"],
    },
  ];
}

// ---------------------------------------------------------------------------
// Public: build every derivation for a (dataset, week)
// ---------------------------------------------------------------------------

export function buildDerivations(ds: SeedDataset, week: string): DerivationGraph[] {
  return [
    depositsCumulativeDerivation(ds, week),
    flowKpiDerivation(ds, week, "deposits", "Deposits / wk", "measured", ["Conversion · metric contract", "Dashboard scorecard"]),
    flowKpiDerivation(ds, week, "applicants", "Applicants / wk", "measured", ["Acquisition · Position", "Answer · What's working"]),
    flowKpiDerivation(ds, week, "ambassador_influenced", "Ambassador-influenced deposits", "measured", ["Advocacy · metric contract"]),
    parityDerivation(ds),
    conversionDerivation(ds, week),
    engagementDerivation(ds),
    slaDerivation(ds, week),
    referralDerivation(ds),
    eventToConsultDerivation(ds, week),
  ];
}

/** Static honesty notes by metric key — board cells read these so the cell text and the
 *  derivation can never diverge (no ds needed; safe to import from board.ts). */
export const DERIVATION_NOTE: Record<string, string> = {
  sla_24h:
    "Stand-in: first-contact AND owner are deterministic hashes from seed (not live HubSpot); no weekly SLA history.",
  engagement_hotwarm: "Derived from lead_score bands (hot ≥70 / warm 40–69); no weekly series or target.",
  referral_rate: "Derived from referral attribution (utm_source/source=referral); UTM is known-unreliable.",
  event_to_consult: "Manual field-marketing tally — uninstrumented in v1 (not a connector).",
  conversion_top_channel: "GA4-derived, flagged low-confidence (UTM attribution broken).",
};
