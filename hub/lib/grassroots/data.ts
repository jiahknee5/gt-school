// data.ts — deterministic stand-ins for the manual-entry grassroots surfaces
// (parent-led events, referral sprints). Source of truth for parent_events lives HERE;
// Field Marketing reads them via the read-only cross-link (crosslinks.ts).

export interface ParentEvent {
  id: string;
  name: string;
  host: string;
  date: string;
  location: string;
  type: "coffee_chat" | "qa" | "school_visit" | "virtual";
  rsvpCount: number;
  attendance: number;
  conversionsInfluenced: number;
}

export const PARENT_EVENTS: ParentEvent[] = [
  { id: "pe_1", name: "Austin gifted-parent coffee", host: "Maria Alvarez", date: "2026-07-12", location: "Austin, TX", type: "coffee_chat", rsvpCount: 22, attendance: 18, conversionsInfluenced: 3 },
  { id: "pe_2", name: "Dallas Q&A: ESA + GT Anywhere", host: "James Park", date: "2026-07-19", location: "Dallas, TX", type: "qa", rsvpCount: 40, attendance: 31, conversionsInfluenced: 6 },
  { id: "pe_3", name: "Virtual curriculum walkthrough", host: "Priya Shah", date: "2026-07-26", location: "Online", type: "virtual", rsvpCount: 65, attendance: 44, conversionsInfluenced: 5 },
  { id: "pe_4", name: "Houston school visit", host: "Dana Lee", date: "2026-08-02", location: "Houston, TX", type: "school_visit", rsvpCount: 15, attendance: 12, conversionsInfluenced: 2 },
];

export interface ReferralSprint {
  id: string;
  name: string;
  windowStart: string;
  windowEnd: string;
  status: "active" | "archived";
  enlisted: number;
  familiesIdentified: number;
  conversions: number;
}

export const REFERRAL_SPRINTS: ReferralSprint[] = [
  { id: "rs_1", name: "Back-to-school referral sprint", windowStart: "2026-08-01", windowEnd: "2026-08-15", status: "active", enlisted: 12, familiesIdentified: 34, conversions: 7 },
  { id: "rs_2", name: "Summer ESA sprint", windowStart: "2026-06-15", windowEnd: "2026-06-29", status: "archived", enlisted: 9, familiesIdentified: 21, conversions: 5 },
];
