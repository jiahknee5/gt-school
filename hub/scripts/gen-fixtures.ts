/**
 * GT Marketing Hub — seed/fixtures generator (runnable, deterministic, offline).
 *
 *   npm run seed                 # write JSON fixtures + manifest to seed-data/, then validate
 *   npm run seed -- --sql        # also emit seed-data/load.sql (admin reset+load)
 *   npm run seed:validate        # regenerate in-memory and just run invariants (no writes)
 *   npm run seed -- --families 2000 --seed 7 --weeks 16
 *
 * No database, no dev server, no .env.local — it only reads code and writes files
 * under seed-data/. The same seed always produces byte-identical fixtures, so the
 * walkthrough can reset to a clean known state.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "../lib/seed/generate";
import { validate } from "../lib/seed/invariants";
import type { SeedDataset } from "../lib/seed/types";

interface Args {
  seed?: number;
  families?: number;
  weeks?: number;
  out?: string;
  sql: boolean;
  validateOnly: boolean;
  quiet: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { sql: false, validateOnly: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--sql") a.sql = true;
    else if (t === "--validate" || t === "--check") a.validateOnly = true;
    else if (t === "--quiet") a.quiet = true;
    else if (t === "--seed") a.seed = Number(argv[++i]);
    else if (t === "--families") a.families = Number(argv[++i]);
    else if (t === "--weeks") a.weeks = Number(argv[++i]);
    else if (t === "--out") a.out = argv[++i];
  }
  return a;
}

const HUB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ------------------------------- SQL emitter -------------------------------

function sqlLit(v: unknown, json = false): string {
  if (v === null || v === undefined) return "NULL";
  if (json) return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "true" : "false";
  return `'${String(v).replace(/'/g, "''")}'`;
}

interface Col {
  name: string;
  json?: boolean;
  /** Replace value with `(select id from programs where key=<row.program_key>)`. */
  programRef?: boolean;
}

function insertRows(table: string, rows: Record<string, unknown>[], cols: Col[]): string {
  if (rows.length === 0) return `-- ${table}: (none)\n`;
  const names = cols.map((c) => c.name).join(", ");
  const lines = rows.map((r) => {
    const vals = cols.map((c) => {
      if (c.programRef) return `(select id from programs where key=${sqlLit(r.program_key)})`;
      return sqlLit(r[c.name], c.json);
    });
    return `  (${vals.join(", ")})`;
  });
  return `insert into ${table} (${names}) values\n${lines.join(",\n")};\n`;
}

function buildSql(ds: SeedDataset): string {
  const FAMILY_COLS: Col[] = [
    { name: "id" }, { name: "hubspot_contact_id" }, { name: "email" }, { name: "phone" },
    { name: "first_name" }, { name: "last_name" }, { name: "funnel_stage" }, { name: "tefa_status" },
    { name: "income_band" }, { name: "grade" }, { name: "lifecycle_stage" }, { name: "lead_score" },
    { name: "source" }, { name: "match_key" }, { name: "row_version" }, { name: "app_updated_at" },
    { name: "hs_updated_at" }, { name: "last_synced_at" }, { name: "created_at" },
  ];
  const scopedMembership: Col[] = [
    { name: "id" }, { name: "program_id", programRef: true }, { name: "family_id" },
    { name: "child_id" }, { name: "status" }, { name: "source" }, { name: "joined_at" },
  ];
  const scopedEnroll: Col[] = [
    { name: "id" }, { name: "program_id", programRef: true }, { name: "family_id" },
    { name: "child_id" }, { name: "hubspot_deal_id" }, { name: "stage" }, { name: "amount" },
    { name: "paid" }, { name: "created_at" },
  ];
  const scopedPay: Col[] = [
    { name: "id" }, { name: "program_id", programRef: true }, { name: "family_id" },
    { name: "enrollment_id" }, { name: "stripe_payment_intent_id" }, { name: "stripe_event_id" },
    { name: "amount" }, { name: "status" }, { name: "status_rank" }, { name: "occurred_at" },
    { name: "created_at" },
  ];

  const byProgram = <T extends { program_key: string }>(rows: T[], key: string) =>
    rows.filter((r) => r.program_key === key);

  const scopedBlock = (key: string): string => {
    return [
      `select set_config('app.current_program', (select id from programs where key='${key}'), true);`,
      insertRows("program_membership", byProgram(ds.program_membership, key) as unknown as Record<string, unknown>[], scopedMembership),
      insertRows("enrollments", byProgram(ds.enrollments, key) as unknown as Record<string, unknown>[], scopedEnroll),
      insertRows("payments", byProgram(ds.payments, key) as unknown as Record<string, unknown>[], scopedPay),
    ].join("\n");
  };

  const out: string[] = [];
  out.push(`-- GT Marketing Hub seed (admin reset+load). Generated deterministically; seed=${ds.manifest.seed}.`);
  out.push(`-- Run as the DB owner via psql. TRUNCATE bypasses RLS for reset; scoped inserts set`);
  out.push(`-- app.current_program per program so the FORCE-RLS WITH CHECK predicate passes.`);
  out.push(`-- programs / field_authority are pre-seeded by 0001_backbone.sql and are NOT touched.\n`);
  out.push("begin;\n");
  out.push(
    "truncate families, children, program_membership, enrollments, payments, field_state,",
    "  parity_snapshot, data_quality_issue, decisions, processed_events, sync_event_log,",
    "  sync_outbox, sync_identity_map cascade;\n",
  );

  // global tables
  out.push(insertRows("families", ds.families as unknown as Record<string, unknown>[], FAMILY_COLS));
  out.push(insertRows("children", ds.children as unknown as Record<string, unknown>[], [
    { name: "id" }, { name: "family_id" }, { name: "first_name" }, { name: "grade" }, { name: "created_at" },
  ]));
  out.push(insertRows("sync_identity_map", ds.sync_identity_map as unknown as Record<string, unknown>[], [
    { name: "id" }, { name: "local_table" }, { name: "local_id" }, { name: "system" }, { name: "external_id" },
  ]));
  out.push(insertRows("field_state", ds.field_state as unknown as Record<string, unknown>[], [
    { name: "entity" }, { name: "entity_id" }, { name: "field" }, { name: "app_value" }, { name: "hs_value" },
    { name: "app_updated_at" }, { name: "hs_updated_at" }, { name: "in_parity" }, { name: "last_checked_at" },
  ]));
  out.push(insertRows("parity_snapshot", ds.parity_snapshot as unknown as Record<string, unknown>[], [
    { name: "id" }, { name: "taken_at" }, { name: "scope" }, { name: "overall_pct" }, { name: "fields", json: true },
  ]));
  out.push(insertRows("data_quality_issue", ds.data_quality_issue as unknown as Record<string, unknown>[], [
    { name: "id" }, { name: "category" }, { name: "severity" }, { name: "entity" }, { name: "entity_id" },
    { name: "field" }, { name: "description" }, { name: "status" }, { name: "created_at" }, { name: "resolved_at" },
  ]));
  out.push(insertRows("decisions", ds.decisions as unknown as Record<string, unknown>[], [
    { name: "id" }, { name: "question" }, { name: "raised_by" }, { name: "workstream" }, { name: "recommendation" },
    { name: "budget_ask" }, { name: "due_date" }, { name: "priority" }, { name: "status" }, { name: "response" },
    { name: "response_note" }, { name: "auto_flag" }, { name: "resolved_at" }, { name: "created_at" },
  ]));
  out.push(insertRows("processed_events", ds.processed_events as unknown as Record<string, unknown>[], [
    { name: "source" }, { name: "event_id" }, { name: "first_seen_at" }, { name: "result", json: true },
  ]));
  out.push(insertRows("sync_event_log", ds.sync_event_log as unknown as Record<string, unknown>[], [
    { name: "id" }, { name: "source_system" }, { name: "external_event_id" }, { name: "entity" },
    { name: "entity_id" }, { name: "change", json: true }, { name: "conflict" }, { name: "received_at" }, { name: "processed_at" },
  ]));
  out.push(insertRows("sync_outbox", ds.sync_outbox as unknown as Record<string, unknown>[], [
    { name: "id" }, { name: "aggregate_type" }, { name: "aggregate_id" }, { name: "target_system" }, { name: "op" },
    { name: "payload", json: true }, { name: "dedupe_key" }, { name: "status" }, { name: "attempts" },
    { name: "last_error" }, { name: "created_at" },
  ]));

  // budget: pre-seeded rows → upsert by key
  out.push("-- budget_workstream is pre-seeded; upsert spend by key.");
  for (const b of ds.budget_workstream) {
    out.push(
      `insert into budget_workstream (key, name, recommended, planned, committed, actual) values ` +
        `(${sqlLit(b.key)}, ${sqlLit(b.name)}, ${b.recommended}, ${b.planned}, ${b.committed}, ${b.actual}) ` +
        `on conflict (key) do update set planned=excluded.planned, committed=excluded.committed, actual=excluded.actual;`,
    );
  }
  out.push("");

  // scoped tables, per program (RLS scope set before each block)
  out.push("-- ===== program-scoped (RLS WITH CHECK requires app.current_program) =====");
  out.push(scopedBlock("fall_enrollment"));
  out.push(scopedBlock("summer_camp"));

  out.push("commit;");
  return out.join("\n");
}

// --------------------------------- main ---------------------------------

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const ds = generate({ seed: args.seed, families: args.families, weeks: args.weeks });
  const result = validate(ds);

  if (!args.quiet) {
    console.log(`\nGT Marketing Hub seed — seed=${ds.manifest.seed}, as-of=${ds.manifest.generatedAt.slice(0, 10)}`);
    const realRows = ds.manifest.real.reduce((s, k) => s + (ds.manifest.counts[k] ?? 0), 0);
    const standRows = ds.manifest.standIn.reduce((s, k) => s + (ds.manifest.counts[k] ?? 0), 0);
    console.log(`  real rows:     ${realRows}  (${ds.manifest.real.length} tables)`);
    console.log(`  stood-in rows: ${standRows}  (${ds.manifest.standIn.length} sources, labeled _standIn)`);
    console.log(`  edge cases:    ${ds.manifest.edgeCases.length}/15 — ${ds.manifest.edgeCases.join(", ")}`);
    console.log("\n  invariants:");
    for (const c of result.checks) console.log(`    ${c.ok ? "PASS" : "FAIL"}  ${c.name} — ${c.detail}`);
  }

  if (!args.validateOnly) {
    const outDir = args.out ? resolve(args.out) : join(HUB_ROOT, "seed-data");
    mkdirSync(outDir, { recursive: true });
    const write = (name: string, data: unknown) =>
      writeFileSync(join(outDir, name), JSON.stringify(data, null, 2) + "\n");

    for (const [k, v] of Object.entries(ds)) {
      if (k === "manifest") continue;
      if (Array.isArray(v)) write(`${k}.json`, v);
    }
    write("manifest.json", ds.manifest);
    if (args.sql) writeFileSync(join(outDir, "load.sql"), buildSql(ds));
    if (!args.quiet) console.log(`\n  wrote ${Object.keys(ds).length - 1} JSON files${args.sql ? " + load.sql" : ""} → ${outDir}`);
  }

  if (!result.ok) {
    console.error("\nSEED INVALID — invariants failed. See FAIL lines above.");
    process.exit(1);
  }
  if (!args.quiet) console.log("\n  all invariants passed.\n");
}

main();
