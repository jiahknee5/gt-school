// sequences.ts — read-only sequence health (Marcus Bell: NO Hub write path to HubSpot).
//
// The Hub never mutates a sequence. "Approve" / "kill" produces exactly ONE Decision
// Queue row (invariant #5), routed to Leaders — it is not a HubSpot mutation.

export type SequenceType = "welcome" | "nurture" | "re-engagement" | "event" | "waitlist";

export interface SequenceStat {
  seqId: string;
  name: string;
  type: SequenceType;
  audienceSize: number;
  sends: number;
  opens: number;
  clicks: number;
  conversions: number;
}

export interface SequenceHealth extends SequenceStat {
  openRate: number;
  clickRate: number;
  convRate: number;
  healthy: boolean; // false → flagged for review
}

// A small fixed catalog of active sequences (HubSpot read-only mirror).
export const SEQUENCES: SequenceStat[] = [
  { seqId: "seq_welcome", name: "Welcome — applicant onboarding", type: "welcome", audienceSize: 540, sends: 2100, opens: 1280, clicks: 410, conversions: 95 },
  { seqId: "seq_nurture", name: "Nurture — engaged leads", type: "nurture", audienceSize: 3100, sends: 9400, opens: 4100, clicks: 980, conversions: 140 },
  { seqId: "seq_reengage", name: "Re-engagement — cold 30d", type: "re-engagement", audienceSize: 1800, sends: 3600, opens: 540, clicks: 72, conversions: 9 },
  { seqId: "seq_waitlist", name: "Waitlist — ESA value frame", type: "waitlist", audienceSize: 1124, sends: 2248, opens: 1010, clicks: 260, conversions: 48 },
];

const MIN_OPEN_RATE = 0.2;
const MIN_CLICK_RATE = 0.03;

export function sequenceHealth(stats: SequenceStat[] = SEQUENCES): SequenceHealth[] {
  return stats.map((s) => {
    const openRate = s.sends > 0 ? Number((s.opens / s.sends).toFixed(3)) : 0;
    const clickRate = s.sends > 0 ? Number((s.clicks / s.sends).toFixed(3)) : 0;
    const convRate = s.sends > 0 ? Number((s.conversions / s.sends).toFixed(3)) : 0;
    return {
      ...s,
      openRate,
      clickRate,
      convRate,
      healthy: openRate >= MIN_OPEN_RATE && clickRate >= MIN_CLICK_RATE,
    };
  });
}

export interface SequenceDecisionPayload {
  question: string;
  workstream: string;
  recommendation: string;
  raised_by: string;
  seq_id: string;
  action: "approve" | "kill";
}

/** Approve/kill → a SINGLE Decision Queue payload (never a HubSpot write). */
export function sequenceDecision(
  seqId: string,
  action: "approve" | "kill",
  raisedBy: string,
): SequenceDecisionPayload {
  const seq = SEQUENCES.find((s) => s.seqId === seqId);
  const name = seq?.name ?? seqId;
  return {
    question:
      action === "kill"
        ? `Kill underperforming sequence "${name}"?`
        : `Approve scaling sequence "${name}"?`,
    workstream: "thought_leadership",
    recommendation:
      action === "kill"
        ? "Performance is below the open/click threshold; pause and re-draft."
        : "Performance is healthy; expand the audience.",
    raised_by: raisedBy,
    seq_id: seqId,
    action,
  };
}
