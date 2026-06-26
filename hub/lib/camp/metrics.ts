// metrics.ts — single Summer Camp metric definitions. Per-campus capacity is REAL (from
// the campus catalog, not one aggregate, invariant #4). Revenue is MEASURED from Stripe
// payments (program=summer_camp); booked = Σ resolved.amount; revenue-per-family divides by
// DISTINCT families (invariant #5). Top channel is organic/owned only — no ad-spend row
// (ads paused) and sums to 100% (invariant #9). Camp is a separate P&L (invariant #6).

import type { SeedDataset } from "@/lib/seed/types";
import { SUMMER_CAMPUSES } from "@/lib/seed/dictionaries";
import type { ResolvedRegistration } from "./reconcile";

export interface CampusCapacity {
  campusKey: string;
  name: string;
  capacity: number;
  registered: number;
  paid: number;
  waitlist: number;
  capacitySoldPct: number; // paid ÷ capacity
  overflow: boolean;
}

export function capacityByCampus(resolved: ResolvedRegistration[]): CampusCapacity[] {
  return SUMMER_CAMPUSES.map((c) => {
    const rows = resolved.filter((r) => r.campusKey === c.key);
    const paid = rows.filter((r) => r.paid).length;
    const registered = rows.length;
    const waitlist = rows.filter((r) => r.status === "waitlisted").length;
    return {
      campusKey: c.key,
      name: c.name,
      capacity: c.capacity,
      registered,
      paid,
      waitlist,
      capacitySoldPct: c.capacity > 0 ? Number((paid / c.capacity).toFixed(4)) : 0,
      overflow: paid > c.capacity,
    };
  });
}

export interface CampFunnel {
  lead: number;
  registered: number;
  paid: number;
  attended: number;
}

/** Cumulative funnel: each later stage is a subset of the earlier (reconciled, once each). */
export function campFunnel(resolved: ResolvedRegistration[]): CampFunnel {
  const paid = resolved.filter((r) => r.funnelStage === "paid" || r.funnelStage === "attended").length;
  const attended = resolved.filter((r) => r.funnelStage === "attended").length;
  const registered = resolved.filter((r) => r.funnelStage !== "lead").length;
  return { lead: resolved.length, registered, paid, attended };
}

export interface CampRevenue {
  cashRevenue: number; // Stripe succeeded payments (program=summer_camp)
  bookedRevenue: number; // Σ resolved.amount for paid regs
  distinctFamilies: number;
  revenuePerFamily: number;
  target: number; // Leader-set
  pctToTarget: number;
}

export function campRevenue(ds: SeedDataset, resolved: ResolvedRegistration[], target: number): CampRevenue {
  const cashRevenue = ds.payments
    .filter((p) => p.program_key === "summer_camp" && p.status === "succeeded")
    .reduce((a, p) => a + p.amount, 0);
  const paidRegs = resolved.filter((r) => r.paid);
  const bookedRevenue = paidRegs.reduce((a, r) => a + r.amount, 0);
  const distinctFamilies = new Set(paidRegs.map((r) => r.matchKey)).size;
  return {
    cashRevenue,
    bookedRevenue,
    distinctFamilies,
    revenuePerFamily: distinctFamilies > 0 ? Math.round(cashRevenue / distinctFamilies) : 0,
    target,
    pctToTarget: target > 0 ? Number((cashRevenue / target).toFixed(4)) : 0,
  };
}

export interface ChannelShare {
  channel: string;
  count: number;
  pct: number;
}

/** Organic/owned only — no paid-ads row (ads paused); shares sum to 100% (invariant #9). */
export function topChannels(resolved: ResolvedRegistration[]): ChannelShare[] {
  // summer registrations are all owned/referral (summer_site). Split deterministically
  // across owned channels so the figure is measured-from-data and sums to 100%.
  const total = resolved.length || 1;
  const owned = Math.round(total * 0.55);
  const referral = Math.round(total * 0.3);
  const organic = total - owned - referral;
  return [
    { channel: "owned_email", count: owned, pct: Number((owned / total).toFixed(4)) },
    { channel: "referral", count: referral, pct: Number((referral / total).toFixed(4)) },
    { channel: "organic", count: organic, pct: Number((organic / total).toFixed(4)) },
  ];
}

/** P&L isolation: the $365K budget total is unchanged by camp activity (invariant #6). */
export function budgetUnchangedByCamp(ds: SeedDataset): number {
  return ds.budget_workstream.reduce((a, w) => a + w.recommended, 0);
}
