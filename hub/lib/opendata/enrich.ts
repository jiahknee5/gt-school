/**
 * Decision enrichment — the "real Open Data query that changes a decision" the
 * Technical Brief asks for. Given a set of Texas counties (e.g. a proposed
 * grassroots / field-marketing bet like the Austin + Dallas chess-tournament
 * street team), it pulls:
 *
 *   - district A–F accountability ratings  (tea/accountability-summary)
 *   - district gifted/talented program spend (tea/summarized-finance)
 *
 * …and derives a GT-relevant signal: how much enrolled demand sits in districts
 * that are BOTH weakly rated AND underspending on gifted programs — i.e. where
 * "public GT is rationed and GT Anywhere is free on the voucher" lands hardest.
 *
 * This is context for a human decision, not a lead field. It never writes back.
 */

import {
  fetchDataset,
  type FetchOptions,
  type OpenDataSource,
  type OpenDataValue,
} from "./client";
import { openDataFixture } from "./fixtures";

const WEAK_RATINGS = new Set(["C", "D", "F"]);

export interface DistrictRating {
  district: string;
  county: string;
  overallRating: string;
  studentAchievementRating: string | null;
  economicallyDisadvantaged: number | null;
  students: number;
}

export interface DistrictGiftedSpend {
  district: string;
  districtId: string;
  county: string;
  year: number;
  giftedSpend: number;
  enrollment: number;
  giftedSpendPerStudent: number | null;
}

export interface DecisionEnrichment {
  counties: string[];
  schoolYear: string;
  financeYear: number;
  ratings: DistrictRating[];
  giftedSpend: DistrictGiftedSpend[];
  summary: {
    districts: number;
    totalStudents: number;
    studentsInWeakDistricts: number;
    weakDistrictShare: number;
    medianGiftedSpendPerStudent: number | null;
  };
  /** Human-readable line for the Decision Queue / Home widget. */
  signal: string;
  /** Worst source across the underlying calls (fixture < cache < live → report honestly). */
  source: OpenDataSource;
  fetchedAt: string;
}

export interface EnrichOptions extends FetchOptions {
  /** A–F accountability school year, e.g. "2024-2025". */
  schoolYear?: string;
  /** PEIMS finance year, e.g. 2024. */
  financeYear?: number;
}

export type DecisionPosture = "hold" | "pilot" | "approve";

export interface DecisionRecommendationImpact {
  before: DecisionPosture;
  after: DecisionPosture;
  changed: boolean;
  confidence: "low" | "medium" | "high";
  reason: string;
}

const DEFAULT_SCHOOL_YEAR = "2024-2025";
const DEFAULT_FINANCE_YEAR = 2024;

function num(v: OpenDataValue): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function rank(source: OpenDataSource): number {
  return source === "live" ? 2 : source === "cache" ? 1 : 0;
}

/**
 * Enrich a geographic bet with district ratings + gifted spend across counties.
 * Counties are queried one at a time (the API's `filter[col]` is equality), then
 * merged — the county set is small in practice.
 */
export async function enrichDecisionByCounties(
  counties: string[],
  opts: EnrichOptions = {},
): Promise<DecisionEnrichment> {
  const schoolYear = opts.schoolYear ?? DEFAULT_SCHOOL_YEAR;
  const financeYear = opts.financeYear ?? DEFAULT_FINANCE_YEAR;
  const fetchOpts: FetchOptions = { fixture: openDataFixture, ...opts };

  const normalized = counties.map((c) => c.trim().toUpperCase()).filter(Boolean);

  const ratings: DistrictRating[] = [];
  const giftedSpend: DistrictGiftedSpend[] = [];
  let worst: OpenDataSource = "live";

  for (const county of normalized) {
    const ratingRes = await fetchDataset(
      "tea",
      "accountability-summary",
      {
        fields: [
          "district",
          "county",
          "overall_rating",
          "student_achievement_rating",
          "economically_disadvantaged",
          "number_of_students",
        ],
        filter: { county, school_year: schoolYear, school_type: "District" },
        sort: "-number_of_students",
        limit: 100,
      },
      fetchOpts,
    );
    if (rank(ratingRes.source) < rank(worst)) worst = ratingRes.source;
    for (const row of ratingRes.data) {
      ratings.push({
        district: String(row.district ?? ""),
        county: String(row.county ?? county),
        overallRating: String(row.overall_rating ?? ""),
        studentAchievementRating: row.student_achievement_rating
          ? String(row.student_achievement_rating)
          : null,
        economicallyDisadvantaged: num(row.economically_disadvantaged),
        students: num(row.number_of_students) ?? 0,
      });
    }

    const financeRes = await fetchDataset(
      "tea",
      "summarized-finance",
      {
        fields: [
          "district_name",
          "district_id",
          "county_name",
          "year",
          "gen_funds_gifted_talented_program_expend_21",
          "fall_survey_enrollment",
        ],
        filter: { county_name: `${county} COUNTY`, year: financeYear },
        sort: "-fall_survey_enrollment",
        limit: 100,
      },
      fetchOpts,
    );
    if (rank(financeRes.source) < rank(worst)) worst = financeRes.source;
    for (const row of financeRes.data) {
      const spend = num(row.gen_funds_gifted_talented_program_expend_21) ?? 0;
      const enrollment = num(row.fall_survey_enrollment) ?? 0;
      giftedSpend.push({
        district: String(row.district_name ?? ""),
        districtId: String(row.district_id ?? ""),
        county,
        year: num(row.year) ?? financeYear,
        giftedSpend: spend,
        enrollment,
        giftedSpendPerStudent: enrollment > 0 ? spend / enrollment : null,
      });
    }
  }

  return buildEnrichment(normalized, schoolYear, financeYear, ratings, giftedSpend, worst);
}

export function recommendationImpactFromEnrichment(
  enrichment: Pick<DecisionEnrichment, "summary" | "source">,
  before: DecisionPosture = "pilot",
): DecisionRecommendationImpact {
  const weakShare = enrichment.summary.weakDistrictShare;
  const medianSpend = enrichment.summary.medianGiftedSpendPerStudent;
  const noData = enrichment.summary.totalStudents === 0;
  const underserved =
    weakShare >= 0.5 &&
    medianSpend !== null &&
    medianSpend <= 35;

  const after: DecisionPosture = noData
    ? "hold"
    : underserved
      ? "approve"
      : weakShare >= 0.35
        ? "pilot"
        : "hold";
  const confidence =
    enrichment.source === "live"
      ? "high"
      : enrichment.source === "cache"
        ? "medium"
        : "low";
  const pct = Math.round(weakShare * 100);
  const reason = noData
    ? "No district data was returned, so the recommendation should wait for another source."
    : underserved
      ? `${pct}% of students are in C/D/F districts and median GT spend is $${Math.round(medianSpend ?? 0)}/student, so Open Data upgrades the ask to approve.`
      : `${pct}% weak-district exposure is not enough to upgrade the ask beyond ${after}.`;

  return {
    before,
    after,
    changed: before !== after,
    confidence,
    reason,
  };
}

function buildEnrichment(
  counties: string[],
  schoolYear: string,
  financeYear: number,
  ratings: DistrictRating[],
  giftedSpend: DistrictGiftedSpend[],
  source: OpenDataSource,
): DecisionEnrichment {
  const totalStudents = ratings.reduce((sum, r) => sum + r.students, 0);
  const studentsInWeakDistricts = ratings
    .filter((r) => WEAK_RATINGS.has(r.overallRating))
    .reduce((sum, r) => sum + r.students, 0);
  const weakDistrictShare = totalStudents > 0 ? studentsInWeakDistricts / totalStudents : 0;

  const perStudent = giftedSpend
    .map((g) => g.giftedSpendPerStudent)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  const medianGiftedSpendPerStudent =
    perStudent.length === 0
      ? null
      : perStudent.length % 2 === 1
        ? perStudent[(perStudent.length - 1) / 2]
        : (perStudent[perStudent.length / 2 - 1] + perStudent[perStudent.length / 2]) / 2;

  const countyLabel = counties
    .map((c) => c.charAt(0) + c.slice(1).toLowerCase())
    .join(" + ");
  const pct = Math.round(weakDistrictShare * 100);
  const median = medianGiftedSpendPerStudent;
  const signal =
    totalStudents === 0
      ? `No district data found for ${countyLabel} (${schoolYear}).`
      : `${countyLabel}: ${studentsInWeakDistricts.toLocaleString()} of ` +
        `${totalStudents.toLocaleString()} enrolled students (${pct}%) sit in C/D/F-rated ` +
        `districts` +
        (median !== null
          ? ` spending a median of $${Math.round(median)}/student on gifted programs`
          : "") +
        `. This is a strong "rationed public GT, free GT Anywhere" pool.`;

  return {
    counties,
    schoolYear,
    financeYear,
    ratings,
    giftedSpend,
    summary: {
      districts: ratings.length,
      totalStudents,
      studentsInWeakDistricts,
      weakDistrictShare,
      medianGiftedSpendPerStudent,
    },
    signal,
    source,
    fetchedAt: new Date().toISOString(),
  };
}
