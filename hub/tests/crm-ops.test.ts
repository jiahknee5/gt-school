// Module 7 — CRM / Marketing Operations. Pure proofs (no DB/services) for the PLAN's
// provable invariants: idempotent auto-detect, alarm semantics, no-vanity-hide, no
// double-count, no-PII-in-issue-text, RBAC denial, attribution chain, read-only scoring.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { generate } from "@/lib/seed/generate";
import { INCOME_BANDS, TEFA_STATUSES, SYNCED_FIELDS } from "@/lib/seed/dictionaries";
import type { FieldState } from "@/lib/seed/types";
import {
  computeSeedParity,
  seedBannerState,
  isExpectedUnreliable,
} from "@/lib/crm-ops/parity-view";
import {
  asIssueRow,
  computeDesiredIssues,
  deriveDetectPlan,
  isMalformedSource,
  runDetect,
} from "@/lib/crm-ops/detect";
import { summarizeAttribution } from "@/lib/crm-ops/attribution";
import { summarizeLeadScores } from "@/lib/crm-ops/scoring";
import {
  assertCanAct,
  buildQueue,
  canActOnQueue,
  canViewCrmOps,
  ownerForIssue,
  QueueAuthError,
} from "@/lib/crm-ops/queue";
import CrmOpsPage from "@/app/m/crm-ops/page";

const ds = generate({ seed: 5, families: 800 });

function fs(field: string, app: string | null, hs: string | null): FieldState {
  return {
    entity: "family",
    entity_id: `${field}-${app}-${hs}-${Math.random()}`,
    field,
    app_value: app,
    hs_value: hs,
    app_updated_at: null,
    hs_updated_at: null,
    in_parity: app === hs,
    last_checked_at: null,
  };
}

describe("CRM Ops · parity view (pure twin of the engine)", () => {
  it("computeSeedParity only counts governed fields and sorts worst-first", () => {
    const parity = computeSeedParity(ds.field_state);
    expect(parity.totalRows).toBeGreaterThan(0);
    // sorted ascending by pct (worst first)
    for (let i = 1; i < parity.fieldDetail.length; i++) {
      expect(parity.fieldDetail[i].pct).toBeGreaterThanOrEqual(parity.fieldDetail[i - 1].pct);
    }
    // a derived segmentation field is never in scope
    expect(parity.fieldDetail.find((f) => f.field === "geo")).toBeUndefined();
  });

  it("reliability flags read field_authority.expected_unreliable, not a hardcoded list", () => {
    const unreliable = SYNCED_FIELDS.filter((f) => f.unreliable).map((f) => f.field).sort();
    expect(unreliable).toEqual(["income_band", "source", "tefa_status"]);
    for (const f of unreliable) expect(isExpectedUnreliable(f)).toBe(true);
    expect(isExpectedUnreliable("funnel_stage")).toBe(false);
  });
});

describe("CRM Ops · banner alarm semantics (invariant #2)", () => {
  it("a known-unreliable field below threshold does NOT trip the alarm (calm)", () => {
    const rows: FieldState[] = [
      ...Array.from({ length: 100 }, (_, i) => fs("income_band", `band${i % 5}`, i < 40 ? "x" : `band${i % 5}`)), // ~60%
      ...Array.from({ length: 100 }, () => fs("lifecycle_stage", "lead", "lead")), // 100%
    ];
    const banner = seedBannerState(rows, 95);
    expect(banner.below.map((b) => b.field)).toContain("income_band");
    expect(banner.expectedUnreliable).toContain("income_band");
    expect(banner.surprises).not.toContain("income_band");
    expect(banner.alarm).toBe(false);
  });

  it("a non-expected field below threshold IS the alarm (surprise → red)", () => {
    const rows: FieldState[] = [
      ...Array.from({ length: 100 }, (_, i) => fs("lifecycle_stage", "lead", i < 30 ? "customer" : "lead")), // ~70%
      ...Array.from({ length: 100 }, () => fs("income_band", "b", "b")), // 100%
    ];
    const banner = seedBannerState(rows, 95);
    expect(banner.surprises).toContain("lifecycle_stage");
    expect(banner.alarm).toBe(true);
  });

  it("no-vanity-hide: overall can read green while a field is visibly below (invariant #5)", () => {
    const parity = computeSeedParity(ds.field_state);
    const banner = seedBannerState(ds.field_state, 95);
    if (banner.overallPct >= 95) {
      // if overall is healthy, any below-threshold field must still be present in fieldDetail
      for (const f of banner.below) {
        expect(parity.fieldDetail.find((d) => d.field === f.field)).toBeTruthy();
      }
    }
    // the seed deliberately drifts unreliable fields, so there is at least one below-threshold field
    expect(banner.below.length).toBeGreaterThan(0);
  });
});

describe("CRM Ops · auto-detector (idempotent)", () => {
  it("isMalformedSource flags missing/sentinel/template sources", () => {
    expect(isMalformedSource(null)).toBe(true);
    expect(isMalformedSource("")).toBe(true);
    expect(isMalformedSource("(none)")).toBe(true);
    expect(isMalformedSource("utm_campaign={{campaign.name}}")).toBe(true);
    expect(isMalformedSource("meta_ads")).toBe(false);
  });

  it("creates utm + sync + duplicate-identity issues from the snapshot", () => {
    const desired = computeDesiredIssues(ds, 95);
    const cats = new Set(desired.map((d) => d.category));
    expect(cats.has("utm")).toBe(true);
    expect(cats.has("sync")).toBe(true);
    expect(cats.has("other")).toBe(true); // duplicate identity
    // duplicate surfaces as an issue on match_key (not as inflated parity rows) — invariant #6
    expect(desired.some((d) => d.field === "match_key" && d.category === "other")).toBe(true);
  });

  it("is idempotent: a rerun over unchanged + persisted state opens 0 and resolves 0 (invariant #3)", () => {
    const first = runDetect(ds, ds.data_quality_issue, 95);
    expect(first.openedCount).toBe(first.desiredCount); // seed issues have no detector signature → all are new
    const persisted = [
      ...ds.data_quality_issue,
      ...first.plan.toOpen.map((d) => asIssueRow(d, "2026-08-31T00:00:00.000Z")),
    ];
    const second = runDetect(ds, persisted, 95);
    expect(second.openedCount).toBe(0);
    expect(second.resolvedCount).toBe(0);
  });

  it("auto-resolves a previously-open auto-issue once its condition clears", () => {
    const desired = computeDesiredIssues(ds, 95);
    // an auto-issue that is open but NOT in the desired set should be resolved
    const stale = asIssueRow(
      { category: "utm", entity: "family", entity_id: "gone-family", field: "source", severity: "high", description: "x" },
      "2026-01-01T00:00:00.000Z",
    );
    const plan = deriveDetectPlan(desired, [stale]);
    expect(plan.toResolve.some((s) => s.entity_id === "gone-family")).toBe(true);
  });

  it("never touches manual/system issues (no detector signature) on resolve", () => {
    const desired = computeDesiredIssues(ds, 95);
    const manual = { category: "tracking", entity: null, entity_id: null, field: null, status: "open" };
    const plan = deriveDetectPlan(desired, [manual]);
    expect(plan.toResolve.length).toBe(0);
  });
});

describe("CRM Ops · privacy (no PII in issue text — invariant #9)", () => {
  it("issue descriptions carry field + entity_id only, never raw income/TEFA/child values", () => {
    const desired = computeDesiredIssues(ds, 95);
    const incomeLabels = INCOME_BANDS.map((b) => b.label);
    for (const d of desired) {
      expect(d.description).not.toContain("@"); // no email
      expect(d.description).not.toContain("$"); // no income band label
      for (const t of TEFA_STATUSES) expect(d.description).not.toContain(t); // no raw TEFA value
      for (const lbl of incomeLabels) expect(d.description).not.toContain(lbl);
    }
  });
});

describe("CRM Ops · attribution chain (§7b)", () => {
  it("reports broken UTM, a 3-hop chain, and names the HubSpot property", () => {
    const a = summarizeAttribution(ds.families);
    expect(a.health.broken).toBeGreaterThan(0);
    expect(a.health.healthPct).toBeLessThan(100);
    expect(a.chain).toHaveLength(3);
    expect(a.hsProperty).toBe("gt_utm_source");
    expect(a.chain[2].status).toBe("broken"); // HubSpot mirror hop
    expect(a.brokenSample.every((r) => !r.familyId.includes("@"))).toBe(true);
  });
});

describe("CRM Ops · lead scoring (read-only, §7c)", () => {
  it("is read-only and labels score→conversion as correlation with n + caveat (Rahman A4)", () => {
    const s = summarizeLeadScores(ds.families);
    expect(s.readOnly).toBe(true);
    expect(s.scored + s.unscored).toBe(ds.families.length);
    expect(s.correlation.n).toBeGreaterThan(0);
    expect(s.correlation.caveat).toMatch(/correlation/i);
    expect(s.correlation.caveat).toMatch(/never writes/i);
    // higher scores convert better on the seeded data
    expect(s.correlation.topQuartileDepositRatePct).toBeGreaterThan(
      s.correlation.bottomQuartileDepositRatePct,
    );
  });
});

describe("CRM Ops · data-quality queue + RBAC (invariant #8)", () => {
  it("merges detected issues idempotently and derives (not stores) an owner", () => {
    const desired = computeDesiredIssues(ds, 95);
    const q1 = buildQueue(ds.data_quality_issue, desired);
    const q2 = buildQueue([...ds.data_quality_issue], desired);
    expect(q1.openCount).toBe(q2.openCount); // stable
    expect(q1.open.every((i) => typeof i.owner === "string" && i.owner.length > 0)).toBe(true);
    const sample = ds.data_quality_issue[0];
    expect(ownerForIssue(sample)).toContain("Marketing Lead");
  });

  it("denies Operators read + act; allows Admin/Leader", () => {
    expect(canViewCrmOps("admin")).toBe(true);
    expect(canViewCrmOps("leader")).toBe(true);
    expect(canViewCrmOps("operator")).toBe(false);
    expect(canActOnQueue("operator")).toBe(false);
    expect(canActOnQueue("leader")).toBe(true);

    expect(() => assertCanAct("operator", "resolve")).toThrow(QueueAuthError);
    expect(() => assertCanAct(null, "ack")).toThrow(QueueAuthError);
    try {
      assertCanAct("operator", "prioritize");
    } catch (e) {
      expect((e as QueueAuthError).status).toBe(403);
    }
    // allowed roles do not throw
    expect(() => assertCanAct("admin", "resolve")).not.toThrow();
    expect(() => assertCanAct("leader", "ack")).not.toThrow();
  });
});

describe("CRM Ops · rendered page (RBAC + sub-views)", () => {
  async function render(tab?: string, role?: string): Promise<string> {
    const node = await CrmOpsPage({
      searchParams: Promise.resolve({ ...(tab ? { tab } : {}), ...(role ? { role } : {}) }),
    });
    return renderToStaticMarkup(node);
  }

  it("denies an Operator the module surface server-side", async () => {
    const html = await render("overview", "operator");
    expect(html).toContain("Access denied for this role");
    expect(html).not.toContain("Sync parity by field");
  });

  it("renders the five sub-views for a Leader", async () => {
    expect(await render("overview", "leader")).toContain("Overall parity");
    expect(await render("parity", "leader")).toContain("Sync parity by field");
    expect(await render("parity", "leader")).toContain("app_form"); // SoT reminder
    expect(await render("source", "admin")).toContain("Attribution chain");
    expect(await render("source", "admin")).toContain("Broken-UTM drill-in");
    expect(await render("scoring", "leader")).toContain("Lead score distribution");
    expect(await render("quality", "leader")).toContain("Open data-quality issues");
  });
});
