// Minimal Stripe client (no stripe SDK): form-encoded API calls + webhook signature verify.
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SECRET = env.STRIPE_SECRET_KEY;
export const WEBHOOK_SECRET = env.STRIPE_WEBHOOK_SECRET;
const BASE = 'https://api.stripe.com';

// flatten nested object into Stripe's bracketed form encoding (metadata[ext_id]=…)
function formEncode(obj, prefix = '', acc = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object' && !Array.isArray(v)) formEncode(v, key, acc);
    else acc.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return acc;
}

async function stripe(path, params) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formEncode(params).join('&'),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Stripe ${path} ${res.status}: ${json.error?.message || ''}`);
  return json;
}

// create + confirm a PaymentIntent server-side (no browser) with test card; metadata drives propagation.
export function createAndConfirmPayment({ amount_cents, metadata, decline = false }) {
  return stripe('/v1/payment_intents', {
    amount: amount_cents,
    currency: 'usd',
    confirm: 'true',
    payment_method: decline ? 'pm_card_visa_chargeDeclined' : 'pm_card_visa',
    automatic_payment_methods: { enabled: 'true', allow_redirects: 'never' },
    description: `GT ${metadata.program} — ${metadata.ext_id}`,
    metadata,
  });
}

// verify the Stripe-Signature header (t=…,v1=…) against the raw request body
export function verifyEvent(rawBody, sigHeader, tolerance = 300) {
  const parts = Object.fromEntries((sigHeader || '').split(',').map((p) => p.split('=')));
  if (!parts.t || !parts.v1) throw new Error('missing signature parts');
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(`${parts.t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected); const b = Buffer.from(parts.v1);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('signature mismatch');
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(parts.t)) > tolerance) throw new Error('timestamp outside tolerance');
  return JSON.parse(rawBody);
}

// sign a synthetic payload — used by the local self-test to exercise the handler without Stripe CLI
export function signPayload(rawBody, t) {
  const ts = t || Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(`${ts}.${rawBody}`).digest('hex');
  return `t=${ts},v1=${sig}`;
}
