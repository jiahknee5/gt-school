// proposals.ts — priority event proposal → Decision Queue intake. Submitting a proposal N
// times creates EXACTLY ONE decisions row (idempotent on source_ref, invariant #3). The
// Operator (Field & Events Owner) may submit but cannot view/act on the queue (RBAC,
// invariant #5) — they only read back their own proposal's response.

import type { Role } from "@/lib/phase2";

const DAY = 86_400_000;
const LEAD_DAYS = 14;

export interface EventProposal {
  id: string;
  name: string;
  type: string;
  proposedDate: string;
  rationale: string;
  expectedAttendance: number;
  budgetAsk: number;
  targetPersona: string;
  workstreamKey: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  decisionId: string | null;
  createdBy: string;
}

export interface DecisionIntake {
  source_module: "events";
  source_ref: string;
  question: string;
  raised_by: string;
  workstream: string;
  recommendation: string;
  budget_ask: number;
  due_date: string;
  priority: "normal" | "urgent";
}

export function buildIntake(p: EventProposal): DecisionIntake {
  const due = new Date(Date.parse(p.proposedDate) - LEAD_DAYS * DAY).toISOString().slice(0, 10);
  return {
    source_module: "events",
    source_ref: p.id,
    question: `Approve ${p.name} (${p.type}, ${p.proposedDate})?`,
    raised_by: p.createdBy,
    workstream: p.workstreamKey,
    recommendation: `${p.rationale} · expected attendance ${p.expectedAttendance} · persona ${p.targetPersona}`,
    budget_ask: p.budgetAsk,
    due_date: due,
    priority: p.budgetAsk > 5000 ? "urgent" : "normal",
  };
}

export interface SubmitResult {
  proposals: EventProposal[];
  intakes: DecisionIntake[];
  created: boolean;
}

/** Idempotent submit: one decision per proposal (keyed on source_ref). */
export function submitProposal(
  proposals: EventProposal[],
  intakes: DecisionIntake[],
  proposalId: string,
): SubmitResult {
  const p = proposals.find((x) => x.id === proposalId);
  if (!p) return { proposals, intakes, created: false };
  if (intakes.some((i) => i.source_ref === proposalId)) {
    return { proposals, intakes, created: false }; // already submitted — no-op
  }
  const intake = buildIntake(p);
  const nextProposals = proposals.map((x) => (x.id === proposalId ? { ...x, status: "submitted" as const, decisionId: `dec_${proposalId}` } : x));
  return { proposals: nextProposals, intakes: [...intakes, intake], created: true };
}

export function canSubmitProposal(role: Role | null | undefined): boolean {
  return role === "admin" || role === "leader" || role === "operator";
}

export function canViewDecisionQueue(role: Role | null | undefined): boolean {
  return role === "leader";
}

export function canEditEvents(role: Role | null | undefined, isOwner = true): boolean {
  if (role === "admin") return true;
  if (role === "operator") return isOwner; // non-owner write denied
  return false;
}

export const SEED_PROPOSALS: EventProposal[] = [
  { id: "prop_1", name: "San Antonio Shadow Day", type: "shadow_day", proposedDate: "2026-09-12", rationale: "Untapped metro with strong ESA interest", expectedAttendance: 35, budgetAsk: 3200, targetPersona: "gifted-parent", workstreamKey: "grassroots", status: "draft", decisionId: null, createdBy: "the Field & Events Owner" },
  { id: "prop_2", name: "Fort Worth Festival Booth", type: "festival", proposedDate: "2026-09-20", rationale: "High-traffic earned-media bet", expectedAttendance: 200, budgetAsk: 8000, targetPersona: "afterschool", workstreamKey: "guerrilla", status: "draft", decisionId: null, createdBy: "the Field & Events Owner" },
];
