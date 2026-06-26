// Seed the HubSpot portal with realistic GT School families (contacts) + enrollments (deals).
// Idempotent-ish: every record carries gt_seed_batch=gt_seed_v1 so reset-hubspot.mjs can wipe it.
// Run:  node scripts/seed-hubspot.mjs [count]   (default 300 families)

import { ensureGroup, ensureProperty, batchCreate, associateDefault } from './lib/hubspot.mjs';
import { generate, SEED_TAG, CONTACT_PROPERTIES, DEAL_PROPERTIES } from './lib/data-model.mjs';

const GROUP = 'gt_marketing_hub';
const count = Number(process.argv[2]) || 300;

function contactInput(f) {
  const p = {
    gt_ext_id: f.extId,
    gt_seed_batch: SEED_TAG,
    email: f.email,
    firstname: f.first,
    lastname: f.last,
    city: f.city,
    state: f.state,
    phone: f.phone,
    gt_program_interest: f.program_interest,
    gt_tier: f.tier,
    gt_geo: f.geo,
    gt_state: f.state,
    gt_engagement_tier: f.engagement_tier,
    gt_lead_score: f.score,
    gt_utm_source: f.utm_source,
    gt_follows_alpha_on_x: f.follows_alpha_on_x,
    gt_esa_status: f.esa_status,
    gt_ambassador_flag: f.ambassador,
    gt_child_first_name: f.child,
    gt_assigned_rep: f.rep,
    gt_data_note: f.note.join('|'),
  };
  // optional / may be intentionally missing (edge cases) — only set when present
  if (f.income_band) p.gt_income_band = f.income_band;
  if (f.grade_band) { p.gt_grade_band = f.grade_band; p.gt_child_grade = gradeFromBand(f.grade_band); }
  if (f.persona) p.gt_persona = f.persona;
  if (f.t3_bucket) p.gt_t3_bucket = f.t3_bucket;
  // strip empties so we don't write '' into enum props
  for (const k of Object.keys(p)) if (p[k] === '' || p[k] == null) delete p[k];
  return p;
}

function gradeFromBand(b) {
  return { k_2: 'K-2', '3_5': '3-5', '6_8': '6-8', '9_12': '9-12' }[b];
}

function dealInput(d) {
  const p = {
    gt_ext_id: d.extId,
    gt_seed_batch: SEED_TAG,
    dealname: d.name,
    amount: d.amount,
    pipeline: 'default',
    dealstage: mapStage(d.stage),
    closedate: d.closedateMs,
    ...d.props,
  };
  for (const k of Object.keys(p)) if (p[k] === '' || p[k] == null) delete p[k];
  return p;
}

// Free/STANDARD portal has one deal pipeline; we carry the true funnel stage in gt_stage and
// map onto the default pipeline's native stages so the native board isn't nonsense.
function mapStage(stage) {
  return {
    lead: 'appointmentscheduled',
    applicant: 'qualifiedtobuy',
    shadow_day: 'presentationscheduled',
    deposit: 'closedwon',
    registered_unpaid: 'qualifiedtobuy',
    paid: 'closedwon',
    attended: 'closedwon',
  }[stage];
}

async function main() {
  console.log(`Seeding HubSpot with ${count} families…\n`);

  console.log('1/5  Ensuring property groups + custom properties…');
  await ensureGroup('contacts', GROUP, 'GT Marketing Hub');
  await ensureGroup('deals', GROUP, 'GT Marketing Hub');
  let made = 0;
  for (const def of CONTACT_PROPERTIES) if ((await ensureProperty('contacts', def, GROUP)) === 'created') made++;
  for (const def of DEAL_PROPERTIES) if ((await ensureProperty('deals', def, GROUP)) === 'created') made++;
  console.log(`     ${made} new properties created (rest already existed).`);

  console.log('2/5  Generating deterministic dataset…');
  const { families, deals, summary } = generate({ count });

  console.log('3/5  Creating contacts…');
  const contacts = await batchCreate('contacts', families.map(contactInput));
  const idByExt = new Map(contacts.map((c) => [c.properties.gt_ext_id, c.id]));
  console.log(`     ${contacts.length} contacts created.`);

  console.log('4/5  Creating deals…');
  const createdDeals = await batchCreate('deals', deals.map(dealInput));
  const dealIdByExt = new Map(createdDeals.map((d) => [d.properties.gt_ext_id, d.id]));
  console.log(`     ${createdDeals.length} deals created.`);

  console.log('5/5  Associating deals → contacts…');
  const pairs = deals
    .map((d) => ({ fromId: dealIdByExt.get(d.extId), toId: idByExt.get(d.familyExtId) }))
    .filter((x) => x.fromId && x.toId);
  const assoc = await associateDefault('deals', 'contacts', pairs);
  console.log(`     ${assoc.ok} associations created${assoc.failed ? `, ${assoc.failed} failed` : ''}.`);

  console.log('\n── Seed summary ─────────────────────────────');
  console.log(`Families: ${summary.families}   Deals: ${summary.deals}   Fall deposits: ${summary.fallDeposits} / 180 goal`);
  console.log('Program interest:', summary.program);
  console.log('Income band:     ', summary.income);
  console.log('Engagement:      ', summary.engagement);
  console.log('Fall funnel:     ', summary.fallFunnel);
  console.log('Summer funnel:   ', summary.summerFunnel);
  console.log('Edge cases:      ', summary.edgeCases);
  console.log('\nDone. Reset anytime with: node scripts/reset-hubspot.mjs');
}

main().catch((e) => {
  console.error('\n✗ Seed failed:', e.message);
  if (e.body) console.error(JSON.stringify(e.body, null, 2).slice(0, 800));
  process.exit(1);
});
