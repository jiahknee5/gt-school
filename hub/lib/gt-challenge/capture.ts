import { createHash } from "node:crypto";
import { matchKey } from "@/lib/connectors/SourceConnector";
import {
  type ChallengeBucket,
  type GradeResult,
  type Grader,
  type QuizAnswers,
  RulesGtChallengeGrader,
} from "@/lib/gt-challenge/assess";

export const GIFTED_QUIZ_CAMPAIGN_KEY = "gifted_quiz";
export const NOT_SET = "(not set)";

export type ChallengeSubmissionStatus = "scored" | "routed";

export interface CaptureUtm {
  source: string;
  medium: string;
  campaign: string;
}

export interface GiftedQuizCaptureRequest {
  idempotencyKey: string;
  campaignKey?: string;
  parentConsent: boolean;
  parent: {
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    zip?: string | null;
  };
  child: {
    firstName?: string | null;
    grade: string;
  };
  answers: QuizAnswers;
  utm?: Partial<CaptureUtm> | null;
  submittedAt?: string;
}

export interface PersistedGiftedQuizSubmission {
  id: string;
  idempotencyKey: string;
  campaignKey: string;
  childFirstName: string | null;
  childGrade: string;
  parentEmail: string | null;
  parentPhone: string | null;
  parentConsent: true;
  // When the parent consent gate was satisfied — carried to HubSpot as gt_consent_at.
  consentAt: string;
  answers: QuizAnswers;
  utm: CaptureUtm;
  rawScore: number;
  bucket: ChallengeBucket;
  qualified: boolean;
  rationale: string;
  answerHash: string;
  leadId: string;
  status: ChallengeSubmissionStatus;
  routedProgramKey: "fall_enrollment" | null;
  submittedAt: string;
  scoredAt: string;
}

export interface PersistedGiftedQuizLead {
  id: string;
  dedupeKey: string;
  matchKey: string | null;
  source: "gifted_quiz";
  parentEmail: string | null;
  parentPhone: string | null;
  parentFirstName: string | null;
  parentLastName: string | null;
  zip: string | null;
  childFirstName: string | null;
  childGrade: string;
  utm: CaptureUtm;
  latestBucket: ChallengeBucket;
  latestQualified: boolean;
  submissionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NewGiftedQuizCapture {
  submission: Omit<PersistedGiftedQuizSubmission, "leadId">;
  lead: Omit<PersistedGiftedQuizLead, "id" | "submissionIds" | "createdAt" | "updatedAt">;
}

export interface GiftedQuizCaptureRecord {
  submission: PersistedGiftedQuizSubmission;
  lead: PersistedGiftedQuizLead;
}

export interface SaveGiftedQuizCaptureResult extends GiftedQuizCaptureRecord {
  created: boolean;
}

export interface GiftedQuizCaptureStore {
  saveCapture(capture: NewGiftedQuizCapture): Promise<SaveGiftedQuizCaptureResult>;
  // Sync for the in-memory contract store; async for the DB-backed store.
  snapshot(): GiftedQuizCaptureRecord[] | Promise<GiftedQuizCaptureRecord[]>;
  clear?(): void;
}

export interface GiftedQuizCaptureResult extends GiftedQuizCaptureRecord {
  duplicate: boolean;
}

export interface PublicGiftedQuizCaptureResponse {
  duplicate: boolean;
  submissionId: string;
  leadId: string;
  status: ChallengeSubmissionStatus;
  campaignKey: string;
  bucket: ChallengeBucket;
  qualified: boolean;
  rawScore: number;
  utm: CaptureUtm;
  submittedAt: string;
}

export class GiftedQuizCaptureError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "GiftedQuizCaptureError";
  }
}

export class GiftedQuizValidationError extends GiftedQuizCaptureError {
  constructor(message: string) {
    super(400, message);
    this.name = "GiftedQuizValidationError";
  }
}

export class GiftedQuizConsentError extends GiftedQuizCaptureError {
  constructor() {
    super(400, "Parent consent is required before a GT Challenge submission can be persisted.");
    this.name = "GiftedQuizConsentError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function requiredString(value: unknown, field: string): string {
  const trimmed = stringOrNull(value);
  if (!trimmed) throw new GiftedQuizValidationError(`${field} is required.`);
  return trimmed;
}

function normalizeEmail(value: unknown): string | null {
  return stringOrNull(value)?.toLowerCase() ?? null;
}

function normalizeUtm(utm: Partial<CaptureUtm> | null | undefined): CaptureUtm {
  return {
    source: stringOrNull(utm?.source) ?? NOT_SET,
    medium: stringOrNull(utm?.medium) ?? NOT_SET,
    campaign: stringOrNull(utm?.campaign) ?? NOT_SET,
  };
}

function hashId(prefix: string, input: string): string {
  return `${prefix}_${createHash("sha256").update(input).digest("hex").slice(0, 24)}`;
}

function leadDedupeKey(input: GiftedQuizCaptureRequest): string {
  const key = matchKey({
    email: input.parent.email,
    phone: input.parent.phone,
    firstName: input.parent.firstName,
    lastName: input.parent.lastName,
    zip: input.parent.zip,
  });
  return key ?? `idempotency:${input.idempotencyKey}`;
}

function buildNewCapture(
  input: GiftedQuizCaptureRequest,
  grade: GradeResult,
  now: string,
): NewGiftedQuizCapture {
  const campaignKey = stringOrNull(input.campaignKey) ?? GIFTED_QUIZ_CAMPAIGN_KEY;
  const utm = normalizeUtm(input.utm);
  const id = hashId("gtcsub", `${campaignKey}:${input.idempotencyKey}`);
  const dedupeKey = leadDedupeKey(input);
  const status: ChallengeSubmissionStatus = grade.qualified ? "routed" : "scored";

  return {
    submission: {
      id,
      idempotencyKey: input.idempotencyKey,
      campaignKey,
      childFirstName: input.child.firstName ?? null,
      childGrade: input.child.grade,
      parentEmail: input.parent.email ?? null,
      parentPhone: input.parent.phone ?? null,
      parentConsent: true,
      // consent is required to reach here (captureGiftedQuizSubmission throws otherwise),
      // so the consent timestamp is the moment the submission was scored.
      consentAt: now,
      answers: input.answers,
      utm,
      rawScore: grade.rawScore,
      bucket: grade.bucket,
      qualified: grade.qualified,
      rationale: grade.rationale,
      answerHash: grade.answerHash,
      status,
      routedProgramKey: grade.qualified ? "fall_enrollment" : null,
      submittedAt: input.submittedAt ?? now,
      scoredAt: now,
    },
    lead: {
      dedupeKey,
      matchKey: dedupeKey.startsWith("idempotency:") ? null : dedupeKey,
      source: "gifted_quiz",
      parentEmail: input.parent.email ?? null,
      parentPhone: input.parent.phone ?? null,
      parentFirstName: input.parent.firstName ?? null,
      parentLastName: input.parent.lastName ?? null,
      zip: input.parent.zip ?? null,
      childFirstName: input.child.firstName ?? null,
      childGrade: input.child.grade,
      utm,
      latestBucket: grade.bucket,
      latestQualified: grade.qualified,
    },
  };
}

export function coerceGiftedQuizCaptureRequest(body: unknown): GiftedQuizCaptureRequest {
  if (!isRecord(body)) throw new GiftedQuizValidationError("Request body must be a JSON object.");

  const parent = isRecord(body.parent) ? body.parent : {};
  const child = isRecord(body.child) ? body.child : {};
  const utm = isRecord(body.utm) ? body.utm : body;
  const answers = isRecord(body.answers) ? body.answers : null;

  if (!answers) throw new GiftedQuizValidationError("answers is required.");

  return {
    idempotencyKey: requiredString(body.idempotencyKey ?? body.idempotency_key, "idempotencyKey"),
    campaignKey: stringOrNull(body.campaignKey ?? body.campaign_key) ?? undefined,
    parentConsent: Boolean(body.parentConsent ?? body.parent_consent),
    parent: {
      email: normalizeEmail(parent.email ?? body.parentEmail ?? body.parent_email),
      phone: stringOrNull(parent.phone ?? body.parentPhone ?? body.parent_phone),
      firstName: stringOrNull(parent.firstName ?? parent.first_name ?? body.parentFirstName ?? body.parent_first_name),
      lastName: stringOrNull(parent.lastName ?? parent.last_name ?? body.parentLastName ?? body.parent_last_name),
      zip: stringOrNull(parent.zip ?? body.zip),
    },
    child: {
      firstName: stringOrNull(child.firstName ?? child.first_name ?? body.childFirstName ?? body.child_first_name),
      grade: requiredString(child.grade ?? body.childGrade ?? body.child_grade, "child.grade"),
    },
    answers,
    utm: {
      source: stringOrNull(utm.source ?? utm.utmSource ?? utm.utm_source) ?? undefined,
      medium: stringOrNull(utm.medium ?? utm.utmMedium ?? utm.utm_medium) ?? undefined,
      campaign: stringOrNull(utm.campaign ?? utm.utmCampaign ?? utm.utm_campaign) ?? undefined,
    },
    submittedAt: stringOrNull(body.submittedAt ?? body.submitted_at) ?? undefined,
  };
}

export async function captureGiftedQuizSubmission(
  input: GiftedQuizCaptureRequest,
  store: GiftedQuizCaptureStore,
  options: { grader?: Grader; now?: Date } = {},
): Promise<GiftedQuizCaptureResult> {
  if (!input.parentConsent) throw new GiftedQuizConsentError();
  if (!stringOrNull(input.parent.email) && !stringOrNull(input.parent.phone)) {
    throw new GiftedQuizValidationError("parent.email or parent.phone is required.");
  }

  const grader = options.grader ?? new RulesGtChallengeGrader();
  const now = (options.now ?? new Date()).toISOString();
  const grade = await grader.grade(input.answers);
  const saved = await store.saveCapture(buildNewCapture(input, grade, now));

  return {
    ...saved,
    duplicate: !saved.created,
  };
}

export function toPublicGiftedQuizCaptureResponse(
  result: GiftedQuizCaptureResult,
): PublicGiftedQuizCaptureResponse {
  return {
    duplicate: result.duplicate,
    submissionId: result.submission.id,
    leadId: result.lead.id,
    status: result.submission.status,
    campaignKey: result.submission.campaignKey,
    bucket: result.submission.bucket,
    qualified: result.submission.qualified,
    rawScore: result.submission.rawScore,
    utm: result.submission.utm,
    submittedAt: result.submission.submittedAt,
  };
}

export class InMemoryGiftedQuizCaptureStore implements GiftedQuizCaptureStore {
  private submissionsByIdempotencyKey = new Map<string, PersistedGiftedQuizSubmission>();
  private leadsByDedupeKey = new Map<string, PersistedGiftedQuizLead>();

  async saveCapture(capture: NewGiftedQuizCapture): Promise<SaveGiftedQuizCaptureResult> {
    const existing = this.submissionsByIdempotencyKey.get(capture.submission.idempotencyKey);
    if (existing) {
      const lead = [...this.leadsByDedupeKey.values()].find((candidate) =>
        candidate.submissionIds.includes(existing.id),
      );
      if (!lead) throw new Error(`Capture store invariant failed for ${existing.id}: missing lead.`);
      return { created: false, submission: existing, lead };
    }

    const now = capture.submission.scoredAt;
    const existingLead = this.leadsByDedupeKey.get(capture.lead.dedupeKey);
    const lead: PersistedGiftedQuizLead = existingLead
      ? {
          ...existingLead,
          parentEmail: existingLead.parentEmail ?? capture.lead.parentEmail,
          parentPhone: existingLead.parentPhone ?? capture.lead.parentPhone,
          parentFirstName: existingLead.parentFirstName ?? capture.lead.parentFirstName,
          parentLastName: existingLead.parentLastName ?? capture.lead.parentLastName,
          zip: existingLead.zip ?? capture.lead.zip,
          childFirstName: existingLead.childFirstName ?? capture.lead.childFirstName,
          childGrade: capture.lead.childGrade,
          utm: capture.lead.utm,
          latestBucket: capture.lead.latestBucket,
          latestQualified: capture.lead.latestQualified,
          submissionIds: [...existingLead.submissionIds, capture.submission.id],
          updatedAt: now,
        }
      : {
          ...capture.lead,
          id: hashId("gtclead", capture.lead.dedupeKey),
          submissionIds: [capture.submission.id],
          createdAt: now,
          updatedAt: now,
        };

    const submission: PersistedGiftedQuizSubmission = {
      ...capture.submission,
      leadId: lead.id,
    };

    this.submissionsByIdempotencyKey.set(submission.idempotencyKey, submission);
    this.leadsByDedupeKey.set(lead.dedupeKey, lead);
    return { created: true, submission, lead };
  }

  snapshot(): GiftedQuizCaptureRecord[] {
    return [...this.submissionsByIdempotencyKey.values()]
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt) || a.id.localeCompare(b.id))
      .map((submission) => {
        const lead = [...this.leadsByDedupeKey.values()].find((candidate) =>
          candidate.submissionIds.includes(submission.id),
        );
        if (!lead) throw new Error(`Capture store invariant failed for ${submission.id}: missing lead.`);
        return { submission, lead };
      });
  }

  clear(): void {
    this.submissionsByIdempotencyKey.clear();
    this.leadsByDedupeKey.clear();
  }
}

export function summarizeGiftedQuizCaptures(
  records: GiftedQuizCaptureRecord[],
  spend: number,
): { submissions: number; leads: number; qualified: number; costPerQualifiedLead: number | null } {
  const leadIds = new Set(records.map((record) => record.lead.id));
  const qualified = records.filter((record) => record.submission.qualified).length;
  return {
    submissions: records.length,
    leads: leadIds.size,
    qualified,
    costPerQualifiedLead: qualified ? Number((spend / qualified).toFixed(2)) : null,
  };
}

