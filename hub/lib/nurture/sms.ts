// sms.ts — the SMS inbox stand-in (HubSpot Conversations / GT Anywhere) with the v1
// deterministic keyword theme classifier and the consent/PII rules.
//
// - Every thread carries ≥1 theme; an unmatched body falls back to `untagged` (#7).
// - A STOP message sets opted_out=true and the thread is suppressed from quick-reply (#8).
// - PII (raw phone/body) is gated at the view layer (see rbac.ts) — this module produces
//   the raw data; the renderer masks it for non-Admin/Leader roles.
// - Flag-to-hot-family is idempotent: the dedupe_key collapses repeat flags to one (#9).

import type { Family } from "@/lib/seed/types";
import { hash01 } from "./util";

export type SmsTheme = "tuition" | "scheduling" | "curriculum" | "logistics" | "opt_out" | "untagged";

export interface SmsThread {
  threadId: string;
  familyId: string;
  responderPhone: string | null; // PII
  body: string; // PII — last inbound message
  lastMessageAt: string;
  unread: boolean;
  optedOut: boolean;
  themes: SmsTheme[];
}

const SAMPLE_BODIES: { body: string; minutesAgo: number }[] = [
  { body: "What's the tuition and are there scholarships? The cost is my main question.", minutesAgo: 30 },
  { body: "Can we reschedule the shadow day to next week?", minutesAgo: 180 },
  { body: "How does the self-paced curriculum work for a 2nd grader?", minutesAgo: 600 },
  { body: "Where is the Austin campus and what time is drop-off?", minutesAgo: 1440 },
  { body: "STOP", minutesAgo: 2880 },
  { body: "Thanks, talk soon!", minutesAgo: 90 },
];

/** v1 deterministic keyword theme rules. Always returns ≥1 theme (`untagged` fallback). */
export function classifyTheme(body: string): SmsTheme[] {
  const t = body.toLowerCase();
  if (/\bstop\b|unsubscribe|opt out/.test(t)) return ["opt_out"];
  const themes: SmsTheme[] = [];
  if (/tuition|cost|price|scholarship|afford|pay/.test(t)) themes.push("tuition");
  if (/reschedul|schedul|time|when|date/.test(t)) themes.push("scheduling");
  if (/curriculum|grade|learn|self-paced|class|subject/.test(t)) themes.push("curriculum");
  if (/campus|where|location|drop-off|address|logistic/.test(t)) themes.push("logistics");
  return themes.length ? themes : ["untagged"];
}

/** Build a deterministic inbox from a subset of families that have a phone. */
export function buildInbox(families: Family[], asOf: string, limit = 24): SmsThread[] {
  const asOfMs = Date.parse(asOf);
  const withPhone = families.filter((f) => !!f.phone).slice(0, limit);
  return withPhone.map((f, i) => {
    const sample = SAMPLE_BODIES[i % SAMPLE_BODIES.length];
    const themes = classifyTheme(sample.body);
    const optedOut = themes.includes("opt_out");
    return {
      threadId: `sms_${f.id.slice(0, 8)}`,
      familyId: f.id,
      responderPhone: f.phone,
      body: sample.body,
      lastMessageAt: new Date(asOfMs - sample.minutesAgo * 60_000).toISOString(),
      unread: hash01(f.id + ":unread") < 0.4,
      optedOut,
      themes,
    };
  });
}

export type SmsFilter = "unread" | "objection" | "hot_family" | "all";

export function filterInbox(threads: SmsThread[], filter: SmsFilter): SmsThread[] {
  if (filter === "unread") return threads.filter((t) => t.unread && !t.optedOut);
  if (filter === "objection") return threads.filter((t) => t.themes.includes("tuition"));
  if (filter === "hot_family") return threads.filter((t) => t.themes.includes("tuition") && t.unread);
  return threads;
}

/** A thread is quick-reply-able only if the responder has NOT opted out (STOP). */
export function canQuickReply(thread: SmsThread): boolean {
  return !thread.optedOut;
}

// ---------------- hot-family cross-link (idempotent) ----------------

export interface FamilyFlag {
  familyId: string;
  kind: "hot_family";
  reason: string;
  sourceModule: "nurture";
  dedupeKey: string;
  createdBy: string;
  createdAt: string;
}

export function hotFamilyDedupeKey(familyId: string, kind = "hot_family"): string {
  return `${familyId}:${kind}`;
}

/**
 * Apply a hot-family flag idempotently against an existing flag list. Flagging the same
 * family twice yields ONE row (UNIQUE dedupe_key) → one Admissions chip + one Decision.
 */
export function flagHotFamily(
  existing: FamilyFlag[],
  familyId: string,
  reason: string,
  createdBy: string,
  createdAt: string,
): { flags: FamilyFlag[]; created: boolean } {
  const dedupeKey = hotFamilyDedupeKey(familyId);
  if (existing.some((f) => f.dedupeKey === dedupeKey)) {
    return { flags: existing, created: false };
  }
  const flag: FamilyFlag = {
    familyId,
    kind: "hot_family",
    reason,
    sourceModule: "nurture",
    dedupeKey,
    createdBy,
    createdAt,
  };
  return { flags: [...existing, flag], created: true };
}
