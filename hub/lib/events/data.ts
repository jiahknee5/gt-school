// data.ts — deterministic stand-in for GT-organized field events (manual entry; no API in
// v1). Source of truth for field_events lives HERE. Includes the PLAN edge cases: a
// DUPLICATE (name+date), an INCOMPLETE/stale row, and uninstrumented consults_booked
// (consult_source always 'manual_entry' — never 'tracked', invariant #1).

export type EventType = "shadow_day" | "chess" | "ama" | "community" | "festival" | "webinar";
export type EventStatus = "planning" | "confirmed" | "completed" | "cancelled";

export interface FieldEvent {
  id: string;
  name: string;
  type: EventType;
  eventDate: string; // YYYY-MM-DD
  venue: string;
  region: string;
  rsvpCount: number;
  attendance: number;
  consultsBooked: number;
  consultSource: "manual_entry"; // honesty marker — never 'tracked' in v1
  owner: string;
  status: EventStatus;
  workstreamKey: "grassroots" | "guerrilla";
  budget: number;
  targetPersona: string;
  notes: string;
  createdAt: string;
}

export const FIELD_EVENTS: FieldEvent[] = [
  { id: "fe_1", name: "Georgetown Shadow Day", type: "shadow_day", eventDate: "2026-07-09", venue: "Georgetown campus", region: "Georgetown, TX", rsvpCount: 40, attendance: 33, consultsBooked: 9, consultSource: "manual_entry", owner: "the Field & Events Owner", status: "completed", workstreamKey: "grassroots", budget: 2400, targetPersona: "gifted-parent", notes: "Strong turnout", createdAt: "2026-06-25" },
  { id: "fe_2", name: "Austin Chess Tournament", type: "chess", eventDate: "2026-07-18", venue: "Austin rec center", region: "Austin, TX", rsvpCount: 64, attendance: 51, consultsBooked: 7, consultSource: "manual_entry", owner: "the Field & Events Owner", status: "confirmed", workstreamKey: "grassroots", budget: 3800, targetPersona: "afterschool", notes: "Trophies ordered", createdAt: "2026-06-20" },
  { id: "fe_3", name: "Founder AMA — ESA & GT Anywhere", type: "ama", eventDate: "2026-07-23", venue: "virtual", region: "Online", rsvpCount: 120, attendance: 78, consultsBooked: 14, consultSource: "manual_entry", owner: "the Field & Events Owner", status: "confirmed", workstreamKey: "grassroots", budget: 600, targetPersona: "esa-curious", notes: "Founder confirmed", createdAt: "2026-06-22" },
  { id: "fe_4", name: "Dallas Community Festival", type: "festival", eventDate: "2026-08-01", venue: "Dallas fairgrounds", region: "Dallas, TX", rsvpCount: 0, attendance: 0, consultsBooked: 0, consultSource: "manual_entry", owner: "the Field & Events Owner", status: "planning", workstreamKey: "guerrilla", budget: 9000, targetPersona: "gifted-parent", notes: "", createdAt: "2026-05-30" }, // incomplete/stale
  { id: "fe_5", name: "Houston Webinar: Gifted at home", type: "webinar", eventDate: "2026-08-06", venue: "virtual", region: "Online", rsvpCount: 85, attendance: 52, consultsBooked: 6, consultSource: "manual_entry", owner: "the Field & Events Owner", status: "planning", workstreamKey: "grassroots", budget: 400, targetPersona: "homeschool", notes: "Deck in review", createdAt: "2026-06-26" },
  // DUPLICATE of fe_1 (same name + date) — must be flagged, never silently counted twice.
  { id: "fe_dup", name: "Georgetown Shadow Day", type: "shadow_day", eventDate: "2026-07-09", venue: "Georgetown campus", region: "Georgetown, TX", rsvpCount: 40, attendance: 33, consultsBooked: 9, consultSource: "manual_entry", owner: "the Field & Events Owner", status: "completed", workstreamKey: "grassroots", budget: 2400, targetPersona: "gifted-parent", notes: "dup", createdAt: "2026-06-25" },
];
