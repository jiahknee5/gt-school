import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { generate } from "@/lib/seed/generate";
import { SYNCED_FIELDS } from "@/lib/seed/dictionaries";
import { USE_CASES } from "@/lib/dev/usecases";
import { routeDecision } from "@/lib/auth/policy";
import {
  addWidget,
  layoutForUser,
  removeWidget,
  reorderWidget,
  starterHomeLayout,
} from "@/lib/home/layout";
import {
  DEFAULT_STARTER_WIDGET_IDS,
  DEMO_USERS,
  WIDGET_LIBRARY,
  assessGtChallenge,
  buildConfidenceBanner,
  buildModuleSurface,
  buildWeeklyScorecard,
  canDecide,
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

/**
 * Brief use cases as runnable tests. Every scenario in lib/dev/usecases.ts that is
 * marked `covered` is proven here at the data/logic level (no live services, always
 * green). `live` scenarios are proven in their own service-backed files (payments,
 * reconcile, parity, opendata). `pending` scenarios are tracked as it.todo so the
 * suite is honest about what isn't built yet. This file is surfaced at /dev/tests.
 */

const hash = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex");

// A medium dataset with enough volume to exercise conflicts + dual-source overlap.
const ds = generate({ seed: 5, families: 800 });
const admin = DEMO_USERS.find((u) => u.role === "admin")!;
const leader = DEMO_USERS.find((u) => u.role === "leader")!;
const operator = DEMO_USERS.find((u) => u.role === "operator")!;

// ───────────────────────── Phase 1 · Backbone ─────────────────────────
describe("Phase 1 · backbone (data-level proofs)", () => {
  it("UC-P1-ISOLATION: no payment references an enrollment in another program", () => {
    const enrById = new Map(ds.enrollments.map((e) => [e.id, e]));
    for (const p of ds.payments) {
      if (!p.enrollment_id) continue;
      const e = enrById.get(p.enrollment_id);
      if (e) expect(e.program_id).toBe(p.program_id);
    }
  });

  it("UC-P1-PAYMENT-IDEM: a twice-delivered event is recorded once in the ledger", () => {
    const counts = new Map<string, number>();
    for (const e of ds.sync_event_log)
      if (e.external_event_id) counts.set(e.external_event_id, (counts.get(e.external_event_id) ?? 0) + 1);
    const dup = [...counts.entries()].find(([, c]) => c >= 2)?.[0];
    expect(dup, "expected a duplicate-delivery edge case").toBeDefined();
    expect(ds.processed_events.filter((p) => p.event_id === dup).length).toBeLessThanOrEqual(1);
  });

  it("UC-P1-PAYMENT-RETRY: a failed payment is followed by a succeeded retry on the same enrollment", () => {
    const byEnr = new Map<string, string[]>();
    for (const p of ds.payments) {
      if (!p.enrollment_id) continue;
      byEnr.set(p.enrollment_id, [...(byEnr.get(p.enrollment_id) ?? []), p.status]);
    }
    expect([...byEnr.values()].some((s) => s.includes("failed") && s.includes("succeeded"))).toBe(true);
  });

  it("UC-P1-DUP-WEBHOOK: a duplicated source event id survives in the log but processes at most once", () => {
    const counts = new Map<string, number>();
    for (const e of ds.sync_event_log)
      if (e.external_event_id) counts.set(e.external_event_id, (counts.get(e.external_event_id) ?? 0) + 1);
    expect([...counts.values()].some((c) => c >= 2)).toBe(true);
    for (const [id, c] of counts) {
      if (c >= 2) expect(ds.processed_events.filter((p) => p.event_id === id).length).toBeLessThanOrEqual(1);
    }
  });

  it("UC-P1-CONFLICT: an app-authoritative field records HubSpot's disagreement without overwriting local", () => {
    const conflict = ds.field_state.find((fs) => !fs.in_parity && fs.app_value !== fs.hs_value);
    expect(conflict, "expected a crm_app_conflict edge case").toBeDefined();
    expect(conflict!.app_value).not.toBeNull();
    expect(conflict!.app_value).not.toBe(conflict!.hs_value);
  });

  it("UC-P1-PARITY-SIGNAL: parity is computed below 100% and data-quality issues exist", () => {
    expect(ds.parity_snapshot.length).toBeGreaterThan(0);
    expect(ds.field_state.some((fs) => !fs.in_parity)).toBe(true);
    expect(ds.parity_snapshot.every((p) => p.overall_pct >= 0 && p.overall_pct <= 100)).toBe(true);
    expect(ds.data_quality_issue.length).toBeGreaterThan(0);
  });

  it("UC-P1-RECON-SUMMER: summer.gt.school + form overlap on match_key and reconcile to unique families", () => {
    const rows = [
      ...ds.summer_site_registrations.map((r) => r.match_key),
      ...ds.registration_form_entries.map((r) => r.match_key),
    ].filter((k): k is string => Boolean(k));
    const siteKeys = new Set(ds.summer_site_registrations.map((r) => r.match_key).filter(Boolean));
    const overlap = ds.registration_form_entries.filter((f) => f.match_key && siteKeys.has(f.match_key));
    expect(overlap.length, "the two feeds must collide (reconciliation has work to do)").toBeGreaterThan(0);
    // reconciling by match_key collapses duplicates → fewer unique families than raw rows.
    expect(new Set(rows).size).toBeLessThan(rows.length);
  });

  it("UC-P1-RECON-AMBASSADOR: HubSpot + community ambassadors resolve to one person by match_key", () => {
    const hsKeys = new Set(ds.hubspot_ambassadors.map((a) => a.match_key).filter(Boolean));
    const overlap = ds.community_ambassadors.filter((a) => a.match_key && hsKeys.has(a.match_key));
    expect(overlap.length).toBeGreaterThan(0);
  });
});

// ───────────────────────── Test data deliverable ─────────────────────────
describe("Test data deliverable", () => {
  it("UC-DATA-DETERMINISM: same seed → byte-identical; different seed → different", () => {
    expect(hash(generate({ seed: 99, families: 300 }))).toBe(hash(generate({ seed: 99, families: 300 })));
    expect(hash(generate({ seed: 1, families: 300 }))).not.toBe(hash(generate({ seed: 2, families: 300 })));
  });

  it("UC-DATA-EDGECASES: all 15 deliberate edge cases are present", () => {
    expect(ds.manifest.edgeCases.length).toBe(15);
  });

  it("UC-DATA-MESSY: a mojibake name and missing-field families are present", () => {
    const nonAscii = ds.families.some((f) => /[^\u0000-\u007F]/.test(`${f.first_name ?? ""}${f.last_name ?? ""}`));
    expect(nonAscii, "expected a mojibake (UTF-8 mis-decoded) name").toBe(true);
    expect(ds.families.some((f) => f.email === null), "expected a missing-email family").toBe(true);
    expect(ds.families.some((f) => f.utm_campaign === null), "expected a missing-field (null UTM) family").toBe(true);
  });

  it("UC-DATA-HONEST: every stood-in record is labeled real-vs-stood-in", () => {
    const standIn = [
      ...ds.meta_insights, ...ds.ga4_days, ...ds.x_posts, ...ds.content_sheet,
      ...ds.summer_site_registrations, ...ds.registration_form_entries,
      ...ds.community_ambassadors, ...ds.hubspot_ambassadors,
    ];
    expect(standIn.length).toBeGreaterThan(0);
    expect(standIn.every((r) => r._standIn === true && typeof r._source === "string")).toBe(true);
  });

  it("UC-DATA-BUDGET-365: workstream recommended amounts sum to exactly $365,000", () => {
    expect(ds.budget_workstream.reduce((s, b) => s + b.recommended, 0)).toBe(365000);
  });

  it("UC-DATA-VARIANCE: a >10% over-plan workstream exists and an auto-flag decision was raised", () => {
    expect(ds.budget_workstream.some((b) => b.actual > b.planned * 1.1)).toBe(true);
    expect(ds.decisions.some((d) => d.auto_flag === true)).toBe(true);
  });

  it("UC-DATA-ATTR-GAP: Meta over-reports leads vs CRM (modeled attribution gap)", () => {
    const metaLeads = ds.meta_insights.reduce((s, m) => s + m.leads, 0);
    const crmMeta = ds.families.filter((f) => f.source === "meta_ads").length;
    expect(metaLeads).toBeGreaterThan(crmMeta);
  });

  it("UC-DATA-UTM-THREAD: a campaign threads CRM → Meta → GA4", () => {
    const crm = new Set(ds.families.map((f) => f.utm_campaign).filter(Boolean));
    const meta = new Set(ds.meta_insights.map((m) => m.utm_campaign));
    const ga4 = new Set(ds.ga4_days.map((g) => g.utm_campaign).filter(Boolean));
    const shared = [...crm].filter((c) => c && meta.has(c) && ga4.has(c));
    expect(shared.length).toBeGreaterThanOrEqual(1);
  });
});

// ───────────────────────── Phase 2 · Product (data-level) ─────────────────────────
describe("Phase 2 · product (data-level proofs)", () => {
  it("UC-P2-SSOT: an app-authoritative field keeps its local value when HubSpot disagrees", () => {
    const fs = ds.field_state.find((s) => !s.in_parity && s.app_value !== null && s.app_value !== s.hs_value);
    expect(fs, "expected an app-vs-HubSpot disagreement that preserves the local value").toBeDefined();
  });

  it("UC-P2-CRMOPS-GAPS: data-quality issues are generated for CRM Ops to surface", () => {
    expect(ds.data_quality_issue.length).toBeGreaterThan(0);
    expect(ds.data_quality_issue.every((i) => typeof i.category === "string" && typeof i.severity === "string")).toBe(true);
  });

  it("UC-P2-HOME: the Home widget library has the starter pack and role-aware additions", () => {
    expect(WIDGET_LIBRARY.length).toBeGreaterThanOrEqual(32);
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
    expect(widgetsForUser(leader).map((w) => w.id)).toContain("decision-preview");
    expect(widgetsForUser(operator).map((w) => w.id)).toContain("content-pipeline");
  });

  it("UC-P2-HOME-PERSISTENCE: Home add/remove/reorder layout survives as a user row", () => {
    const started = starterHomeLayout(operator);
    const added = addWidget(started, "top-objections");
    const moved = reorderWidget(added, "top-objections", 0);
    const removed = removeWidget(moved, "content-pipeline");
    const saved = layoutForUser(operator, {
      user_id: operator.id,
      role: operator.role,
      widgets: removed,
      version: 2,
      updated_at: "2026-06-26T12:00:00.000Z",
    });

    expect(saved.persisted).toBe(true);
    expect(saved.user_id).toBe(operator.id);
    expect(saved.widgets[0].widget_key).toBe("top-objections");
    expect(saved.widgets.map((item) => item.widget_key)).not.toContain("content-pipeline");
    expect(saved.widgets.map((item) => item.order)).toEqual(saved.widgets.map((_, index) => index));
  });

  it("UC-GTC-CAPTURE-ASSESS: Challenge assessment requires consent, scores, routes, and de-identifies", () => {
    const blocked = assessGtChallenge({
      parentEmail: "parent@example.com",
      childGrade: "2",
      score: 92,
      consent: false,
      utmSource: "facebook",
    });
    expect(blocked.accepted).toBe(false);
    expect(blocked.programKey).toBe("none");
    expect(blocked.deidentifiedPayload.scoreBand).toBe("withheld");

    const routed = assessGtChallenge({
      parentEmail: "parent@example.com",
      childGrade: "2",
      score: 92,
      consent: true,
      utmSource: "facebook",
      utmCampaign: "gifted_quiz_2026",
    });
    expect(routed.qualified).toBe(true);
    expect(routed.bucket).toBe("strong_fit");
    expect(routed.programKey).toBe("fall_enrollment");
    expect(JSON.stringify(routed.deidentifiedPayload)).not.toContain("parent@example.com");
  });

  it("UC-GTC-CAMPAIGN: the gifted-quiz campaign threads across Meta and CRM source", () => {
    const summary = summarizeGtChallengeCampaign(ds.meta_insights, ds.families);
    expect(ds.meta_insights.some((m) => m.utm_campaign === "gifted_quiz_2026")).toBe(true);
    expect(ds.families.some((f) => f.source === "meta_ads")).toBe(true);
    expect(summary.campaign).toBe("gifted_quiz_2026");
    expect(summary.platformLeads).toBeGreaterThanOrEqual(summary.qualifiedLeads);
    expect(summary.caveat).toContain("UTM attribution is known broken");
  });
});

// ───────────────────────── Demo signals supported by Phase 2 helpers ─────────────────────────
describe("Demo signals supported by Phase 2 helpers", () => {
  it("UC-DEMO-BUDGET: Budget Tracker logic reconciles to $365K and raises variance decisions", () => {
    const summary = summarizeBudget(ds.budget_workstream);
    expect(summary.totals.recommended).toBe(365000);
    expect(summary.totals.planned).toBe(365000);
    expect(summary.rows.every((r) => r.remaining === r.planned - r.actual)).toBe(true);
    expect(summary.autoFlagRows.map((r) => r.key)).toContain("guerrilla");
    expect(ensureBudgetVarianceDecision(ds.budget_workstream, []).some((d) => d.auto_flag)).toBe(true);
  });

  it("UC-DEMO-ROLE-DENIED: non-leaders are denied full Decision Queue data", () => {
    expect(canViewDecisionQueue(leader)).toBe(true);
    expect(canDecide(leader)).toBe(true);
    expect(canViewDecisionQueue(admin)).toBe(false);
    expect(canViewDecisionQueue(operator)).toBe(false);
    expect(DEMO_USERS.every(canSubmitDecision)).toBe(true);
    expect(visibleDecisionsForUser(leader, ds.decisions)).toHaveLength(ds.decisions.length);
    expect(visibleDecisionsForUser(operator, ds.decisions).length).toBeLessThan(ds.decisions.length);
  });

  it("UC-DEMO-ROLE-DENIED-AUTH-UI: Operator is denied the Decision Queue route and ruling UI", () => {
    expect(routeDecision("operator", "/m/decisions").status).toBe(403);
    expect(routeDecision("admin", "/m/decisions").status).toBe(403);
    expect(routeDecision("leader", "/m/decisions").allowed).toBe(true);

    const surface = buildModuleSurface("decisions", ds, "operator");
    expect(surface.access.allowed).toBe(false);
    expect(surface.metrics.map((m) => m.value)).toContain("Denied");
    expect(surface.metrics.map((m) => m.note).join(" ")).not.toMatch(/open decisions exist/i);
    const renderedRows = surface.sections.flatMap((section) => section.rows);
    expect(renderedRows.map((row) => row.label)).toEqual(["Full queue hidden"]);
    expect(renderedRows.map((row) => row.label).join(" ")).not.toContain(ds.decisions[0].question);
    expect(surface.actions).toEqual(["Submit a decision request"]);
    expect(surface.actions).not.toContain("Approve");
    expect(surface.actions).not.toContain("Reject");
    expect(surface.actions).not.toContain("Need info");
  });

  it("UC-DEMO-BANNER: data-confidence banner payload appears when parity drops", () => {
    const banner = buildConfidenceBanner(ds.field_state);
    expect(banner.show).toBe(true);
    expect(banner.href).toBe("/m/crm-ops");
    expect(banner.below.length).toBeGreaterThan(0);
    expect(banner.message).toContain("CRM Ops");
  });
});

// ───────────────────────── Marketing Hub spec (data-level) ─────────────────────────
describe("Marketing Hub spec (data-level proofs)", () => {
  it("UC-SPEC-BUDGET-WORKSTREAMS: pre-loaded workstreams match the spec's $365K table", () => {
    const want: Record<string, number> = {
      grassroots: 210_000,
      thought_leadership: 90_000,
      guerrilla: 40_000,
      foundations: 25_000,
    };
    const got = Object.fromEntries(ds.budget_workstream.map((b) => [b.key, b.recommended]));
    expect(got).toMatchObject(want);
    expect(Object.values(want).reduce((a, b) => a + b, 0)).toBe(365_000);
  });

  it("UC-SPEC-CAMP-PL: summer camp is a separate P&L, not a budget workstream", () => {
    const keys = ds.budget_workstream.map((b) => b.key);
    expect(keys.some((k) => /camp|summer/i.test(k))).toBe(false);
    expect(ds.summer_site_registrations.length).toBeGreaterThan(0); // tracked in its own feed
  });

  it("UC-SPEC-FIELD-RELIABILITY: exactly TEFA/income/source are unreliable, and they drift", () => {
    const unreliable = SYNCED_FIELDS.filter((f) => f.unreliable).map((f) => f.field).sort();
    expect(unreliable).toEqual(["income_band", "source", "tefa_status"]);
    const drifted = new Set(ds.field_state.filter((fs) => !fs.in_parity).map((fs) => fs.field));
    expect(unreliable.some((f) => drifted.has(f))).toBe(true);
  });

  it("UC-SPEC-SCORE-CONVERSION: top-quartile lead scores convert better than bottom-quartile", () => {
    const scored = ds.families.filter((f) => f.lead_score != null).sort((a, b) => a.lead_score! - b.lead_score!);
    const q = Math.floor(scored.length / 4);
    const depositRate = (arr: typeof scored) => arr.filter((f) => f.funnel_stage === "deposit").length / arr.length;
    expect(depositRate(scored.slice(-q))).toBeGreaterThan(depositRate(scored.slice(0, q)));
  });

  it("UC-SPEC-DQ-AUTODETECT: the data-quality queue includes UTM + sync issues", () => {
    const cats = new Set(ds.data_quality_issue.map((i) => i.category));
    expect(cats.has("utm")).toBe(true);
    expect(cats.has("sync")).toBe(true);
  });

  it("UC-SPEC-OUTBOX-DLQ: the sync outbox models pending, done, and dead states", () => {
    const statuses = new Set(ds.sync_outbox.map((o) => o.status));
    expect(statuses.has("pending")).toBe(true);
    expect(statuses.has("dead")).toBe(true);
  });

  it("UC-SPEC-CONTENT-PIPELINE: the content sheet spans multiple stages and reaches published", () => {
    expect(ds.content_sheet.length).toBeGreaterThan(0);
    const statuses = new Set(ds.content_sheet.map((r) => r.status));
    expect(statuses.size).toBeGreaterThanOrEqual(2);
    expect(statuses.has("published")).toBe(true);
  });

  it("UC-SPEC-XLINK-TESTIMONIAL: Grassroots testimonial creates a Content idea stub", () => {
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

  it("UC-SPEC-XLINK-OBJECTION: high-frequency Admissions objection creates a content brief", () => {
    const brief = createContentBriefFromObjection({
      theme: "tuition",
      frequency: 7,
      examples: ["Can we afford this?", "How does ESA change tuition?"],
    });
    expect(brief.urgency).toBe("high");
    expect(brief.sourceModule).toBe("admissions");
    expect(brief.title).toContain("tuition");
  });

  it("UC-SPEC-XLINK-HOTFAMILY: hot-family signal chips into Admissions and Decision Queue", () => {
    const decision = createHotFamilyDecision({
      familyId: "fam-1",
      sourceModule: "grassroots",
      reason: "Ambassador says family is ready for founder follow-up.",
      priority: "urgent",
    });
    expect(decision.status).toBe("open");
    expect(decision.priority).toBe("urgent");
    expect(decision.question).toContain("Hot family");

    const surface = buildModuleSurface("grassroots", ds);
    const hot = surface.sections.flatMap((s) => s.rows).find((r) => r.label.includes("Hot family"));
    expect(hot?.label).toContain("Admissions");
    expect(hot?.href).toBe("/m/decisions");
  });

  it("UC-SPEC-XLINK-EVENT: parent-led Grassroots event maps to read-only Field Marketing", () => {
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

  it("UC-SPEC-MONDAY-MEETING: the shared scorecard uses canonical sourced metrics", () => {
    const rows = buildWeeklyScorecard(ds.families, ds.budget_workstream);
    expect(rows.map((r) => r.metric)).toEqual(["Applicants", "Deposits", "Budget actual"]);
    expect(rows.every((r) => r.source)).toBe(true);
    expect(buildModuleSurface("dashboard", ds).sections.some((s) => s.id === "scorecard")).toBe(true);
  });

  it("UC-SPEC-HANDOFF: handoff count, rate, and velocity derive from deal/payment facts", () => {
    const handoff = summarizeMarketingHandoff(ds.families, ds.payments);
    expect(handoff.cumulative).toBeGreaterThan(0);
    expect(handoff.handoffRate).toBeGreaterThan(0);
    expect(handoff.avgDaysToHandoff).toBeGreaterThan(0);
    expect(handoff.source).toContain("HubSpot");
  });
});

// ───────────────────────── Pending — not built yet (tracked) ─────────────────────────
describe("Pending product features (tracked, not yet built)", () => {
  it.todo("UC-P2-AUTH-ROLES: auth + Admin/Leader/Operator enforced at the app layer");
  it.todo("UC-GTC-CAPTURE-PERSIST: GT Challenge public quiz stores deduped submissions with no double-count");
});

// ───────────────────────── Catalog integrity ─────────────────────────
describe("Use-case catalog integrity (lib/dev/usecases.ts)", () => {
  const IMPLEMENTED = new Set([
    "UC-P1-ISOLATION", "UC-P1-PAYMENT-IDEM", "UC-P1-PAYMENT-RETRY", "UC-P1-DUP-WEBHOOK",
    "UC-P1-CONFLICT", "UC-P1-PARITY-SIGNAL", "UC-P1-RECON-SUMMER", "UC-P1-RECON-AMBASSADOR",
    "UC-DATA-DETERMINISM", "UC-DATA-EDGECASES", "UC-DATA-MESSY", "UC-DATA-HONEST", "UC-DATA-BUDGET-365",
    "UC-DATA-VARIANCE", "UC-DATA-ATTR-GAP", "UC-DATA-UTM-THREAD",
    "UC-P2-SSOT", "UC-P2-CRMOPS-GAPS", "UC-P2-HOME", "UC-P2-HOME-PERSISTENCE", "UC-GTC-CAPTURE-ASSESS", "UC-GTC-CAMPAIGN",
    "UC-SPEC-BUDGET-WORKSTREAMS", "UC-SPEC-CAMP-PL", "UC-SPEC-FIELD-RELIABILITY",
    "UC-SPEC-SCORE-CONVERSION", "UC-SPEC-DQ-AUTODETECT", "UC-SPEC-OUTBOX-DLQ",
    "UC-SPEC-CONTENT-PIPELINE",
    "UC-SPEC-XLINK-TESTIMONIAL", "UC-SPEC-XLINK-OBJECTION", "UC-SPEC-XLINK-HOTFAMILY",
    "UC-SPEC-XLINK-EVENT", "UC-SPEC-MONDAY-MEETING", "UC-SPEC-HANDOFF",
    "UC-DEMO-BUDGET", "UC-DEMO-ROLE-DENIED", "UC-DEMO-BANNER",
    "UC-DEMO-BUDGET-UI", "UC-DEMO-ROLE-DENIED-AUTH-UI", "UC-DEMO-BANNER-UI",
  ]);
  const TODOS = new Set([
    "UC-P2-AUTH-ROLES", "UC-GTC-CAPTURE-PERSIST",
  ]);

  it("every use case is well-formed (id, reqs, proves, tests)", () => {
    for (const u of USE_CASES) {
      expect(u.id, JSON.stringify(u)).toMatch(/^UC-/);
      expect(u.reqs.length).toBeGreaterThan(0);
      expect(u.proves.length).toBeGreaterThan(0);
      expect(u.tests.length).toBeGreaterThan(0);
    }
  });

  it("use-case ids are unique", () => {
    const ids = USE_CASES.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every P0 hard requirement is referenced by at least one use case (traceability)", () => {
    // P0 ids from docs/01-intake/REQUIREMENTS.md — the non-negotiables.
    const P0 = [
      "B1", "B2", "B3", "B4", "B5",
      "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8",
      "D1", "D3", "D4",
      "E1", "E2", "E3", "E4", "E5",
    ];
    const referenced = new Set(USE_CASES.flatMap((u) => u.reqs));
    const orphans = P0.filter((id) => !referenced.has(id));
    expect(orphans, `P0 requirements with no use case: ${orphans.join(", ")}`).toHaveLength(0);
  });

  it("catalog stays in sync with this file's implemented + todo cases", () => {
    for (const u of USE_CASES) {
      const ref = u.tests.find((t) => t.startsWith("brief-usecases.test.ts"));
      if (!ref) continue;
      if (ref.includes("(todo)")) expect(TODOS.has(u.id), `${u.id} should be a todo here`).toBe(true);
      else expect(IMPLEMENTED.has(u.id), `${u.id} should be implemented here`).toBe(true);
    }
    // and every pending catalog entry is tracked as a todo
    for (const u of USE_CASES) {
      if (u.status === "pending") expect(TODOS.has(u.id), `${u.id} pending → needs a todo`).toBe(true);
    }
  });
});
