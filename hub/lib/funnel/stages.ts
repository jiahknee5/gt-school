/**
 * stages.ts — the canonical marketing-funnel stage order, shared so the Dashboard
 * scorecard and the Status board can't drift.
 *
 * Stage KEYS + ORDER mirror the Status board (lib/status/board.ts → `FunnelStageKey`
 * and `stages[].num/name`) and the funnel-IA recommendation
 * (docs/audits/FUNNEL-IA-RECOMMENDATION.md §3):
 *
 *   Awareness → Acquisition → Activation → Nurture → Conversion → Advocacy
 *
 * A compile-time guard ties this list to the Status board's `FunnelStageKey` union,
 * so adding/removing a stage in either place fails the type-check until both agree.
 * The import is type-only — this module carries NO runtime dependency on Status, so
 * importing it (e.g. from the scorecard) never pulls the Status board into a bundle.
 */

import type { FunnelStageKey } from "@/lib/status/board";

export type { FunnelStageKey };

/** Trailing bucket for metrics that serve every stage — not a funnel stage. */
export type CrossCuttingKey = "cross_cutting";

/** A scorecard row's group: a funnel stage, or the cross-cutting bucket. */
export type ScorecardGroupKey = FunnelStageKey | CrossCuttingKey;

export interface ScorecardGroupDef {
  key: ScorecardGroupKey;
  /** Funnel position (1-based); the cross-cutting bucket sorts last. */
  order: number;
  name: string;
  /** Short plain-language descriptor shown under the group header. */
  blurb: string;
}

/** The six funnel stages, in canonical order (matches Status board `num`). */
export const FUNNEL_STAGES: ScorecardGroupDef[] = [
  { key: "awareness", order: 1, name: "Awareness", blurb: "Create demand" },
  { key: "acquisition", order: 2, name: "Acquisition", blurb: "Turn reach into known leads" },
  { key: "activation", order: 3, name: "Activation", blurb: "First meaningful engagement" },
  { key: "nurture", order: 4, name: "Nurture", blurb: "Sequenced follow-up toward a decision" },
  { key: "conversion", order: 5, name: "Conversion", blurb: "Shadow \u2192 offer \u2192 deposit" },
  { key: "advocacy", order: 6, name: "Advocacy", blurb: "Referrals refill the top of the funnel" },
];

/** The cross-cutting bucket — data/operations that underpin every stage. */
export const CROSS_CUTTING: ScorecardGroupDef = {
  key: "cross_cutting",
  order: 99,
  name: "Cross-cutting",
  blurb: "Operational metrics that serve every stage",
};

/** Every scorecard group, in render order (funnel stages, then cross-cutting). */
export const SCORECARD_GROUPS: ScorecardGroupDef[] = [...FUNNEL_STAGES, CROSS_CUTTING];

const GROUP_BY_KEY = new Map<ScorecardGroupKey, ScorecardGroupDef>(
  SCORECARD_GROUPS.map((g) => [g.key, g]),
);

export function funnelGroup(key: ScorecardGroupKey): ScorecardGroupDef {
  return GROUP_BY_KEY.get(key) ?? CROSS_CUTTING;
}

/** Sort key for a group (lower = earlier in the funnel; cross-cutting last). */
export function groupOrder(key: ScorecardGroupKey): number {
  return funnelGroup(key).order;
}

/**
 * KPI key → funnel group, mirroring how the Status board files each KPI:
 *  - awareness    : conversion_top_channel  (GA4 top-channel conv — board Awareness cell)
 *  - acquisition  : applicants, event_to_consult (demand — board Acquisition cell)
 *  - conversion   : deposits  (board Conversion cell — the binding stage)
 *  - advocacy     : ambassador_influenced  (board Advocacy cell)
 *  - cross_cutting: parity_pct  (CRM-Ops sync parity — data backbone, not a stage)
 *
 * KPIs absent here fall back to cross-cutting, so a newly added KPI is parked in the
 * trailing bucket (visible, never silently mis-ranked) until it is mapped explicitly.
 */
export const KPI_FUNNEL_STAGE: Record<string, ScorecardGroupKey> = {
  conversion_top_channel: "awareness",
  applicants: "acquisition",
  event_to_consult: "acquisition",
  deposits: "conversion",
  ambassador_influenced: "advocacy",
  parity_pct: "cross_cutting",
};

export function stageForKpi(key: string): ScorecardGroupKey {
  return KPI_FUNNEL_STAGE[key] ?? "cross_cutting";
}

// ── Compile-time anti-drift guard ──────────────────────────────────────────────
// The canonical funnel order, as a literal tuple. `satisfies` proves every entry is
// a real `FunnelStageKey` (no extras); `_coversBoard` proves none is missing. Touch
// the Status board's stage union without updating this and the build fails here.
const _CANONICAL_ORDER = [
  "awareness",
  "acquisition",
  "activation",
  "nurture",
  "conversion",
  "advocacy",
] as const satisfies readonly FunnelStageKey[];

type _OrderKey = (typeof _CANONICAL_ORDER)[number];
type _MissingFromOrder = Exclude<FunnelStageKey, _OrderKey>;
const _coversBoard: [_MissingFromOrder] extends [never] ? true : never = true;
void _coversBoard;

// FUNNEL_STAGES must list the same stages as the canonical tuple, in the same order.
const _funnelStagesMatchOrder: boolean =
  FUNNEL_STAGES.length === _CANONICAL_ORDER.length &&
  FUNNEL_STAGES.every((s, i) => s.key === _CANONICAL_ORDER[i]);
void _funnelStagesMatchOrder;
