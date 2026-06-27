// Module 6 — Dashboard / KPI Tracking. Pure proofs (no DB/services) for the PLAN's
// provable invariants: single KPI definition (no drift), read-only aggregator, versioned
// + immutable snapshots, Leader-only goal RBAC, the honesty (low-confidence) flag,
// per-connector freshness (the seeded stale connector), and the display-only HubSpot
// mirror. Plus the rendered page sub-views and the server-side goal-edit route guard.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { generate } from "@/lib/seed/generate";
import {
  KPI_DEFINITIONS,
  computeKpi,
  kpiWeeklySeries,
  weekMondays,
  weekIndexOf,
} from "@/lib/metrics/registry";
import { buildScorecard, paceToTarget } from "@/lib/dashboard/scorecard";
import { buildPacing } from "@/lib/dashboard/pacing";
import { goalFor } from "@/lib/dashboard/goals";
import { buildStatusBoard } from "@/lib/status/board";
import { FUNNEL_STAGES, SCORECARD_GROUPS, stageForKpi } from "@/lib/funnel/stages";
import {
  GoalAuthError,
  applyGoalEdit,
  canEditGoal,
  DEFAULT_GOALS,
} from "@/lib/dashboard/goals";
import { connectorFreshness } from "@/lib/dashboard/freshness";
import { DEMO_USERS } from "@/lib/phase2";

const ds = generate({ seed: 424242, families: 1200 });
const WEEKS = weekMondays();
const LATEST = WEEKS[WEEKS.length - 1];

const admin = DEMO_USERS.find((u) => u.role === "admin")!;
const leader = DEMO_USERS.find((u) => u.role === "leader")!;
const operator = DEMO_USERS.find((u) => u.role === "operator")!;

const SPRINT_START = Date.parse("2026-06-01T00:00:00.000Z");
const DAY = 86_400_000;
const wi = (iso: string) => Math.floor((Date.parse(iso) - SPRINT_START) / (7 * DAY));

describe("Dashboard · single KPI definition / no drift (invariant #1)", () => {
  it("scorecard value == registry value == an independent recompute, to the digit", () => {
    const idx = WEEKS.length - 1;
    const applicantsRecompute = ds.families.filter(
      (f) => ["applicant", "shadow_day", "deposit"].includes(f.funnel_stage ?? "") && wi(f.created_at) === idx,
    ).length;
    const depositsRecompute = ds.families.filter(
      (f) => f.funnel_stage === "deposit" && wi(f.created_at) === idx,
    ).length;

    const sc = buildScorecard(ds, LATEST);
    const aRow = sc.rows.find((r) => r.key === "applicants")!;
    const dRow = sc.rows.find((r) => r.key === "deposits")!;

    expect(computeKpi("applicants", ds, LATEST)).toBe(applicantsRecompute);
    expect(aRow.thisWeek).toBe(applicantsRecompute);
    expect(dRow.thisWeek).toBe(depositsRecompute);
  });

  it("every KPI in the scorecard is defined exactly once in the registry", () => {
    const sc = buildScorecard(ds, LATEST);
    for (const row of sc.rows) {
      expect(KPI_DEFINITIONS.filter((d) => d.key === row.key)).toHaveLength(1);
    }
    expect(sc.rows.map((r) => r.key).sort()).toEqual(KPI_DEFINITIONS.map((d) => d.key).sort());
  });

  it("weekIndexOf is window-bounded and Monday-keyed", () => {
    expect(weekIndexOf("2026-06-01T00:00:00.000Z")).toBe(0);
    expect(weekIndexOf("2026-05-01T00:00:00.000Z")).toBe(-1);
    expect(weekIndexOf(null)).toBe(-1);
    expect(WEEKS).toHaveLength(13);
  });
});

describe("Dashboard · read-only aggregator + versioned immutability (invariants #2, #3)", () => {
  it("building the scorecard does not mutate the dataset", () => {
    const before = JSON.stringify({ fams: ds.families.length, first: ds.families[0] });
    buildScorecard(ds, LATEST);
    buildPacing(ds, LATEST);
    const after = JSON.stringify({ fams: ds.families.length, first: ds.families[0] });
    expect(after).toBe(before);
  });

  it("re-building a closed week is byte-identical (deterministic snapshot)", () => {
    const a = buildScorecard(ds, WEEKS[5]);
    const b = buildScorecard(ds, WEEKS[5]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("different weeks produce different frozen rows", () => {
    const a = buildScorecard(ds, WEEKS[3]);
    const b = buildScorecard(ds, WEEKS[8]);
    expect(a.weekOf).not.toBe(b.weekOf);
  });
});

describe("Dashboard · Leader-only goal RBAC (invariant #4)", () => {
  it("only a Leader may edit a goal", () => {
    expect(canEditGoal(leader.role)).toBe(true);
    expect(canEditGoal(admin.role)).toBe(false);
    expect(canEditGoal(operator.role)).toBe(false);
    expect(canEditGoal(null)).toBe(false);
  });

  it("a Leader edit succeeds and writes an audit row", () => {
    const { goals, audit } = applyGoalEdit(leader.role, "deposits", 70, leader.id, "2026-08-10T00:00:00.000Z");
    expect(audit.oldValue).toBe(55);
    expect(audit.newValue).toBe(70);
    expect(audit.actor).toBe(leader.id);
    expect(goals.find((g) => g.kpiKey === "deposits")!.targetValue).toBe(70);
    // original is untouched (append-only semantics)
    expect(DEFAULT_GOALS.find((g) => g.kpiKey === "deposits")!.targetValue).toBe(55);
  });

  it("an Operator or Admin edit is rejected and writes nothing", () => {
    expect(() => applyGoalEdit(operator.role, "deposits", 70, operator.id, "x")).toThrow(GoalAuthError);
    expect(() => applyGoalEdit(admin.role, "deposits", 70, admin.id, "x")).toThrow(GoalAuthError);
    try {
      applyGoalEdit(operator.role, "deposits", 70, operator.id, "x");
    } catch (e) {
      expect((e as GoalAuthError).status).toBe(403);
    }
  });
});

describe("Dashboard · honesty flag + biggest-mover (invariant #5)", () => {
  it("uninstrumented KPIs are low-confidence; measured KPIs are not", () => {
    const sc = buildScorecard(ds, LATEST);
    const conv = sc.rows.find((r) => r.key === "conversion_top_channel")!;
    const evt = sc.rows.find((r) => r.key === "event_to_consult")!;
    const deposits = sc.rows.find((r) => r.key === "deposits")!;
    expect(conv.confidence).toBe("low");
    expect(conv.instrumented).toBe(false);
    expect(evt.confidence).toBe("low");
    expect(deposits.confidence).toBe("measured");
  });

  it("the biggest mover is drawn only from instrumented KPIs", () => {
    const sc = buildScorecard(ds, LATEST);
    if (sc.biggestMover) {
      expect(sc.biggestMover.instrumented).toBe(true);
    }
  });

  it("pacing projection carries a low-confidence flag for uninstrumented inputs", () => {
    const rows = buildPacing(ds, LATEST);
    const conv = rows.find((r) => r.key === "conversion_top_channel")!;
    const deposits = rows.find((r) => r.key === "deposits")!;
    expect(conv.confidence).toBe("low");
    expect(deposits.confidence).toBe("measured");
    expect(conv.method).toContain("linear-v1");
  });
});

describe("Dashboard · freshness (invariant #7)", () => {
  it("exactly one connector is stale (the seeded aged X connector)", () => {
    const fresh = connectorFreshness(ds);
    const stale = fresh.filter((c) => c.status === "stale");
    expect(stale.map((c) => c.connector)).toEqual(["x"]);
  });

  it("a fresh connector's age is within its SLA", () => {
    const fresh = connectorFreshness(ds);
    const supa = fresh.find((c) => c.connector === "supabase")!;
    expect(supa.ageMinutes).toBeLessThanOrEqual(supa.freshnessSlaMinutes);
    expect(supa.status).toBe("fresh");
  });
});

describe("Dashboard · weekly series sanity", () => {
  it("applicants series is per-week, length 13, and sums to the windowed applicant count", () => {
    const series = kpiWeeklySeries("applicants", ds);
    expect(series).toHaveLength(13);
    const windowed = ds.families.filter(
      (f) => ["applicant", "shadow_day", "deposit"].includes(f.funnel_stage ?? "") && wi(f.created_at) >= 0 && wi(f.created_at) < 13,
    ).length;
    expect(series.reduce((s, v) => s + v, 0)).toBe(windowed);
  });

  it("parity series tracks the seeded week-6 dip below threshold", () => {
    const series = kpiWeeklySeries("parity_pct", ds);
    expect(series[6]).toBeLessThan(95);
  });
});

describe("Dashboard · goal/target + pace-to-goal on the scorecard", () => {
  it("paceToTarget is direction-aware and null when there is no target", () => {
    expect(paceToTarget(90, 90, "higher_better")).toBe(100); // exactly on target
    expect(paceToTarget(45, 90, "higher_better")).toBe(50); // half-way
    expect(paceToTarget(99, 90, "higher_better")).toBe(110); // ahead
    // lower_better: under the target reads as ahead (>100%)
    expect(paceToTarget(50, 100, "lower_better")).toBe(200);
    expect(paceToTarget(200, 100, "lower_better")).toBe(50);
    expect(paceToTarget(10, null, "higher_better")).toBeNull();
    expect(paceToTarget(10, 0, "higher_better")).toBeNull();
  });

  it("every scorecard row carries the goal from the single goals source + a matching pace", () => {
    const sc = buildScorecard(ds, LATEST);
    for (const row of sc.rows) {
      const goal = goalFor(row.key);
      // target is sourced from DEFAULT_GOALS (no parallel/hardcoded targets)
      expect(row.target).toBe(goal ? goal.targetValue : null);
      // pace and status are computed from the same source, so they can't contradict
      if (row.target === null) {
        expect(row.pctToTarget).toBeNull();
      } else {
        expect(row.pctToTarget).toBe(paceToTarget(row.thisWeek, row.target, KPI_DEFINITIONS.find((d) => d.key === row.key)!.direction));
        if (row.pctToTarget! >= 100) expect(row.status).toBe("on_track");
        else if (row.pctToTarget! >= 90) expect(row.status).toBe("watch");
        else expect(row.status).toBe("at_risk");
      }
    }
  });
});

describe("Dashboard · scorecard ordered by the marketing funnel", () => {
  it("rows follow the funnel stage order (cross-cutting last)", () => {
    const sc = buildScorecard(ds, LATEST);
    // Awareness → Acquisition → Conversion → Advocacy → Cross-cutting (Activation +
    // Nurture have no v1 KPI, so their groups are omitted but ordering is preserved).
    expect(sc.rows.map((r) => r.key)).toEqual([
      "conversion_top_channel", // Awareness
      "applicants", // Acquisition
      "event_to_consult", // Acquisition
      "deposits", // Conversion
      "ambassador_influenced", // Advocacy
      "parity_pct", // Cross-cutting (trailing)
    ]);
  });

  it("each row carries its funnel stage from the single mapping", () => {
    const sc = buildScorecard(ds, LATEST);
    for (const row of sc.rows) {
      expect(row.stage).toBe(stageForKpi(row.key));
    }
    expect(sc.rows.find((r) => r.key === "parity_pct")!.stage).toBe("cross_cutting");
    expect(sc.rows.find((r) => r.key === "deposits")!.stage).toBe("conversion");
  });

  it("groups partition the rows in funnel order, no empty groups, cross-cutting trailing", () => {
    const sc = buildScorecard(ds, LATEST);
    expect(sc.groups.map((g) => g.key)).toEqual([
      "awareness",
      "acquisition",
      "conversion",
      "advocacy",
      "cross_cutting",
    ]);
    // cross-cutting is always last
    expect(sc.groups[sc.groups.length - 1].key).toBe("cross_cutting");
    // no empty group is emitted
    for (const g of sc.groups) expect(g.rows.length).toBeGreaterThan(0);
    // groups reconstruct the flat rows exactly (same set, same order)
    expect(sc.groups.flatMap((g) => g.rows.map((r) => r.key))).toEqual(sc.rows.map((r) => r.key));
    // sync parity is filed cross-cutting, not jammed into a funnel stage
    expect(sc.groups.find((g) => g.key === "cross_cutting")!.rows.map((r) => r.key)).toEqual([
      "parity_pct",
    ]);
  });

  it("reorder is goal/pace-preserving: every row keeps its target + pace", () => {
    const sc = buildScorecard(ds, LATEST);
    for (const row of sc.rows) {
      const goal = goalFor(row.key);
      expect(row.target).toBe(goal ? goal.targetValue : null);
      expect(row.pctToTarget).toBe(
        paceToTarget(row.thisWeek, row.target, KPI_DEFINITIONS.find((d) => d.key === row.key)!.direction),
      );
    }
  });

  it("shares ONE funnel-stage order with the Status board (no drift)", () => {
    // The scorecard order is derived from lib/funnel/stages, whose stage keys + order
    // are tied (compile-time guard) to the Status board's FunnelStageKey. Prove the two
    // agree at runtime: the canonical funnel order equals the board's stage sequence.
    const board = buildStatusBoard(ds, "fall_enrollment", LATEST);
    expect(FUNNEL_STAGES.map((s) => s.key)).toEqual(board.stages.map((s) => s.key));
    // every funnel stage a scorecard group uses is a real funnel stage in that order
    const funnelGroupKeys = buildScorecard(ds, LATEST)
      .groups.map((g) => g.key)
      .filter((k) => k !== "cross_cutting");
    const orderIndex = SCORECARD_GROUPS.map((g) => g.key);
    const positions = funnelGroupKeys.map((k) => orderIndex.indexOf(k));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

// ───────────────── rendered page + goal route (auth + db mocked) ─────────────────
const authMock = vi.hoisted(() => {
  class AuthError extends Error {
    status: 401 | 403;
    constructor(status: 401 | 403, message: string) {
      super(message);
      this.status = status;
      this.name = "AuthError";
    }
  }
  return {
    AuthError,
    DEV_MODE: true,
    getSession: vi.fn(async () => null as unknown),
    requireSession: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => authMock);

const dbMock = vi.hoisted(() => ({ withoutProgram: vi.fn() }));
vi.mock("@/lib/db", () => dbMock);

const { default: DashboardPage } = await import("@/app/m/dashboard/page");
const { POST: GOAL_POST, GET: GOAL_GET } = await import("@/app/api/dashboard/goals/route");

async function render(tab?: string, role?: string, week?: string): Promise<string> {
  authMock.getSession.mockResolvedValue(null);
  const node = await DashboardPage({
    searchParams: Promise.resolve({
      ...(tab ? { tab } : {}),
      ...(role ? { role } : {}),
      ...(week ? { week } : {}),
    }),
  });
  return renderToStaticMarkup(node);
}

describe("Dashboard · rendered sub-views", () => {
  it("6a scorecard renders one row per KPI with the shared-board framing", async () => {
    const html = await render("scorecard", "leader");
    expect(html).toContain("Dashboard / KPI Tracking");
    expect(html).toContain("Weekly scorecard");
    expect(html).toContain("Applicants (new / wk)");
    expect(html).toContain("low-confidence");
    expect(html).toContain("Identical for every role");
  });

  it("6a scorecard groups rows under funnel-stage headers in funnel order", async () => {
    const html = await render("scorecard", "leader");
    // The funnel-stage group headers render (Activation + Nurture omitted — no v1 KPI).
    for (const name of ["Awareness", "Acquisition", "Conversion", "Advocacy", "Cross-cutting"]) {
      expect(html).toContain(name);
    }
    // Headers appear in funnel order, with the cross-cutting bucket trailing.
    const idx = (s: string) => html.indexOf(s);
    expect(idx("Awareness")).toBeLessThan(idx("Acquisition"));
    expect(idx("Acquisition")).toBeLessThan(idx("Conversion"));
    expect(idx("Conversion")).toBeLessThan(idx("Advocacy"));
    expect(idx("Advocacy")).toBeLessThan(idx("Cross-cutting"));
    // The funnel-ordering rationale is stated for the reader.
    expect(html).toContain("Rows follow the marketing funnel");
  });

  it("6a scorecard shows each row's goal/target plus a pace-to-goal signal", async () => {
    const html = await render("scorecard", "leader");
    // The goal/target column header + pace column are present.
    expect(html).toContain("Goal / target");
    expect(html).toContain("Pace to goal");
    // The explicit "% to goal" pace number is rendered for instrumented targets.
    expect(html).toContain("% to goal");
    // Plain-language pace status (matches the existing RAG pills).
    expect(html).toMatch(/on pace|ahead|behind/);
    // Fall vs Summer Camp scope is called out so targets aren't conflated (HTML-escaped &).
    expect(html).toContain("separate P&amp;L");
  });

  it("reads as the Weekly Standup board and hosts the reporting-week + countdown (HD-6/8)", async () => {
    const html = await render("scorecard", "leader");
    // Standup framing + the contrast cross-link back to Home (HD-6).
    expect(html).toContain("Weekly Standup");
    expect(html).toContain("Home (your cockpit)");
    // The reporting-week control's home is this board, with the Aug-17 countdown to pacing (HD-8/HD-7).
    expect(html).toContain("Reporting week");
    expect(html).toContain("Operational modules keep their own source dates");
    expect(html).toContain("to Fall enrollment (Aug 17)");
    // The Monday run-of-show is a launcher, not a tab (HD-10).
    expect(html).toContain("Run the meeting");
  });

  it("renders trends, sla, pacing, and the display-only mirror", async () => {
    expect(await render("trends", "leader")).toContain("Trends");
    const sla = await render("sla", "leader");
    expect(sla).toContain("Connector freshness");
    expect(sla).toContain("Tracking-gaps register");
    expect(sla).toContain("stale");
    const pacing = await render("pacing", "leader");
    expect(pacing).toContain("Goal pacing");
    expect(pacing).toContain("Fall 2026 enrollment deadline");
    expect(pacing).toContain("linear-v1");
    expect(pacing).toContain("Leader: goals editable");
    expect(pacing).toContain('action="/api/dashboard/goals"');
    expect(pacing).toContain('name="target_value"');
    expect(pacing).toContain("Save");
    const mirror = await render("mirror", "leader");
    expect(mirror).toContain("HubSpot dashboard mirror");
    expect(mirror).toContain("display-only");
  });

  it("the data-confidence banner is consumed on this HubSpot-derived board", async () => {
    const html = await render("scorecard", "leader");
    expect(html).toContain("Open CRM Ops");
  });

  it("goal editing is read-only for Admin and Operator (UI mirrors server RBAC)", async () => {
    const operatorPacing = await render("pacing", "operator");
    const adminPacing = await render("pacing", "admin");
    expect(operatorPacing).toContain("read-only");
    expect(adminPacing).toContain("read-only");
    expect(operatorPacing).not.toContain('name="target_value"');
    expect(adminPacing).not.toContain('name="target_value"');
  });
});

describe("Dashboard · goal-edit route server-side RBAC", () => {
  function req(body: unknown): Request {
    return new Request("http://localhost/api/dashboard/goals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  beforeEach(() => {
    authMock.requireSession.mockReset();
    dbMock.withoutProgram.mockReset();
    dbMock.withoutProgram.mockImplementation(async (cb: (sql: unknown) => unknown) => {
      const sql = (() => Promise.resolve([])) as unknown;
      return cb(sql);
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("allows a Leader to edit a goal", async () => {
    authMock.requireSession.mockResolvedValue(leader);
    const res = await GOAL_POST(req({ kpi_key: "deposits", target_value: 70 }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.goal.newValue).toBe(70);
  });

  it("denies an Admin and an Operator (403, server-side)", async () => {
    authMock.requireSession.mockResolvedValue(admin);
    expect((await GOAL_POST(req({ kpi_key: "deposits", target_value: 70 }))).status).toBe(403);
    authMock.requireSession.mockResolvedValue(operator);
    expect((await GOAL_POST(req({ kpi_key: "deposits", target_value: 70 }))).status).toBe(403);
  });

  it("validates the payload (unknown KPI / bad value) for a Leader", async () => {
    authMock.requireSession.mockResolvedValue(leader);
    expect((await GOAL_POST(req({ kpi_key: "nope", target_value: 70 }))).status).toBe(400);
    expect((await GOAL_POST(req({ kpi_key: "deposits", target_value: -5 }))).status).toBe(400);
  });

  it("401s an unauthenticated edit before any RBAC check", async () => {
    authMock.requireSession.mockRejectedValue(new authMock.AuthError(401, "Authentication required."));
    const res = await GOAL_POST(req({ kpi_key: "deposits", target_value: 70 }));
    expect(res.status).toBe(401);
  });

  it("GET reflects the caller's goal-edit capability", async () => {
    authMock.requireSession.mockResolvedValue(leader);
    const res = await GOAL_GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.canEditGoals).toBe(true);
  });
});
