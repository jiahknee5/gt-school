# GT Marketing Hub — PRD Requirement Status Matrix (post-full-build)

> Snapshot after all 13 module surfaces were built. Companion to `REQUIREMENTS.md` (the original
> completeness review, written when depth = 0 modules). This is the **current** done/partial/missing
> matrix with evidence. Source PRDs: `hub/PRD/GT_Technical_Project_Brief.md` +
> `hub/PRD/GT_Marketing_Hub_Spec.md`. Date: 2026-06-26.

**Legend** — Status: **✅ done** · **🟡 partial** · **⛔ missing**. Priority **P0** (scored heavily) /
**P1** / **P2**. ★ = hard/non-negotiable per the brief.

---

## Headline

The product build is materially stronger than the original intake review, but it is **not submission-complete**.
Core code paths for the P0 slice are mostly built and tested; the remaining blockers are submission
artifacts, production/deploy proof, browser-level workflow proof, and GT Challenge public-capture
persistence. E1 now has a deterministic `/dev/payments` watcher with a live DB path when credentials
are present. Tests: **348 passed (pure gate), 1 todo** before the E1 watcher add; targeted E1 tests
pass in `payment-propagation-surface.test.ts`.

## A. Submission deliverables (meta — all ★ P0)

| # | Requirement | Status | Evidence / gap |
|---|---|---|---|
| A1 | Repo + README that runs in minutes | 🟡 | code + `.env.example` present; confirm a top-level run-in-minutes README + setup steps |
| A2 | Write-up (deep vs stubbed & why, trade-offs, bent rules) | ⛔ | not started — graded heavily; draft from this matrix + `REQUIREMENTS.md` §F |
| A3 | Proof it works (tests/scripts; isolation, idempotency, dual-source, budget, role gating) | ✅ | `npm run test:ci` pure gate; `rbac.test.ts`, `payments.test.ts`, `payment-propagation-surface.test.ts`, `budget.test.ts`, `reconcile.test.ts`, `summer-camp.test.ts` |
| A4 | Walkthrough video 5–10 min (+≥1 failure/edge) | ⛔ | record after deploy |
| A5 | Live demo URL + 3 role logins (Admin/Leader/Operator) | 🟡 | auth + 3 demo identities ready (`DEMO_USERS`, `/login`); **deploy pending** |
| A6 | No secrets in git | ✅ | `.env*` gitignored; `.env.local` is an ignored symlink; only `.env.example` tracked |

## B. Phase 1 — backbone non-negotiables (all ★ P0)

| # | Requirement | Status | Evidence |
|---|---|---|---|
| B1 | Bidirectional CRM↔app sync, consistent over time | ✅ | `lib/sync/reconcile.ts`, `lib/sync/outbox-worker.ts`, `app/api/webhooks/hubspot/route.ts` |
| B2 | Program isolation, provable | ✅ | RLS (`0001_backbone.sql`), `lib/db.ts` `withProgram`, `r1_isolation.sql`, `rbac.test.ts` program scope |
| B3 | Idempotent payment end-to-end | ✅ | `lib/payments.ts` + `tests/payments.test.ts` (idempotent replay, monotonic, RLS WITH CHECK) |
| B4 | Sync-parity / data-confidence signal | ✅ | `lib/parity.ts` + `tests/parity.test.ts`; **banner now wired** (`DataConfidenceBanner` across 7 HubSpot modules) |
| B5 | Messy parts: retries, dup webhooks, conflicts, **dual-source reconcile** | ✅ | dup/echo/conflict (`reconcile.ts`, `processed_events`); **dual-source surfaced as product** in Summer Camp + Grassroots |

## C. Phase 2 — product non-negotiables (all ★ P0)

| # | Requirement | Status | Evidence / gap |
|---|---|---|---|
| C1 | **Auth + 3 roles enforced** (Admin/Leader/Operator) | ✅ | `middleware.ts` deny-by-default, `lib/auth/policy.ts`, signed `gt_session`; proven in `rbac.test.ts` + `UC-P2-AUTH-ROLES`. (Prod identity lifecycle is the only non-blocking remainder.) |
| C2 | **Decision Queue gated to Leaders** (Operators submit, never view) | ✅ | Leader-only route/API/mutation; rendered queue (`/m/decisions`); submitter own-status (`/m/submissions`) |
| C3 | **Single source of truth** (no figure computed two ways) | ✅ | `lib/metrics/*`/seed authoritative; Analytics reconciles by summation, one bounce def; budget total in one place |
| C4 | **Budget reconciles to $365K** + >10% variance auto-flags to DQ | ✅ | `/m/budget`, append-only `budget_entry`, variance→DQ payload (`budget.test.ts`, `UC-DATA-VARIANCE`) |
| C5 | **Composable per-user Home** (widget library, starter pack, saved layout) | 🟡 | library + role-aware starter pack + `home_layout` GET/PUT + picker add/remove/reorder/save exist; browser drag-style E2E remains |
| C6 | **Real integrations + dual-source reconciliation** | ✅ | HubSpot connector live; Summer Camp reconciles summer.gt.school + form by `match_key` (counted once) |
| C7 | **Open Data query that changes a decision** | ✅ | `recommendationImpactFromEnrichment`, `/api/opendata/decision-enrichment`, and Decision Queue surfaces show `pilot -> approve`; `opendata.test.ts` covers fallback + recommendation flip |
| C8 | **Respect known gaps honestly** (UTM broken, unreliable fields, uninstrumented) | ✅ | CRM Ops surfaces parity/UTM; Analytics counts `(not set)` UTM bucket; Field Events flagged uninstrumented |

## D. Test data deliverable (★ P0 — explicitly scored)

| # | Requirement | Status | Evidence |
|---|---|---|---|
| D1 | Realistic, spec shapes, $365K budget | ✅ | `lib/seed/*`, `dictionaries.ts` (BUDGET = 365K) |
| D2 | Volume + spread | ✅ | `lib/seed/generate.ts` distributions |
| D3 | Edge cases on purpose (15) | ✅ | `lib/seed/invariants.ts`, manifest edge-case list (`UC-DATA-EDGECASES`) |
| D4 | Reproducible + honest + reset | ✅ | deterministic RNG, `_standIn` labels, `npm run reset`/`seed:fixtures` |

## E. "Show us it works" — acceptance demo (all ★ P0)

| # | Signal | Status | Evidence / gap |
|---|---|---|---|
| E1 | Watch a payment propagate without contamination | ✅ | `/dev/payments` shows processed event/payment status, idempotent replay/no-op, program isolation/no-contamination, and deterministic seed fallback; live propagation remains proven by `payments.test.ts` when DB/Stripe env exists |
| E2 | A budget reconcile to the total | ✅ | `/m/budget` + `budget.test.ts` reconcile 4 workstreams → $365K |
| E3 | A role denied the Decision Queue | ✅ | auth + middleware redirect Operator → `/forbidden`; `rbac.test.ts`, `UC-DEMO-ROLE-DENIED-AUTH-UI` |
| E4 | Data-confidence banner appears when parity drops | ✅ | `DataConfidenceBanner` + parity payload; `module-routes.test.ts` renders it on HubSpot modules |
| E5 | A real Open Data query (+≥1 failure/edge) | ✅ | `opendata.test.ts` (cache→live→stale→fixture degrade path) |

## F. Module depth (the scored judgment — NOT all 13 equal)

All 13 modules now render a real surface (was: 0). Depth tiers per the runbook build order:

| Tier | Modules | Depth |
|---|---|---|
| 1 (deep, P0) | CRM Ops · Budget · Decision Queue | ✅ deep (ledger/parity/role-gating + tests) |
| 2 | Dashboard · Nurture · Home | ✅ built (Home picker UI is the C5 partial) |
| 3 | Grassroots · Admissions · Content · Analytics | ✅ built |
| 4 | Summer Camp · Field Events · Library | ✅ built (Camp deep for dual-source/C6; Events/Library intentionally lighter) |

## G. Cross-module rules (★ where they gate the demo)

| Rule | Status |
|---|---|
| Single source of truth per number | ✅ enforced via `lib/metrics/*`/seed (C3) |
| Auto cross-links (testimonial→Content, objection→brief, hot-family→DQ, variance→DQ, parity→banner, event→Field) | ✅ built + each has a visible landing (`brief-usecases.test.ts › UC-SPEC-XLINK-*`) |
| Data-confidence banner broadcast | ✅ wired across HubSpot-consuming modules |

## H. Honest todos / deferred (tracked, not faked green)

- `UC-GTC-CAPTURE-PERSIST` — GT Challenge **public-capture persistence contract** is now covered
  without a live DB: consent gates persistence, idempotency replays return the original
  submission/lead, UTM falls back to `(not set)`, and score/bucket/qualified persist with no
  "not gifted" verdict. Remaining gap: additive DB migration plus transactional route adapter.
- **S6** — Decision-Queue ruling lacks an actor audit trail (who/when). See `SECURITY-REVIEW.md`.
- **S7-b/c** — security headers/CSP + rate limiting are deploy-time hardening (no public quiz ships yet).
- **C5 browser drag/E2E** — partial above.

## Bottom line

The foundation, the three deep P0 modules (CRM Ops · Budget · Decision Queue), and **auth/RBAC**
are in place and tested at the app/pure-test layer. Do **not** call the project complete yet: the score
now hinges on the **submission deliverables** (A2 write-up, A4 video, A5 deploy + role logins), plus
the honest partials above.
