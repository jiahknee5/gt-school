import type { Role } from "@/lib/phase2";

export const DECISION_QUEUE_PATH = "/m/decisions";
export const MY_SUBMISSIONS_PATH = "/m/submissions";

export function decisionStatusHref(role: Role | null | undefined): string {
  return role === "leader" ? DECISION_QUEUE_PATH : MY_SUBMISSIONS_PATH;
}

export function decisionStatusLabel(role: Role | null | undefined): string {
  return role === "leader" ? "Decision Queue" : "My submissions";
}
