# QA Value Sweep — Ledger (full PRD hard-gate pass)

**Target:** local dev server `http://localhost:3000` on branch `reconcile-status` (= "what is built"; current branch is ahead of `master`).
**Live deploy:** `https://gt-school-hub.vercel.app` (tracks `master`) — **DOWN for authenticated users this pass** (see HG-LIVE).
**Date:** 2026-06-27 · **Roles:** Admin (Marketing Lead) · Leader (co-founder/Growth) · Operator (Admissions Owner) — all driven live.
**Method:** PRD (`PRD/GT_Marketing_Hub_Spec.md` + `GT_Technical_Project_Brief.md`) hard-gates first; verified by (a) running app via agent-browser, (b) live HTTP role matrix through the real middleware, (c) the test suite hitting **live** Supabase/HubSpot/Stripe.

---

## Part A — Hard-gate registry (the "must-builts")

Every non-negotiable the Brief + Spec make falsifiable. Verdict = PASS / FAIL / PARTIAL, with how it was checked.

### Phase 1 — Data backbone (Brief §"What the backbone must do")

| # | Hard gate | Verdict | Evidence |
|---|---|---|---|
| **P1-1** | Bidirectional sync CRM↔app DB, consistent over time | **PASS** | `reconcile.test.ts` (HubSpot→app, field-directional authority, cursor advance, **stable across 2 runs**, parity 97.02%); `outbox-worker.test.ts` (app→HubSpot patch_deal). Live HubSpot. |
| **P1-2** | Strict program isolation; prove no cross-program bleed | **PASS** | `payments.test.ts #5`: **cross-program write DENIED by RLS `WITH CHECK`**. Program isolation also surfaced in-product as the Fall/Camp/All nav toggle. |
| **P1-3** | Payment event end-to-end, idempotent | **PASS** | `payments.test.ts #2` (succeeded PI → correct program → flips paid → enqueues outbox), **#3 idempotent on signed-event replay**, **#4 out-of-order refund/late-succeeded → terminal state holds**. Live Stripe TEST sig. |
| **P1-4** | Sync-parity / data-confidence signal plumbing | **PASS** | `parity.test.ts` rolls up governed-field parity, writes snapshot, names income-below-threshold without false alarm; banner state consumed by all modules. |
| **P1-5** | Handle messy parts (retries, partial fail, dup webhooks, rate limits, dual-source reconcile) | **PASS** | `hubspot-webhook.test.ts` (idempotent apply, 401 on tampered body), `outbox-worker.test.ts` (429 backoff, dead-letter after maxAttempts + auto-files data_quality_issue, non-retryable→dead), `matchkey`/`reconcile` dual-source. |

### Phase 2 — Product non-negotiables (Brief §"Non-negotiables from the spec")

| # | Hard gate | Verdict | Evidence |
|---|---|---|---|
| **P2-1** | Auth + 3 roles enforced; **Decision Queue Leaders-only** (Operators submit, never view/act) | **PASS** | **Live middleware matrix:** `/m/decisions` → Leader **200**, Admin **307→/forbidden**, Operator **307→/forbidden** (reason: "Operators may submit, not view"). `/dev`,`/opendata` admin-only (L/O→forbidden). `/api/opendata/decision-enrichment` admin+leader (Operator **403**). `rbac.test.ts` green. Deny-by-default. |
| **P2-2** | Single source of truth per number (no figure computed two ways) | **PASS** | Dashboard "owns nothing, reads all" + Source column citations (`citations.test.ts`); SSOT map in `PRD §4` honored (funnel/income←Supabase, engagement←HubSpot, budget←Hub). |
| **P2-3** | Budget reconciles to $365K everywhere; >10% variance auto-flags Decision Queue | **PASS** | `budget.test.ts` (25): **recomputes $365,000 live, throws if rows ≠ 365000**, 5-column identities, no campaign double-count, **>10% AND ≥$2,500 → idempotent auto-flag**, urgent >20%. Live budget page shows $365K + variance; **the auto-flag appears in the Leader's queue**. |
| **P2-4** | Composable per-user Home (widget library + default starter pack + saved layout) | **PASS** | Live "+ Add widget" picker: **45 widgets, all 9 PRD categories, search, 58 data-source tags**; `home-layout.test.ts` + `home-widget-picker.test.ts` (14) cover per-user save. |
| **P2-5** | Real integrations + dual-source reconciliation + a real Open Data query that changes a decision | **PASS** | Live HubSpot/Stripe/Supabase (backbone tests); summer-camp + grassroots dual-source; `/opendata` renders Texas **PEIMS/STAAR/accountability** (tryopendata); **Open-Data enrichment surfaces on the Decision Queue**. |
| **P2-6** | Respect known gaps honestly (UTM broken, event-to-consult uninstrumented, unreliable fields) | **PASS** | CRM Ops shows **169 auto-detected UTM issues**, unreliable-field flags (TEFA/income/source), SSOT reminder, data-quality queue; parity 95% with income flagged — not faked green. |

### Cross-module rules (Spec §4) + demo proof points (Brief §"Show us it works")

| # | Hard gate | Verdict | Evidence |
|---|---|---|---|
| **X-1** | Auto cross-links (budget variance→queue; testimonial→content; objection→content; hot-family→admissions+queue; parent-event→field) | **PASS (budget link live)** | Budget-variance auto-flag confirmed live in the Leader queue; remaining links covered by module tests (`decisions-queue`, `admissions`, `content`, `grassroots`). |
| **X-2** | Data-confidence banner when parity drops | **PASS** | Home + Dashboard render **"Data confidence needs review"** → links to CRM Ops; driven by `parity` engine. |
| **D-1..D-5** | Demo: payment propagates · budget reconciles · role denied queue · banner on drop · Open Data query | **PASS (locally)** | All five demonstrable on the **local** app + tests. **NOT demonstrable on the live URL** — see HG-LIVE. |

### Deployment gate

| # | Hard gate | Verdict | Evidence |
|---|---|---|---|
| **HG-LIVE** | A working live demo URL + the three role logins (Brief §"How to submit") | **FAIL (P0)** | Live `/login` 200, but **every authenticated route returns `504 MIDDLEWARE_INVOCATION_TIMEOUT`** (reproduced consistently ~15 min). Root cause: Edge middleware (`middleware.ts`, no `runtime='nodejs'`) calls `loadProfileById` → `withoutProgram(postgres())` — **raw-TCP `postgres` v3.4.7 is unsupported in the Vercel Edge runtime**. Works locally only because `next dev` runs middleware in Node. Same code on `master` + `reconcile-status`. |

---

## Part B — Surface coverage

| Surface / state | Owner role | Status | Verdict | Worst V# | Finding | File(s) |
|---|---|---|---|---|---|---|
| `/` Home (admin) | All | done | **KEEP** | — | H1 20px, banner present, "Start here" CTAs, widget grid; condensed. | `app/page.tsx` |
| Home "+ Add widget" picker | All | done | **KEEP** | — | 45 widgets · 9 categories · search · source tag/row — matches PRD §3 M1. | `app/_components/*widget*` |
| `/m/status` Exec verdict board | Leadership | done | **KEEP** | — | H1 18px, dense; covered in detail by prior STATUS sweep. | `app/m/status/*` |
| `/m/dashboard` Scorecard | Marketing Lead | done | **KEEP** | — | H1 18px, 61 table cells (justified density), banner, Source citations. | `app/m/dashboard/*` |
| `/m/budget` | Budget Owner | done | **KEEP** | — | $365K reconcile + variance + decision-flag language all present. | `app/m/budget/*` |
| `/m/crm-ops` | Marketing Lead | done | **KEEP** | — | 169 UTM issues, unreliable-field flags, SSOT reminder, parity 95% — honest. | `app/m/crm-ops/*` |
| `/m/decisions` (Leader) | Leadership | done | **KEEP** | — | Badge "3", cards w/ approve/reject/need-info, Open-Data enrichment, budget auto-flag. | `app/m/decisions/*` |
| `/m/decisions` (Admin/Operator) | — | done | **KEEP** | — | Correctly 307→/forbidden with precise reason. | `lib/auth/policy.ts` |
| `/opendata` (admin) | Admin | done | **KEEP** | — | "Every dataset the Hub can pull" — PEIMS/STAAR/accountability. | `app/opendata/*` |
| `/dev/*` (admin) | Admin | done | **KEEP** | — | Admin-only enforced (L/O→forbidden). | `app/dev/*` |
| Sidebar nav (admin, default My/Fall) | — | done | **FIX** | V7/V9 | Default nav shows **8 of 14**; Grassroots, Content, Summer Camp, Events, Admissions, Budget absent for the Admin who has full access. VIEW=All toggle is **disabled on Home**. Reachable by URL. May be intentional role-scoping (see `ROLE-SCOPING-ADVISORY.md`) — ratify or expose an All toggle that works on Home. | `app/_components/Sidebar.tsx`, `lib/nav.ts` |
| Live deploy (any authed route) | all | done | **FIX (P0)** | V8 | 504 on every authenticated route — see HG-LIVE. | `middleware.ts`, `lib/auth/profile-store.ts`, `lib/db.ts` |
| Middleware per-request perf | — | done | **FIX (P1)** | V8 | Local `proxy.ts` ~6.0s/request when DB conn degrades (same `loadProfileById` read) — inflates every authed load; root of the Edge 504. | `middleware.ts` |
| `/m/{nurture,analytics,library,grassroots,content,summer-camp,events,admissions}` | various | partial | **KEEP (by test+code)** | — | Not individually re-rendered this pass (dev-server flakiness); use shared 20px `ModuleHeader`; covered by `test:frontend` (all green) + prior per-module panels. | `app/m/*` |

## Coverage note
- **Judged live (local):** Home + picker, Status, Dashboard, Budget, CRM Ops, Decision Queue (all 3 roles), Open Data, dev gate, full RBAC matrix.
- **By test (authoritative, live services):** 184+ tests green — backbone (87) + product (97). Phase-1 isolation/idempotency/parity and Phase-2 budget/decision/widget invariants.
- **Blocked / not re-rendered:** 8 module pages not individually screenshotted (dev server crashed twice under load + ~6s middleware); empty/error/zero-data states; mobile/responsive (defer to `gt-hub-visual-qa-panel`). The **live URL could not be swept at all** for authed routes (504).
