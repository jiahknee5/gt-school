import { beforeEach, describe, expect, it } from "vitest";
import { CHALLENGE_BUCKETS, gradeGiftedQuizAnswers } from "@/lib/gt-challenge/assess";
import {
  captureGiftedQuizSubmission,
  InMemoryGiftedQuizCaptureStore,
  NOT_SET,
  summarizeGiftedQuizCaptures,
  type GiftedQuizCaptureRequest,
} from "@/lib/gt-challenge/capture";

const route = await import("@/app/api/gifted-quiz/route");

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
});

describe("POST /api/gifted-quiz route contract", () => {
  beforeEach(() => {
    route.__resetGiftedQuizCaptureStoreForTests();
  });

  it("rejects non-consented submissions before persistence", async () => {
    const res = await route.POST(request({
      idempotency_key: "route-no-consent",
      parent_consent: false,
      parent_email: "parent@example.com",
      child_grade: "2",
      answers: strongAnswers,
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Parent consent is required");
  });

  it("returns one public submission/lead for duplicate idempotency keys", async () => {
    const body = {
      idempotency_key: "route-dup-1",
      parent_consent: true,
      parent_email: "route-parent@example.com",
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
    expect(firstBody.persistence).toBe("memory-contract");
    expect(firstBody.dbGap).toContain("transactional DB adapter");
    expect(firstBody.capture.duplicate).toBe(false);
    expect(secondBody.capture.duplicate).toBe(true);
    expect(secondBody.capture.submissionId).toBe(firstBody.capture.submissionId);
    expect(secondBody.capture.leadId).toBe(firstBody.capture.leadId);
    expect(secondBody.capture.utm).toEqual({
      source: "meta",
      medium: "paid_social",
      campaign: "gifted_quiz_2026",
    });
    expect(JSON.stringify(secondBody)).not.toContain("route-parent@example.com");
  });
});

