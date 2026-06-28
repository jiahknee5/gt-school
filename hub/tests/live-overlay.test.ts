// The end-to-end use case: a REAL captured lead (form → Stripe → DB) overlaid onto the
// seed snapshot must show up in the Hub's aggregate funnel — not just on /track. This
// pins the PURE merge (mergeLiveLeads / deriveFunnelStage); the DB read (withLiveLeads)
// is a thin wrapper around it and is exercised live, not in CI.

import { describe, it, expect } from "vitest";
import { generate } from "@/lib/seed/generate";
import { kpiWeeklySeries } from "@/lib/metrics/registry";
import { mergeLiveLeads, deriveFunnelStage, type LiveLeadInput } from "@/lib/seed/live-overlay";

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const FAM_ID = "11111111-1111-4111-8111-111111111111";

function liveRow(over: Partial<LiveLeadInput> = {}): LiveLeadInput {
  return {
    familyId: FAM_ID,
    email: "demo@gtschool.test",
    phone: null,
    childFirstName: "Harper",
    matchKey: "abc123",
    source: "gifted_quiz",
    hubspotContactId: null,
    createdAt: "2026-06-23T12:00:00.000Z", // in-sprint (week 3) so it buckets into the funnel
    utmSource: "ad",
    utmMedium: "paid_social",
    utmCampaign: "gifted_quiz_2026",
    bucket: "strong_fit",
    rawScore: 97,
    qualified: true,
    routed: true,
    enrollmentId: "22222222-2222-4222-8222-222222222222",
    enrollmentStage: "paid",
    paid: true,
    amount: 500,
    hubspotDealId: null,
    paymentIntentId: "pi_test_live_overlay",
    paymentStatus: "succeeded",
    paymentAmount: 500,
    paidAt: "2026-06-23T12:05:00.000Z",
    ...over,
  };
}

describe("live overlay — a real lead appended to the seed shows in the Hub funnel", () => {
  const base = generate({ seed: 424242, families: 1200 });

  it("derives the funnel_stage the KPIs key on, from the real journey", () => {
    expect(deriveFunnelStage(liveRow())).toBe("deposit"); // paid
    expect(deriveFunnelStage(liveRow({ paid: false, paymentStatus: null, qualified: true }))).toBe("applicant");
    expect(deriveFunnelStage(liveRow({ paid: false, paymentStatus: null, qualified: false }))).toBe("lead");
  });

  it("a paid live lead increments deposits AND applicants by exactly 1", () => {
    const depBefore = sum(kpiWeeklySeries("deposits", base));
    const appBefore = sum(kpiWeeklySeries("applicants", base));
    const { dataset, leads, liveFamilyIds } = mergeLiveLeads(base, [liveRow()]);

    expect(sum(kpiWeeklySeries("deposits", dataset))).toBe(depBefore + 1);
    expect(sum(kpiWeeklySeries("applicants", dataset))).toBe(appBefore + 1); // deposit ∈ APPLICANT_PLUS

    const fam = dataset.families.find((f) => f.id === FAM_ID);
    expect(fam?.funnel_stage).toBe("deposit");
    expect(dataset.payments.some((p) => p.stripe_payment_intent_id === "pi_test_live_overlay")).toBe(true);
    expect(dataset.enrollments.some((e) => e.family_id === FAM_ID && e.paid)).toBe(true);
    expect(dataset.program_membership.some((m) => m.family_id === FAM_ID)).toBe(true);

    expect(liveFamilyIds.has(FAM_ID)).toBe(true);
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ name: "Harper", stage: "deposit", paid: true, amount: 500, trackHref: `/track/${FAM_ID}` });
  });

  it("a qualified-but-unpaid lead counts as an applicant, never a deposit", () => {
    const depBefore = sum(kpiWeeklySeries("deposits", base));
    const appBefore = sum(kpiWeeklySeries("applicants", base));
    const { dataset } = mergeLiveLeads(base, [
      liveRow({ paid: false, paymentStatus: null, paymentIntentId: null, enrollmentStage: "applicant" }),
    ]);
    expect(sum(kpiWeeklySeries("deposits", dataset))).toBe(depBefore); // unchanged
    expect(sum(kpiWeeklySeries("applicants", dataset))).toBe(appBefore + 1);
  });

  it("fails closed: no rows leaves the dataset identical and untouched", () => {
    const before = base.families.length;
    const { dataset, leads } = mergeLiveLeads(base, []);
    expect(dataset).toBe(base);
    expect(leads).toEqual([]);
    expect(base.families.length).toBe(before); // never mutates the seed
  });
});
