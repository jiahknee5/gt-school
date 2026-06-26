// calendar.ts — merge GT-organized field_events with the READ-ONLY ambassador overlay
// (owned by Module 2 Grassroots). Ambassador events render distinctly and are NEVER counted
// as GT-organized (no double-count, invariant #2). Type is encoded by color + text/shape
// (not color alone) for accessibility.

import { FIELD_EVENTS, type EventType } from "./data";
import { dedupeEvents } from "./metrics";
import { PARENT_EVENTS } from "@/lib/grassroots/data";

export interface CalendarItem {
  id: string;
  name: string;
  date: string;
  kind: "gt_organized" | "ambassador";
  type: string;
  glyph: string; // shape/text token (a11y — never color alone)
  color: string;
  readOnly: boolean;
}

const TYPE_STYLE: Record<EventType, { glyph: string; color: string }> = {
  shadow_day: { glyph: "◆ Shadow", color: "var(--green)" },
  chess: { glyph: "♟ Chess", color: "var(--gold)" },
  ama: { glyph: "● AMA", color: "var(--amber)" },
  community: { glyph: "▲ Community", color: "var(--slate)" },
  festival: { glyph: "★ Festival", color: "var(--red)" },
  webinar: { glyph: "▮ Webinar", color: "var(--ink)" },
};

export function buildCalendar(): CalendarItem[] {
  const gt: CalendarItem[] = dedupeEvents(FIELD_EVENTS).map((e) => ({
    id: e.id,
    name: e.name,
    date: e.eventDate,
    kind: "gt_organized",
    type: e.type,
    glyph: TYPE_STYLE[e.type].glyph,
    color: TYPE_STYLE[e.type].color,
    readOnly: false,
  }));
  // read-only overlay — owned by Module 2, never editable or counted here
  const amb: CalendarItem[] = PARENT_EVENTS.map((p) => ({
    id: `amb_${p.id}`,
    name: p.name,
    date: p.date,
    kind: "ambassador",
    type: p.type,
    glyph: "◇ Ambassador",
    color: "var(--muted)",
    readOnly: true,
  }));
  return [...gt, ...amb].sort((a, b) => a.date.localeCompare(b.date));
}

/** GT-organized count excludes the ambassador overlay (proves no double-count). */
export function gtOrganizedCount(items: CalendarItem[]): number {
  return items.filter((i) => i.kind === "gt_organized").length;
}
