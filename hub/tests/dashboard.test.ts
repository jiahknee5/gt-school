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
import { buildScorecard } from "@/lib/dashboard/scorecard";
import { buildPacing } from "@/lib/dashboard/pacing";
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
    expect(html).toContain("identical for every role");
  });

  it("renders trends, sla, pacing, and the display-only mirror", async () => {
    expect(await render("trends", "leader")).toContain("Trends");
    const sla = await render("sla", "leader");
    expect(sla).toContain("Connector freshness");
    expect(sla).toContain("Tracking-gaps register");
    expect(sla).toContain("stale");
    const pacing = await render("pacing", "leader");
    expect(pacing).toContain("Goal pacing");
    expect(pacing).toContain("linear-v1");
    expect(pacing).toContain("Leader: goals editable");
    const mirror = await render("mirror", "leader");
    expect(mirror).toContain("HubSpot dashboard mirror");
    expect(mirror).toContain("display-only");
  });

  it("the data-confidence banner is consumed on this HubSpot-derived board", async () => {
    const html = await render("scorecard", "leader");
    expect(html).toContain("Open CRM Ops");
  });

  it("goal editing is read-only for Admin and Operator (UI mirrors server RBAC)", async () => {
    expect(await render("pacing", "operator")).toContain("read-only");
    expect(await render("pacing", "admin")).toContain("read-only");
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
