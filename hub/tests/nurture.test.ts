// Module 5 — Nurture & Lifecycle. Pure proofs for the PLAN's provable invariants: SSOT
// (app_form), no engagement↔conversion circularity, small-cell suppression, pipeline
// reconciliation (handoff ≤ 1), SLA correctness + owner attribution, SMS theming +
// PII/consent gating, and idempotent hot-family cross-links. Plus the rendered sub-views.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { generate } from "@/lib/seed/generate";
import {
  engagementTier,
  tierMix,
  ENGAGEMENT_FIELDS,
  CONVERSION_FIELDS,
} from "@/lib/nurture/engagement";
import { buildHeatmap, tierConversion, MIN_CELL_N } from "@/lib/nurture/heatmap";
import { segmentSummaries, tierOf, t3Buckets } from "@/lib/nurture/segments";
import { parentStageDistribution, handoffMetrics } from "@/lib/nurture/pipeline";
import { buildSla } from "@/lib/nurture/sla";
import {
  classifyTheme,
  buildInbox,
  filterInbox,
  canQuickReply,
  flagHotFamily,
  hotFamilyDedupeKey,
  type FamilyFlag,
} from "@/lib/nurture/sms";
import { sequenceHealth, sequenceDecision } from "@/lib/nurture/sequences";
import { canViewSmsPii, canActHotFamily, maskPhone } from "@/lib/nurture/rbac";

const ds = generate({ seed: 424242, families: 1200 });
const asOf = ds.manifest.generatedAt;

describe("Nurture · SSOT + no circularity (invariants #1, #2)", () => {
  it("engagement fields and conversion fields are disjoint (no shared field)", () => {
    const eng = new Set<string>(ENGAGEMENT_FIELDS);
    for (const c of CONVERSION_FIELDS) expect(eng.has(c)).toBe(false);
  });

  it("engagement tier never reads funnel_stage (toggling funnel does not change tier)", () => {
    const f = ds.families[0];
    const before = engagementTier(f);
    const mutated = { ...f, funnel_stage: f.funnel_stage === "deposit" ? "lead" : "deposit" };
    expect(engagementTier(mutated)).toBe(before);
  });

  it("tier mix sums to the population", () => {
    const mix = tierMix(ds.families);
    expect(mix.clicked + mix.opened + mix.cold).toBe(mix.total);
    expect(mix.total).toBe(ds.families.length);
  });
});

describe("Nurture · heatmap small-cell honesty (invariant #3)", () => {
  const heat = buildHeatmap(ds.families, "income_band");

  it("every cell carries n; cells with n<25 are suppressed (no pct)", () => {
    for (const cell of heat.cells) {
      expect(typeof cell.n).toBe("number");
      if (cell.n < MIN_CELL_N) {
        expect(cell.suppressed).toBe(true);
        expect(cell.pct).toBeNull();
      } else {
        expect(cell.suppressed).toBe(false);
        expect(cell.pct).not.toBeNull();
      }
    }
  });

  it("conversion% is measured (clicked tier converts higher than cold) and bounded 0..100", () => {
    const tc = tierConversion(ds.families);
    const clicked = tc.find((t) => t.tier === "clicked")!;
    const cold = tc.find((t) => t.tier === "cold")!;
    for (const t of tc) {
      expect(t.pct).toBeGreaterThanOrEqual(0);
      expect(t.pct).toBeLessThanOrEqual(100);
    }
    expect(clicked.pct).toBeGreaterThan(cold.pct);
  });
});

describe("Nurture · segments (invariant #1 SSOT)", () => {
  it("T1/T2/T3 partition the population exactly once", () => {
    const tiers = ds.families.map(tierOf);
    expect(tiers).toHaveLength(ds.families.length);
    const segs = segmentSummaries(ds.families);
    const sum = segs.reduce((s, x) => s + x.count, 0);
    expect(sum).toBe(ds.families.length);
  });

  it("T3 buckets read tefa_status (app_form) and sum to the waitlist size", () => {
    const waitlist = ds.families.filter((f) => f.funnel_stage === "waitlisted").length;
    const buckets = t3Buckets(ds.families);
    expect(buckets.reduce((s, b) => s + b.count, 0)).toBe(waitlist);
  });
});

describe("Nurture · pipeline reconciliation (invariant #4)", () => {
  it("each fall deal appears once in the parent distribution", () => {
    const dist = parentStageDistribution(ds.enrollments);
    const fall = ds.enrollments.filter((e) => e.program_key === "fall_enrollment").length;
    expect(dist.reduce((s, x) => s + x.count, 0)).toBe(fall);
  });

  it("handoff conversion is between 0 and 1 (no double-count)", () => {
    const h = handoffMetrics(ds.enrollments);
    expect(h.convRate).toBeGreaterThanOrEqual(0);
    expect(h.convRate).toBeLessThanOrEqual(1);
    expect(h.onboarded).toBeLessThanOrEqual(h.handedOff);
  });
});

describe("Nurture · SLA correctness (invariant #6)", () => {
  const sla = buildSla(ds.families, asOf);

  it("SLA% = contacted_within_24h ÷ new_applicants", () => {
    expect(sla.slaPct).toBe(Number(((100 * sla.contactedWithin24h) / sla.newApplicants).toFixed(1)));
  });

  it("every late-list row is owner-attributable (non-null owner) and uncontacted", () => {
    for (const row of sla.lateList) {
      expect(row.owner).toBeTruthy();
      expect(row.contacted).toBe(false);
    }
  });

  it("is deterministic across runs", () => {
    const again = buildSla(generate({ seed: 424242, families: 1200 }).families, asOf);
    expect(again.slaPct).toBe(sla.slaPct);
    expect(again.lateList.length).toBe(sla.lateList.length);
  });
});

describe("Nurture · SMS theming + consent (invariants #7, #8)", () => {
  it("v1 keyword rules classify tuition / scheduling and fall back to untagged", () => {
    expect(classifyTheme("What's the tuition and cost?")).toContain("tuition");
    expect(classifyTheme("Can we reschedule the time?")).toContain("scheduling");
    expect(classifyTheme("hello there")).toEqual(["untagged"]);
    expect(classifyTheme("STOP")).toEqual(["opt_out"]);
  });

  it("every thread carries at least one theme", () => {
    const inbox = buildInbox(ds.families, asOf);
    for (const t of inbox) expect(t.themes.length).toBeGreaterThanOrEqual(1);
  });

  it("an opted-out thread cannot be quick-replied", () => {
    const inbox = buildInbox(ds.families, asOf);
    const opted = inbox.find((t) => t.optedOut);
    expect(opted).toBeTruthy();
    expect(canQuickReply(opted!)).toBe(false);
  });

  it("objection filter returns tuition threads", () => {
    const inbox = buildInbox(ds.families, asOf);
    const objections = filterInbox(inbox, "objection");
    expect(objections.length).toBeGreaterThan(0);
    for (const t of objections) expect(t.themes).toContain("tuition");
  });
});

describe("Nurture · RBAC + PII (invariants #8, #11)", () => {
  it("SMS PII gated to Admin/Leader; Operator masked", () => {
    expect(canViewSmsPii("admin")).toBe(true);
    expect(canViewSmsPii("leader")).toBe(true);
    expect(canViewSmsPii("operator")).toBe(false);
    expect(maskPhone("(512) 555-1234")).toBe("(***) ***-1234");
  });

  it("only Leaders may act on a hot-family decision", () => {
    expect(canActHotFamily("leader")).toBe(true);
    expect(canActHotFamily("admin")).toBe(false);
    expect(canActHotFamily("operator")).toBe(false);
  });
});

describe("Nurture · cross-link idempotency (invariant #9)", () => {
  it("flagging the same family twice yields exactly one flag", () => {
    let flags: FamilyFlag[] = [];
    const a = flagHotFamily(flags, "fam-1", "tuition objection", "leader", asOf);
    expect(a.created).toBe(true);
    flags = a.flags;
    const b = flagHotFamily(flags, "fam-1", "tuition objection again", "leader", asOf);
    expect(b.created).toBe(false);
    expect(b.flags).toHaveLength(1);
    expect(b.flags[0].dedupeKey).toBe(hotFamilyDedupeKey("fam-1"));
  });
});

describe("Nurture · sequences read-only (invariant #5)", () => {
  it("flags an unhealthy sequence and produces exactly one decision payload", () => {
    const health = sequenceHealth();
    expect(health.some((s) => !s.healthy)).toBe(true);
    const decision = sequenceDecision("seq_reengage", "kill", "growth-leader");
    expect(decision.action).toBe("kill");
    expect(decision.seq_id).toBe("seq_reengage");
    expect(decision.question).toContain("Kill");
  });
});

// ───────────────── rendered page (auth mocked) ─────────────────
import { vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  DEV_MODE: true,
  getSession: vi.fn(async () => null),
}));

const { default: NurturePage } = await import("@/app/m/nurture/page");

async function render(tab?: string, role?: string): Promise<string> {
  const node = await NurturePage({
    searchParams: Promise.resolve({ ...(tab ? { tab } : {}), ...(role ? { role } : {}) }),
  });
  return renderToStaticMarkup(node);
}

describe("Nurture · rendered sub-views", () => {
  it("overview + segments + heatmap render", async () => {
    const overview = await render("overview", "admin");
    expect(overview).toContain("Nurture &amp; Lifecycle");
    expect(overview).toContain("measured conversion predictor");
    const segments = await render("segments", "admin");
    expect(segments).toContain("Nurture segments");
    expect(segments).toContain("conversion heatmap");
    expect(segments).toContain(`n&lt;${MIN_CELL_N}`);
  });

  it("SMS inbox masks PII for an Operator and shows it for Admin", async () => {
    const operator = await render("sms", "operator");
    expect(operator).toContain("PII masked");
    expect(operator).toContain("message body hidden");
    const admin = await render("sms", "admin");
    expect(admin).toContain("PII visible");
  });

  it("renders pipeline, sequences, and SLA tabs", async () => {
    expect(await render("pipeline", "admin")).toContain("marketing→onboarding handoff");
    expect(await render("sequences", "admin")).toContain("Sequence health");
    expect(await render("sla", "admin")).toContain("first-contact SLA");
  });
});
