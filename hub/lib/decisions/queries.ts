// Pure, dependency-free read helpers for the Decision Queue (Module 11). No DB, no
// next/headers — so these are safe to import from server components AND unit tests,
// and they render from the same Decision[] the live engine produces.
//
// RBAC note: the *gate* (Leader-only view+act) lives in middleware + the API routes +
// the sidebar hide. These helpers are the read-shaping layer the Leader queue and the
// submitter own-status view sit on top of. `submittedBy` / `visibleToRole` encode the
// "submit = all, view full queue = Leader" split at the data layer (defense in depth).

import type { Decision } from "@/lib/seed/types";

export type DecisionViewer = { role: string; title: string };

/** A decision still needs leadership attention until it is decided. */
export function isActive(decision: Decision): boolean {
  return decision.status !== "decided";
}

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function priorityRank(priority: string): number {
  return PRIORITY_RANK[priority?.toLowerCase()] ?? 2;
}

function dueRank(due: string | null): number {
  // Sooner due dates float up; rows with no due date sort last.
  return due ? new Date(due).getTime() : Number.MAX_SAFE_INTEGER;
}

/** Active decisions, urgent first, then soonest due, then oldest raised. */
export function activeDecisions(decisions: Decision[]): Decision[] {
  return decisions
    .filter(isActive)
    .slice()
    .sort(
      (a, b) =>
        priorityRank(a.priority) - priorityRank(b.priority) ||
        dueRank(a.due_date) - dueRank(b.due_date) ||
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
}

/** Decided decisions, most-recently-resolved first (the searchable archive). */
export function historyDecisions(decisions: Decision[]): Decision[] {
  return decisions
    .filter((d) => d.status === "decided")
    .slice()
    .sort(
      (a, b) =>
        new Date(b.resolved_at ?? b.created_at).getTime() -
        new Date(a.resolved_at ?? a.created_at).getTime(),
    );
}

/** The Leader-only red-dot badge counts strictly OPEN (un-ruled) decisions. */
export function openBadgeCount(decisions: Decision[]): number {
  return decisions.filter((d) => d.status === "open").length;
}

export interface DecisionStats {
  total: number;
  open: number;
  inFlight: number;
  decided: number;
  urgentOpen: number;
  autoFlagged: number;
  /** Sum of budget_ask across still-active decisions (what's awaiting a ruling). */
  budgetAtStake: number;
}

export function decisionStats(decisions: Decision[]): DecisionStats {
  const stats: DecisionStats = {
    total: decisions.length,
    open: 0,
    inFlight: 0,
    decided: 0,
    urgentOpen: 0,
    autoFlagged: 0,
    budgetAtStake: 0,
  };
  for (const d of decisions) {
    if (d.status === "open") stats.open += 1;
    else if (d.status === "in_flight") stats.inFlight += 1;
    else if (d.status === "decided") stats.decided += 1;
    if (d.status === "open" && priorityRank(d.priority) === 0) stats.urgentOpen += 1;
    if (d.auto_flag) stats.autoFlagged += 1;
    if (isActive(d) && d.budget_ask) stats.budgetAtStake += d.budget_ask;
  }
  return stats;
}

/**
 * Title-match the decisions a given user submitted. Mirrors the seed convention where
 * `raised_by` carries the submitter's title (e.g. "the Content Owner"). Used by the
 * submitter own-status view, which is open to ALL roles (you can always see your own).
 */
export function submittedBy(decisions: Decision[], title: string): Decision[] {
  const needle = title.trim().toLowerCase();
  if (!needle) return [];
  return decisions.filter((d) => (d.raised_by ?? "").toLowerCase().includes(needle));
}

/**
 * Role-aware queue visibility (the read half of the RBAC split): a Leader sees the
 * full queue; everyone else sees only their own submissions. The API + middleware are
 * the primary gate — this is the data-layer twin so a non-Leader read can never widen.
 */
export function visibleToRole(decisions: Decision[], viewer: DecisionViewer): Decision[] {
  if (viewer.role === "leader") return decisions;
  return submittedBy(decisions, viewer.title);
}

export type OutcomeTone = "neutral" | "good" | "watch" | "risk";

/** Human label for a decision's lifecycle state (used by both queue + own-status). */
export function outcomeLabel(decision: Decision): string {
  if (decision.status === "open") return "Open";
  if (decision.status === "in_flight") return "Awaiting info";
  if (decision.response === "approve") return "Approved";
  if (decision.response === "reject") return "Rejected";
  if (decision.response === "need_info") return "Info requested";
  return "Decided";
}

export function outcomeTone(decision: Decision): OutcomeTone {
  if (decision.status === "open") {
    return priorityRank(decision.priority) === 0 ? "risk" : "watch";
  }
  if (decision.status === "in_flight") return "watch";
  if (decision.response === "approve") return "good";
  if (decision.response === "reject") return "risk";
  return "neutral";
}
