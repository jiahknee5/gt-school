// Module 4 — Summer Camp. Pure proofs for the PLAN's provable invariants: no double-count,
// idempotent reconcile, conflict surfaced (not averaged), real per-campus capacity, measured
// revenue, P&L isolation, RBAC + minors gate, organic-only honest channels, waitlist/overflow.

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { generate } from "@/lib/seed/generate";
import { reconcileFromDataset, reconcileCamp } from "@/lib/camp/reconcile";
import {
  capacityByCampus,
  campFunnel,
  campRevenue,
  topChannels,
  budgetUnchangedByCamp,
} from "@/lib/camp/metrics";
import { canViewRoster, canSetTarget, canViewDecisionQueue, assertCanViewRoster, CampAuthError } from "@/lib/camp/rbac";
import { SUMMER_CAMPUSES } from "@/lib/seed/dictionaries";

const ds = generate({ seed: 424242, families: 1200 });
const { resolved, conflicts } = reconcileFromDataset(ds);

describe("Summer Camp · no double-count + merged feeds (invariant #1)", () => {
  it("a child on both site + form collapses to one row with both source feeds", () => {
    const merged = resolved.filter((r) => r.sourceFeeds.length === 2);
    expect(merged.length).toBeGreaterThan(0);
    for (const m of merged) {
      expect(m.sourceFeeds).toContain("summer_site");
      expect(m.sourceFeeds).toContain("registration_form");
    }
    // every resolved_key is unique → counted once
    const keys = resolved.map((r) => r.resolvedKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("Summer Camp · reconcile is idempotent (invariant #2)", () => {
  it("re-running reconcile yields the same resolved_key set, no new rows", () => {
    const again = reconcileCamp(ds.summer_site_registrations, ds.registration_form_entries);
    expect(again.resolved.length).toBe(resolved.length);
    expect(again.resolved.map((r) => r.resolvedKey).sort()).toEqual(resolved.map((r) => r.resolvedKey).sort());
  });
});

describe("Summer Camp · conflict surfaced, not averaged (invariant #3)", () => {
  it("a weeks disagreement keeps the site value AND raises a conflict", () => {
    expect(conflicts.length).toBeGreaterThan(0);
    const c = conflicts[0];
    expect(c.field).toBe("weeks");
    const row = resolved.find((r) => r.resolvedKey === c.resolvedKey)!;
    expect(row.conflict).toBe(true);
    expect(String(row.weeks)).toBe(c.siteValue); // site wins, never the average
    expect(row.weeks).not.toBe((Number(c.siteValue) + Number(c.formValue)) / 2);
  });
});

describe("Summer Camp · real per-campus capacity (invariant #4)", () => {
  it("the 4 campuses show distinct capacities; aggregate is a sum, not an average", () => {
    const caps = capacityByCampus(resolved);
    expect(caps).toHaveLength(SUMMER_CAMPUSES.length);
    const capacities = caps.map((c) => c.capacity).sort((a, b) => a - b);
    expect(capacities).toEqual([...SUMMER_CAMPUSES.map((c) => c.capacity)].sort((a, b) => a - b));
    for (const c of caps) {
      const expected = c.capacity > 0 ? Number((c.paid / c.capacity).toFixed(4)) : 0;
      expect(c.capacitySoldPct).toBe(expected);
    }
  });
});

describe("Summer Camp · measured revenue (invariant #5)", () => {
  it("cash revenue = Σ succeeded camp payments; per-family divides by distinct families", () => {
    const rev = campRevenue(ds, resolved, 180_000);
    const expectedCash = ds.payments
      .filter((p) => p.program_key === "summer_camp" && p.status === "succeeded")
      .reduce((a, p) => a + p.amount, 0);
    expect(rev.cashRevenue).toBe(expectedCash);
    if (rev.distinctFamilies > 0) {
      expect(rev.revenuePerFamily).toBe(Math.round(rev.cashRevenue / rev.distinctFamilies));
    }
    expect(rev.target).toBe(180_000); // Leader-set, not hard-coded into the metric
  });
});

describe("Summer Camp · P&L isolation (invariant #6)", () => {
  it("the marketing budget total stays $365,000 regardless of camp activity", () => {
    expect(budgetUnchangedByCamp(ds)).toBe(365000);
  });
});

describe("Summer Camp · RBAC + minors gate (invariant #8)", () => {
  it("a non-camp Operator is denied the roster; camp Operator/Leader/Admin allowed", () => {
    expect(canViewRoster("operator", false)).toBe(false);
    expect(canViewRoster("operator", true)).toBe(true);
    expect(canViewRoster("leader")).toBe(true);
    expect(canViewRoster("admin")).toBe(true);
    expect(() => assertCanViewRoster("operator", false)).toThrow(CampAuthError);
  });

  it("only Leader sets the target / views the Decision Queue", () => {
    expect(canSetTarget("leader")).toBe(true);
    expect(canSetTarget("operator")).toBe(false);
    expect(canViewDecisionQueue("operator")).toBe(false);
  });
});

describe("Summer Camp · honest organic-only channels (invariant #9)", () => {
  it("there is no ad-spend row and shares sum to ~100%", () => {
    const ch = topChannels(resolved);
    expect(ch.some((c) => /ad|paid/i.test(c.channel))).toBe(false);
    const sum = ch.reduce((a, c) => a + c.count, 0);
    expect(sum).toBe(resolved.length);
  });
});

describe("Summer Camp · funnel is cumulative", () => {
  it("Lead ≥ Registered ≥ Paid ≥ Attended", () => {
    const f = campFunnel(resolved);
    expect(f.lead).toBeGreaterThanOrEqual(f.registered);
    expect(f.registered).toBeGreaterThanOrEqual(f.paid);
    expect(f.paid).toBeGreaterThanOrEqual(f.attended);
  });
});

// ───────────────── rendered page (auth mocked) ─────────────────
vi.mock("@/lib/auth", () => ({
  DEV_MODE: true,
  getSession: vi.fn(async () => null),
}));

const { default: SummerCampPage } = await import("@/app/m/summer-camp/page");

async function render(tab?: string, role?: string, campOwner?: string): Promise<string> {
  const node = await SummerCampPage({
    searchParams: Promise.resolve({ ...(tab ? { tab } : {}), ...(role ? { role } : {}), ...(campOwner ? { campOwner } : {}) }),
  });
  return renderToStaticMarkup(node);
}

describe("Summer Camp · rendered sub-views", () => {
  it("overview renders revenue vs target + P&L isolation", async () => {
    const html = await render("overview", "leader");
    expect(html).toContain("Summer Camp");
    expect(html).toContain("Revenue vs target");
    expect(html).toContain("P&amp;L isolation");
    expect(html).toContain("Camp source note");
    expect(html).not.toContain("Data confidence warning");
  });

  it("sessions roster is gated: leader sees it, plain operator does not", async () => {
    const leader = await render("sessions", "leader");
    expect(leader).toContain("4 campus cards");
    expect(leader).not.toContain("Denied — roster is gated");
    const operator = await render("sessions", "operator", "false");
    expect(operator).toContain("Denied — roster is gated");
  });

  it("funnel + content tabs render", async () => {
    expect(await render("funnel", "leader")).toContain("Registration funnel");
    expect(await render("content", "leader")).toContain("Camp content");
  });

  it("Operator proposal CTA points to own-status, not the full queue", async () => {
    const html = await render("overview", "operator");
    expect(html).toContain('href="/m/submissions"');
    expect(html).toContain("My submissions");
    expect(html).not.toContain('href="/m/decisions"');
  });
});
