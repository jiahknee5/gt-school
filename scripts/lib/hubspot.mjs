// Thin HubSpot CRM v3/v4 client for the GT Marketing Hub seed tooling.
// Zero dependencies — Node 18+ global fetch. Reads the private-app token from .env.local.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = 'https://api.hubapi.com';

// --- minimal .env.local loader (no dotenv dependency) ---
export function loadEnv(file = '.env.local') {
  let txt;
  try {
    txt = readFileSync(join(ROOT, file), 'utf8');
  } catch {
    return;
  }
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

loadEnv();

const TOKEN = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
if (!TOKEN || !TOKEN.startsWith('pat-')) {
  console.error('✗ HUBSPOT_PRIVATE_APP_TOKEN missing/invalid in .env.local — run scripts/verify-hubspot.mjs first.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Core request with retry on 429 (rate limit) and 5xx.
export async function hs(path, { method = 'GET', body, retries = 5 } = {}) {
  const url = path.startsWith('http') ? path : BASE + path;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= retries) throw new Error(`${method} ${path} → ${res.status} after ${retries} retries`);
      const wait = Number(res.headers.get('Retry-After')) * 1000 || (attempt + 1) * 1500;
      await sleep(wait);
      continue;
    }
    const text = await res.text();
    let json = null;
    if (text) {
      try { json = JSON.parse(text); } catch { /* non-JSON body (e.g. an HTML error page) */ }
    }
    if (!res.ok) {
      const msg = json?.message || (text || '').slice(0, 200) || res.statusText;
      const err = new Error(`${method} ${path} → ${res.status}: ${msg}`);
      err.status = res.status;
      err.body = json || text;
      throw err;
    }
    return json;
  }
}

// --- property + group management (idempotent) ---
export async function ensureGroup(objectType, name, label) {
  try {
    await hs(`/crm/v3/properties/${objectType}/groups/${name}`);
  } catch (e) {
    if (e.status === 404) await hs(`/crm/v3/properties/${objectType}/groups`, { method: 'POST', body: { name, label, displayOrder: -1 } });
    else throw e;
  }
}

export async function ensureProperty(objectType, def, groupName) {
  try {
    await hs(`/crm/v3/properties/${objectType}/${def.name}`);
    return 'exists';
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  const body = {
    name: def.name,
    label: def.label,
    type: def.type,
    fieldType: def.fieldType,
    groupName,
  };
  if (def.options) {
    body.options = def.options.map((o, i) =>
      typeof o === 'string' ? { label: o, value: o, displayOrder: i, hidden: false } : o
    );
  }
  await hs(`/crm/v3/properties/${objectType}`, { method: 'POST', body });
  return 'created';
}

// --- batch create (100 max per call); returns created objects with ids+properties ---
export async function batchCreate(objectType, inputs) {
  const created = [];
  for (let i = 0; i < inputs.length; i += 100) {
    const chunk = inputs.slice(i, i + 100);
    const res = await hs(`/crm/v3/objects/${objectType}/batch/create`, {
      method: 'POST',
      body: { inputs: chunk.map((properties) => ({ properties })) },
    });
    created.push(...(res.results || []));
  }
  return created;
}

// --- default association (deal -> contact, etc.) via v4, limited concurrency ---
export async function associateDefault(fromType, toType, pairs, concurrency = 6) {
  let i = 0;
  let ok = 0;
  let failed = 0;
  async function worker() {
    while (i < pairs.length) {
      const { fromId, toId } = pairs[i++];
      try {
        await hs(`/crm/v4/objects/${fromType}/${fromId}/associations/default/${toType}/${toId}`, { method: 'PUT' });
        ok++;
      } catch (e) {
        failed++;
        if (failed <= 3) console.warn(`  assoc ${fromId}→${toId} failed: ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { ok, failed };
}

// --- search every record carrying our seed marker (for reset) ---
export async function searchSeeded(objectType, batchTag) {
  const ids = [];
  let after;
  do {
    const res = await hs(`/crm/v3/objects/${objectType}/search`, {
      method: 'POST',
      body: {
        filterGroups: [{ filters: [{ propertyName: 'gt_seed_batch', operator: 'EQ', value: batchTag }] }],
        properties: ['gt_ext_id'],
        limit: 100,
        after,
      },
    });
    ids.push(...res.results.map((r) => r.id));
    after = res.paging?.next?.after;
  } while (after);
  return ids;
}

export async function batchArchive(objectType, ids) {
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    await hs(`/crm/v3/objects/${objectType}/batch/archive`, { method: 'POST', body: { inputs: chunk.map((id) => ({ id })) } });
  }
}
