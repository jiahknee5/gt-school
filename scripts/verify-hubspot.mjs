#!/usr/bin/env node
// Verify the HubSpot private-app token in .env.local actually works.
// Zero dependencies — uses Node 18+ global fetch.
// Run:  node scripts/verify-hubspot.mjs   (add VERBOSE=1 to see error bodies)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Minimal .env.local parser so we don't need the dotenv package yet.
function loadEnv(file) {
  let txt;
  try {
    txt = readFileSync(join(root, file), 'utf8');
  } catch {
    return;
  }
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

loadEnv('.env.local');

const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
if (!token || token.includes('paste-')) {
  console.error('✗ HUBSPOT_PRIVATE_APP_TOKEN is not set in .env.local');
  console.error('  Create a Private App in HubSpot, copy its token, paste it into .env.local, re-run.');
  process.exit(1);
}
if (!token.startsWith('pat-')) {
  console.error(`✗ Token does not look like a private-app token (should start with "pat-"). Got: ${token.slice(0, 8)}…`);
  process.exit(1);
}

const headers = { Authorization: `Bearer ${token}` };
let failed = 0;

async function check(label, url, scopeHint) {
  try {
    const res = await fetch(url, { headers });
    if (res.ok) {
      console.log(`✓ ${label}`);
      return await res.json();
    }
    failed++;
    console.log(`✗ ${label} — HTTP ${res.status}`);
    if (res.status === 401) console.log('    401 = bad or expired token.');
    if (res.status === 403) console.log(`    403 = missing scope. ${scopeHint || ''}`);
    if (process.env.VERBOSE) console.log('    ' + (await res.text()).slice(0, 300));
    return null;
  } catch (e) {
    failed++;
    console.log(`✗ ${label} — ${e.message}`);
    return null;
  }
}

console.log('Verifying HubSpot connection…\n');

const acct = await check('Auth + account access', 'https://api.hubapi.com/account-info/v3/details');
if (acct) console.log(`    portal ${acct.portalId} · ${acct.accountType} · ${acct.timeZone}`);
await check('Read contacts', 'https://api.hubapi.com/crm/v3/objects/contacts?limit=1', 'Enable crm.objects.contacts.read');
await check('Read deals', 'https://api.hubapi.com/crm/v3/objects/deals?limit=1', 'Enable crm.objects.deals.read');

console.log('');
if (failed === 0) {
  console.log('All checks passed — HubSpot is connected. 🎉');
} else {
  console.log(`${failed} check(s) failed. Fix scopes/token in the Private App, then re-run.`);
  process.exit(1);
}
