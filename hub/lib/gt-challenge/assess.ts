import { createHash } from "node:crypto";

export type ChallengeBucket = "strong_fit" | "promising" | "explore";

export const CHALLENGE_BUCKETS: readonly ChallengeBucket[] = [
  "strong_fit",
  "promising",
  "explore",
];

export type QuizAnswers = Record<string, unknown>;

export interface GradeResult {
  rawScore: number;
  bucket: ChallengeBucket;
  qualified: boolean;
  rationale: string;
  answerHash: string;
}

export interface Grader {
  grade(answers: QuizAnswers): Promise<GradeResult>;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function answerHash(answers: QuizAnswers): string {
  return createHash("sha256").update(stableJson(answers)).digest("hex");
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function numericScore(value: number): number {
  if (value <= 5) return clampScore(value * 20);
  if (value <= 10) return clampScore(value * 10);
  return clampScore(value);
}

function stringScore(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  if (["always", "advanced", "yes", "high", "frequently"].includes(normalized)) return 90;
  if (["often", "above_grade", "above grade", "strong"].includes(normalized)) return 80;
  if (["sometimes", "mixed", "medium"].includes(normalized)) return 60;
  if (["rarely", "not_yet", "not yet", "low", "no"].includes(normalized)) return 35;

  if (normalized.length >= 120) return 80;
  if (normalized.length >= 40) return 65;
  return null;
}

function collectSignals(value: unknown, out: number[]): void {
  if (typeof value === "number") {
    out.push(numericScore(value));
    return;
  }
  if (typeof value === "boolean") {
    out.push(value ? 85 : 40);
    return;
  }
  if (typeof value === "string") {
    const score = stringScore(value);
    if (score != null) out.push(score);
    return;
  }
  if (Array.isArray(value)) {
    for (const child of value) collectSignals(child, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) collectSignals(child, out);
  }
}

export function bucketForScore(rawScore: number): ChallengeBucket {
  if (rawScore >= 80) return "strong_fit";
  if (rawScore >= 55) return "promising";
  return "explore";
}

export function gradeGiftedQuizAnswers(answers: QuizAnswers): GradeResult {
  const signals: number[] = [];
  collectSignals(answers, signals);

  const rawScore = signals.length
    ? Math.round(signals.reduce((sum, score) => sum + score, 0) / signals.length)
    : 50;
  const bucket = bucketForScore(rawScore);
  return {
    rawScore,
    bucket,
    qualified: bucket === "strong_fit" || bucket === "promising",
    rationale:
      bucket === "strong_fit"
        ? "Strong fit signal for an admissions follow-up."
        : bucket === "promising"
          ? "Promising fit signal for review and nurturing."
          : "Explore signal; keep the family informed without labeling the child out.",
    answerHash: answerHash(answers),
  };
}

export class RulesGtChallengeGrader implements Grader {
  async grade(answers: QuizAnswers): Promise<GradeResult> {
    return gradeGiftedQuizAnswers(answers);
  }
}

