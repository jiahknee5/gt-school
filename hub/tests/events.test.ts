// Module 8 — Field Marketing & Events. Pure proofs for the PLAN's provable invariants:
// honesty (uninstrumented event→consult), read-only overlay (no double-count), idempotent
// Decision intake + RBAC denial, budget reconcile, single metric defs, duplicate flag,
// widget Inputs→Outputs.

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { generate } from "@/lib/seed/generate";
import { FIELD_EVENTS } from "@/lib/events/data";
import {
  dedupeEvents,
  duplicateFlags,
  validateEvent,
  attendanceRate,
  eventToConsult,
  upcoming30d,
  topTypeByAttendance,
  spendByWorkstream,
} from "@/lib/events/metrics";
import { buildCalendar, gtOrganizedCount } from "@/lib/events/calendar";
import {
  submitProposal,
  buildIntake,
  canSubmitProposal,
  canViewDecisionQueue,
  canEditEvents,
  SEED_PROPOSALS,
} from "@/lib/events/proposals";

const ds = generate({ seed: 424242, families: 1200 });
const ASOF = "2026-07-01";

describe("Events · honesty / uninstrumented (invariant #1)", () => {
  it("every consults row is manual_entry and event→consult is flagged uninstrumented", () => {
    for (const e of FIELD_EVENTS) expect(e.consultSource).toBe("manual_entry");
    const e2c = eventToConsult();
    expect(e2c.instrumented).toBe(false);
    expect(e2c.source).toBe("manual_entry");
  });
});

describe("Events · read-only overlay, no double-count (invariant #2)", () => {
  it("ambassador events render distinctly and are excluded from GT-organized counts", () => {
    const cal = buildCalendar();
    const amb = cal.filter((c) => c.kind === "ambassador");
    expect(amb.length).toBeGreaterThan(0);
    for (const a of amb) expect(a.readOnly).toBe(true);
    expect(gtOrganizedCount(cal)).toBe(dedupeEvents(FIELD_EVENTS).length);
  });
});

describe("Events · decision intake idempotent + RBAC (invariants #3, #5)", () => {
  it("submitting a proposal twice creates exactly one decision row", () => {
    let proposals = SEED_PROPOSALS.map((p) => ({ ...p }));
    let intakes: ReturnType<typeof buildIntake>[] = [];
    const first = submitProposal(proposals, intakes, "prop_1");
    expect(first.created).toBe(true);
    proposals = first.proposals;
    intakes = first.intakes;
    const second = submitProposal(proposals, intakes, "prop_1");
    expect(second.created).toBe(false);
    expect(second.intakes.filter((i) => i.source_ref === "prop_1")).toHaveLength(1);
  });

  it("the intake question + lead-time are well-formed", () => {
    const intake = buildIntake(SEED_PROPOSALS[0]);
    expect(intake.source_module).toBe("events");
    expect(intake.source_ref).toBe("prop_1");
    expect(intake.question).toContain("Approve");
    expect(intake.due_date < SEED_PROPOSALS[0].proposedDate).toBe(true);
  });

  it("Operator submits but cannot view the Decision Queue; non-owner cannot edit", () => {
    expect(canSubmitProposal("operator")).toBe(true);
    expect(canViewDecisionQueue("operator")).toBe(false);
    expect(canViewDecisionQueue("leader")).toBe(true);
    expect(canEditEvents("operator", false)).toBe(false);
    expect(canEditEvents("operator", true)).toBe(true);
    expect(canEditEvents("admin")).toBe(true);
  });
});

describe("Events · budget reconcile (invariant #4)", () => {
  it("event spend rolls into a workstream; the plan still sums to $365K", () => {
    const spend = spendByWorkstream();
    expect(Object.keys(spend).length).toBeGreaterThan(0);
    const total = ds.budget_workstream.reduce((a, w) => a + w.recommended, 0);
    expect(total).toBe(365000);
  });
});

describe("Events · single metric definition (invariant #6)", () => {
  it("attendance-rate = Σattendance/Σrsvp; event→consult = Σconsults/Σrsvp", () => {
    const ev = dedupeEvents(FIELD_EVENTS);
    const rsvp = ev.reduce((a, e) => a + e.rsvpCount, 0);
    const att = ev.reduce((a, e) => a + e.attendance, 0);
    const consults = ev.reduce((a, e) => a + e.consultsBooked, 0);
    expect(attendanceRate()).toBe(Number((att / rsvp).toFixed(4)));
    expect(eventToConsult().rate).toBe(Number((consults / rsvp).toFixed(4)));
  });
});

describe("Events · duplicate flag + validation (invariant #7)", () => {
  it("a duplicate (name+date) is flagged and not counted twice", () => {
    const dupes = duplicateFlags(FIELD_EVENTS);
    expect(dupes.length).toBeGreaterThan(0);
    // dedupe drops the duplicate so it isn't double-counted
    expect(dedupeEvents(FIELD_EVENTS).length).toBeLessThan(FIELD_EVENTS.length);
  });

  it("required fields are enforced", () => {
    expect(validateEvent({ name: "", type: undefined, eventDate: undefined })).toEqual(["name", "type", "event_date"]);
    expect(validateEvent({ name: "X", type: "ama", eventDate: "2026-07-01" })).toEqual([]);
  });
});

describe("Events · widget Inputs→Outputs (invariant #8)", () => {
  it("upcoming-30d + top-type compute purely from field_events", () => {
    const up = upcoming30d(ASOF);
    for (const e of up) {
      expect(Date.parse(e.eventDate)).toBeGreaterThanOrEqual(Date.parse(ASOF));
    }
    expect(topTypeByAttendance().length).toBeGreaterThan(0);
  });
});

// ───────────────── rendered page (auth mocked) ─────────────────
vi.mock("@/lib/auth", () => ({
  DEV_MODE: true,
  getSession: vi.fn(async () => null),
}));

const { default: EventsPage } = await import("@/app/m/events/page");

async function render(tab?: string, role?: string): Promise<string> {
  const node = await EventsPage({
    searchParams: Promise.resolve({ ...(tab ? { tab } : {}), ...(role ? { role } : {}) }),
  });
  return renderToStaticMarkup(node);
}

describe("Events · rendered sub-views", () => {
  it("overview shows the uninstrumented badge", async () => {
    const html = await render("overview", "operator");
    expect(html).toContain("Field Marketing &amp; Events");
    expect(html).toContain("uninstrumented");
    expect(html).not.toContain("Data confidence warning");
  });

  it("tracker flags duplicates; calendar shows read-only ambassador overlay", async () => {
    expect(await render("tracker", "operator")).toContain("Duplicate flagged");
    const cal = await render("calendar", "operator");
    expect(cal).toContain("Calendar");
    expect(cal).toContain("read-only");
  });

  it("proposals tab denies queue view for operator", async () => {
    const html = await render("proposals", "operator");
    expect(html).toContain("Priority event proposals");
    expect(html).toContain("submit-only");
  });
});
