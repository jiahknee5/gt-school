// Deterministic generator for realistic GT School marketing data.
// Seeded (mulberry32) so re-runs produce identical data — brief: "make it reproducible."
// Grounded in researched GT facts: GT Anywhere $10,400 (TEFA $10,474 → $0 in TX),
// Georgetown flagship $25,000, 4 real summer campuses, real channel mix, CogAT ~90th bar.

export const SEED_TAG = 'gt_seed_v1';

// ---------- seeded PRNG ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rnd = mulberry32(0x6750_4c00); // "GTL"
const rand = () => rnd();
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
const intBetween = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
function weighted(pairs) {
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = rand() * total;
  for (const [v, w] of pairs) if ((r -= w) < 0) return v;
  return pairs[pairs.length - 1][0];
}

// ---------- enum option vocab (single source for both property defs and values) ----------
const OPT = {
  program_interest: ['fall_anywhere', 'summer_camp', 'both', 'flagship'],
  tier: ['T1', 'T2', 'T3'],
  t3_bucket: ['esa_planned', 'esa_ineligible', 'no_indicator'],
  income_band: ['under_65k', '65k_160k', 'over_160k'],
  geo: ['tx', 'out_of_state'],
  grade_band: ['k_2', '3_5', '6_8', '9_12'],
  persona: ['bored_boxed_in', 'affluent_gifted', 'homeschool_gifted', 'undetermined'],
  engagement_tier: ['clicked', 'opened', 'cold'],
  utm_source: ['x_twitter', 'facebook', 'instagram', 'substack', 'podcast', 'email', 'referral', 'gifted_community', 'organic', 'esa_navigator'],
  yes_no_unknown: ['yes', 'no', 'unknown'],
  yes_no: ['yes', 'no'],
  esa_status: ['planned', 'approved', 'ineligible', 'none'],
  deal_program: ['fall_anywhere', 'summer_camp', 'flagship'],
  deal_stage: ['lead', 'applicant', 'shadow_day', 'deposit', 'registered_unpaid', 'paid', 'attended'],
  campus: ['austin', 'dallas', 'raleigh', 'houston'],
  esa_covered: ['yes', 'no', 'partial'],
};

// ---------- HubSpot property definitions ----------
const enumProp = (name, label, key) => ({ name, label, type: 'enumeration', fieldType: 'select', options: OPT[key] });
const strProp = (name, label) => ({ name, label, type: 'string', fieldType: 'text' });
const numProp = (name, label) => ({ name, label, type: 'number', fieldType: 'number' });

export const CONTACT_PROPERTIES = [
  strProp('gt_ext_id', 'GT Ext ID'),
  strProp('gt_seed_batch', 'GT Seed Batch'),
  enumProp('gt_program_interest', 'GT Program Interest', 'program_interest'),
  enumProp('gt_tier', 'GT Tier', 'tier'),
  enumProp('gt_t3_bucket', 'GT T3 Bucket', 't3_bucket'),
  enumProp('gt_income_band', 'GT Income Band (HubSpot — unreliable)', 'income_band'),
  enumProp('gt_geo', 'GT Geo', 'geo'),
  strProp('gt_state', 'GT State'),
  enumProp('gt_grade_band', 'GT Grade Band', 'grade_band'),
  enumProp('gt_persona', 'GT Persona', 'persona'),
  enumProp('gt_engagement_tier', 'GT Engagement Tier', 'engagement_tier'),
  numProp('gt_lead_score', 'GT Lead Score'),
  enumProp('gt_utm_source', 'GT UTM Source', 'utm_source'),
  enumProp('gt_follows_alpha_on_x', 'GT Follows Alpha on X', 'yes_no_unknown'),
  enumProp('gt_esa_status', 'GT ESA Status', 'esa_status'),
  enumProp('gt_ambassador_flag', 'GT Ambassador Flag', 'yes_no'),
  strProp('gt_child_first_name', 'GT Child First Name'),
  strProp('gt_child_grade', 'GT Child Grade'),
  strProp('gt_assigned_rep', 'GT Assigned Rep'),
  strProp('gt_data_note', 'GT Data Note (edge-case marker)'),
];

export const DEAL_PROPERTIES = [
  strProp('gt_ext_id', 'GT Ext ID'),
  strProp('gt_seed_batch', 'GT Seed Batch'),
  enumProp('gt_program', 'GT Program', 'deal_program'),
  enumProp('gt_stage', 'GT Funnel Stage', 'deal_stage'),
  enumProp('gt_campus', 'GT Camp Campus', 'campus'),
  numProp('gt_session_weeks', 'GT Session Weeks'),
  enumProp('gt_esa_covered', 'GT ESA Covered', 'esa_covered'),
  strProp('gt_data_note', 'GT Data Note (edge-case marker)'),
];

// ---------- name + place pools (TX-weighted, diverse) ----------
const LAST = ['Garcia', 'Martinez', 'Nguyen', 'Patel', 'Smith', 'Johnson', 'Williams', 'Rodriguez', 'Hernandez', 'Lopez', 'Lee', 'Kim', 'Chen', 'Davis', 'Miller', 'Wilson', 'Anderson', 'Thomas', 'Reyes', 'Flores', 'Gonzalez', 'Ramirez', 'Torres', 'Brooks', 'Khan', 'Shah', 'Cohen', 'Murphy', 'Okafor', 'Adeyemi', 'Singh', 'Wang', 'Park', 'Vasquez', 'Castillo', 'Mendoza', 'Nair', 'Iyer', 'Tran', 'Le'];
const PARENT = ['Jennifer', 'David', 'Maria', 'Michael', 'Ashley', 'Christopher', 'Jessica', 'Daniel', 'Amanda', 'Priya', 'Wei', 'Sarah', 'Brian', 'Nicole', 'Carlos', 'Emily', 'Kevin', 'Stephanie', 'Andrew', 'Aisha', 'Rahul', 'Lauren', 'Patrick', 'Megan', 'Juan', 'Rachel', 'Anthony', 'Elena', 'Marcus', 'Deepa'];
const CHILD = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Sophia', 'Mateo', 'Isabella', 'Lucas', 'Mia', 'Aiden', 'Maya', 'Ethan', 'Zoe', 'Leo', 'Aria', 'Caleb', 'Nina', 'Diego', 'Layla', 'Arjun', 'Hana', 'Sofia', 'Eli', 'Ivy', 'Owen', 'Anaya', 'Theo', 'Lucia', 'Dev'];
const REPS = ['Marisol Reyes', 'Tyler Brooks', 'Priya Raman', 'Jordan Webb'];

const TX_CITIES = [['Austin', 'TX'], ['Georgetown', 'TX'], ['Houston', 'TX'], ['Dallas', 'TX'], ['San Antonio', 'TX'], ['Fort Worth', 'TX'], ['Round Rock', 'TX'], ['Plano', 'TX'], ['Frisco', 'TX'], ['Keller', 'TX']];
// out-of-state weighted toward funded-ESA states, with a value-market tail (NY/CA/etc.)
const OOS_CITIES = [['Phoenix', 'AZ'], ['Scottsdale', 'AZ'], ['Miami', 'FL'], ['Orlando', 'FL'], ['Tampa', 'FL'], ['Little Rock', 'AR'], ['Charleston', 'WV'], ['Des Moines', 'IA'], ['Salt Lake City', 'UT'], ['Nashville', 'TN'], ['Indianapolis', 'IN'], ['Boise', 'ID'], ['New York', 'NY'], ['Brooklyn', 'NY'], ['Los Angeles', 'CA'], ['San Francisco', 'CA'], ['Chicago', 'IL'], ['Seattle', 'WA'], ['Denver', 'CO'], ['Boston', 'MA']];

const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const mojibake = (s) => s.replace(/é/g, 'Ã©').replace(/í/g, 'Ã­').replace(/ñ/g, 'Ã±').replace(/ü/g, 'Ã¼').replace(/á/g, 'Ã¡');

// grade-band → a concrete grade label
function gradeLabel(band) {
  return { k_2: pick(['K', '1', '2']), '3_5': pick(['3', '4', '5']), '6_8': pick(['6', '7', '8']), '9_12': pick(['9', '10', '11']) }[band];
}

// conversion propensity — encodes the spec's insights (income is master var, engagement top predictor,
// "follows Alpha on X" tell, K-2 sweet spot, 9-12 dead grades)
function propensity(f) {
  let p = 0.12;
  p += { under_65k: 0.04, '65k_160k': 0.12, over_160k: 0.25 }[f.income_band];
  p += { clicked: 0.25, opened: 0.10, cold: 0.0 }[f.engagement_tier];
  if (f.follows_alpha_on_x === 'yes') p += 0.15;
  p += { k_2: 0.10, '3_5': 0.04, '6_8': 0.0, '9_12': -0.30 }[f.grade_band];
  if (f.persona === 'affluent_gifted') p += 0.06;
  if (f.esa_status === 'approved') p += 0.08;
  // channel quality: X is the conversion engine, Facebook is a volume trap (spec insight)
  p += ({ x_twitter: 0.18, referral: 0.10, esa_navigator: 0.08, gifted_community: 0.06, substack: 0.05, podcast: 0.05, email: 0.02, organic: 0, instagram: -0.02, facebook: -0.10 }[f.utm_source]) || 0;
  return Math.max(0.01, Math.min(0.95, p + (rand() - 0.5) * 0.1));
}

const isoMs = (y, m, d) => String(Date.UTC(y, m - 1, d));

// ---------- summer campus config (from live research of summer.gt.school) ----------
const CAMPUSES = [
  { key: 'austin', weeks: 2, weight: 4 },
  { key: 'dallas', weeks: 2, weight: 3 },
  { key: 'raleigh', weeks: 2, weight: 3 },
  { key: 'houston', weeks: 1, weight: 2 }, // Week 2 only
];

export function generate({ count = 300 } = {}) {
  rnd = mulberry32(0x6750_4c00); // reset for determinism each call
  const families = [];
  const deals = [];
  let dealSeq = 0;

  for (let i = 0; i < count; i++) {
    const geo = weighted([['tx', 0.5], ['out_of_state', 0.5]]);
    const [city, state] = geo === 'tx' ? pick(TX_CITIES) : pick(OOS_CITIES);
    const income = weighted([['under_65k', 0.2], ['65k_160k', 0.45], ['over_160k', 0.35]]);
    const grade_band = weighted([['k_2', 0.4], ['3_5', 0.3], ['6_8', 0.22], ['9_12', 0.08]]);
    const persona = weighted([['bored_boxed_in', 0.45], ['homeschool_gifted', 0.25], ['affluent_gifted', 0.2], ['undetermined', 0.1]]);
    const engagement_tier = weighted([['clicked', 0.3], ['opened', 0.4], ['cold', 0.3]]);
    const follows_alpha_on_x = weighted([['yes', 0.15], ['no', 0.6], ['unknown', 0.25]]);
    const utm_source = weighted([['x_twitter', 0.16], ['facebook', 0.22], ['instagram', 0.08], ['substack', 0.09], ['podcast', 0.05], ['email', 0.1], ['referral', 0.1], ['gifted_community', 0.07], ['organic', 0.08], ['esa_navigator', 0.05]]);
    const tier = weighted([['T1', 0.03], ['T2', 0.6], ['T3', 0.37]]);

    // ESA status reflects TEFA priority tiers: TX high-income (~$160k, ≥500% FPL) is deprioritized.
    let esa_status;
    if (geo === 'tx') {
      esa_status = income === 'over_160k'
        ? weighted([['ineligible', 0.45], ['planned', 0.35], ['approved', 0.2]])
        : weighted([['approved', 0.45], ['planned', 0.4], ['ineligible', 0.05], ['none', 0.1]]);
    } else {
      // funded-ESA out-of-state vs non-ESA value markets
      esa_status = ['AZ', 'FL', 'AR', 'WV', 'IA', 'UT', 'TN', 'IN', 'ID'].includes(state)
        ? weighted([['planned', 0.5], ['approved', 0.2], ['ineligible', 0.1], ['none', 0.2]])
        : 'none';
    }

    const firstRaw = pick(PARENT);
    const lastRaw = pick(LAST);
    const childRaw = pick(CHILD);
    const f = {
      extId: `fam_${String(i).padStart(4, '0')}`,
      first: firstRaw, last: lastRaw, child: childRaw,
      email: `${stripAccents(firstRaw).toLowerCase()}.${stripAccents(lastRaw).toLowerCase()}${i}@example.com`,
      phone: `(512) ${intBetween(200, 989)}-${String(intBetween(0, 9999)).padStart(4, '0')}`,
      city, state, geo, income_band: income, grade_band, persona, engagement_tier,
      follows_alpha_on_x, utm_source, tier, esa_status,
      t3_bucket: tier === 'T3' ? weighted([['esa_planned', 0.4], ['esa_ineligible', 0.3], ['no_indicator', 0.3]]) : null,
      ambassador: chance(0.12) ? 'yes' : 'no',
      rep: tier === 'T2' ? REPS[i % REPS.length] : '',
      note: [],
    };
    f.score = Math.round(propensity(f) * 100);

    // program interest: most are Fall; affluent skew flagship; some summer; some both
    f.program_interest = weighted([
      ['fall_anywhere', 0.5],
      ['both', 0.18],
      ['summer_camp', 0.17],
      ['flagship', f.persona === 'affluent_gifted' ? 0.25 : 0.08],
    ]);
    families.push(f);
  }

  // ---------- deterministic edge cases (Phase 1 is graded on these) ----------
  const note = (f, t) => f.note.push(t);
  // intentional income conflict: HubSpot field wrong vs the "truth" (Supabase will hold truth)
  for (const idx of [7, 23, 51, 88, 140, 199, 256]) {
    const f = families[idx]; if (!f) continue;
    const truth = f.income_band; const others = OPT.income_band.filter((b) => b !== truth);
    f.income_band = pick(others); note(f, `income_conflict:true=${truth}`);
  }
  // mojibake in names (encoding bug to prove your pipeline survives it)
  for (const idx of [12, 64, 175, 220]) {
    const f = families[idx]; if (!f) continue;
    f.first = mojibake(f.first === stripAccents(f.first) ? 'José' : f.first);
    f.last = mojibake('Muñoz'); note(f, 'mojibake');
  }
  // missing fields (sparse records)
  for (const idx of [34, 102, 188, 244, 290]) {
    const f = families[idx]; if (!f) continue;
    f.income_band = null; f.grade_band = null; f.persona = null; note(f, 'missing_fields');
  }
  // force at least a dozen cross-program families (in BOTH Fall and Summer)
  for (let k = 0; k < 14; k++) {
    const f = families[k * 17 % families.length];
    if (f) { f.program_interest = 'both'; note(f, 'in_both_programs'); }
  }
  // parity-drift markers (lead score stale vs CRM) — flips the data-confidence banner
  for (const idx of [5, 60, 130, 210]) {
    const f = families[idx]; if (!f) continue; note(f, 'parity_drift');
  }

  // ---------- deals ----------
  const newDeal = (f, program, stage, props, name, amount, closeMs) => {
    deals.push({
      extId: `deal_${String(dealSeq++).padStart(4, '0')}`,
      familyExtId: f.extId, program, stage, name, amount: String(amount),
      closedateMs: closeMs, props: { ...props, gt_data_note: f.note.join('|') || '' },
    });
  };

  for (const f of families) {
    const wantFall = f.program_interest === 'fall_anywhere' || f.program_interest === 'both';
    const wantFlagship = f.program_interest === 'flagship';
    const wantSummer = f.program_interest === 'summer_camp' || f.program_interest === 'both';

    if (wantFall || wantFlagship) {
      const p = f.score / 100;
      const prog = Math.min(0.99, p + (rand() - 0.30) * 0.30);
      const stage = prog < 0.30 ? 'lead' : prog < 0.52 ? 'applicant' : prog < 0.68 ? 'shadow_day' : 'deposit';
      const flagship = wantFlagship;
      const tuition = flagship ? 25000 : 10400;
      const esaCovered = !flagship && f.geo === 'tx' && (f.esa_status === 'approved' || f.esa_status === 'planned') ? 'yes' : flagship ? 'no' : 'partial';
      // deposit is the $1,000 non-refundable; tuition is net-of-ESA where covered
      const amount = stage === 'deposit' ? (esaCovered === 'yes' ? 1000 : tuition) : tuition;
      const closeMs = stage === 'deposit' ? isoMs(2026, intBetween(4, 6), intBetween(1, 28)) : isoMs(2026, 8, 17);
      newDeal(f, flagship ? 'flagship' : 'fall_anywhere', stage, {
        gt_program: flagship ? 'flagship' : 'fall_anywhere',
        gt_stage: stage, gt_esa_covered: esaCovered,
      }, `${f.first} ${f.last} — ${flagship ? 'Georgetown Flagship' : 'GT Anywhere Fall'}`, amount, closeMs);
    }

    if (wantSummer) {
      const campus = weighted(CAMPUSES.map((c) => [c, c.weight]));
      const bothWeeks = campus.weeks === 2 && chance(0.55);
      const weeks = campus.weeks === 1 ? 1 : bothWeeks ? 2 : 1;
      const amount = weeks === 2 ? 1400 : 750;
      const stage = weighted([['lead', 0.2], ['registered_unpaid', 0.3], ['paid', 0.48], ['attended', 0.02]]);
      const closeMs = stage === 'paid' || stage === 'attended' ? isoMs(2026, intBetween(5, 6), intBetween(1, 25)) : isoMs(2026, 7, 13);
      newDeal(f, 'summer_camp', stage, {
        gt_program: 'summer_camp', gt_stage: stage, gt_campus: campus.key,
        gt_session_weeks: weeks, gt_esa_covered: 'no',
      }, `${f.child} ${f.last} — Summer ${campus.key[0].toUpperCase() + campus.key.slice(1)} (${weeks}wk)`, amount, closeMs);
    }
  }

  // duplicate contact (same family, second email) — the dedup/reconciliation test
  const dupSrc = families[42];
  const dup = {
    ...dupSrc,
    extId: 'fam_dup_0042',
    email: `${stripAccents(dupSrc.first).toLowerCase()}.${stripAccents(dupSrc.last).toLowerCase()}.home@example.com`,
    note: [`duplicate_of:${dupSrc.email}`],
  };
  families.push(dup);

  return { families, deals, summary: summarize(families, deals) };
}

function summarize(families, deals) {
  const tally = (arr, key) => arr.reduce((m, x) => ((m[x[key]] = (m[x[key]] || 0) + 1), m), {});
  const dealStage = tally(deals.filter((d) => d.program !== 'summer_camp'), 'stage');
  const summerStage = tally(deals.filter((d) => d.program === 'summer_camp'), 'stage');
  const edge = families.flatMap((f) => f.note).reduce((m, n) => ((m[n.split(':')[0]] = (m[n.split(':')[0]] || 0) + 1), m), {});
  return {
    families: families.length,
    deals: deals.length,
    fallDeposits: dealStage.deposit || 0,
    program: tally(families, 'program_interest'),
    income: tally(families, 'income_band'),
    engagement: tally(families, 'engagement_tier'),
    fallFunnel: dealStage,
    summerFunnel: summerStage,
    edgeCases: edge,
  };
}
