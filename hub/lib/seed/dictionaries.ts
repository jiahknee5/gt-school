/**
 * Realistic vocabularies + distributions for the GT Anywhere funnel. The weights
 * encode the spec's stated insights so dashboards/segments show the RIGHT shape:
 *   - income is the master conversion variable ($160K+ ≈ 25% regardless of geo)
 *   - Grade K–2 is the application sweet spot
 *   - "follows Alpha on X" is the conviction tell (~27% among converters)
 *   - the home market is Texas (TEFA), with the other funded-ESA states behind it
 */

export const FIRST_NAMES = [
  "Ava", "Noah", "Mia", "Liam", "Sofia", "Ethan", "Maya", "Eli", "Aisha", "Lucas",
  "Zoe", "Arjun", "Priya", "Mateo", "Chloe", "Ibrahim", "Layla", "Caleb", "Nina", "Omar",
  "Hana", "Diego", "Ruby", "Kai", "Sara", "Theo", "Yuki", "Marcus", "Elena", "Jonah",
] as const;

export const LAST_NAMES = [
  "Reyes", "Kim", "Patel", "Nguyen", "Garcia", "Chen", "Okafor", "Schwartz", "Ali", "Johnson",
  "Martinez", "Cohen", "Singh", "Brooks", "Hernandez", "Park", "Adams", "Khan", "Rivera", "Lee",
] as const;

/** Income bands with relative volume weight and a baseline conversion rate. */
export interface IncomeBand {
  key: string;
  label: string;
  weight: number;
  conversion: number; // baseline P(deposit | applicant)
}

export const INCOME_BANDS: readonly IncomeBand[] = [
  { key: "lt_80k", label: "<$80K", weight: 18, conversion: 0.06 },
  { key: "80_120k", label: "$80K–120K", weight: 26, conversion: 0.11 },
  { key: "120_160k", label: "$120K–160K", weight: 24, conversion: 0.17 },
  { key: "gte_160k", label: "$160K+", weight: 22, conversion: 0.25 }, // master variable
  { key: "unknown", label: "Unknown", weight: 10, conversion: 0.09 },
];

/** Grades with application-volume weight and a conversion multiplier (K–2 sweet spot). */
export interface GradeBand {
  key: string;
  weight: number;
  convMult: number;
}

export const GRADES: readonly GradeBand[] = [
  { key: "PK", weight: 10, convMult: 0.9 },
  { key: "K", weight: 16, convMult: 1.25 },
  { key: "1", weight: 17, convMult: 1.3 }, // sweet spot
  { key: "2", weight: 15, convMult: 1.25 },
  { key: "3", weight: 11, convMult: 1.05 },
  { key: "4", weight: 9, convMult: 0.95 },
  { key: "5", weight: 8, convMult: 0.9 },
  { key: "6", weight: 6, convMult: 0.8 },
  { key: "7", weight: 5, convMult: 0.75 },
  { key: "8", weight: 4, convMult: 0.7 },
];

/** State + a few cities with representative ZIPs. TX-heavy (home market). */
export interface GeoEntry {
  state: string;
  esaFunded: boolean;
  weight: number;
  cities: ReadonlyArray<readonly [string, string]>; // [city, zip]
}

export const GEO: readonly GeoEntry[] = [
  { state: "TX", esaFunded: true, weight: 46, cities: [["Austin", "78704"], ["Austin", "78745"], ["Georgetown", "78626"], ["Dallas", "75204"], ["Houston", "77005"], ["San Antonio", "78209"]] },
  { state: "AZ", esaFunded: true, weight: 11, cities: [["Phoenix", "85016"], ["Scottsdale", "85251"], ["Mesa", "85201"]] },
  { state: "FL", esaFunded: true, weight: 11, cities: [["Miami", "33133"], ["Orlando", "32801"], ["Tampa", "33606"]] },
  { state: "AR", esaFunded: true, weight: 4, cities: [["Little Rock", "72201"]] },
  { state: "WV", esaFunded: true, weight: 3, cities: [["Charleston", "25301"]] },
  { state: "NH", esaFunded: true, weight: 3, cities: [["Manchester", "03101"]] },
  { state: "NY", esaFunded: false, weight: 11, cities: [["Brooklyn", "11215"], ["New York", "10024"]] },
  { state: "CA", esaFunded: false, weight: 11, cities: [["San Francisco", "94110"], ["Palo Alto", "94301"]] },
];

/** ICP personas (from the GTM strategy's segmentation). */
export const PERSONAS = [
  "bored_boxed_in", // gifted kid stuck in public GT
  "affluent_gifted", // wants in-person peer tribe
  "homeschool_roadschool",
  "operator_entrepreneur",
] as const;

export const ENGAGEMENT_TIERS = [
  { key: "clicked", weight: 22, convMult: 1.8 },
  { key: "opened", weight: 38, convMult: 1.0 },
  { key: "cold", weight: 40, convMult: 0.35 },
] as const;

export const FUNNEL_STAGES = [
  "lead", "applicant", "shadow_day", "deposit", "waitlisted",
] as const;

export const LIFECYCLE_STAGES = [
  "subscriber", "lead", "marketingqualifiedlead", "opportunity", "customer",
] as const;

export const TEFA_STATUSES = ["esa_planned", "esa_ineligible", "no_indicator"] as const;

/** Marketing sources. `null` / garbage values model the KNOWN-broken UTM attribution. */
export const SOURCES = [
  { value: "organic_search", weight: 20 },
  { value: "x_twitter", weight: 16 },
  { value: "referral", weight: 14 },
  { value: "meta_ads", weight: 14 },
  { value: "direct", weight: 12 },
  { value: "newsletter", weight: 10 },
  { value: "(none)", weight: 8 }, // broken attribution
  { value: "utm_campaign={{campaign.name}}", weight: 6 }, // unrendered template = garbage
] as const;

/** The 4 summer campuses (3× two-week, 1× one-week), with capacity. */
export const SUMMER_CAMPUSES = [
  { key: "georgetown", name: "Georgetown", weeks: 2, capacity: 60 },
  { key: "austin", name: "Austin", weeks: 2, capacity: 48 },
  { key: "dallas", name: "Dallas", weeks: 2, capacity: 40 },
  { key: "houston", name: "Houston", weeks: 1, capacity: 30 },
] as const;

/** Tuition anchors from the GTM strategy. */
export const FALL_TUITION = 10400;
export const SUMMER_WEEK_PRICE = 1450;

/** The Hub-owned budget — must reconcile to exactly $365,000. */
export const BUDGET = [
  { key: "grassroots", name: "Grassroots marketing", recommended: 210000 },
  { key: "thought_leadership", name: "Thought leadership + content engine", recommended: 90000 },
  { key: "guerrilla", name: "Guerrilla / earned media bets", recommended: 40000 },
  { key: "foundations", name: "Marketing foundations + operations", recommended: 25000 },
] as const;

export const BUDGET_TOTAL = 365000;

/** The 9 sync'd family fields and their authority (mirrors field_authority seed). */
export const SYNCED_FIELDS = [
  { field: "funnel_stage", authority: "app_form", unreliable: false },
  { field: "tefa_status", authority: "app_form", unreliable: true },
  { field: "income_band", authority: "app_form", unreliable: true },
  { field: "grade", authority: "app_form", unreliable: false },
  { field: "source", authority: "hubspot", unreliable: true },
  { field: "lead_score", authority: "hubspot", unreliable: false },
  { field: "lifecycle_stage", authority: "hubspot", unreliable: false },
  { field: "email", authority: "app_form", unreliable: false },
  { field: "phone", authority: "none", unreliable: false },
] as const;
