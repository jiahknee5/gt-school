// Pure builder for the append-only Decision Queue audit trail (security finding S6).
// Kept dependency-free (no DB, no next/headers) so the decide route can compose it and
// unit tests can assert exactly which who/when/what row gets written — without a live DB.

import type { Decision } from "@/lib/seed/types";
import type { DecisionResponse } from "@/lib/decisions/transitions";

export type DecisionActor = {
  id: string;
  name?: string | null;
  role: string;
};

/** One immutable row in `decision_event` — the proof that a specific leader ruled. */
export type DecisionEvent = {
  decisionId: string;
  actorId: string;
  actorName: string | null;
  actorRole: string;
  action: DecisionResponse;
  fromStatus: string;
  toStatus: string;
  note: string;
  createdAt: string;
};

/**
 * Build the audit event for a ruling, given the decision before/after the transition and
 * the authenticated actor. `after` must already carry the persisted response (the output
 * of applyDecisionTransition); we never invent an action the state machine didn't produce.
 */
export function buildDecisionEvent(
  before: Decision,
  after: Decision,
  actor: DecisionActor,
  now: Date = new Date(),
): DecisionEvent {
  if (!after.response) {
    throw new Error("Cannot record a decision event without a ruling response.");
  }
  if (!actor.id) {
    throw new Error("Cannot record a decision event without an actor id.");
  }
  return {
    decisionId: after.id,
    actorId: actor.id,
    actorName: actor.name ?? null,
    actorRole: actor.role,
    action: after.response as DecisionResponse,
    fromStatus: before.status,
    toStatus: after.status,
    note: after.response_note ?? "",
    createdAt: now.toISOString(),
  };
}
