import { afterAll, describe, expect, it } from "vitest";
import { captureGiftedQuizSubmission, type GiftedQuizCaptureRequest } from "@/lib/gt-challenge/capture";
import { DbGiftedQuizCaptureStore, summarizeQuizSubmissionsFromDb } from "@/lib/gt-challenge/store-db";
import { closeDb, withProgram, withoutProgram } from "@/lib/db";

// Live wiring proof: a public gifted-quiz submission must persist to quiz_submissions,
// originate a families lead, enqueue a sync_outbox upsert_contact intent (app→HubSpot),
// and route qualified fits into Fall Enrollment — idempotently. Mirrors the live-DB
// discipline of payments.test.ts. Skips when no DB is configured.
const HAS_DB = Boolean(process.env.APP_RW_DATABASE_URL);
const RUN = `gtcdb${Date.now()}`;

function qualifyingInput(idem: string, email: string): GiftedQuizCaptureRequest {
  return {
    idempotencyKey: idem,
    parentConsent: true,
    parent: { email, phone: null, firstName: "QA", lastName: "Runner", zip: "78701" },
    child: { firstName: "Testkid", grade: "2" },
    answers: { patternReasoning: 5, curiosity: 5, selfDirectedProjects: 4, readingAboveGrade: true },
    utm: { source: "facebook", medium: "social", campaign: "gifted_quiz_2026" },
    submittedAt: "2026-06-27T12:00:00.000Z",
  };
}

(HAS_DB ? describe : describe.skip)("GT Challenge capture → DB → outbox (live Supabase)", () => {
  const store = new DbGiftedQuizCaptureStore();
  const idem = `${RUN}-1`;
  const email = `${RUN}-parent@example.com`;

  afterAll(async () => {
    const fallId = (
      await withoutProgram((sql) => sql<{ id: string }[]>`select id from programs where key='fall_enrollment' limit 1`)
    )[0]?.id;
    const famIds = await withoutProgram(async (sql) => {
      const subs = await sql<{ id: string }[]>`select id from quiz_submissions where idempotency_key like ${RUN + "%"}`;
      if (subs.length) {
        const ids = subs.map((s) => s.id);
        await sql`delete from sync_outbox where aggregate_id in ${sql(ids)}`;
        await sql`delete from quiz_submissions where id in ${sql(ids)}`;
      }
      const fams = await sql<{ id: string }[]>`select id from families where email like ${RUN + "%"}`;
      return fams.map((f) => f.id);
    });
    if (famIds.length && fallId) {
      await withProgram(fallId, (sql) => sql`delete from program_membership where family_id in ${sql(famIds)}`);
    }
    if (famIds.length) await withoutProgram((sql) => sql`delete from families where id in ${sql(famIds)}`);
    await closeDb();
  });

  it("persists the submission, originates a lead, enqueues HubSpot, and routes a qualified fit", async () => {
    const result = await captureGiftedQuizSubmission(qualifyingInput(idem, email), store);
    expect(result.duplicate).toBe(false);
    expect(result.submission.qualified).toBe(true);
    expect(result.submission.status).toBe("routed");

    // 1) the scored submission row exists
    const subs = await withoutProgram(
      (sql) => sql<{ id: string; family_id: string; qualified: boolean; bucket: string; utm_source: string }[]>`
        select id, family_id, qualified, bucket, utm_source from quiz_submissions where idempotency_key = ${idem}`,
    );
    expect(subs).toHaveLength(1);
    expect(subs[0].qualified).toBe(true);
    expect(subs[0].utm_source).toBe("facebook");
    const familyId = subs[0].family_id;
    expect(familyId).toBeTruthy();

    // 2) the lead exists in families, originated by the quiz (HubSpot id backfilled later by reconcile)
    const fam = await withoutProgram(
      (sql) => sql<{ source: string; email: string }[]>`select source, email from families where id = ${familyId}`,
    );
    expect(fam[0].source).toBe("gifted_quiz");
    expect(fam[0].email).toBe(email);

    // 3) an app→HubSpot upsert_contact intent is enqueued with the email + UTM
    const ob = await withoutProgram(
      (sql) => sql<{ op: string; payload: Record<string, unknown> }[]>`
        select op, payload from sync_outbox where aggregate_id = ${subs[0].id}`,
    );
    expect(ob).toHaveLength(1);
    expect(ob[0].op).toBe("upsert_contact");
    const payload = ob[0].payload;
    expect(payload.email).toBe(email);
    expect(payload.hs_lead_status).toBe("NEW"); // qualified → NEW lead status
    // The FULL lead is on the wire: real parent name + zip + the gt_* fit signal.
    expect(payload.firstname).toBe("QA");
    expect(payload.lastname).toBe("Runner");
    expect(payload.zip).toBe("78701");
    expect(payload.gt_grade_band).toBe("k_2"); // grade "2" → k_2 band
    expect(payload.gt_fit_bucket).toBe("strong_fit");
    expect(payload.gt_lead_score).toBeGreaterThanOrEqual(80);
    expect(payload.gt_consent).toBe(true);
    expect(payload.gt_consent_at).toBeTruthy();
    expect(payload.gt_utm_source).toBe("facebook");

    // 4) qualified → routed into Fall Enrollment (RLS-scoped membership)
    const fallId = (
      await withoutProgram((sql) => sql<{ id: string }[]>`select id from programs where key='fall_enrollment' limit 1`)
    )[0].id;
    const mem = await withProgram(fallId, (sql) =>
      sql<{ source: string }[]>`select source from program_membership where family_id = ${familyId}`,
    );
    expect(mem.length).toBeGreaterThanOrEqual(1);
    expect(mem[0].source).toBe("gifted_quiz");
  });

  it("is idempotent on idempotency_key replay (no duplicate rows)", async () => {
    const before = await withoutProgram(
      (sql) => sql<{ n: string }[]>`select count(*)::text as n from quiz_submissions where idempotency_key = ${idem}`,
    );
    const replay = await captureGiftedQuizSubmission(qualifyingInput(idem, email), store);
    expect(replay.duplicate).toBe(true);
    const after = await withoutProgram(
      (sql) => sql<{ n: string }[]>`select count(*)::text as n from quiz_submissions where idempotency_key = ${idem}`,
    );
    expect(after[0].n).toBe(before[0].n); // still exactly one
  });

  it("the live KPI summary counts the captured submission", async () => {
    const summary = await summarizeQuizSubmissionsFromDb();
    expect(summary).not.toBeNull();
    expect(summary!.submissions).toBeGreaterThanOrEqual(1);
    expect(summary!.qualified).toBeGreaterThanOrEqual(1);
  });
});
