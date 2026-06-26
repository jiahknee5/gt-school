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
| `ask-route.test.ts` | backend | pure | — | Ask-the-Hub route auth, role-aware answers, refusals, citations, and read-only audit metadata |
| `ask-agents.test.ts` | backend | pure | — | Ask-the-Hub deterministic agents, de-identified context, Open Data decision impact, and safe refusals |
| `decisions.test.ts` | backend | pure | — | Decision Queue ruling transitions and Leader-only mutation route |
| `decisions-queue.test.ts` | backend | pure | — | Decision Queue read helpers and rendered Leader-only surface |
| `crm-ops.test.ts` | backend | pure | — | CRM Ops parity, attribution, scoring, detector, queue RBAC, and rendered module surface |
| `budget.test.ts` | backend | pure | — | Budget ledger reconciliation, variance auto-flags, RBAC, route write guard, and rendered sub-views |
| `home-layout.test.ts` | backend | pure | — | Home saved layout normalization, per-session GET/PUT persistence, and spoofed user-id denial |
| `rbac.test.ts` | backend | pure | — | Signed demo sessions, route policy, middleware denial, token integrity/expiry |
| `module-routes.test.ts` | frontend | pure | — | Server-rendered Home/Budget/CRM/Decision Queue demo surfaces |
| `home-widget-picker.test.ts` | frontend | pure | — | Home widget picker search, add/remove, reorder, and save payload state |
| `dashboard.test.ts` | frontend | pure | — | Dashboard/KPI route, shared scorecard, goal RBAC, freshness, and rendered sub-views |
| `nurture.test.ts` | frontend | pure | — | Nurture lifecycle metrics, SMS/PII gates, SLA, segments, and rendered sub-views |
| `grassroots.test.ts` | frontend | pure | — | Grassroots ambassador reconciliation, referral metrics, market map, cross-links, and rendered sub-views |
| `admissions.test.ts` | frontend | pure | — | Admissions objection themes, consented family voice, content bridge, feedback RBAC, and rendered sub-views |
| `content.test.ts` | frontend | pure | — | Content sheet mirror, channel attribution, brand-voice suggestions, sync conflicts, and rendered sub-views |
| `analytics.test.ts` | frontend | pure | — | Website analytics GA4 reconciliation, UTM/download honesty, RBAC, and rendered sub-views |
| `summer-camp.test.ts` | frontend | pure | — | Summer Camp dual-source reconciliation, campus capacity, separate P&L, roster RBAC, and rendered sub-views |
| `events.test.ts` | frontend | pure | — | Field Events manual metrics, duplicate/stale row handling, proposal idempotency, queue RBAC, and rendered sub-views |
| `library.test.ts` | frontend | pure | — | Resource Library badge derivation, visibility filtering, search, upload validation, Analytics download chips, and rendered sub-views |
| `seed-fixtures.test.ts` | data | live | db | Spec-mandated rates + stress cases vs seeded Postgres |
| `reconcile.test.ts` | backend | live | db, hubspot | Field-directional authority + stable parity across runs |
| `payments.test.ts` | backend | live | db, stripe | Idempotent, monotonic, program-isolated payments |
| `hubspot-webhook.test.ts` | backend | live | db, hubspot | Inbound webhook ingest → app state |
| `outbox-worker.test.ts` | backend | live | db, hubspot | Outbound outbox drain, retries, dead-lettering |
| `parity.test.ts` | backend | live | db | Parity / data-confidence computation |
| `r1-connection.test.ts` | backend | live | db | RLS / program isolation smoke vs the DB |
| `brief-usecases.test.ts` | scenarios | pure | — | Every brief use case made runnable + catalog integrity |
| `payment-propagation-surface.test.ts` | scenarios | pure | — | Visible E1 payment watcher signals: processed status, replay no-op, isolation, and contamination warning |
| `phase2.test.ts` | scenarios | pure | — | Phase 2 roles, widgets, budget, confidence banner, GT Challenge helpers, and requirement audit |
| _(scaffold)_ | frontend | pure | — | Add browser/component tests as auth and persistence land |

## Running a group

```bash
npm test            # everything (live files skip without keys)
npm run test:ci     # pure only — the no-keys gate (fast, deterministic, green)
npm run test:data       # data domain (incl. the live seed-fixtures check)
npm run test:backend    # sync engine, payments, DB, RLS
npm run test:scenarios  # cross-cutting brief use cases
npm run test:frontend   # server-rendered route surfaces
npm run test:live       # only the service-backed files
npm run test:report     # write seed-data/test-results.json for /dev/tests
```

There is no browser `test:e2e` script yet. The scenario suite is Vitest-based
contract coverage; add Playwright/browser tests before claiming end-to-end UI
coverage.

The in-app **Test Theater** (`/dev/tests`) renders this layout plus the brief-use-case
coverage matrix; the source of truth for both is `lib/dev/suites.ts` and `lib/dev/usecases.ts`.

## Recommended end-state (folders)

The scripts above select by path so nothing has to move today. The clean end-state is to
mirror the domains as folders and convert imports to the `@/` alias (depth-independent),
after which the scripts simplify to `vitest run tests/<domain>`:

```
tests/
  data/        seed, matchkey, seed-hubspot, catalog, opendata, seed-fixtures
  backend/     ask, decisions, crm-ops, budget, rbac, reconcile, payments, hubspot-webhook, outbox-worker, parity, r1-connection
  scenarios/   brief-usecases, payment-propagation-surface, phase2
  frontend/    route/component/browser tests
```

This move is deferred only to avoid colliding with in-flight live-test runs; do it when the
backend live tests are idle (it is a pure rename + import-alias change, no logic change).
