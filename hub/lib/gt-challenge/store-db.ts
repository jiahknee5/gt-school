// DB-backed GT Challenge capture store — the real persistence behind the public
// gifted-quiz endpoint (replaces InMemoryGiftedQuizCaptureStore when a DB is
// configured). It mirrors the transactional discipline of lib/payments.ts:
//
//   ONE transaction (as app_rw, scoped to Fall Enrollment so program_membership
//   writes pass RLS):
//     1. dedupe on idempotency_key  → idempotent capture (replay = no new rows)
//     2. resolve-or-insert the lead in families (the app ORIGINATES a gifted_quiz
//        contact; HubSpot stays authoritative — reconcile backfills hubspot_contact_id)
//     3. insert the scored quiz_submission
//     4. qualified fits → program_membership in Fall Enrollment (routed)
//     5. enqueue a sync_outbox upsert_contact intent → the lead becomes a HubSpot
//        contact via the existing outbox worker (app→HubSpot backbone)
//
// All writes are global-table or RLS-scoped through app_rw; service_role is never used.

import type postgres from "postgres";
import { withProgram, withoutProgram, type ScopedSql } from "@/lib/db";
import {
  GIFTED_QUIZ_CAMPAIGN_KEY,
  type GiftedQuizCaptureStore,
  type NewGiftedQuizCapture,
  type PersistedGiftedQuizLead,
  type PersistedGiftedQuizSubmission,
  type SaveGiftedQuizCaptureResult,
  type GiftedQuizCaptureRecord,
} from "@/lib/gt-challenge/capture";
import type { ChallengeBucket } from "@/lib/gt-challenge/assess";

const FALL_PROGRAM_KEY = "fall_enrollment";

type SubmissionRow = {
  id: string;
  idempotency_key: string;
  campaign_key: string;
  family_id: string | null;
  match_key: string | null;
  child_first_name: string | null;
  child_grade: string;
  parent_email: string | null;
  parent_phone: string | null;
  answers: Record<string, unknown>;
  raw_score: number;
  bucket: ChallengeBucket;
  qualified: boolean;
  rationale: string | null;
  answer_hash: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  status: "scored" | "routed";
  routed_program_key: string | null;
  submitted_at: string | Date;
  scored_at: string | Date;
};

let _fallProgramId: string | null = null;

async function fallProgramId(): Promise<string> {
  if (_fallProgramId) return _fallProgramId;
  const id = await withoutProgram(async (sql) => {
    const rows = await sql<{ id: string }[]>`
      select id from programs where key = ${FALL_PROGRAM_KEY} limit 1`;
    return rows[0]?.id ?? null;
  });
  if (!id) throw new Error(`programs row for '${FALL_PROGRAM_KEY}' not found.`);
  _fallProgramId = id;
  return id;
}

function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function rowToSubmission(row: SubmissionRow): PersistedGiftedQuizSubmission {
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    campaignKey: row.campaign_key,
    childFirstName: row.child_first_name,
    childGrade: row.child_grade,
    parentEmail: row.parent_email,
    parentPhone: row.parent_phone,
    parentConsent: true,
    answers: row.answers,
    utm: {
      source: row.utm_source ?? "(not set)",
      medium: row.utm_medium ?? "(not set)",
      campaign: row.utm_campaign ?? "(not set)",
    },
    rawScore: row.raw_score,
    bucket: row.bucket,
    qualified: row.qualified,
    rationale: row.rationale ?? "",
    answerHash: row.answer_hash ?? "",
    leadId: row.family_id ?? "",
    status: row.status,
    routedProgramKey: (row.routed_program_key as "fall_enrollment" | null) ?? null,
    submittedAt: iso(row.submitted_at),
    scoredAt: iso(row.scored_at),
  };
}

function leadFor(
  capture: NewGiftedQuizCapture,
  familyId: string,
  submissionId: string,
  now: string,
): PersistedGiftedQuizLead {
  return {
    ...capture.lead,
    id: familyId,
    submissionIds: [submissionId],
    createdAt: now,
    updatedAt: now,
  };
}

export class DbGiftedQuizCaptureStore implements GiftedQuizCaptureStore {
  async saveCapture(capture: NewGiftedQuizCapture): Promise<SaveGiftedQuizCaptureResult> {
    const fallId = await fallProgramId();
    const sub = capture.submission;
    const utm = sub.utm;

    return withProgram(fallId, async (tx: ScopedSql) => {
      // 1) idempotent capture — a replayed idempotency_key returns the stored rows.
      const existing = await tx<SubmissionRow[]>`
        select * from quiz_submissions where idempotency_key = ${sub.idempotencyKey} limit 1`;
      if (existing[0]) {
        const row = rowToSubmission(existing[0]);
        return {
          created: false,
          submission: row,
          lead: leadFor(capture, row.leadId, row.id, row.scoredAt),
        };
      }

      // 2) resolve-or-insert the lead contact (families is global; HubSpot authoritative).
      const mk = capture.lead.matchKey;
      let familyId: string | null = null;
      if (mk) {
        const found = await tx<{ id: string }[]>`
          select id from families where match_key = ${mk} limit 1`;
        familyId = found[0]?.id ?? null;
      }
      if (!familyId) {
        const inserted = await tx<{ id: string }[]>`
          insert into families (email, phone, match_key, source)
          values (${sub.parentEmail}, ${sub.parentPhone}, ${mk}, 'gifted_quiz')
          returning id`;
        familyId = inserted[0].id;
      }

      // 3) insert the scored submission.
      await tx`
        insert into quiz_submissions (
          id, idempotency_key, campaign_key, family_id, match_key,
          child_first_name, child_grade, parent_email, parent_phone,
          answers, raw_score, bucket, qualified, rationale, answer_hash,
          utm_source, utm_medium, utm_campaign, status, routed_program_key,
          submitted_at, scored_at
        ) values (
          ${sub.id}, ${sub.idempotencyKey}, ${sub.campaignKey}, ${familyId}, ${mk},
          ${sub.childFirstName}, ${sub.childGrade}, ${sub.parentEmail}, ${sub.parentPhone},
          ${tx.json(sub.answers as unknown as postgres.JSONValue)}, ${sub.rawScore}, ${sub.bucket}, ${sub.qualified},
          ${sub.rationale}, ${sub.answerHash},
          ${utm.source}, ${utm.medium}, ${utm.campaign}, ${sub.status}, ${sub.routedProgramKey},
          ${sub.submittedAt}, ${sub.scoredAt}
        )`;

      // 4) qualified → route into Fall Enrollment (RLS-scoped; the tx is scoped to fall).
      if (sub.qualified) {
        await tx`
          insert into program_membership (program_id, family_id, source)
          select ${fallId}, ${familyId}, 'gifted_quiz'
          where not exists (
            select 1 from program_membership
            where program_id = ${fallId} and family_id = ${familyId})`;
      }

      // 5) enqueue the app→HubSpot intent (existing outbox backbone dispatches it).
      await tx`
        insert into sync_outbox (aggregate_type, aggregate_id, target_system, op, payload, dedupe_key)
        values (
          'quiz_submission', ${sub.id}, 'hubspot', 'upsert_contact',
          ${tx.json({
            email: sub.parentEmail,
            phone: sub.parentPhone,
            gt_challenge_bucket: sub.bucket,
            gt_challenge_score: String(sub.rawScore),
            gt_challenge_qualified: String(sub.qualified),
            hs_lead_status: sub.qualified ? "NEW" : "UNQUALIFIED",
            utm_source: utm.source,
            utm_medium: utm.medium,
            utm_campaign: utm.campaign,
          } as unknown as postgres.JSONValue)},
          ${`gtc:${sub.id}`}
        )
        on conflict (dedupe_key) do nothing`;

      const now = sub.scoredAt;
      return {
        created: true,
        submission: { ...sub, leadId: familyId } as PersistedGiftedQuizSubmission,
        lead: leadFor(capture, familyId, sub.id, now),
      };
    });
  }

  async snapshot(): Promise<GiftedQuizCaptureRecord[]> {
    const rows = await withoutProgram((sql) =>
      sql<SubmissionRow[]>`select * from quiz_submissions order by submitted_at, id`,
    );
    return rows.map((row) => {
      const submission = rowToSubmission(row);
      const lead: PersistedGiftedQuizLead = {
        id: submission.leadId,
        dedupeKey: row.match_key ?? `idempotency:${row.idempotency_key}`,
        matchKey: row.match_key,
        source: "gifted_quiz",
        parentEmail: row.parent_email,
        parentPhone: row.parent_phone,
        childFirstName: row.child_first_name,
        childGrade: row.child_grade,
        utm: submission.utm,
        latestBucket: submission.bucket,
        latestQualified: submission.qualified,
        submissionIds: [submission.id],
        createdAt: submission.scoredAt,
        updatedAt: submission.scoredAt,
      };
      return { submission, lead };
    });
  }
}

/**
 * Live GT Challenge KPI counts read straight from quiz_submissions — what the
 * /m/gt-challenge surface shows. Leads are distinct match_keys (one parent can
 * submit several children). The surface derives CPQL from the seed campaign spend
 * ÷ live qualified, so spend stays single-sourced. Returns null on any DB trouble
 * so the surface falls back to seed rather than erroring (lib/db fails fast).
 */
export async function summarizeQuizSubmissionsFromDb(
  campaignKey: string = GIFTED_QUIZ_CAMPAIGN_KEY,
): Promise<{ submissions: number; leads: number; qualified: number } | null> {
  try {
    const rows = await withoutProgram(
      (sql) => sql<{ submissions: string; leads: string; qualified: string }[]>`
        select count(*)::text as submissions,
               count(distinct match_key)::text as leads,
               count(*) filter (where qualified)::text as qualified
        from quiz_submissions
        where campaign_key = ${campaignKey}`,
    );
    const r = rows[0];
    if (!r) return null;
    return { submissions: Number(r.submissions), leads: Number(r.leads), qualified: Number(r.qualified) };
  } catch {
    return null;
  }
}
