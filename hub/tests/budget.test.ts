// Module 10 — Budget Tracker. Pure proofs (no DB/services) for the PLAN's provable
// invariants: $365K live reconciliation, the five-column identities, no campaign
// double-count (survivorship), the >10% AND >= $2,500 variance trigger + idempotent
// auto-flag, per-owner RBAC denial, burn/allocation honesty, and the rendered sub-views.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { generate } from "@/lib/seed/generate";
import {
  assertReconciles,
  doubleCountedCampaigns,
  reconcileBudget,
} from "@/lib/budget/reconcile";
import {
  buildVariancePayload,
  evaluateVariance,
  flaggedVariances,
  pendingVarianceDecisions,
  VARIANCE_RAISED_BY,
} from "@/lib/budget/variance";
import { actualAllocation, buildBurnSeries, workstreamHealth } from "@/lib/metrics/budget";
import {
  assertCanEditPlanned,
  assertCanWriteEntry,
  BudgetAuthError,
  canEditPlanned,
  canWriteEntry,
} from "@/lib/budget/rbac";
import { DEMO_USERS } from "@/lib/phase2";
import type { BudgetEntry } from "@/lib/seed/types";

const ds = generate({ seed: 424242, families: 1200 });
const recon = reconcileBudget(ds.budget_workstream, ds.budget_entry);
const ASOF = ds.manifest.generatedAt;

const admin = DEMO_USERS.find((u) => u.role === "admin")!; // owns all
const leader = DEMO_USERS.find((u) => u.role === "leader")!; // owns guerrilla
const operator = DEMO_USERS.find((u) => u.role === "operator")!; // owns thought_leadership

const r2 = (n: number) => Math.round(n * 100) / 100;

describe("Budget · reconcile to $365K + column identities (invariants #1, #2)", () => {
  it("recomputes the $365K total live (not a seed constant)", () => {
    expect(recon.reconciles).toBe(true);
    expect(recon.totals.recommended).toBe(365000);
    expect(() => assertReconciles(ds.budget_workstream)).not.toThrow();
  });

  it("throws if the recommended rows do not sum to 365000", () => {
    const broken = ds.budget_workstream.map((w) =>
      w.key === "guerrilla" ? { ...w, recommended: w.recommended + 1 } : w,
    );
    expect(() => assertReconciles(broken)).toThrow();
    expect(reconcileBudget(broken, ds.budget_entry).reconciles).toBe(false);
  });

  it("holds remaining = planned - actual and available = planned - committed row-wise + at total", () => {
    for (const row of recon.rows) {
      expect(row.remaining).toBe(r2(row.planned - row.actual));
      expect(row.available).toBe(r2(row.planned - row.committed));
    }
    const sum = (k: "remaining" | "available" | "actual" | "committed") =>
      r2(recon.rows.reduce((s, x) => s + x[k], 0));
    expect(recon.totals.remaining).toBe(sum("remaining"));
    expect(recon.totals.available).toBe(sum("available"));
    expect(recon.totals.actual).toBe(sum("actual"));
    expect(recon.totals.committed).toBe(sum("committed"));
  });

  it("derives committed/actual from the ledger exactly equal to the backbone aggregates (audit immutability #6)", () => {
    for (const w of ds.budget_workstream) {
      const row = recon.rows.find((x) => x.key === w.key)!;
      expect(row.committed).toBe(r2(w.committed));
      expect(row.actual).toBe(r2(w.actual));
    }
  });

  it("a zero-entry workstream shows $0 actual + full remaining, not a crash (invariant #7)", () => {
    const empty = reconcileBudget(ds.budget_workstream, []);
    const g = empty.rows.find((r) => r.key === "grassroots")!;
    expect(g.actual).toBe(0);
    expect(g.committed).toBe(0);
    expect(g.remaining).toBe(g.planned);
    expect(empty.reconciles).toBe(true); // recommended still sums to 365K
  });
});

describe("Budget · no double-count / survivorship (invariant #3)", () => {
  it("counts campaign spend exactly once as an origin=campaign ledger row", () => {
    const campaign = ds.budget_entry.filter((e) => e.origin === "campaign");
    expect(campaign.length).toBeGreaterThanOrEqual(1);
    expect(campaign.every((e) => e.campaign_key && e.kind === "actual")).toBe(true);
    expect(doubleCountedCampaigns(ds.budget_entry)).toEqual([]);
    const grassroots = recon.rows.find((r) => r.key === "grassroots")!;
    expect(grassroots.campaignActual).toBeGreaterThan(0);
    expect(grassroots.campaignActual).toBeLessThanOrEqual(grassroots.actual);
  });

  it("rejects a campaign + matching manual entry as a double-count", () => {
    const dupe: BudgetEntry = {
      id: "x",
      workstream_key: "grassroots",
      kind: "actual",
      origin: "manual",
      amount: 1000,
      entered_by: "tester",
      owner_role: "Grassroots Owner",
      note: "illegal manual restatement of campaign spend",
      campaign_key: "gifted_quiz_2026",
      created_at: ASOF,
    };
    const poisoned = [...ds.budget_entry, dupe];
    expect(doubleCountedCampaigns(poisoned)).toContain("gifted_quiz_2026");
    expect(reconcileBudget(ds.budget_workstream, poisoned).doubleCountedCampaigns).toContain("gifted_quiz_2026");
  });
});

describe("Budget · variance trigger + idempotent auto-flag (invariant #4)", () => {
  const rows = recon.rows.map((r) => ({ key: r.key, name: r.name, planned: r.planned, actual: r.actual }));

  it("flags exactly the seeded over-plan workstream (guerrilla)", () => {
    const flagged = flaggedVariances(rows);
    expect(flagged.map((f) => f.key)).toEqual(["guerrilla"]);
    expect(flagged[0].overPct).toBeGreaterThan(10);
    expect(flagged[0].overAmount).toBeGreaterThanOrEqual(2500);
  });

  it("respects the absolute $2,500 floor so tiny lines do not spam", () => {
    const synthetic = [
      { key: "tiny", name: "Tiny", planned: 2000, actual: 2300 }, // 15% over but only $300
      { key: "mid", name: "Mid", planned: 25000, actual: 27600 }, // 10.4% over and $2,600
      { key: "near", name: "Near", planned: 25000, actual: 27000 }, // 8% over → under threshold
    ];
    const flagged = flaggedVariances(synthetic).map((f) => f.key);
    expect(flagged).toContain("mid");
    expect(flagged).not.toContain("tiny");
    expect(flagged).not.toContain("near");
  });

  it("emits the §4 payload and is idempotent (one open flag per workstream)", () => {
    const fresh = pendingVarianceDecisions(rows, [], ASOF);
    expect(fresh).toHaveLength(1);
    const p = fresh[0];
    expect(p.workstream).toBe("guerrilla");
    expect(p.raised_by).toBe(VARIANCE_RAISED_BY);
    expect(p.auto_flag).toBe(true);
    expect(p.status).toBe("open");
    expect(p.budget_ask).toBeGreaterThan(0);
    expect(p.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // The seed already carries an OPEN auto_flag decision for guerrilla → nothing new.
    expect(pendingVarianceDecisions(rows, ds.decisions, ASOF)).toHaveLength(0);

    // Re-running after "raising" the fresh payload also yields nothing (no duplicate).
    const raised = fresh.map((x, i) => ({
      ...x,
      id: `auto-${i}`,
      response: null,
      response_note: null,
      resolved_at: null,
      created_at: ASOF,
    }));
    expect(pendingVarianceDecisions(rows, raised, ASOF)).toHaveLength(0);
  });

  it("marks >20% over as urgent, else normal", () => {
    const normal = buildVariancePayload(evaluateVariance([{ key: "a", name: "A", planned: 25000, actual: 28750 }])[0], ASOF);
    const urgent = buildVariancePayload(evaluateVariance([{ key: "b", name: "B", planned: 25000, actual: 32500 }])[0], ASOF);
    expect(normal.priority).toBe("normal");
    expect(urgent.priority).toBe("urgent");
  });
});

describe("Budget · chart honesty (10b/10c)", () => {
  it("burn series is monotonic, ends at the plan total, and exposes a projected burn-out", () => {
    const burn = buildBurnSeries(ds.budget_entry, recon.totals.planned, {
      sprintStart: "2026-06-01T00:00:00.000Z",
      weeks: 13,
      asOf: ASOF,
    });
    expect(burn.points).toHaveLength(13);
    for (let i = 1; i < burn.points.length; i++) {
      expect(burn.points[i].cumulativeActual).toBeGreaterThanOrEqual(burn.points[i - 1].cumulativeActual);
    }
    expect(burn.points[burn.points.length - 1].planPace).toBe(recon.totals.planned);
    expect(burn.actualTotal).toBeGreaterThan(0);
    expect(typeof burn.projectedBurnOutDate === "string" || burn.projectedBurnOutDate === null).toBe(true);
  });

  it("allocation is share-of-actual and sums to ~100%", () => {
    const slices = actualAllocation(recon.rows);
    const total = slices.reduce((s, x) => s + x.pct, 0);
    expect(Math.abs(total - 100)).toBeLessThan(0.5);
    // sorted by actual descending
    for (let i = 1; i < slices.length; i++) {
      expect(slices[i - 1].actual).toBeGreaterThanOrEqual(slices[i].actual);
    }
  });

  it("workstreamHealth reflects the variance thresholds", () => {
    expect(workstreamHealth(40000, 44800)).toBe("at-risk"); // guerrilla-like
    expect(workstreamHealth(25000, 25500)).toBe("watch"); // small overage
    expect(workstreamHealth(210000, 120000)).toBe("on-track");
  });
});

describe("Budget · per-owner RBAC (invariant #5)", () => {
  it("an Operator may write only their own workstream row", () => {
    expect(canWriteEntry(operator, "thought_leadership")).toBe(true);
    expect(canWriteEntry(operator, "grassroots")).toBe(false);
    expect(() => assertCanWriteEntry(operator, "thought_leadership")).not.toThrow();
    expect(() => assertCanWriteEntry(operator, "grassroots")).toThrow(BudgetAuthError);
    try {
      assertCanWriteEntry(operator, "grassroots");
    } catch (e) {
      expect((e as BudgetAuthError).status).toBe(403);
    }
  });

  it("a Leader can edit planned but not another owner's actual; Admin edits all", () => {
    expect(canWriteEntry(leader, "guerrilla")).toBe(true);
    expect(canWriteEntry(leader, "grassroots")).toBe(false);
    expect(() => assertCanWriteEntry(leader, "grassroots")).toThrow(BudgetAuthError);
    expect(canEditPlanned(leader)).toBe(true);
    expect(canEditPlanned(admin)).toBe(true);
    expect(canEditPlanned(operator)).toBe(false);
    expect(() => assertCanEditPlanned(operator)).toThrow(BudgetAuthError);
    for (const k of ["grassroots", "thought_leadership", "guerrilla", "foundations"]) {
      expect(canWriteEntry(admin, k)).toBe(true);
    }
    expect(() => assertCanWriteEntry(null, "grassroots")).toThrow(BudgetAuthError);
  });
});

// ───────────────── rendered page + write route (auth mocked) ─────────────────
const authMock = vi.hoisted(() => {
  class AuthError extends Error {
    status: 401 | 403;
    constructor(status: 401 | 403, message: string) {
      super(message);
      this.status = status;
      this.name = "AuthError";
    }
  }
  class ProgramScopeError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ProgramScopeError";
    }
  }
  const allowed = (role: string) =>
    role === "operator" ? ["fall_enrollment"] : ["fall_enrollment", "summer_camp"];
  return {
    AuthError,
    ProgramScopeError,
    DEV_MODE: true,
    getSession: vi.fn(async () => null as unknown),
    requireSession: vi.fn(),
    resolveProgramScope: ({ role, requestedProgram }: { role: string; requestedProgram?: string | null }) => {
      const req = requestedProgram?.trim();
      if (!req) return allowed(role)[0];
      if (!allowed(role).includes(req)) throw new ProgramScopeError(`forged program ${req}`);
      return req;
    },
    parityThreshold: () => 0.95,
  };
});

vi.mock("@/lib/auth", () => authMock);

const dbMock = vi.hoisted(() => ({
  withoutProgram: vi.fn(),
}));

vi.mock("@/lib/db", () => dbMock);

const { default: BudgetPage } = await import("@/app/m/budget/page");
const { POST: ENTRY_POST, GET: ENTRY_GET } = await import("@/app/api/budget/entries/route");

async function render(tab?: string, role?: string): Promise<string> {
  authMock.getSession.mockResolvedValue(null);
  const node = await BudgetPage({
    searchParams: Promise.resolve({ ...(tab ? { tab } : {}), ...(role ? { role } : {}) }),
  });
  return renderToStaticMarkup(node);
}

describe("Budget · rendered sub-views (demo signal: reconcile to the total)", () => {
  it("10a visibly reconciles the four workstreams to $365,000", async () => {
    const html = await render("table", "admin");
    expect(html).toContain("Budget Tracker");
    expect(html).toContain("Budget table");
    expect(html).toContain("$365,000");
    expect(html).toContain("Reconciles to $365,000");
    expect(html).toContain("Grassroots marketing");
    expect(html).toContain("Guerrilla / earned media bets");
  });

  it("does not show the HubSpot data-confidence banner on the manual Hub-owned Budget module", async () => {
    const html = await render("table", "admin");
    expect(html).not.toContain("Data confidence warning");
    expect(html).not.toContain("Open CRM Ops");
  });

  it("shows the viewer's own row editable and others read-only (Operator)", async () => {
    const html = await render("table", "operator");
    expect(html).toContain("Record spend"); // own (thought_leadership) row form
    expect(html).toContain("Read-only"); // a non-owned row
    expect(html).toContain("owned by Grassroots Owner");
  });

  it("renders burn, spend, and variance sub-views", async () => {
    expect(await render("burn", "admin")).toContain("Burn chart");
    expect(await render("burn", "admin")).toContain("Projected burn-out");
    expect(await render("spend", "admin")).toContain("Spend by workstream");
    const variance = await render("variance", "admin");
    expect(variance).toContain("Variance alerts");
    expect(variance).toContain("Open reallocation in Decision Queue");
  });
});

describe("Budget · write route server-side RBAC", () => {
  function req(body: unknown): Request {
    return new Request("http://localhost/api/budget/entries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function sqlForBudgetRoute(
    workstream: string,
    kind: "committed" | "actual",
    amount: number,
    enteredBy: string,
    ownerRole: string,
  ) {
    const calls: { text: string; values: unknown[] }[] = [];
    const row = {
      id: "33333333-3333-4333-8333-333333333333",
      workstream_key: workstream,
      kind,
      origin: "manual",
      amount,
      entered_by: enteredBy,
      owner_role: ownerRole,
      note: null,
      campaign_key: null,
      created_at: "2026-08-31T00:00:00.000Z",
    };
    type SqlMock = {
      <T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
      calls: typeof calls;
    };
    const sql = (<T>(strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ text: strings.join("?"), values });
      const result = calls.length === 1
        ? [row]
        : calls.length === 2
          ? [{ committed: kind === "committed" ? amount : 0, actual: kind === "actual" ? amount : 0 }]
          : [];
      return Promise.resolve(result as T);
    }) as SqlMock;
    sql.calls = calls;
    return sql;
  }

  beforeEach(() => {
    authMock.requireSession.mockReset();
    dbMock.withoutProgram.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("denies an Operator writing another owner's row (403, server-side)", async () => {
    authMock.requireSession.mockResolvedValue(operator);
    const res = await ENTRY_POST(req({ workstream_key: "grassroots", kind: "actual", amount: 5000 }));
    expect(res.status).toBe(403);
  });

  it("allows an Operator to write their own row", async () => {
    authMock.requireSession.mockResolvedValue(operator);
    dbMock.withoutProgram.mockImplementationOnce(async (cb) =>
      cb(sqlForBudgetRoute("thought_leadership", "actual", 5000, operator.id, "Content Owner")),
    );
    const res = await ENTRY_POST(req({ workstream_key: "thought_leadership", kind: "actual", amount: 5000 }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.entry.origin).toBe("manual");
    expect(body.entry.workstream_key).toBe("thought_leadership");
  });

  it("allows Admin to write any row and validates the payload", async () => {
    authMock.requireSession.mockResolvedValue(admin);
    dbMock.withoutProgram.mockImplementationOnce(async (cb) =>
      cb(sqlForBudgetRoute("grassroots", "actual", 1000, admin.id, "Grassroots Owner")),
    );
    expect((await ENTRY_POST(req({ workstream_key: "grassroots", kind: "actual", amount: 1000 }))).status).toBe(200);
    expect((await ENTRY_POST(req({ workstream_key: "nope", kind: "actual", amount: 10 }))).status).toBe(400);
    expect((await ENTRY_POST(req({ workstream_key: "grassroots", kind: "actual", amount: -5 }))).status).toBe(400);
    expect((await ENTRY_POST(req({ workstream_key: "grassroots", kind: "bogus", amount: 10 }))).status).toBe(400);
  });

  it("401s an unauthenticated write before any RBAC check", async () => {
    authMock.requireSession.mockRejectedValue(new authMock.AuthError(401, "Authentication required."));
    const res = await ENTRY_POST(req({ workstream_key: "grassroots", kind: "actual", amount: 10 }));
    expect(res.status).toBe(401);
  });

  it("GET reflects the caller's writable workstreams", async () => {
    authMock.requireSession.mockResolvedValue(operator);
    const res = await ENTRY_GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.writableWorkstreams).toEqual(["thought_leadership"]);
  });
});
