import type { Decision } from "@/lib/seed/types";

export type DecisionResponse = "approve" | "reject" | "need_info";

export type DecisionTransitionInput = {
  response: string | null | undefined;
  note: string | null | undefined;
};

export class DecisionTransitionError extends Error {
  status: 400 | 409;

  constructor(status: 400 | 409, message: string) {
    super(message);
    this.status = status;
    this.name = "DecisionTransitionError";
  }
}

export function normalizeDecisionResponse(value: string | null | undefined): DecisionResponse {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (normalized === "approve" || normalized === "reject" || normalized === "need_info") {
    return normalized;
  }
  throw new DecisionTransitionError(
    400,
    "Decision response must be approve, reject, or need_info.",
  );
}

export function applyDecisionTransition(
  decision: Decision,
  input: DecisionTransitionInput,
  now = new Date(),
): Decision {
  if (decision.status !== "open") {
    throw new DecisionTransitionError(409, "Only open decisions can receive a ruling.");
  }

  const response = normalizeDecisionResponse(input.response);
  const note = String(input.note ?? "").trim();
  if (!note) {
    throw new DecisionTransitionError(400, "Decision response requires a leadership note.");
  }

  return {
    ...decision,
    status: response === "need_info" ? "in_flight" : "decided",
    response,
    response_note: note,
    resolved_at: response === "need_info" ? null : now.toISOString(),
  };
}
