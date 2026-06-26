// Phase-1 payment propagation service.
// payment (Stripe) → webhook → idempotency ledger → CORRECT isolated program store → HubSpot deal.
// Run:  node scripts/stripe-service.mjs        (then: stripe listen --forward-to localhost:4242/webhooks/stripe)

import http from 'node:http';
import { verifyEvent } from './lib/stripe.mjs';
import { q, qProgram, esc } from './lib/db.mjs';
import { hs } from './lib/hubspot.mjs';

const PORT = 4242;

async function handleEvent(event) {
  const type = event.type;
  if (type !== 'payment_intent.succeeded' && type !== 'payment_intent.payment_failed') {
    return { status: 'ignored', note: `unhandled ${type}` };
  }
  const pi = event.data.object;
  const { ext_id, program, hubspot_deal_id } = pi.metadata || {};

  // idempotency: claim this event id exactly once (duplicate webhook deliveries are no-ops)
  const claimed = q(
    `insert into webhook_events (id, source, type, payload, status)
     values (${esc(event.id)}, 'stripe', ${esc(type)}, ${esc(JSON.stringify(event))}::jsonb, 'received')
     on conflict (id) do nothing returning id`
  );
  if (claimed.length === 0) return { status: 'duplicate', note: `event ${event.id} already processed` };

  try {
    if (type === 'payment_intent.payment_failed') {
      q(`update webhook_events set processed_at=now(), status='payment_failed' where id=${esc(event.id)}`);
      return { status: 'payment_failed', ext_id, program };
    }

    // write into the CORRECT program store — role-scoped, so a mis-routed payment is denied by Postgres
    const table = program === 'summer_camp' ? 'summer.registrations' : 'fall.enrollments';
    const stripeCol = program === 'summer_camp' ? 'stripe_session_id' : 'stripe_payment_intent';
    const updated = qProgram(program,
      `update ${table} set stage='paid', ${stripeCol}=${esc(pi.id)}, paid_at=now() where ext_id=${esc(ext_id)} returning id`);
    if (updated.length === 0) throw new Error(`no ${program} record for ext_id ${ext_id}`);

    // propagate to the CRM (deal → paid / closedwon)
    let hubspotOk = false;
    if (hubspot_deal_id) {
      await hs(`/crm/v3/objects/deals/${hubspot_deal_id}`, { method: 'PATCH', body: { properties: { gt_stage: 'paid', dealstage: 'closedwon' } } });
      hubspotOk = true;
    }

    q(`update webhook_events set processed_at=now(), status='processed' where id=${esc(event.id)}`);
    return { status: 'processed', program, ext_id, program_row: updated[0][0], hubspotOk };
  } catch (e) {
    q(`update webhook_events set processed_at=now(), status='error' where id=${esc(event.id)}`);
    throw e;
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    const n = q(`select count(*) from webhook_events`)[0]?.[0] ?? '0';
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, processed_events: Number(n) }));
    return;
  }
  if (req.method === 'POST' && req.url === '/webhooks/stripe') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let event;
      try {
        event = verifyEvent(raw, req.headers['stripe-signature']);
      } catch (e) {
        console.log(`[webhook] signature rejected: ${e.message}`);
        res.writeHead(400); res.end(`signature error: ${e.message}`);
        return;
      }
      try {
        const result = await handleEvent(event);
        console.log(`[webhook] ${event.type} ${event.id} → ${result.status}${result.program ? ` (${result.program} ${result.ext_id})` : ''}`);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        console.error(`[webhook] ${event.id} ERROR: ${e.message}`);
        res.writeHead(500); res.end(e.message);
      }
    });
    return;
  }
  res.writeHead(404); res.end('not found');
});

server.listen(PORT, () => console.log(`stripe-service on http://localhost:${PORT}  → POST /webhooks/stripe`));
