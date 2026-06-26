// sla.ts — the 24-hour first-contact SLA. Clock starts at app_form funnel-entry
// (Tara Whitfield). SLA% = contacted_within_24h ÷ new_applicants. The late-list is every
// applicant past 24h with no first contact, each OWNER-ATTRIBUTABLE (non-null owner) —
// invariant #6. First-contact is a deterministic stand-in (hash), so the numbers are
// reproducible from seed without seeding a new table.

import type { Family } from "@/lib/seed/types";
import { hash01 } from "./util";

const APPLICANT_PLUS = new Set(["applicant", "shadow_day", "deposit"]);
const OWNERS = ["Maya Patel", "David Chen", "Johnny Chung"];
const DAY = 86_400_000;

export interface SlaRow {
  familyId: string;
  funnelEnteredAt: string;
  contacted: boolean;
  withinSla: boolean;
  owner: string; // always attributable
}

export interface SlaSummary {
  newApplicants: number;
  contactedWithin24h: number;
  slaPct: number;
  lateList: SlaRow[];
}

function ownerFor(f: Family): string {
  return OWNERS[Math.floor(hash01(f.id + ":owner") * OWNERS.length) % OWNERS.length];
}

export function buildSla(families: Family[], asOf: string): SlaSummary {
  const asOfMs = Date.parse(asOf);
  const applicants = families.filter((f) => APPLICANT_PLUS.has(f.funnel_stage ?? ""));

  let contactedWithin24h = 0;
  const lateList: SlaRow[] = [];

  for (const f of applicants) {
    const enteredMs = Date.parse(f.created_at);
    // ~72% are contacted at all; of those, ~80% within 24h (deterministic).
    const contacted = hash01(f.id + ":contact") < 0.72;
    const fast = contacted && hash01(f.id + ":fast") < 0.8;
    const ageHours = (asOfMs - enteredMs) / (DAY / 24);
    const owner = ownerFor(f);

    if (fast) contactedWithin24h += 1;
    const row: SlaRow = { familyId: f.id, funnelEnteredAt: f.created_at, contacted, withinSla: fast, owner };
    // Late = past 24h AND no first contact.
    if (!contacted && ageHours > 24) lateList.push(row);
  }

  const newApplicants = applicants.length;
  const slaPct = newApplicants > 0 ? Number(((100 * contactedWithin24h) / newApplicants).toFixed(1)) : 0;
  return {
    newApplicants,
    contactedWithin24h,
    slaPct,
    lateList: lateList.sort((a, b) => a.funnelEnteredAt.localeCompare(b.funnelEnteredAt)),
  };
}

/** Late-list grouped by the attributable owner (Tara: a name to call). */
export function lateListByOwner(summary: SlaSummary): { owner: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of summary.lateList) counts.set(row.owner, (counts.get(row.owner) ?? 0) + 1);
  return [...counts.entries()].map(([owner, count]) => ({ owner, count })).sort((a, b) => b.count - a.count);
}
