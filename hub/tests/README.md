# Test suite layout

The suite is organized on **two axes** — and they are not the same axis:

1. **Domain** — what part of the system it tests (`data`, `backend`, `frontend`, `scenarios`).
2. **Execution** — what it needs to run: `pure` (mocks `fetch`/connectors, no keys, always green) or `live` (needs `APP_RW_DATABASE_URL` + HubSpot/Stripe keys; skips gracefully when absent).

> Why two axes? "Front end / back end" alone doesn't fit this repo: the current frontend coverage is server-rendered route smoke, not browser/jsdom interaction, and "backend" would swallow most files. The load-bearing axis for CI is actually **pure vs live** — the union of the `pure` files is the no-keys gate (`npm run test:ci`), and it deliberately crosses domains (e.g. `seed.test.ts` is data+pure, `seed-fixtures.test.ts` is data+live).

## Classification

| File | Domain | Execution | Needs | What it proves |
|---|---|---|---|---|
| `seed.test.ts` | data | pure | — | Deterministic generator, invariants, 15 edge cases, realism |
| `matchkey.test.ts` | data | pure | — | Identity resolution (email / phone / name+zip) |
| `seed-hubspot.test.ts` | data | pure | — | App→HubSpot enum mappings for the seed bridge |
| `catalog.test.ts` | data | pure | — | Open Data catalog curation + formatting (mocked fetch) |
| `opendata.test.ts` | data | pure | — | Open Data client cache/fallback + enrichment (mocked fetch) |
| `opendata-route.test.ts` | backend | pure | — | Decision-enrichment route validation, cache headers, and 502 failure path |
| `decisions.test.ts` | backend | pure | — | Decision Queue ruling transitions and Leader-only mutation route |
| `crm-ops.test.ts` | backend | pure | — | CRM Ops parity, attribution, scoring, detector, queue RBAC, and rendered module surface |
| `rbac.test.ts` | backend | pure | — | Signed demo sessions, route policy, middleware denial, token integrity/expiry |
| `module-routes.test.ts` | frontend | pure | — | Server-rendered Home/Budget/CRM/Decision Queue demo surfaces |
| `seed-fixtures.test.ts` | data | live | db | Spec-mandated rates + stress cases vs seeded Postgres |
| `reconcile.test.ts` | backend | live | db, hubspot | Field-directional authority + stable parity across runs |
| `payments.test.ts` | backend | live | db, stripe | Idempotent, monotonic, program-isolated payments |
| `hubspot-webhook.test.ts` | backend | live | db, hubspot | Inbound webhook ingest → app state |
| `outbox-worker.test.ts` | backend | live | db, hubspot | Outbound outbox drain, retries, dead-lettering |
| `parity.test.ts` | backend | live | db | Parity / data-confidence computation |
| `r1-connection.test.ts` | backend | live | db | RLS / program isolation smoke vs the DB |
| `brief-usecases.test.ts` | scenarios | pure | — | Every brief use case made runnable + catalog integrity |
| `phase2.test.ts` | scenarios | pure | — | Phase 2 roles, widgets, budget, confidence banner, GT Challenge helpers, and requirement audit |
| _(scaffold)_ | frontend | pure | — | Add browser/component tests as auth and persistence land |

## Running a group

```bash
npm test            # everything (live files skip without keys)
npm run test:ci     # pure only — the no-keys gate (fast, deterministic, green)
npm run test:data       # data domain (incl. the live seed-fixtures check)
npm run test:backend    # sync engine, payments, DB, RLS
npm run test:e2e        # cross-cutting brief use cases
npm run test:frontend   # server-rendered route surfaces
npm run test:live       # only the service-backed files
npm run test:report     # write seed-data/test-results.json for /dev/tests
```

The in-app **Test Theater** (`/dev/tests`) renders this layout plus the brief-use-case
coverage matrix; the source of truth for both is `lib/dev/suites.ts` and `lib/dev/usecases.ts`.

## Recommended end-state (folders)

The scripts above select by path so nothing has to move today. The clean end-state is to
mirror the domains as folders and convert imports to the `@/` alias (depth-independent),
after which the scripts simplify to `vitest run tests/<domain>`:

```
tests/
  data/        seed, matchkey, seed-hubspot, catalog, opendata, seed-fixtures
  backend/     decisions, crm-ops, rbac, reconcile, payments, hubspot-webhook, outbox-worker, parity, r1-connection
  scenarios/   brief-usecases, phase2
  frontend/    route/component/browser tests
```

This move is deferred only to avoid colliding with in-flight live-test runs; do it when the
backend live tests are idle (it is a pure rename + import-alias change, no logic change).
