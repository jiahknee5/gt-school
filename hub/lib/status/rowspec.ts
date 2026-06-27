/**
 * rowspec.ts — the per-funnel-stage ACCOUNTABILITY CONTRACT for the Status board.
 *
 * Each funnel stage (Awareness→Advocacy) has exactly one accountable owner (+ their role)
 * and a FIXED set of metrics reviewed every week — the same 1–3 metrics, in the same shape
 * (this week / last week / delta / trend), so "who is accountable and what we review" is
 * guaranteed consistent week to week. One metric per stage is the `exec` headline shown on
 * the calm board; the rest are `detail`, surfaced in the stage drawer.
 *
 * Metric `key`s are either a registry KPI (lib/metrics/registry — real weekly series, so
 * this/last/delta/trend are exact) or a board-derived key (SLA, engagement tier, referral
 * rate) that has no weekly history in the seed and is resolved from the current reading.
 */

import type { FunnelStageKey } from "./board";

/** Derived (non-registry) metric keys resolved from the board's current computations. */
export type DerivedMetricKey = "sla_24h" | "engagement_hotwarm" | "referral_rate";

export interface StageMetricSpec {
  /** A registry KPI key (applicants, deposits, …) or a DerivedMetricKey. */
  key: string;
  label: string;
  /** Authoritative source connector (for citations / dual links in a later WS). */
  source: string;
  /** The module that OWNS the number (its `/m/<slug>` home). */
  homeModule: string;
  /** `exec` = the single headline metric on the board; `detail` = drawer-only. */
  surface: "exec" | "detail";
}

export interface StageRowSpec {
  stage: FunnelStageKey;
  /** The accountable owner for this stage (a name/role label shown on the row). */
  owner: string;
  /** The owner's functional role (so the exec sees the whole team across the funnel). */
  ownerRole: string;
  /** The fixed weekly metric set; exactly one is `surface: "exec"`. */
  metrics: StageMetricSpec[];
}

export const STAGE_ROW_SPECS: StageRowSpec[] = [
  {
    stage: "awareness",
    owner: "Content Owner",
    ownerRole: "Content & Brand",
    metrics: [
      { key: "conversion_top_channel", label: "Top-channel conversion", source: "ga4", homeModule: "analytics", surface: "exec" },
      { key: "event_to_consult", label: "Event-to-consult", source: "manual", homeModule: "events", surface: "detail" },
    ],
  },
  {
    stage: "acquisition",
    owner: "Grassroots Lead",
    ownerRole: "Field & Grassroots",
    metrics: [
      { key: "applicants", label: "Applicants / wk", source: "supabase", homeModule: "nurture", surface: "exec" },
    ],
  },
  {
    stage: "activation",
    owner: "Nurture Owner",
    ownerRole: "Lifecycle Marketing",
    metrics: [
      { key: "engagement_hotwarm", label: "Hot+warm → deposit", source: "hubspot", homeModule: "nurture", surface: "exec" },
    ],
  },
  {
    stage: "nurture",
    owner: "CRM Ops Lead",
    ownerRole: "Marketing Operations",
    metrics: [
      { key: "sla_24h", label: "24h speed-to-lead SLA", source: "hubspot", homeModule: "nurture", surface: "exec" },
      { key: "parity_pct", label: "Sync parity", source: "hubspot", homeModule: "crm-ops", surface: "detail" },
    ],
  },
  {
    stage: "conversion",
    owner: "Admissions Lead",
    ownerRole: "Admissions",
    metrics: [
      { key: "deposits", label: "Deposits / wk", source: "supabase", homeModule: "nurture", surface: "exec" },
    ],
  },
  {
    stage: "advocacy",
    owner: "Grassroots Lead",
    ownerRole: "Field & Grassroots",
    metrics: [
      { key: "ambassador_influenced", label: "Ambassador-influenced deposits", source: "hubspot", homeModule: "grassroots", surface: "exec" },
      { key: "referral_rate", label: "Referral → deposit", source: "hubspot", homeModule: "grassroots", surface: "detail" },
    ],
  },
];

const BY_STAGE = new Map(STAGE_ROW_SPECS.map((s) => [s.stage, s]));

export function rowSpecFor(stage: FunnelStageKey): StageRowSpec | undefined {
  return BY_STAGE.get(stage);
}
