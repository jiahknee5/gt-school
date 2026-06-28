import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { CHALLENGE_BUCKETS, gradeGiftedQuizAnswers } from "@/lib/gt-challenge/assess";
import {
  captureGiftedQuizSubmission,
  InMemoryGiftedQuizCaptureStore,
  NOT_SET,
  summarizeGiftedQuizCaptures,
  type GiftedQuizCaptureRequest,
} from "@/lib/gt-challenge/capture";
import { closeDb, withProgram, withoutProgram } from "@/lib/db";

const route = await import("@/app/api/gifted-quiz/route");

// When a DB is configured the route persists for real (DbGiftedQuizCaptureStore);
// without one it uses the in-memory contract. The route-contract test below adapts.
const HAS_DB = Boolean(process.env.APP_RW_DATABASE_URL);
const RUN = `rt${Date.now()}`;

async function cleanupGtcByPrefix(prefix: string): Promise<void> {
  if (!HAS_DB) return;
  const fallId = (
    await withoutProgram((sql) => sql<{ id: string }[]>`select id from programs where key='fall_enrollment' limit 1`)
  )[0]?.id;
  const famIds = await withoutProgram(async (sql) => {
    const subs = await sql<{ id: string }[]>`select id from quiz_submissions where idempotency_key like ${prefix + "%"}`;
    if (subs.length) {
      const ids = subs.map((s) => s.id);
      await sql`delete from sync_outbox where aggregate_id in ${sql(ids)}`;
      await sql`delete from quiz_submissions where id in ${sql(ids)}`;
    }
    const fams = await sql<{ id: string }[]>`select id from families where email like ${prefix + "%"}`;
    return fams.map((f) => f.id);
  });
  if (famIds.length && fallId) {
    await withProgram(fallId, (sql) => sql`delete from program_membership where family_id in ${sql(famIds)}`);
  }
  if (famIds.length) {
    await withoutProgram((sql) => sql`delete from families where id in ${sql(famIds)}`);
  }
}

const strongAnswers = {
  patternReasoning: 5,
  curiosity: 5,
  selfDirectedProjects: 4,
  readingAboveGrade: true,
  parentObservation:
    "Builds elaborate systems, asks advanced questions, and keeps returning to difficult puzzles until they make sense.",
};

const exploreAnswers = {
  patternReasoning: 1,
  curiosity: 2,
  selfDirectedProjects: false,
  readingAboveGrade: false,
  parentObservation: "Still exploring interests.",
};

function baseInput(overrides: Partial<GiftedQuizCaptureRequest> = {}): GiftedQuizCaptureRequest {
  return {
    idempotencyKey: "idem-base",
    parentConsent: true,
    parent: {
      email: "parent@example.com",
      phone: "(512) 555-0100",
      firstName: "Pat",
      lastName: "Rivera",
      zip: "78704",
    },
    child: { firstName: "Ava", grade: "2" },
    answers: strongAnswers,
    utm: { source: "meta", medium: "paid_social", campaign: "gifted_quiz_2026" },
    submittedAt: "2026-06-26T10:00:00.000Z",
    ...overrides,
  };
}

function request(body: unknown): Request {
  return new Request("http://localhost/api/gifted-quiz", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GT Challenge capture persistence model", () => {
  it("uses a deterministic grader with no negative verdict bucket", () => {
    const first = gradeGiftedQuizAnswers(strongAnswers);
    const second = gradeGiftedQuizAnswers({
      readingAboveGrade: true,
      selfDirectedProjects: 4,
      curiosity: 5,
      parentObservation: strongAnswers.parentObservation,
      patternReasoning: 5,
    });

    expect(second).toEqual(first);
    expect(CHALLENGE_BUCKETS).toEqual(["strong_fit", "promising", "explore"]);
    expect(JSON.stringify(CHALLENGE_BUCKETS)).not.toContain("not gifted");
    expect(first.bucket).toBe("strong_fit");
    expect(first.qualified).toBe(true);
  });

  it("requires consent before anything is persisted", async () => {
    const store = new InMemoryGiftedQuizCaptureStore();

    await expect(
      captureGiftedQuizSubmission(baseInput({ parentConsent: false }), store),
    ).rejects.toThrow("Parent consent is required");

    expect(store.snapshot()).toHaveLength(0);
  });

  it("collapses duplicate idempotency keys to one submission and one lead", async () => {
    const store = new InMemoryGiftedQuizCaptureStore();

    const first = await captureGiftedQuizSubmission(baseInput({ idempotencyKey: "dup-1" }), store, {
      now: new Date("2026-06-26T10:00:00.000Z"),
    });
    const second = await captureGiftedQuizSubmission(
      baseInput({
        idempotencyKey: "dup-1",
        answers: exploreAnswers,
        child: { firstName: "Different", grade: "6" },
        submittedAt: "2026-06-26T10:05:00.000Z",
      }),
      store,
      { now: new Date("2026-06-26T10:05:00.000Z") },
    );

    const snapshot = store.snapshot();
    const metrics = summarizeGiftedQuizCaptures(snapshot, 250);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.submission.id).toBe(first.submission.id);
    expect(second.lead.id).toBe(first.lead.id);
    expect(snapshot).toHaveLength(1);
    expect(metrics).toEqual({
      submissions: 1,
      leads: 1,
      qualified: 1,
      costPerQualifiedLead: 250,
    });
  });

  it("persists UTM, score, qualified flag, and fit bucket", async () => {
    const store = new InMemoryGiftedQuizCaptureStore();

    const result = await captureGiftedQuizSubmission(
      baseInput({ idempotencyKey: "utm-missing", utm: null }),
      store,
      { now: new Date("2026-06-26T10:00:00.000Z") },
    );

    expect(result.submission.utm).toEqual({
      source: NOT_SET,
      medium: NOT_SET,
      campaign: NOT_SET,
    });
    expect(result.submission.rawScore).toBeGreaterThanOrEqual(80);
    expect(result.submission.bucket).toBe("strong_fit");
    expect(result.submission.qualified).toBe(true);
    expect(result.submission.status).toBe("routed");
    expect(result.submission.routedProgramKey).toBe("fall_enrollment");
    expect(result.lead.latestBucket).toBe(result.submission.bucket);
    expect(result.lead.latestQualified).toBe(result.submission.qualified);
  });

  it("carries the full lead — parent name, zip, and a consent timestamp — for HubSpot enrichment", async () => {
    const store = new InMemoryGiftedQuizCaptureStore();
    const now = new Date("2026-06-26T10:00:00.000Z");

    const result = await captureGiftedQuizSubmission(baseInput({ idempotencyKey: "rich-lead" }), store, {
      now,
    });

    // The submission stamps WHEN consent was given (capture only reaches here consented).
    expect(result.submission.consentAt).toBe(now.toISOString());
    // The lead carries the real parent identity the deposit forwards to HubSpot — never
    // the "GT"/"(GT lead)" placeholder.
    expect(result.lead.parentFirstName).toBe("Pat");
    expect(result.lead.parentLastName).toBe("Rivera");
    expect(result.lead.zip).toBe("78704");
    expect(JSON.stringify(result.lead)).not.toContain("(GT lead)");
  });
});

describe("POST /api/gifted-quiz route contract", () => {
  beforeEach(() => {
    route.__resetGiftedQuizCaptureStoreForTests();
  });

  afterAll(async () => {
    await cleanupGtcByPrefix(RUN);
    if (HAS_DB) await closeDb();
  });

  it("rejects non-consented submissions before persistence", async () => {
    const res = await route.POST(request({
      idempotency_key: `${RUN}-no-consent`,
      parent_consent: false,
      parent_email: `${RUN}-parent@example.com`,
      child_grade: "2",
      answers: strongAnswers,
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Parent consent is required");
  });

  it("returns one public submission/lead for duplicate idempotency keys", async () => {
    const email = `${RUN}-parent@example.com`;
    const body = {
      idempotency_key: `${RUN}-dup-1`,
      parent_consent: true,
      parent_email: email,
      child_first_name: "Ava",
      child_grade: "2",
      answers: strongAnswers,
      utm_source: "meta",
      utm_medium: "paid_social",
      utm_campaign: "gifted_quiz_2026",
    };

    const first = await route.POST(request(body));
    const firstBody = await first.json();
    const second = await route.POST(request({ ...body, answers: exploreAnswers }));
    const secondBody = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    // The persistence model is now real when a DB is configured; the in-memory
    // contract (with its dbGap) only stands in when there is no DB.
    expect(firstBody.persistence).toBe(HAS_DB ? "db" : "memory-contract");
    if (!HAS_DB) expect(firstBody.dbGap).toContain("transactional DB adapter");
    else expect(firstBody.dbGap).toBeUndefined();
    expect(firstBody.capture.duplicate).toBe(false);
    expect(secondBody.capture.duplicate).toBe(true);
    expect(secondBody.capture.submissionId).toBe(firstBody.capture.submissionId);
    expect(secondBody.capture.leadId).toBe(firstBody.capture.leadId);
    expect(secondBody.capture.utm).toEqual({
      source: "meta",
      medium: "paid_social",
      campaign: "gifted_quiz_2026",
    });
    expect(JSON.stringify(secondBody)).not.toContain(email);
  });
});

