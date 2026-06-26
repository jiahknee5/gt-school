// reconcile.ts — Summer Camp dual-source golden record. summer.gt.school is PRIMARY
// (payment + status survivorship); the registration form is the alternate intake. Identity
// is `match_key` (+ campus); the golden `resolved_key` makes the upsert idempotent
// (invariant #2). A `weeks` disagreement takes the SITE value AND raises a reconciliation
// data_quality_issue (invariant #3) — never an average. `cancelled` drops from active.

import type { SeedDataset, SummerSiteRegistration, RegistrationFormEntry } from "@/lib/seed/types";
import { SUMMER_CAMPUSES } from "@/lib/seed/dictionaries";

export type CampStage = "lead" | "registered" | "paid" | "attended";

export interface ResolvedRegistration {
  resolvedKey: string;
  matchKey: string;
  campusKey: string;
  campusName: string;
  weeks: number; // site-primary on conflict
  amount: number; // booked = weeks × 1450
  paid: boolean;
  status: string; // site-primary
  funnelStage: CampStage;
  sourceFeeds: ("summer_site" | "registration_form")[];
  conflict: boolean;
}

export interface CampConflict {
  resolvedKey: string;
  matchKey: string;
  field: string;
  siteValue: string;
  formValue: string;
}

export interface ReconcileResult {
  resolved: ResolvedRegistration[];
  conflicts: CampConflict[];
}

const WEEK_PRICE = 1450;

function campusKeyFromName(name: string): string {
  return SUMMER_CAMPUSES.find((c) => c.name === name)?.key ?? name.toLowerCase();
}

function stageFor(status: string, paid: boolean, attended: boolean): CampStage {
  if (attended) return "attended";
  if (paid || status === "confirmed") return "paid";
  if (status === "waitlisted" || status === "pending") return "registered";
  return "lead";
}

/**
 * Reconcile site (primary) ⇄ form (alternate) by match_key + campus. Idempotent: the same
 * inputs always yield the same `resolved_key` set; re-running is a no-op.
 */
export function reconcileCamp(
  site: SummerSiteRegistration[],
  form: RegistrationFormEntry[],
  attendedKeys: Set<string> = new Set(),
): ReconcileResult {
  const byKey = new Map<string, { site?: SummerSiteRegistration; form?: RegistrationFormEntry }>();

  for (const s of site) {
    if (!s.match_key) continue;
    const k = `${s.match_key}|${s.campus_key}`;
    const cur = byKey.get(k) ?? {};
    cur.site = s;
    byKey.set(k, cur);
  }
  for (const f of form) {
    if (!f.match_key) continue;
    const k = `${f.match_key}|${campusKeyFromName(f.campus)}`;
    const cur = byKey.get(k) ?? {};
    cur.form = f;
    byKey.set(k, cur);
  }

  const resolved: ResolvedRegistration[] = [];
  const conflicts: CampConflict[] = [];

  for (const [k, { site: s, form: f }] of byKey.entries()) {
    const matchKey = (s?.match_key ?? f?.match_key)!;
    const campusKey = s?.campus_key ?? campusKeyFromName(f!.campus);
    const campusName = s?.campus ?? f!.campus;
    const resolvedKey = k; // hash stand-in: match_key|campus — stable + idempotent

    // site-primary survivorship for weeks; conflict if form disagrees
    const siteWeeks = s?.weeks;
    const formWeeks = f?.weeks;
    let weeks = siteWeeks ?? formWeeks ?? 1;
    let conflict = false;
    if (siteWeeks != null && formWeeks != null && siteWeeks !== formWeeks) {
      weeks = siteWeeks; // take site, never average
      conflict = true;
      conflicts.push({
        resolvedKey,
        matchKey,
        field: "weeks",
        siteValue: String(siteWeeks),
        formValue: String(formWeeks),
      });
    }

    const status = s?.status ?? "registered";
    if (status === "cancelled") continue; // dropped from active

    const paid = s?.paid ?? false;
    const sourceFeeds: ("summer_site" | "registration_form")[] = [];
    if (s) sourceFeeds.push("summer_site");
    if (f) sourceFeeds.push("registration_form");

    resolved.push({
      resolvedKey,
      matchKey,
      campusKey,
      campusName,
      weeks,
      amount: weeks * WEEK_PRICE,
      paid,
      status,
      funnelStage: stageFor(status, paid, attendedKeys.has(resolvedKey)),
      sourceFeeds,
      conflict,
    });
  }

  return { resolved, conflicts };
}

export function reconcileFromDataset(ds: SeedDataset, attendedKeys?: Set<string>): ReconcileResult {
  return reconcileCamp(ds.summer_site_registrations, ds.registration_form_entries, attendedKeys);
}
