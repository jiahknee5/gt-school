/**
 * rubrics.ts — the typed SPEC each Status cell + the overall Answer must satisfy.
 *
 * This is the single source of truth for "what a good Status cell is". Generation
 * (lib/status/generate.ts), the conformance tests (tests/status-rubrics.test.ts),
 * and the docs (docs/audits/STATUS-RUBRICS.md) all reference THESE definitions —
 * there is no second rubric. It extends the Narrative-column standard in
 * docs/audits/NARRATIVE-RUBRIC.md (the L1→L5 quality scale) to all four spine
 * columns and to the top-level Answer.
 *
 * Each rubric states, for one cell type:
 *   - question:        the single question the cell answers
 *   - citesData:       the real data it must cite (grounding, not vibes)
 *   - structure:       the required shape (headline + RAG + driver + decision …)
 *   - defaultShows:    what is visible on the calm default board (ONE signal)
 *   - drilldownShows:  what lives in the drawer (the depth)
 *   - qualityBar:      the L5 bar from NARRATIVE-RUBRIC it is held to
 */

import type {
  SpineColumn,
  FunnelStageKey,
  StatusCell,
  StatusBullet,
  RagStatus,
} from "./board";

// ---------------------------------------------------------------------------
// Rubric definitions
// ---------------------------------------------------------------------------

export interface CellRubric {
  /** Stable id — `${column}` for the base rubric, `${column}.${stage}` when specialized. */
  id: string;
  column: SpineColumn;
  /** Set when this rubric specializes the column for one funnel stage. */
  stage?: FunnelStageKey;
  /** The one question this cell answers. */
  question: string;
  /** Real data the cell must cite to be grounded (not invented). */
  citesData: string[];
  /** Required structural elements, in read order. */
  structure: string[];
  /** What shows on the calm default board (ONE signal + RAG). */
  defaultShows: string;
  /** What lives in the drawer (the depth). */
  drilldownShows: string;
  /** The quality bar (ties to NARRATIVE-RUBRIC L5). */
  qualityBar: string;
}

/** The four base column rubrics (apply to every stage unless a specialization overrides). */
export const COLUMN_RUBRICS: Record<SpineColumn, CellRubric> = {
  position: {
    id: "position",
    column: "position",
    question: "Where do we stand on this stage — now, versus last week, and versus the goal?",
    citesData: [
      "the stage's headline KPI (real value — where we are now)",
      "the prior-week value (the WoW delta)",
      "the goal/target + direction-aware pace (pctToTarget) where one exists",
      "a RAG status",
    ],
    structure: [
      "one headline number + unit (where we are now)",
      "RAG token",
      "vs last week — WoW direction + signed delta (when a weekly series exists)",
      "vs goal — now/target or % to target (when a target exists; omitted honestly when none)",
    ],
    defaultShows: "Headline value + a compact WoW chip + a compact vs-goal marker — the smallest where/last-week/goal unit.",
    drilldownShows: "Full reading: now, WoW (+ deltaPct), pace-to-target, derivation note, and confidence caveat.",
    qualityBar:
      "L4+ — answers where/last-week/goal at a glance; stages with no weekly series or no target say so honestly (never a fabricated target).",
  },
  drivers: {
    id: "drivers",
    column: "drivers",
    question: "What is driving the position up or down?",
    citesData: ["a ranked breakdown (channel/tier/funnel step) or trend", "stage spend / economics where known"],
    structure: ["one-line glance naming the lead driver", "a chart (ranked bars / funnel / sparkline) in the drawer", "stage economics (CPQL / $-per-deposit) when known"],
    defaultShows: "One quiet glance line naming the lead driver.",
    drilldownShows: "The ranked chart, the per-stage economics, and the derivation method.",
    qualityBar: "L4 — names the mechanism (why the level is what it is), not just the value; estimates are flagged.",
  },
  decisions: {
    id: "decisions",
    column: "decisions",
    question: "What needs a leadership decision on this stage?",
    citesData: ["an open Decision Queue item (id + question) OR an explicit 'no open decision' reason"],
    structure: ["a Decide flag (urgent when due) OR an honest thin/operational note", "the linked decision question + queue href in the drawer"],
    defaultShows: "An attention flag only when a real open decision exists; otherwise it recedes.",
    drilldownShows: "The decision question, urgency, source workstream, and the Decision Queue link.",
    qualityBar: "Honesty bar — never invents a decision; a thin cell says WHY there is no open ask.",
  },
  narrative: {
    id: "narrative",
    column: "narrative",
    question: "What is the one-line story a C-suite leader tells about this stage?",
    citesData: ["the real headline number", "the binding driver", "the consequence for the Aug-17 goal / $365K budget"],
    structure: ["so-what first", "direction + magnitude + against-what", "named driver", "implied decision", "one business consequence"],
    defaultShows: "The single top headline bullet (the takeaway).",
    drilldownShows: "The full set of narrative bullets + the generated reasoning behind the verdict.",
    qualityBar: "L5 (NARRATIVE-RUBRIC §1.3) — board-ready insight in ~25 words with a RAG cue.",
  },
};

/**
 * Stage specializations — where a column needs a sharper spec for a specific stage.
 * (Conversion is the binding row; Nurture is the SLA/speed-to-lead row.)
 */
export const STAGE_CELL_RUBRICS: CellRubric[] = [
  {
    id: "position.conversion",
    column: "position",
    stage: "conversion",
    question: "Are we converting fast enough to hit the Fall deposit goal?",
    citesData: ["cumulative deposits / target", "deposits closed this week vs last (WoW)", "% to the 180 goal", "gap to linear pace", "weekly run rate vs required run rate"],
    structure: ["deposits / target headline", "RAG (binding-aware)", "WoW deposits delta (this wk vs last)", "vs-goal marker (% of 180, ink — gold stays on the hero gap)"],
    defaultShows: "Deposits / 180 + WoW + % to goal + RAG.",
    drilldownShows: "Pace-to-Aug-17 table: current, needed, projected — plus the offer→deposit leak.",
    qualityBar: "L5 — must state deposits/target, the WoW move, % to goal, and the run-rate gap (the binding-constraint proof).",
  },
  {
    id: "narrative.conversion",
    column: "narrative",
    stage: "conversion",
    question: "Why is conversion (not demand) the binding constraint, and what do we do?",
    citesData: ["deposits/target", "−gap to pace", "weekly vs required run rate", "the offer→deposit step"],
    structure: ["so-what: conversion is binding", "the full reference set", "the offer→deposit driver", "the Fall-goal consequence"],
    defaultShows: "The binding-constraint headline bullet.",
    drilldownShows: "Full conversion narrative + pace economics + the linked conversion decision.",
    qualityBar: "L5 — mirrors the Answer so the binding row and the page headline never disagree.",
  },
  {
    id: "position.nurture",
    column: "position",
    stage: "nurture",
    question: "Is speed-to-lead protecting the paid leads we already bought?",
    citesData: ["24h SLA %", "count of late follow-ups", "worst owner", "that there is no live weekly SLA series or target"],
    structure: ["SLA % headline", "RAG (red < 70, amber < 85)", "late count + worst owner subline", "honest 'no weekly series / target' basis note (WoW + goal omitted, not fabricated)"],
    defaultShows: "SLA % + late count + worst owner + RAG (WoW/goal omitted honestly).",
    drilldownShows: "SLA trend sparkline (labeled est.), worst-owner list, and the assign-owner action.",
    qualityBar: "L4+ — SLA labeled a deterministic stand-in (not live HubSpot); WoW/goal omitted honestly rather than invented.",
  },
];

/** The overall-status ("The Answer") rubric — the top-level board verdict. */
export interface AnswerRubric {
  id: "answer";
  question: string;
  /** The four C-suite questions the Answer must resolve, in order. */
  sectionsRequired: AnswerSectionKey[];
  citesData: string[];
  structure: string[];
  qualityBar: string;
}

export type AnswerSectionKey = "where" | "on_track" | "why" | "do";

export const ANSWER_SECTION_LABELS: Record<AnswerSectionKey, string> = {
  where: "Where we are",
  on_track: "On track?",
  why: "Why / why not",
  do: "What to do about it",
};

export const ANSWER_RUBRIC: AnswerRubric = {
  id: "answer",
  question: "Are we on track for Fall enrollment — and what should leadership do this week?",
  sectionsRequired: ["where", "on_track", "why", "do"],
  citesData: [
    "deposits / target + gap to pace (the north star)",
    "weekly run rate vs required",
    "demand (applicants) as the non-constraint",
    "speed-to-lead SLA",
    "open decisions + budget at stake",
  ],
  structure: [
    "a one-line headline verdict (the pyramid-principle answer)",
    "Where we are — the position in one organized bullet",
    "On track? — yes/no with the magnitude vs pace",
    "Why / why not — the binding constraint named",
    "What to do — the lever + the clock (Aug 17), as an action",
  ],
  qualityBar:
    "Board-appropriate: organized bullets (not prose), honest about the miss, leads with the answer, names ONE binding reason, ends on an action with a deadline.",
};

export function cellRubricFor(column: SpineColumn, stage?: FunnelStageKey): CellRubric {
  if (stage) {
    const specialized = STAGE_CELL_RUBRICS.find((r) => r.column === column && r.stage === stage);
    if (specialized) return specialized;
  }
  return COLUMN_RUBRICS[column];
}

export function allCellRubrics(): CellRubric[] {
  return [...Object.values(COLUMN_RUBRICS), ...STAGE_CELL_RUBRICS];
}

// ---------------------------------------------------------------------------
// Conformance checks — the falsifiable contract used by tests + generation QA
// ---------------------------------------------------------------------------

export interface CellConformance {
  id: string;
  column: SpineColumn;
  stage?: FunnelStageKey;
  pass: boolean;
  failures: string[];
}

const NUM_RE = /\d/;

function bulletText(bullets: StatusBullet[] | undefined): string {
  return (bullets ?? []).map((b) => b.text).join(" ");
}

/** Does a stage cell satisfy its column rubric? Returns the failures (empty = pass). */
export function checkCellConformance(
  cell: StatusCell,
  column: SpineColumn,
  stage: FunnelStageKey,
  rag?: RagStatus,
): CellConformance {
  const rubric = cellRubricFor(column, stage);
  const failures: string[] = [];

  if (column === "position") {
    const stat = cell.stat;
    const hasNumber = Boolean(stat?.value && NUM_RE.test(stat.value));
    if (!hasNumber) failures.push("Position must carry a real headline number (where we are now).");
    if (!rag) failures.push("Position must carry a RAG status.");
    if (!stat?.unit && !cell.subline) failures.push("Position needs a unit or supporting subline (against-what).");
    if (cell.derived && !cell.derivedNote) failures.push("Derived Position value must carry a derivation note.");
    // where / vs-last-week / vs-goal — each must be SHOWN or honestly explained
    // (a basis note or derivation caveat). Never a fabricated WoW or target.
    const honest = Boolean(stat?.basisNote || cell.derivedNote);
    if (!stat?.wow && !honest) {
      failures.push("Position must show vs-last-week (WoW) or honestly note why there is no weekly series.");
    }
    if (!stat?.goal && !honest) {
      failures.push("Position must show vs-goal (now/target or % to target) or honestly note why there is no target.");
    }
  }

  if (column === "drivers") {
    if (!cell.subline && !cell.owner) failures.push("Drivers must carry a one-line glance for the calm default.");
    const hasDepth = Boolean(
      cell.rankedBars?.length || cell.funnelSteps?.length || cell.sparkline || cell.budgetSlice,
    );
    if (!hasDepth) failures.push("Drivers must carry chart/economics depth for the drawer.");
    if (cell.derived && !cell.derivedNote) failures.push("Derived Drivers must label the estimation method.");
  }

  if (column === "decisions") {
    const hasDecision = Boolean(cell.decision?.question && cell.decision.href);
    const hasHonestThin = Boolean(cell.thin && (cell.thinReason || cell.subline));
    if (!hasDecision && !hasHonestThin) {
      failures.push("Decisions must link a real decision OR explain why there is no open ask.");
    }
  }

  if (column === "narrative") {
    const bullets = cell.bullets ?? [];
    if (bullets.length === 0) failures.push("Narrative must carry at least one headline bullet.");
    const text = bulletText(bullets);
    if (!NUM_RE.test(text)) failures.push("Narrative headline must carry a real number (direction + magnitude).");
    const top = bullets[0]?.text ?? "";
    const words = top.trim().split(/\s+/).length;
    if (words < 6) failures.push("Narrative headline is too thin to be a board takeaway (so-what first).");
    if (words > 45) failures.push("Narrative headline exceeds the ~25-word L5 tightness bar.");
    // Binding row must agree with the Answer (the conversion narrative names the constraint).
    if (stage === "conversion" && !/bind|conversion/i.test(text)) {
      failures.push("Conversion narrative must name conversion as the binding constraint.");
    }
  }

  return { id: rubric.id, column, stage, pass: failures.length === 0, failures };
}

export interface AnswerConformance {
  pass: boolean;
  failures: string[];
}

export interface AnswerShape {
  headline: string;
  rag: RagStatus;
  sections: { key: AnswerSectionKey; bullets: StatusBullet[] }[];
}

/** Does the generated Answer satisfy the overall-status rubric? */
export function checkAnswerConformance(answer: AnswerShape): AnswerConformance {
  const failures: string[] = [];
  if (!answer.headline || answer.headline.trim().split(/\s+/).length < 4) {
    failures.push("Answer needs a one-line headline verdict.");
  }
  const keys = new Set(answer.sections.map((s) => s.key));
  for (const required of ANSWER_RUBRIC.sectionsRequired) {
    if (!keys.has(required)) failures.push(`Answer is missing the "${ANSWER_SECTION_LABELS[required]}" section.`);
  }
  for (const section of answer.sections) {
    if (section.bullets.length === 0) {
      failures.push(`Answer section "${ANSWER_SECTION_LABELS[section.key]}" has no bullet.`);
    }
  }
  const allText = answer.sections.flatMap((s) => s.bullets.map((b) => b.text)).join(" ");
  if (!NUM_RE.test(allText)) failures.push("Answer must cite real numbers (deposits/pace/SLA).");
  if (!/aug|deadline|deposit|pace/i.test(allText)) {
    failures.push("Answer must tie to the Fall goal / the clock.");
  }
  return { pass: failures.length === 0, failures };
}
