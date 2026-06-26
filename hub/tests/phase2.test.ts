import { describe, expect, it } from "vitest";
import { generate } from "@/lib/seed/generate";
import {
  DEFAULT_STARTER_WIDGET_IDS,
  DEMO_USERS,
  PHASE2_REQUIREMENT_AUDIT,
  WIDGET_LIBRARY,
  assessGtChallenge,
  buildConfidenceBanner,
  buildWeeklyScorecard,
  canDecide,
  canEditBudgetWorkstream,
  canSubmitDecision,
  canViewDecisionQueue,
  createContentBriefFromObjection,
  createContentStubFromTestimonial,
  createHotFamilyDecision,
  ensureBudgetVarianceDecision,
  fieldMarketingReadOnlyEvent,
  summarizeBudget,
  summarizeGtChallengeCampaign,
  summarizeMarketingHandoff,
  visibleDecisionsForUser,
  widgetsForUser,
} from "@/lib/phase2";

const ds = generate({ seed: 5, families: 2000 });
const admin = DEMO_USERS.find((u) => u.role === "admin")!;
const leader = DEMO_USERS.find((u) => u.role === "leader")!;
const operator = DEMO_USERS.find((u) => u.role === "operator")!;

describe("Phase 2 roles and Decision Queue gate", () => {
  it("enforces Leader-only full Decision Queue access while allowing all roles to submit", () => {
    expect(canViewDecisionQueue(leader)).toBe(true);
    expect(canDecide(leader)).toBe(true);
    expect(canViewDecisionQueue(admin)).toBe(false);
    expect(canViewDecisionQueue(operator)).toBe(false);
    expect(DEMO_USERS.every(canSubmitDecision)).toBe(true);
  });

  it("lets an operator edit only their owned workstream budget row", () => {
    expect(canEditBudgetWorkstream(operator, "thought_leadership")).toBe(true);
    expect(canEditBudgetWorkstream(operator, "grassroots")).toBe(false);
    expect(canEditBudgetWorkstream(admin, "grassroots")).toBe(true);
  });

  it("hides the full queue from operators", () => {
    expect(visibleDecisionsForUser(leader, ds.decisions)).toHaveLength(ds.decisions.length);
    expect(visibleDecisionsForUser(operator, ds.decisions).length).toBeLessThan(ds.decisions.length);
  });
});

describe("Phase 2 Home widget library", () => {
  it("contains the PRD's 30+ widgets across the specified categories", () => {
    expect(WIDGET_LIBRARY.length).toBeGreaterThanOrEqual(32);
    expect(new Set(WIDGET_LIBRARY.map((w) => w.category)).size).toBeGreaterThanOrEqual(9);
    expect(WIDGET_LIBRARY.every((w) => w.source && w.size)).toBe(true);
  });

  it("pre-checks the PRD starter pack and personalizes leader/operator additions", () => {
    expect(DEFAULT_STARTER_WIDGET_IDS).toEqual([
      "applicants-total",
      "deposits-goal",
      "conversion-channel",
      "tier-counts",
      "engagement-mix",
      "sla-24",
      "executive-narrative",
      "workstream-health",
    ]);
    expect(widgetsForUser(leader).some((w) => w.id === "decision-preview")).toBe(true);
    expect(widgetsForUser(operator).some((w) => w.id === "content-pipeline")).toBe(true);
  });
});

describe("Phase 2 Budget Tracker", () => {
  it("reconciles every budget total to the PRD's $365K system of record", () => {
    const summary = summarizeBudget(ds.budget_workstream);
    expect(summary.totals.recommended).toBe(365000);
    expect(summary.totals.planned).toBe(365000);
    expect(summary.rows.every((r) => r.remaining === r.planned - r.actual)).toBe(true);
  });

  it("auto-flags any workstream more than 10% over plan into Decision Queue", () => {
    const summary = summarizeBudget(ds.budget_workstream);
    expect(summary.autoFlagRows.map((r) => r.key)).toContain("guerrilla");
    const decisions = ensureBudgetVarianceDecision(ds.budget_workstream, []);
    expect(decisions.some((d) => d.auto_flag && d.workstream === "guerrilla")).toBe(true);
  });
});

describe("Phase 2 CRM Ops and data-confidence banner", () => {
  it("names field-specific parity issues and points to CRM Ops", () => {
    const banner = buildConfidenceBanner(ds.field_state);
    expect(banner.show).toBe(true);
    expect(banner.href).toBe("/m/crm-ops");
    expect(banner.below.map((b) => b.field)).toContain("income_band");
    expect(banner.message).toContain("income_band");
  });
});

describe("GT Challenge workflow", () => {
  it("requires consent before a child assessment lead can be stored", () => {
    const result = assessGtChallenge({
      parentEmail: "parent@example.com",
      childGrade: "2",
      score: 92,
      consent: false,
      utmSource: "facebook",
    });
    expect(result.accepted).toBe(false);
    expect(result.programKey).toBe("none");
    expect(result.deidentifiedPayload.scoreBand).toBe("withheld");
  });

  it("scores, buckets, routes, and de-identifies a qualified Challenge lead", () => {
    const result = assessGtChallenge({
      parentEmail: "parent@example.com",
      childGrade: "2",
      score: 92,
      consent: true,
      utmSource: "facebook",
      utmCampaign: "gifted_quiz_2026",
    });
    expect(result.qualified).toBe(true);
    expect(result.bucket).toBe("strong_fit");
    expect(result.programKey).toBe("fall_enrollment");
    expect(JSON.stringify(result.deidentifiedPayload)).not.toContain("parent@example.com");
  });

  it("closes the Challenge campaign loop with spend, qualified leads, and CPQL caveat", () => {
    const summary = summarizeGtChallengeCampaign(ds.meta_insights, ds.families);
    expect(summary.campaign).toBe("gifted_quiz_2026");
    expect(summary.spend).toBeGreaterThan(0);
    expect(summary.platformLeads).toBeGreaterThanOrEqual(summary.qualifiedLeads);
    expect(summary.caveat).toContain("UTM attribution is known broken");
  });
});

describe("Spec auto-cross-links and meeting workflow", () => {
  it("turns a Grassroots testimonial into a Content production stub", () => {
    const stub = createContentStubFromTestimonial({
      quote: "GT finally gave my child challenge again.",
      sourceModule: "grassroots",
      persona: "Gifted Advocate",
      urgency: "high",
    });
    expect(stub.status).toBe("idea");
    expect(stub.owner).toBe("Content Owner");
    expect(stub.tags).toContain("testimonial");
    expect(stub.sourceModule).toBe("grassroots");
  });

  it("turns a top Admissions objection into a high-urgency content brief", () => {
    const brief = createContentBriefFromObjection({
      theme: "tuition",
      frequency: 7,
      examples: ["Can we afford this?", "How does ESA change tuition?"],
    });
    expect(brief.urgency).toBe("high");
    expect(brief.sourceModule).toBe("admissions");
    expect(brief.title).toContain("tuition");
  });

  it("pushes hot-family flags into the Decision Queue", () => {
    const decision = createHotFamilyDecision({
      familyId: "fam-1",
      sourceModule: "grassroots",
      reason: "Ambassador says family is ready for founder follow-up.",
      priority: "urgent",
    });
    expect(decision.status).toBe("open");
    expect(decision.priority).toBe("urgent");
    expect(decision.question).toContain("Hot family");
  });

  it("shows parent-led Grassroots events as read-only in Field Marketing", () => {
    const event = fieldMarketingReadOnlyEvent({
      id: "evt-1",
      name: "Parent coffee chat",
      host: "Aisha Cohen",
      date: "2026-07-12",
      rsvps: 18,
      sourceModule: "grassroots",
    });
    expect(event.destinationModule).toBe("field-marketing");
    expect(event.readOnly).toBe(true);
  });

  it("builds the shared weekly scorecard from canonical sources", () => {
    const rows = buildWeeklyScorecard(ds.families, ds.budget_workstream);
    expect(rows.map((r) => r.metric)).toEqual(["Applicants", "Deposits", "Budget actual"]);
    expect(rows.every((r) => r.source)).toBe(true);
  });

  it("summarizes marketing-to-onboarding handoff from deal/payment facts", () => {
    const handoff = summarizeMarketingHandoff(ds.families, ds.payments);
    expect(handoff.cumulative).toBeGreaterThan(0);
    expect(handoff.handoffRate).toBeGreaterThan(0);
    expect(handoff.source).toContain("HubSpot");
  });
});

describe("Phase 2 requirements audit stays honest", () => {
  it("does not claim full completion while Auth, Ask-the-Hub, and Home UI controls remain partial", () => {
    const byId = new Map(PHASE2_REQUIREMENT_AUDIT.map((r) => [r.id, r]));
    expect(byId.get("P2-BUDGET")?.status).toBe("covered");
    expect(byId.get("P2-ASK")?.status).toBe("partial");
    expect(byId.get("P2-ASK")?.evidence).toContain("Ask-the-Hub route");
    expect([...byId.values()].some((r) => r.status !== "covered")).toBe(true);
  });
});
