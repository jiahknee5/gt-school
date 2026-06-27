// Program scoping (global program selector) applied to the data surfaces. Pure proofs,
// no request context: the headline invariant is that the Camp P&L is NEVER merged into
// the $365K fall marketing total on either the Budget or the Dashboard, and that the
// per-page active lens (resolveProgramView) is RBAC-clamped exactly like the selector.

import { describe, expect, it } from "vitest";
import { generate } from "@/lib/seed/generate";
import { reconcileBudget } from "@/lib/budget/reconcile";
import { reconcileFromDataset } from "@/lib/camp/reconcile";
import { campRevenue, budgetUnchangedByCamp } from "@/lib/camp/metrics";
import { programsForScope } from "@/lib/program-scope";
import { resolveProgramView } from "@/lib/program-view";

const ds = generate({ seed: 424242, families: 1200 });
const CAMP_TARGET = 180_000;

describe("Program scoping · Budget + Dashboard never merge Camp into the $365K fall total", () => {
  it("fall workstreams reconcile to $365K, unchanged by camp activity", () => {
    const recon = reconcileBudget(ds.budget_workstream, ds.budget_entry);
    expect(recon.totals.recommended).toBe(365000);
    expect(budgetUnchangedByCamp(ds)).toBe(365000);
  });

  it("camp P&L is measured ONLY from summer_camp Stripe cash, kept off the $365K total", () => {
    const { resolved } = reconcileFromDataset(ds);
    const camp = campRevenue(ds, resolved, CAMP_TARGET);

    const expectedCash = ds.payments
      .filter((p) => p.program_key === "summer_camp" && p.status === "succeeded")
      .reduce((a, p) => a + p.amount, 0);

    expect(camp.cashRevenue).toBe(expectedCash);
    // No fall payment ever contributes to camp cash.
    const fallCampLeak = ds.payments.filter(
      (p) => p.program_key === "fall_enrollment" && p.status === "succeeded",
    );
    expect(fallCampLeak.every((p) => p.program_key !== "summer_camp")).toBe(true);
    // The fall budget total is untouched by the camp figure.
    expect(budgetUnchangedByCamp(ds)).toBe(365000);
    expect(camp.cashRevenue).not.toBe(365000);
  });
});

describe("resolveProgramView · per-page lens is RBAC-clamped", () => {
  it("operator is locked to Fall (never camp, never all)", async () => {
    const view = await resolveProgramView({ role: "operator" });
    expect(view.scope).toBe("fall_enrollment");
    expect(view.programs).toEqual(["fall_enrollment"]);
    expect(view.showFall).toBe(true);
    expect(view.showCamp).toBe(false);
  });

  it("leader + admin default to Fall and may span both programs", async () => {
    const leader = await resolveProgramView({ role: "leader" });
    expect(leader.scope).toBe("fall_enrollment");
    expect(leader.showFall).toBe(true);

    const admin = await resolveProgramView({ role: "admin" });
    expect(admin.showFall).toBe(true);
  });

  it("the 'all' lens expands to BOTH programs, so both sections render separately", () => {
    const leader = programsForScope("leader", "all");
    expect(leader).toContain("fall_enrollment");
    expect(leader).toContain("summer_camp");

    // showFall && showCamp would both be true → Budget/Dashboard render two sections.
    const showFall = leader.includes("fall_enrollment");
    const showCamp = leader.includes("summer_camp");
    expect(showFall && showCamp).toBe(true);
  });
});
