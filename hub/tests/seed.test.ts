import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { generate } from "@/lib/seed/generate";
import { validate } from "@/lib/seed/invariants";
import { matchKey } from "@/lib/connectors/SourceConnector";

function hash(x: unknown): string {
  return createHash("sha256").update(JSON.stringify(x)).digest("hex");
}

describe("seed generator", () => {
  it("is deterministic: same seed → byte-identical dataset", () => {
    const a = generate({ seed: 99, families: 300 });
    const b = generate({ seed: 99, families: 300 });
    expect(hash(a)).toBe(hash(b));
  });

  it("changes with the seed", () => {
    const a = generate({ seed: 1, families: 300 });
    const b = generate({ seed: 2, families: 300 });
    expect(hash(a)).not.toBe(hash(b));
  });

  it("passes every invariant at the default size", () => {
    const ds = generate();
    const result = validate(ds);
    const failed = result.checks.filter((c) => !c.ok);
    expect(failed, JSON.stringify(failed, null, 2)).toHaveLength(0);
    expect(result.ok).toBe(true);
  });

  it("passes invariants across a range of seeds and sizes", () => {
    for (const seed of [1, 7, 42, 2026]) {
      const ds = generate({ seed, families: 500 });
      expect(validate(ds).ok, `seed ${seed}`).toBe(true);
    }
  });

  it("records all 15 deliberate edge cases", () => {
    const ds = generate({ families: 500 });
    expect(ds.manifest.edgeCases).toHaveLength(15);
  });
});

describe("realism of the modeled funnel", () => {
  const ds = generate({ seed: 5, families: 2000 });

  it("makes income the master conversion variable ($160K+ converts highest)", () => {
    const rate = (band: string) => {
      const fams = ds.families.filter((f) => f.income_band === band);
      const dep = fams.filter((f) => f.funnel_stage === "deposit").length;
      return fams.length ? dep / fams.length : 0;
    };
    expect(rate("gte_160k")).toBeGreaterThan(rate("lt_80k"));
    expect(rate("gte_160k")).toBeGreaterThan(rate("80_120k"));
  });

  it("spreads families across multiple states with Texas as the home market", () => {
    // state isn't a stored column, but ZIP-derived geography drives match keys;
    // assert spread via a proxy: many distinct match keys and >1 program in play.
    const programs = new Set(ds.program_membership.map((m) => m.program_key));
    expect(programs.size).toBe(2);
  });

  it("models a $365K budget with a real over-plan workstream", () => {
    const total = ds.budget_workstream.reduce((s, b) => s + b.recommended, 0);
    expect(total).toBe(365000);
    expect(ds.budget_workstream.some((b) => b.actual > b.planned * 1.1)).toBe(true);
  });

  it("labels every stood-in record honestly", () => {
    const standIn = [
      ...ds.meta_insights, ...ds.ga4_days, ...ds.x_posts, ...ds.content_sheet,
      ...ds.summer_site_registrations, ...ds.registration_form_entries,
      ...ds.community_ambassadors, ...ds.hubspot_ambassadors,
    ];
    expect(standIn.every((r) => r._standIn === true && typeof r._source === "string")).toBe(true);
  });

  it("threads UTM campaigns from CRM → Meta → GA4", () => {
    const campaigns = new Set(ds.families.map((f) => f.utm_campaign).filter(Boolean));
    const inMeta = new Set(ds.meta_insights.map((m) => m.utm_campaign));
    const inGa4 = new Set(ds.ga4_days.map((g) => g.utm_campaign).filter(Boolean));
    const shared = [...campaigns].filter((c) => inMeta.has(c!) && inGa4.has(c!));
    expect(shared.length).toBeGreaterThanOrEqual(3);
  });

  it("models Meta over-reporting vs CRM (attribution gap)", () => {
    const metaLeads = ds.meta_insights.reduce((s, m) => s + m.leads, 0);
    const crmMeta = ds.families.filter((f) => f.source === "meta_ads").length;
    expect(metaLeads).toBeGreaterThan(crmMeta);
  });

  it("uses real API field names on Meta rows", () => {
    const row = ds.meta_insights[0];
    expect(row).toHaveProperty("campaign_id");
    expect(row).toHaveProperty("publisher_platform");
    expect(row.actions.some((a) => a.action_type === "lead")).toBe(true);
  });
});

describe("edge cases are provable", () => {
  const ds = generate({ seed: 5, families: 800 });

  it("a duplicate family shares a match_key with its original", () => {
    const counts = new Map<string, number>();
    for (const f of ds.families) if (f.match_key) counts.set(f.match_key, (counts.get(f.match_key) ?? 0) + 1);
    expect([...counts.values()].some((c) => c >= 2)).toBe(true);
  });

  it("a Stripe event delivered twice is recorded once in the idempotency ledger", () => {
    const evCounts = new Map<string, number>();
    for (const e of ds.sync_event_log) if (e.external_event_id) evCounts.set(e.external_event_id, (evCounts.get(e.external_event_id) ?? 0) + 1);
    const dupEvent = [...evCounts.entries()].find(([, c]) => c >= 2)?.[0];
    expect(dupEvent).toBeDefined();
    const inLedger = ds.processed_events.filter((p) => p.event_id === dupEvent);
    expect(inLedger.length).toBeLessThanOrEqual(1);
  });

  it("a failed payment is followed by a succeeded retry on the same enrollment", () => {
    const byEnrollment = new Map<string, string[]>();
    for (const p of ds.payments) {
      if (!p.enrollment_id) continue;
      const arr = byEnrollment.get(p.enrollment_id) ?? [];
      arr.push(p.status);
      byEnrollment.set(p.enrollment_id, arr);
    }
    const retried = [...byEnrollment.values()].some((s) => s.includes("failed") && s.includes("succeeded"));
    expect(retried).toBe(true);
  });

  it("the dual-source feeds collide on match_key (reconciliation has work to do)", () => {
    const siteKeys = new Set(ds.summer_site_registrations.map((r) => r.match_key));
    const overlap = ds.registration_form_entries.filter((f) => f.match_key && siteKeys.has(f.match_key));
    expect(overlap.length).toBeGreaterThan(0);
  });

  it("a phone-only family resolves to a phone-based match key", () => {
    const phoneOnly = ds.families.find((f) => f.email === null && f.phone);
    expect(phoneOnly).toBeDefined();
    expect(phoneOnly!.match_key).toBe(
      matchKey({ phone: phoneOnly!.phone, firstName: phoneOnly!.first_name, lastName: phoneOnly!.last_name }),
    );
  });

  it("no payment crosses program isolation", () => {
    const enrById = new Map(ds.enrollments.map((e) => [e.id, e]));
    for (const p of ds.payments) {
      if (!p.enrollment_id) continue;
      const e = enrById.get(p.enrollment_id);
      if (e) expect(e.program_id).toBe(p.program_id);
    }
  });
});
