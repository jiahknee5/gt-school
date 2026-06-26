// Module 2 — Grassroots Engine. Pure proofs for the PLAN's provable invariants: dual-
// source reconcile (no double-count + survivorship + no ambassador dropped), influenced
// enrollments traced to app_form, intros/P2P de-duplication, pipeline integrity, market
// coverage denominator, PII-minimized + idempotent cross-links. Plus rendered sub-views.

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { generate } from "@/lib/seed/generate";
import { reconcileAmbassadors, ALL_STAGES, stageRank } from "@/lib/grassroots/reconcile";
import {
  activeAmbassadors,
  influencedEnrollments,
  ambassadorActivity,
  warmIntros,
  p2pCalls,
  marketCoverage,
} from "@/lib/grassroots/metrics";
import {
  logTestimonial,
  minimizeHotFamily,
  parentEventCrossLink,
  type ContentStub,
} from "@/lib/grassroots/crosslinks";

const ds = generate({ seed: 424242, families: 1200 });
const { ambassadors, conflicts } = reconcileAmbassadors(ds.community_ambassadors, ds.hubspot_ambassadors);

describe("Grassroots · dual-source reconcile (invariants #1, #2, #3)", () => {
  it("collapses a match_key present in both feeds to exactly one golden row", () => {
    const keys = ambassadors.map((a) => a.matchKey);
    expect(new Set(keys).size).toBe(keys.length); // unique → no double-count
    // every feed match_key is represented
    const feedKeys = new Set(
      [...ds.community_ambassadors, ...ds.hubspot_ambassadors].map((a) => a.match_key).filter(Boolean),
    );
    expect(ambassadors.length).toBe(feedKeys.size);
  });

  it("survivorship picks the most-advanced stage on conflict and logs the loss", () => {
    expect(conflicts.length).toBeGreaterThan(0);
    for (const c of conflicts) {
      expect(stageRank(c.winner)).toBe(Math.max(stageRank(c.communityStage), stageRank(c.hubspotStage)));
    }
  });

  it("no ambassador is dropped; every golden row is in exactly one of the 5 stages", () => {
    for (const a of ambassadors) expect(ALL_STAGES).toContain(a.stage);
  });
});

describe("Grassroots · metrics single-definition (invariants #4, #5, #6)", () => {
  it("influenced enrollments read app_form referral attribution (not a constant)", () => {
    const influenced = influencedEnrollments(ds.families);
    const recompute = ds.families.filter(
      (f) => f.source === "referral" && ["applicant", "shadow_day", "deposit"].includes(f.funnel_stage ?? ""),
    ).length;
    expect(influenced.length).toBe(recompute);
    for (const i of influenced) expect(i.touchpoint).toBeTruthy();
  });

  it("intros/P2P are the de-duplicated activity sum (2a == 2b)", () => {
    const activity = ambassadorActivity(ambassadors);
    const introKeys = activity.filter((a) => a.type === "intro").map((a) => a.dedupeKey);
    expect(warmIntros(activity)).toBe(new Set(introKeys).size);
    expect(p2pCalls(activity)).toBeLessThanOrEqual(activity.length);
  });

  it("active count includes only Active/Champion stages", () => {
    const active = activeAmbassadors(ambassadors);
    expect(active).toBe(ambassadors.filter((a) => a.stage === "Active" || a.stage === "Champion").length);
  });

  it("pipeline stage counts sum to the roster total", () => {
    const sum = ALL_STAGES.reduce((s, stage) => s + ambassadors.filter((a) => a.stage === stage).length, 0);
    expect(sum).toBe(ambassadors.length);
  });
});

describe("Grassroots · market coverage denominator (invariant #7)", () => {
  it("each category has coverage% = contacted/total, bounded 0..100, ungeocoded explicit", () => {
    for (const c of marketCoverage()) {
      expect(c.contacted).toBeLessThanOrEqual(c.total);
      expect(c.coveragePct).toBeGreaterThanOrEqual(0);
      expect(c.coveragePct).toBeLessThanOrEqual(100);
      expect(typeof c.ungeocoded).toBe("number");
    }
  });
});

describe("Grassroots · cross-links idempotent + minimized (invariants #9, #10, #11)", () => {
  it("logging a testimonial twice creates exactly one Content stub", () => {
    let stubs: ContentStub[] = [];
    const a = logTestimonial(stubs, "amb-1", "Great experience");
    expect(a.created).toBe(true);
    stubs = a.stubs;
    const b = logTestimonial(stubs, "amb-1", "Great experience again");
    expect(b.created).toBe(false);
    expect(b.stubs).toHaveLength(1);
  });

  it("a hot-family flag carries minimized PII only", () => {
    const flag = minimizeHotFamily("fam-1", "Avery", "3rd", "tuition_objection", true);
    expect(flag.minimized).toBe(true);
    expect(flag.childFirstName).toBe("Avery");
    expect(flag.childGrade).toBe("3rd");
    expect(Object.keys(flag)).not.toContain("lastName");
    expect(flag.dedupeKey).toBe("hot_family:fam-1:tuition_objection");
  });

  it("parent-event cross-link to Field Marketing is read-only", () => {
    const link = parentEventCrossLink({ id: "pe_1", name: "Coffee", date: "2026-07-12", host: "Maria", type: "coffee_chat" });
    expect(link.readOnly).toBe(true);
  });
});

// ───────────────── rendered page (auth mocked) ─────────────────
vi.mock("@/lib/auth", () => ({
  DEV_MODE: true,
  getSession: vi.fn(async () => null),
}));

const { default: GrassrootsPage } = await import("@/app/m/grassroots/page");

async function render(tab?: string, role?: string): Promise<string> {
  const node = await GrassrootsPage({
    searchParams: Promise.resolve({ ...(tab ? { tab } : {}), ...(role ? { role } : {}) }),
  });
  return renderToStaticMarkup(node);
}

describe("Grassroots · rendered sub-views", () => {
  it("overview goal bars + roster reconcile render", async () => {
    const overview = await render("overview", "operator");
    expect(overview).toContain("Grassroots Engine");
    expect(overview).toContain("Goal bars");
    const roster = await render("roster", "operator");
    expect(roster).toContain("Ambassador roster");
    expect(roster).toContain("survivorship conflict");
  });

  it("Operator sees submit-not-view Decision Queue framing", async () => {
    const html = await render("overview", "operator");
    expect(html).toContain("cannot view the full queue");
    expect(html).toContain('href="/m/submissions"');
    expect(html).toContain("My submissions");
    expect(html).not.toContain('href="/m/decisions"');
  });

  it("renders market map, sprints, community, events", async () => {
    expect(await render("market", "operator")).toContain("Market map coverage");
    expect(await render("sprints", "operator")).toContain("Referral sprints");
    expect(await render("community", "operator")).toContain("Parent community");
    expect(await render("events", "operator")).toContain("source of truth");
  });
});
