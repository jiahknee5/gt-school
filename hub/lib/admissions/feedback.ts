// feedback.ts — the feedback-to-marketing loop. An actionable item renders a chip in
// Nurture AND (if urgent) is SUBMITTED to the Decision Queue by the Operator — who can
// submit but NOT view/decide the queue (invariant #7, RBAC). closure_rate = actioned
// within 7 days ÷ flagged (invariant #6) — not a write-only loop.

import type { Role } from "@/lib/phase2";

const DAY = 86_400_000;

export type FeedbackCategory =
  | "messaging_gap"
  | "persona_mismatch"
  | "objection_pattern"
  | "positive_signal"
  | "urgent";

export interface MarketingFeedback {
  id: string;
  category: FeedbackCategory;
  note: string;
  actionable: boolean;
  decisionId: string | null;
  status: "open" | "actioned" | "dismissed";
  flaggedAt: string;
  actionedAt: string | null;
}

/** Operator may SUBMIT feedback to the Decision Queue; nobody may view it from here. */
export function canSubmitFeedback(role: Role | null | undefined): boolean {
  return role === "admin" || role === "leader" || role === "operator";
}

export function canViewDecisionQueue(role: Role | null | undefined): boolean {
  return role === "leader";
}

export interface DecisionSubmission {
  question: string;
  workstream: string;
  raised_by: string;
  recommendation: string;
}

export function submitToDecisionQueue(item: MarketingFeedback, raisedBy: string): DecisionSubmission {
  return {
    question: `Marketing feedback (${item.category}): ${item.note}`,
    workstream: "thought_leadership",
    raised_by: raisedBy,
    recommendation: "Review the flagged objection/messaging pattern and assign an owner.",
  };
}

/** closure_rate = count(actioned within 7d of flag) ÷ count(flagged). */
export function closureRate(items: MarketingFeedback[]): number {
  if (items.length === 0) return 0;
  const closed = items.filter(
    (i) =>
      i.status === "actioned" &&
      i.actionedAt !== null &&
      Date.parse(i.actionedAt) - Date.parse(i.flaggedAt) <= 7 * DAY,
  ).length;
  return Number((closed / items.length).toFixed(3));
}

/** A small deterministic seed feedback set (covers actioned-in-time, late, and open). */
export function seedFeedback(asOf: string): MarketingFeedback[] {
  const asOfMs = Date.parse(asOf);
  const iso = (ms: number) => new Date(ms).toISOString();
  return [
    { id: "fb_1", category: "messaging_gap", note: "Cost objection rising — need an ESA value explainer.", actionable: true, decisionId: "dec_1", status: "actioned", flaggedAt: iso(asOfMs - 10 * DAY), actionedAt: iso(asOfMs - 6 * DAY) },
    { id: "fb_2", category: "urgent", note: "Multiple gifted_enough doubts from shadow-day families.", actionable: true, decisionId: "dec_2", status: "actioned", flaggedAt: iso(asOfMs - 9 * DAY), actionedAt: iso(asOfMs - 1 * DAY) }, // > 7d late
    { id: "fb_3", category: "objection_pattern", note: "Scheduling complaints clustering on the AM cohort.", actionable: true, decisionId: null, status: "open", flaggedAt: iso(asOfMs - 3 * DAY), actionedAt: null },
    { id: "fb_4", category: "positive_signal", note: "Strong word-of-mouth in the Austin parent group.", actionable: false, decisionId: null, status: "actioned", flaggedAt: iso(asOfMs - 5 * DAY), actionedAt: iso(asOfMs - 4 * DAY) },
  ];
}
