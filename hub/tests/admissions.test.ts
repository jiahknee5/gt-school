// Module 9 — Admissions & Voice of Customer. Pure proofs for the PLAN's provable
// invariants: dedup (no double-count), theme closure, pipeline SSOT, idempotent +
// correlational bridge, consent gate, closure-rate math, RBAC denial, trend correctness.

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { generate } from "@/lib/seed/generate";
import { suggestTheme, THEMES, isTheme } from "@/lib/admissions/themes";
import {
  buildRawObjections,
  buildObjections,
  buildFamilyQuotes,
  publicQuotes,
  quoteOfWeek,
} from "@/lib/admissions/ingest";
import { pipelineNumbers, themeFrequencies } from "@/lib/admissions/metrics";
import { stubBrief, bridgeEffect, bridgeHitRate, type ContentBrief } from "@/lib/admissions/bridge";
import {
  closureRate,
  seedFeedback,
  canViewDecisionQueue,
  canSubmitFeedback,
} from "@/lib/admissions/feedback";

const ds = generate({ seed: 424242, families: 1200 });
const asOf = ds.manifest.generatedAt;

describe("Admissions · theme closure (invariant #2)", () => {
  it("the verbatim 'is my kid gifted enough' maps to gifted_enough, never other", () => {
    expect(suggestTheme("Is my kid gifted enough for this?").theme).toBe("gifted_enough");
  });

  it("every objection theme is in the closed 8-theme set", () => {
    for (const o of buildObjections(ds)) expect(isTheme(o.theme)).toBe(true);
    expect(THEMES).toHaveLength(8);
  });
});

describe("Admissions · dedup (invariant #1)", () => {
  it("a re-surfaced thread (same source_ref+theme) does not inflate frequency", () => {
    const raw = buildRawObjections(ds);
    const deduped = buildObjections(ds);
    expect(raw.length).toBeGreaterThan(deduped.length); // the duplicate was removed
    const keys = deduped.map((o) => `${o.sourceRef}:${o.theme}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("a multi-objection thread keeps distinct themes from the same source_ref", () => {
    const deduped = buildObjections(ds);
    const thread1 = deduped.filter((o) => o.sourceRef === "thread_1");
    expect(new Set(thread1.map((o) => o.theme)).size).toBe(thread1.length);
    expect(thread1.length).toBeGreaterThan(1);
  });
});

describe("Admissions · pipeline SSOT (invariant #3)", () => {
  it("pipeline numbers equal counts derived from families.funnel_stage", () => {
    const p = pipelineNumbers(ds.families);
    expect(p.applicants).toBe(ds.families.filter((f) => f.funnel_stage === "applicant").length);
    expect(p.deposits).toBe(ds.families.filter((f) => f.funnel_stage === "deposit").length);
    expect(p.shadowDays).toBe(ds.families.filter((f) => f.funnel_stage === "shadow_day").length);
  });
});

describe("Admissions · bridge idempotency + honesty (invariant #4)", () => {
  it("stubbing the same theme twice yields one open brief", () => {
    let briefs: ContentBrief[] = [];
    const a = stubBrief(briefs, "cost", ["too expensive"], 5, asOf);
    expect(a.created).toBe(true);
    briefs = a.briefs;
    const b = stubBrief(briefs, "cost", ["still expensive"], 5, asOf);
    expect(b.created).toBe(false);
    expect(b.briefs).toHaveLength(1);
  });

  it("bridge effect is labeled correlational with a window + delta", () => {
    const brief: ContentBrief = {
      id: "b", objectionTheme: "cost", verbatimExamples: [], suggestedAngle: "", targetPersona: "p",
      urgency: "normal", status: "published", freqBefore: 10, freqAfter: null, publishedAt: asOf, createdAt: asOf,
    };
    const eff = bridgeEffect(brief, 6);
    expect(eff.label).toBe("correlational");
    expect(eff.delta).toBe(-4);
    expect(eff.windowDays).toBe(14);
  });

  it("hit-rate = produced ÷ sent", () => {
    const briefs: ContentBrief[] = [
      { id: "1", objectionTheme: "cost", verbatimExamples: [], suggestedAngle: "", targetPersona: "", urgency: "normal", status: "published", freqBefore: 0, freqAfter: null, publishedAt: asOf, createdAt: asOf },
      { id: "2", objectionTheme: "social", verbatimExamples: [], suggestedAngle: "", targetPersona: "", urgency: "normal", status: "open", freqBefore: 0, freqAfter: null, publishedAt: null, createdAt: asOf },
    ];
    expect(bridgeHitRate(briefs)).toBe(0.5);
  });
});

describe("Admissions · consent gate (invariant #5)", () => {
  it("no unconsented quote appears in the public feed or quote-of-week", () => {
    const quotes = buildFamilyQuotes(ds);
    expect(quotes.some((q) => !q.consent)).toBe(true); // seed includes an unconsented one
    for (const q of publicQuotes(quotes)) expect(q.consent).toBe(true);
    const qow = quoteOfWeek(quotes);
    if (qow) expect(qow.consent).toBe(true);
  });
});

describe("Admissions · closure rate + RBAC (invariants #6, #7)", () => {
  it("closure_rate = actioned within 7d ÷ flagged (a late action does not count)", () => {
    const fb = seedFeedback(asOf);
    // fb_1 actioned in 4d (counts), fb_2 actioned in 8d (does not), fb_3 open, fb_4 1d
    expect(closureRate(fb)).toBe(Number((2 / 4).toFixed(3)));
  });

  it("Operator may submit feedback but cannot view the Decision Queue", () => {
    expect(canSubmitFeedback("operator")).toBe(true);
    expect(canViewDecisionQueue("operator")).toBe(false);
    expect(canViewDecisionQueue("admin")).toBe(false);
    expect(canViewDecisionQueue("leader")).toBe(true);
  });
});

describe("Admissions · trend correctness (invariant #9)", () => {
  it("the trend arrow matches the sign of (this - prior) per theme", () => {
    const freqs = themeFrequencies(buildObjections(ds), asOf);
    for (const f of freqs) {
      if (f.thisPeriod > f.priorPeriod) expect(f.trend).toBe("up");
      else if (f.thisPeriod < f.priorPeriod) expect(f.trend).toBe("down");
      else expect(f.trend).toBe("stable");
    }
  });
});

// ───────────────── rendered page (auth mocked) ─────────────────
vi.mock("@/lib/auth", () => ({
  DEV_MODE: true,
  getSession: vi.fn(async () => null),
}));

const { default: AdmissionsPage } = await import("@/app/m/admissions/page");

async function render(tab?: string, role?: string): Promise<string> {
  const node = await AdmissionsPage({
    searchParams: Promise.resolve({ ...(tab ? { tab } : {}), ...(role ? { role } : {}) }),
  });
  return renderToStaticMarkup(node);
}

describe("Admissions · rendered sub-views", () => {
  it("overview + objection log render with trend arrows", async () => {
    const overview = await render("overview", "operator");
    expect(overview).toContain("Admissions &amp; Voice of Customer");
    expect(overview).toContain("Top objections");
    const log = await render("objections", "operator");
    expect(log).toContain("Objection log");
    expect(log).toContain("gifted enough");
  });

  it("voice of families hides unconsented quotes and shows quote-of-week", async () => {
    const html = await render("voice", "admin");
    expect(html).toContain("Quote of the week");
    expect(html).not.toContain("the price is steep"); // the unconsented quote
  });

  it("renders bridge + feedback; Operator sees submit-not-view framing", async () => {
    expect(await render("bridge", "operator")).toContain("Bridge hit-rate");
    const feedback = await render("feedback", "operator");
    expect(feedback).toContain("Feedback-to-marketing loop");
    expect(feedback).toContain("not view/act on it");
    expect(feedback).toContain('href="/m/submissions"');
    expect(feedback).toContain("My submissions");
    expect(feedback).not.toContain('href="/m/decisions"');
  });
});
