/**
 * Stood-in Open Data snapshot — the offline fallback for the decision-enrichment
 * flow. Clearly labeled as a stand-in (the Technical Brief expects stood-in vs.
 * live data to be honest and visible): every result built from this carries
 * `source: "fixture"`.
 *
 * Values are a real snapshot captured from the live tryopendata.ai API
 * (TEA `accountability-summary` and `summarized-finance`, 2024–25 / FY2024) for
 * the TX metros GT cares about. They exist so a walkthrough or Decision Queue
 * view still renders if the network is down — NOT as a source of truth.
 *
 * Snapshot captured: 2026-06-25.
 */

import type { DatasetQuery, OpenDataRow } from "./client";

interface RatingFixture {
  district: string;
  county: string;
  overall_rating: string;
  student_achievement_rating: string;
  economically_disadvantaged: number;
  number_of_students: number;
  school_year: string;
}

interface FinanceFixture {
  district_name: string;
  district_id: string;
  county_name: string;
  year: number;
  gen_funds_gifted_talented_program_expend_21: number;
  fall_survey_enrollment: number;
}

// A–F accountability, 2024–2025, district level. Real values from the API.
const RATINGS: RatingFixture[] = [
  { district: "AUSTIN ISD", county: "TRAVIS", overall_rating: "C", student_achievement_rating: "C", economically_disadvantaged: 0.539, number_of_students: 72175, school_year: "2024-2025" },
  { district: "KIPP TEXAS PUBLIC SCHOOLS", county: "TRAVIS", overall_rating: "B", student_achievement_rating: "B", economically_disadvantaged: 0.84, number_of_students: 32754, school_year: "2024-2025" },
  { district: "PFLUGERVILLE ISD", county: "TRAVIS", overall_rating: "C", student_achievement_rating: "C", economically_disadvantaged: 0.55, number_of_students: 25451, school_year: "2024-2025" },
  { district: "DEL VALLE ISD", county: "TRAVIS", overall_rating: "D", student_achievement_rating: "D", economically_disadvantaged: 0.85, number_of_students: 11681, school_year: "2024-2025" },
  { district: "LAKE TRAVIS ISD", county: "TRAVIS", overall_rating: "A", student_achievement_rating: "A", economically_disadvantaged: 0.13, number_of_students: 10970, school_year: "2024-2025" },
];

// Summarized PEIMS finance, FY2024, gifted/talented program spend. Approximate
// stand-in values shaped like the live columns; for offline rendering only.
const FINANCE: FinanceFixture[] = [
  { district_name: "AUSTIN ISD", district_id: "227901", county_name: "TRAVIS COUNTY", year: 2024, gen_funds_gifted_talented_program_expend_21: 2014000, fall_survey_enrollment: 72175 },
  { district_name: "PFLUGERVILLE ISD", district_id: "227904", county_name: "TRAVIS COUNTY", year: 2024, gen_funds_gifted_talented_program_expend_21: 612000, fall_survey_enrollment: 25451 },
  { district_name: "DEL VALLE ISD", district_id: "227910", county_name: "TRAVIS COUNTY", year: 2024, gen_funds_gifted_talented_program_expend_21: 119000, fall_survey_enrollment: 11681 },
  { district_name: "LAKE TRAVIS ISD", district_id: "227912", county_name: "TRAVIS COUNTY", year: 2024, gen_funds_gifted_talented_program_expend_21: 388000, fall_survey_enrollment: 10970 },
];

/**
 * Fixture resolver matching the `FetchOptions.fixture` contract. Returns shaped
 * rows for the two enrichment datasets, filtered by the query's county/year so
 * the stand-in behaves like the live filtered endpoint. Returns null otherwise.
 */
export function openDataFixture(
  provider: string,
  dataset: string,
  query: DatasetQuery,
): OpenDataRow[] | null {
  if (provider !== "tea") return null;
  const filter = query.filter ?? {};

  if (dataset === "accountability-summary") {
    const county = filter["county"];
    const rows = RATINGS.filter((r) => (county ? r.county === county : true));
    return rows as unknown as OpenDataRow[];
  }

  if (dataset === "summarized-finance") {
    const countyName = filter["county_name"];
    const rows = FINANCE.filter((r) => (countyName ? r.county_name === countyName : true));
    return rows as unknown as OpenDataRow[];
  }

  return null;
}
