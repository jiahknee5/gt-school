// Drive a real test-mode payment for a seeded enrollment/registration, so the webhook propagates it.
// Resolves the program + amount + HubSpot deal for an ext_id, then creates+confirms a PaymentIntent.
// Run:  node scripts/pay.mjs <deal_ext_id> [--decline]
//   --decline uses a card that fails → exercises the payment_failed path.

import { createAndConfirmPayment } from './lib/stripe.mjs';
import { qAdmin, esc } from './lib/db.mjs';
import { hs } from './lib/hubspot.mjs';

const extId = process.argv[2];
const decline = process.argv.includes('--decline');
if (!extId) { console.error('usage: node scripts/pay.mjs <deal_ext_id> [--decline]'); process.exit(1); }

// 1) which program + how much? (dev lookup via admin connection — not the request path)
const rows = qAdmin(
  `select 'summer_camp' as program, amount_cents, stage from summer.registrations where ext_id=${esc(extId)}
   union all
   select 'fall_anywhere', amount_cents, stage from fall.enrollments where ext_id=${esc(extId)}`
);
if (rows.length === 0) { console.error(`No program record for ext_id ${extId}`); process.exit(1); }
const [program, amount_cents, stage] = rows[0];

// 2) resolve the HubSpot deal id by its gt_ext_id
const search = await hs('/crm/v3/objects/deals/search', {
  method: 'POST',
  body: { filterGroups: [{ filters: [{ propertyName: 'gt_ext_id', operator: 'EQ', value: extId }] }], properties: ['gt_ext_id'], limit: 1 },
});
const hubspot_deal_id = search.results[0]?.id || null;

console.log(`Paying ${program} record ${extId} (currently '${stage}') — $${(amount_cents / 100).toFixed(2)} → HubSpot deal ${hubspot_deal_id || '(none)'}`);

// 3) create + confirm the payment; the webhook does the propagation
try {
  const pi = await createAndConfirmPayment({
    amount_cents: Number(amount_cents),
    metadata: { ext_id: extId, program, hubspot_deal_id },
    decline,
  });
  console.log(`PaymentIntent ${pi.id} → ${pi.status}`);
  console.log('Watch the service log for the propagation.');
} catch (e) {
  if (decline) {
    console.log(`Declined as expected: ${e.message}`);
    console.log('Stripe will still emit payment_intent.payment_failed — watch the service log.');
  } else throw e;
}
