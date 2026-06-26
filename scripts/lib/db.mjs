// Postgres access for the Phase-1 services, via psql (no pg dependency).
// Runtime ops use the least-privilege app_rw role; program data is reached ONLY by
// assuming that program's role inside a transaction — so a payment for one program
// physically cannot write another program's store.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export const env = Object.fromEntries(
  readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const APP_RW = env.APP_RW_DATABASE_URL;
const ADMIN = env.SUPABASE_DB_URL;
const SEP = '\x01';

export const esc = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

function run(url, sql) {
  try {
    const out = execFileSync('psql', [url, '-X', '-q', '-At', '-F', SEP, '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' });
    return out.split('\n').filter(Boolean).map((line) => line.split(SEP));
  } catch (e) {
    const msg = (e.stderr || e.message || '').toString().trim();
    const err = new Error(msg.split('\n').find((l) => l.includes('ERROR')) || msg.split('\n')[0] || 'psql error');
    err.stderr = msg;
    throw err;
  }
}

// app_rw on public schema (webhook_events, app_form, sync_parity). No program access.
export const q = (sql) => run(APP_RW, sql);

// admin (postgres) — for dev/demo lookups only, never the request path.
export const qAdmin = (sql) => run(ADMIN, sql);

// run a statement scoped to exactly one program role, in a single transaction.
const ROLE = { summer_camp: 'gt_summer', fall_anywhere: 'gt_fall', flagship: 'gt_fall' };
export function qProgram(program, sql) {
  const role = ROLE[program];
  if (!role) throw new Error(`unknown program: ${program}`);
  return run(APP_RW, `begin; set local role ${role}; ${sql}; commit;`);
}
