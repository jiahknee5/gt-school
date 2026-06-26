// metrics.ts — single Field-Events metric definitions. attendance-rate and event→consult
// each have ONE definition (invariant #6); event→consult is always badged manual/
// uninstrumented (invariant #1). Duplicate (name+date) rows are flagged, never silently
// counted (invariant #7). GT-organized counts EXCLUDE the read-only ambassador overlay.

import { FIELD_EVENTS, type FieldEvent, type EventType } from "./data";

const DAY = 86_400_000;
export const PROPOSAL_LEAD_DAYS = 14;

/** Deduped active events: drop exact (name+date) duplicates AND cancelled rows. */
export function dedupeEvents(events: FieldEvent[] = FIELD_EVENTS): FieldEvent[] {
  const seen = new Set<string>();
  const out: FieldEvent[] = [];
  for (const e of events) {
    if (e.status === "cancelled") continue;
    const key = `${e.name.toLowerCase()}|${e.eventDate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export interface DuplicateFlag {
  name: string;
  eventDate: string;
  count: number;
}

export function duplicateFlags(events: FieldEvent[] = FIELD_EVENTS): DuplicateFlag[] {
  const counts = new Map<string, DuplicateFlag>();
  for (const e of events) {
    const key = `${e.name.toLowerCase()}|${e.eventDate}`;
    const cur = counts.get(key);
    if (cur) cur.count += 1;
    else counts.set(key, { name: e.name, eventDate: e.eventDate, count: 1 });
  }
  return [...counts.values()].filter((d) => d.count > 1);
}

/** Required-field validation for the ≤30s add-event flow. */
export function validateEvent(e: Partial<FieldEvent>): string[] {
  const missing: string[] = [];
  if (!e.name?.trim()) missing.push("name");
  if (!e.type) missing.push("type");
  if (!e.eventDate) missing.push("event_date");
  return missing;
}

export function upcoming30d(asOf: string, events: FieldEvent[] = dedupeEvents()): FieldEvent[] {
  const now = Date.parse(asOf);
  return events.filter((e) => {
    const t = Date.parse(e.eventDate);
    return t >= now && t <= now + 30 * DAY;
  });
}

export function completedThisMonth(asOf: string, events: FieldEvent[] = dedupeEvents()): FieldEvent[] {
  const d = new Date(asOf);
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  return events.filter((e) => {
    if (e.status !== "completed") return false;
    const ed = new Date(e.eventDate);
    return ed.getUTCFullYear() === y && ed.getUTCMonth() === mo;
  });
}

/** attendance-rate = Σ attendance / Σ rsvp (single definition). */
export function attendanceRate(events: FieldEvent[] = dedupeEvents()): number {
  const rsvp = events.reduce((a, e) => a + e.rsvpCount, 0);
  const att = events.reduce((a, e) => a + e.attendance, 0);
  return rsvp > 0 ? Number((att / rsvp).toFixed(4)) : 0;
}

export interface EventToConsult {
  rate: number;
  consults: number;
  rsvp: number;
  instrumented: false; // manual v1 — always uninstrumented
  source: "manual_entry";
}

/** event→consult = Σ consults / Σ rsvp — ALWAYS badged manual/uninstrumented. */
export function eventToConsult(events: FieldEvent[] = dedupeEvents()): EventToConsult {
  const rsvp = events.reduce((a, e) => a + e.rsvpCount, 0);
  const consults = events.reduce((a, e) => a + e.consultsBooked, 0);
  return {
    rate: rsvp > 0 ? Number((consults / rsvp).toFixed(4)) : 0,
    consults,
    rsvp,
    instrumented: false,
    source: "manual_entry",
  };
}

export interface TypeAttendance {
  type: EventType;
  attendance: number;
  events: number;
}

export function topTypeByAttendance(events: FieldEvent[] = dedupeEvents()): TypeAttendance[] {
  const m = new Map<EventType, TypeAttendance>();
  for (const e of events) {
    const cur = m.get(e.type) ?? { type: e.type, attendance: 0, events: 0 };
    cur.attendance += e.attendance;
    cur.events += 1;
    m.set(e.type, cur);
  }
  return [...m.values()].sort((a, b) => b.attendance - a.attendance);
}

/** Stale/incomplete chip: planning rows with no RSVPs older than N days. */
export function staleEvents(asOf: string, staleDays = 14, events: FieldEvent[] = dedupeEvents()): FieldEvent[] {
  const now = Date.parse(asOf);
  return events.filter((e) => e.status === "planning" && e.rsvpCount === 0 && now - Date.parse(e.createdAt) > staleDays * DAY);
}

/** Event spend rolls into its workstream actual — no new workstream line. */
export function spendByWorkstream(events: FieldEvent[] = dedupeEvents()): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of events) out[e.workstreamKey] = (out[e.workstreamKey] ?? 0) + e.budget;
  return out;
}
