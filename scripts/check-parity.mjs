// Sync-parity reconciliation: Supabase app_form (source of truth) vs HubSpot contacts.
// Flags every field where HubSpot disagrees with the truth → this is the data-confidence signal
// the spec's CRM Ops module surfaces. Writes results to public.sync_parity.
// Run: node scripts/check-parity.mjs

import { hs } from './lib/hubspot.mjs'; // loads .env.local + HubSpot token
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const sb = (path, opts = {}) =>
  fetch(`${SB_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });

const FIELDS = ['income_band', 'grade_band']; // funnel fields Supabase owns; HubSpot's copies are unreliable

async function main() {
  // 1) source of truth
  const af = await (await sb('app_form?select=ext_id,email,income_band,grade_band&limit=2000')).json();
  const truth = new Map(af.map((r) => [r.ext_id, r]));

  // 2) HubSpot copies
  const contacts = [];
  let after;
  do {
    const res = await hs('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: {
        filterGroups: [{ filters: [{ propertyName: 'gt_seed_batch', operator: 'EQ', value: 'gt_seed_v1' }] }],
        properties: ['gt_ext_id', 'email', 'gt_income_band', 'gt_grade_band'],
        limit: 100,
        after,
      },
    });
    contacts.push(...res.results);
    after = res.paging?.next?.after;
  } while (after);

  // 3) diff
  const rows = [];
  const orphanHub = [];
  let compared = 0, mismatched = 0;
  for (const c of contacts) {
    const ext = c.properties.gt_ext_id;
    const t = truth.get(ext);
    if (!t) { orphanHub.push(c.properties.email); continue; } // in HubSpot, not in source (e.g. the duplicate)
    for (const f of FIELDS) {
      const sv = t[f] ?? null;
      const hv = c.properties[`gt_${f}`] ?? null;
      const inSync = sv === hv;
      compared++; if (!inSync) mismatched++;
      rows.push({ object_type: 'contact', ext_id: ext, field: f, supabase_value: sv, hubspot_value: hv, in_sync: inSync });
    }
  }

  // 4) persist parity results (clear prior run first)
  await sb('sync_parity?ext_id=neq.__none__', { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  for (let i = 0; i < rows.length; i += 200) {
    await sb('sync_parity', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows.slice(i, i + 200)) });
  }

  // 5) report
  const parity = (compared - mismatched) / compared;
  console.log(`Parity: ${(parity * 100).toFixed(1)}%  (${compared - mismatched}/${compared} field-values agree across ${contacts.length} contacts)\n`);
  for (const f of FIELDS) {
    const fr = rows.filter((r) => r.field === f);
    const ok = fr.filter((r) => r.in_sync).length;
    console.log(`  ${f.padEnd(12)} ${(100 * ok / fr.length).toFixed(1)}%  (${fr.length - ok} disagree)`);
  }
  console.log('\nFlagged conflicts (Supabase truth ≠ HubSpot copy):');
  for (const r of rows.filter((r) => !r.in_sync)) console.log(`  ${r.ext_id}  ${r.field}: truth=${r.supabase_value}  hubspot=${r.hubspot_value}`);
  console.log(`\nHubSpot-only contacts (no source row — the seeded duplicate): ${orphanHub.length} ${JSON.stringify(orphanHub.slice(0, 3))}`);
  const thr = Number(env.PARITY_THRESHOLD || 0.95);
  console.log(`\nData-confidence: overall ${(parity * 100).toFixed(1)}% vs ${(thr * 100).toFixed(0)}% threshold → ${parity < thr ? '⚠ BANNER ON' : 'ok'}.  (income_band is flagged UNRELIABLE regardless — spec rule.)`);
}

main().catch((e) => { console.error('parity failed:', e.message); process.exit(1); });
