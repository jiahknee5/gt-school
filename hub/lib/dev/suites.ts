/**
 * Suite layout — how the test suite is organized, by DOMAIN (data / backend /
 * frontend / scenarios) crossed with EXECUTION (pure = no services, always green;
 * live = needs DB/HubSpot/Stripe keys, skips gracefully). Surfaced at /dev/tests
 * and documented in tests/README.md. Domain ≠ execution on purpose: the CI gate is
 * the union of the `pure` files across domains (see `npm run test:ci`).
 */

export type SuiteKind = "pure" | "live";

export interface SuiteFile {
  file: string;
  kind: SuiteKind;
  /** Services the live files need (empty for pure). */
  needs: string[];
  what: string;
}

export interface Suite {
  id: string;
  label: string;
  domain: string;
  script: string;
  files: SuiteFile[];
}

export const SUITES: Suite[] = [
  {
    id: "data",
    label: "Data",
    domain: "Generation, fixtures, identity & data sources",
    script: "npm run test:data",
    files: [
      { file: "tests/seed.test.ts", kind: "pure", needs: [], what: "Deterministic generator, invariants, 15 edge cases, realism." },
      { file: "tests/matchkey.test.ts", kind: "pure", needs: [], what: "Identity resolution (email / phone / name+zip)." },
      { file: "tests/seed-hubspot.test.ts", kind: "pure", needs: [], what: "App→HubSpot enum mappings for the seed bridge." },
      { file: "tests/catalog.test.ts", kind: "pure", needs: [], what: "Open Data catalog curation + formatting (mocked fetch)." },
      { file: "tests/opendata.test.ts", kind: "pure", needs: [], what: "Open Data client cache/fallback + enrichment (mocked fetch)." },
      { file: "tests/seed-fixtures.test.ts", kind: "live", needs: ["db"], what: "Spec-mandated rates + stress cases against seeded Postgres." },
    ],
  },
  {
    id: "backend",
    label: "Backend",
    domain: "Sync engine, payments, DB isolation & connectors",
    script: "npm run test:backend",
    files: [
      { file: "tests/reconcile.test.ts", kind: "live", needs: ["db", "hubspot"], what: "Field-directional authority + stable parity across runs." },
      { file: "tests/payments.test.ts", kind: "live", needs: ["db", "stripe"], what: "Idempotent, monotonic, program-isolated payment propagation." },
      { file: "tests/hubspot-webhook.test.ts", kind: "live", needs: ["db", "hubspot"], what: "Inbound webhook ingest → app state." },
      { file: "tests/opendata-route.test.ts", kind: "pure", needs: [], what: "Decision-enrichment route validation, cache headers, and 502 failure path." },
      { file: "tests/decisions.test.ts", kind: "pure", needs: [], what: "Decision Queue ruling transitions and Leader-only mutation route." },
      { file: "tests/decisions-queue.test.ts", kind: "pure", needs: [], what: "Decision Queue read helpers and rendered Leader-only surface." },
      { file: "tests/crm-ops.test.ts", kind: "pure", needs: [], what: "CRM Ops parity, attribution, scoring, detector, queue RBAC, and rendered module surface." },
      { file: "tests/budget.test.ts", kind: "pure", needs: [], what: "Budget ledger reconciliation, variance auto-flags, RBAC, route write guard, and rendered sub-views." },
      { file: "tests/home-layout.test.ts", kind: "pure", needs: [], what: "Home saved layout normalization, per-session GET/PUT persistence, and spoofed user-id denial." },
      { file: "tests/rbac.test.ts", kind: "pure", needs: [], what: "Signed demo sessions, route policy, middleware denial, token integrity/expiry." },
      { file: "tests/outbox-worker.test.ts", kind: "live", needs: ["db", "hubspot"], what: "Outbound outbox drain, retries, dead-lettering." },
      { file: "tests/parity.test.ts", kind: "live", needs: ["db"], what: "Parity / data-confidence computation." },
      { file: "tests/r1-connection.test.ts", kind: "live", needs: ["db"], what: "RLS / program isolation smoke against the DB." },
    ],
  },
  {
    id: "e2e",
    label: "Scenarios (others)",
    domain: "End-to-end brief use cases, cross-cutting",
    script: "npm run test:e2e",
    files: [
      { file: "tests/brief-usecases.test.ts", kind: "pure", needs: [], what: "Every brief use case made runnable + catalog integrity." },
      { file: "tests/phase2.test.ts", kind: "pure", needs: [], what: "Phase 2 roles, widgets, budget, confidence banner, GT Challenge helpers, and requirement audit." },
    ],
  },
  {
    id: "frontend",
    label: "Frontend",
    domain: "UI components & pages",
    script: "npm run test:frontend",
    files: [
      { file: "tests/module-routes.test.ts", kind: "pure", needs: [], what: "Server-rendered Home/Budget/CRM/Decision Queue demo surfaces." },
      { file: "tests/dashboard.test.ts", kind: "pure", needs: [], what: "Dashboard/KPI route, shared scorecard, goal RBAC, freshness, and rendered sub-views." },
      { file: "tests/nurture.test.ts", kind: "pure", needs: [], what: "Nurture lifecycle metrics, SMS/PII gates, SLA, segments, and rendered sub-views." },
      { file: "tests/grassroots.test.ts", kind: "pure", needs: [], what: "Grassroots ambassador reconciliation, referral metrics, market map, cross-links, and rendered sub-views." },
      { file: "tests/admissions.test.ts", kind: "pure", needs: [], what: "Admissions objection themes, consented family voice, content bridge, feedback RBAC, and rendered sub-views." },
      { file: "tests/content.test.ts", kind: "pure", needs: [], what: "Content sheet mirror, channel attribution, brand-voice suggestions, sync conflicts, and rendered sub-views." },
    ],
  },
];

export function suiteCounts() {
  const all = SUITES.flatMap((s) => s.files);
  return {
    files: all.length,
    pure: all.filter((f) => f.kind === "pure").length,
    live: all.filter((f) => f.kind === "live").length,
  };
}
