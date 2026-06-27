# QA Value Sweep — Report (full PRD hard-gate pass)

**Target:** local `http://localhost:3000` @ `reconcile-status` (what's built) · live `gt-school-hub.vercel.app` (=`master`).
**Date:** 2026-06-27. **Scope:** every PRD/Brief hard gate, the RBAC role matrix, and a value pass over the rendered surfaces. Ledger: `QA-SWEEP-LEDGER.md`.

## Headline

**The product is built correctly — but the live deployment is broken for every logged-in user.**

All 14 PRD hard gates PASS at the logic level (184+ tests against *live* Supabase/HubSpot/Stripe) **and** in the running local app: program isolation by RLS, idempotent payment propagation, the $365K budget reconcile + >10% variance auto-flag, the Leader-only Decision Queue (Admin and Operator both denied), the composable 45-widget Home, Open-Data enrichment that changes a decision, and the honest data-confidence banner. Locally you can watch every one of the Brief's "show us it works" moments.

**The one FAIL is the deployment gate, and it's a P0:** on the live URL, `/login` works but **every authenticated route returns `504 MIDDLEWARE_INVOCATION_TIMEOUT`**. A grader who logs in with the role credentials sees a 504 on every page — none of the green gates above are reachable in production.

## Verdict roll-up

- **Hard gates:** 13 PASS · **1 FAIL (P0 — live deploy)**.
- **Surfaces:** KEEP 10 · **FIX 3** (live-504, middleware perf, nav scoping) · MERGE 0 · CUT 0.
- Nothing is dead weight or wrong-purpose — no surface fails V1/V3/V5. The product *content* earns its place; the failures are an infrastructure break and a navigation/discoverability nit.

## Prioritized fix backlog

### P0 — production is down for authenticated users (ship-blocker)
1. **Live 504 on all authed routes — Edge middleware does a raw-TCP Postgres read.**
   `middleware.ts` runs on the Edge runtime (no `export const runtime = 'nodejs'`). On every request with a session cookie it calls `loadProfileById` → `withoutProgram(postgres())`, and `postgres` v3.4.7 opens a **raw TCP socket, which the Vercel Edge runtime does not support** → the invocation times out → 504. Public `/login` is fine (no DB read); unauthenticated requests are fine (no cookie → no read). Works locally only because `next dev` runs middleware in Node. Present on both `master` and `reconcile-status`.
   - **Fix (pick one, in preference order):**
     1. **Stop reading the DB in middleware** — carry the role as a signed claim in the session token (`lib/auth/token.ts`), so `routeDecision` needs no `loadProfileById`. Keeps Edge fast, fixes the perf issue below too. *(Recommended.)*
     2. Opt middleware into the Node runtime (Next 16 supports Node middleware) so TCP works — but you still pay the per-request DB latency.
     3. Swap the middleware profile lookup to an Edge-compatible HTTP driver (Supabase REST / `@vercel/postgres` / `@neondatabase/serverless` over HTTP).
   - **Confirm:** check `APP_RW_DATABASE_URL` is set in the Vercel env (if it is, the DB path is taken — consistent with the 504).
   - Files: `middleware.ts`, `lib/auth/profile-store.ts`, `lib/auth/token.ts`, `lib/db.ts`.

### P1 — performance / correctness
2. **Per-request middleware DB read adds ~6s locally.** Same root cause: `proxy.ts: 6.0s` in the dev log when the Supabase connection degrades — every authenticated navigation pays it, and it's what tips Edge over the timeout. The P0 fix #1 (role-in-token) removes this read entirely. Files: `middleware.ts`, `lib/auth/profile-store.ts`.

### P2 — navigation / discoverability
3. **Default sidebar hides 6 modules from the Admin.** With the default `My` / `Fall` scope, the Admin (full-access Marketing Lead) sees only 8 of 14 modules in the nav — Grassroots, Content, Summer Camp, Field & Events, Admissions, and Budget are absent (reachable only by direct URL), and the `VIEW: All` toggle is **disabled on Home**. PRD §2 calls for a sidebar "module list." Either (a) make the `All` toggle work on Home so full access is one click, or (b) if the role-scoped default is intentional (`ROLE-SCOPING-ADVISORY.md`), have Johnny/the cohesion panel ratify it and add a visible "show all modules" affordance. Files: `app/_components/Sidebar.tsx`, `lib/nav.ts`, `app/api/nav/scope/route.ts`.

## GT Challenge end-to-end: does the data pass through to the Hub? (answer to the direct question)

> **UPDATE 2026-06-27 — NOW WIRED END-TO-END (was a stub).** Per Johnny's direction this
> was implemented, not just flagged. A public quiz submission now persists to the DB,
> originates a CRM lead, routes qualified fits into Fall Enrollment, lands as a real
> HubSpot contact via the existing outbox backbone, and shows as a **live** count on
> `/m/gt-challenge`. Proof: `tests/gt-challenge-db.test.ts` (capture→DB→outbox→membership,
> idempotent, live KPI) + `tests/gt-challenge-hubspot.test.ts` (create→resolve→idempotent
> →archive against live HubSpot) + `tests/gt-challenge.test.ts` (route now `persistence:"db"`);
> full suite green (595 passed). Live screenshot: `qa-shots/gtc-5-live-report.png` (Qualified
> read 3 from 3 submitted, CPQL computed live). Changes: migration `0020_gt_challenge.sql`
> (+`quiz_submissions`, app_rw write on families); `lib/gt-challenge/store-db.ts`;
> `app/api/gifted-quiz/route.ts`; `lib/connectors/hubspot.ts` + `lib/sync/outbox-worker.ts`
> (`upsert_contact` create-by-email path); `lib/phase2.ts` + `app/m/[slug]/page.tsx` (live read).
> The original finding below is retained for the record.

**Originally (pre-fix): No — the capture+scoring half was real; the persistence→Hub half was a documented stub.** Verified by submitting a real qualifying quiz against the running app:

- **What works (real + tested):** `POST /api/gifted-quiz` (public) validated consent + contact, graded the answers deterministically (`rawScore 90 → strong_fit → qualified → routed → fall_enrollment`), captured UTM, and deduped on idempotency key. `gt-challenge.test.ts` (6) covers all of it.
- **What does NOT pass through:** the route persists to an **in-memory `Map`** (`InMemoryGiftedQuizCaptureStore`) and returns `"persistence": "memory-contract"` + a `dbGap` naming the missing adapter (`campaigns, quiz_submissions, families, sync_outbox, processed_events`). The test suite *asserts* this (`gt-challenge.test.ts:181-182`). So: **no DB write, no real HubSpot lead, no outbox enqueue.**
- **The Hub shows seed, not live captures.** `/m/gt-challenge` (Spend $8,208 · **Qualified 12** · CPQL $684), the Dashboard/Home KPI row, and CRM Ops all read from seed `generate()`. The submission I sent **did not appear and did not move Qualified off 12** (`shows-my-submission=false`). `summarizeGiftedQuizCaptures` / the capture store are referenced **only** in the API route, never in a render path.
- **Honest, not faked:** the page labels itself "Worked example", says "capture persistence remains tracked separately", and surfaces "UTM attribution is known broken… not treated as truth." This is a **deliberate, documented scope cut** (the Brief calls the GT Challenge "optional"), consistent with the spec's "be honest about what's broken" rule — *not* a green-washed fake.
- **Contrast:** the **payment** pipeline IS wired end-to-end to the real DB (RLS isolation + idempotent outbox + HubSpot, proven against live Stripe/Supabase). The GT Challenge capture is the one "worked example" loop that stops at an in-memory contract.

**Fix to make it actually flow (P1 if you want it live):** implement the `GiftedQuizCaptureStore` against the DB (the `dbGap` lists the exact tables) → enqueue to `sync_outbox` so the lead reaches HubSpot via the existing Phase-1 backbone → have the `/m/gt-challenge` surface + Dashboard KPI read submission counts from the store (via `summarizeGiftedQuizCaptures`) instead of seed. Screenshots of the current loop: `docs/audits/qa-shots/gtc-{1-guide,2-budget,3-quiz,4-report}.png`.

## Are we sure the UI is condensed? (answer to the direct question)

**Yes — the UI is genuinely condensed, and the old inconsistency is resolved.** Measured from the rendered pages and the header components:

- **Type scale is tight everywhere:** page H1 **20px** (shared `ModuleHeader`, `modkit.tsx:148`), with Dashboard + Status at **18px**; section H2 15px; metric values 18px (mono); body 12px; notes 11px; labels/badges 10px. (For reference, a non-condensed app runs H1 ~30px / body 16px.)
- **It's now consistent.** The prior audit's finding **X1** ("half-applied density pass → two coexisting densities; ~9 modules at H1 ~30px") is **stale/fixed**: nothing renders at 30px anymore; 12 surfaces share the 20px header, only Dashboard + Status sit 2px denser at 18px (a deliberate, near-invisible delta).
- **Density is earned, not empty.** Dashboard packs 61 table cells; scroll heights are reasonable (home 1299px, status 1123px) — dense with data, not padded whitespace.

**Caveat on certainty:** the value sweep's V1–V10 rubric does **not** include visual density — that's `gt-hub-visual-qa-panel`'s Q1/Q8 territory. I added the check for this pass and verified it via computed styles + the header components, but I did **not** get a clean full-page rendered-density measurement on *every* module (the live URL 504'd and the dev server crashed twice). The 18-vs-20px Dashboard/Status delta and any per-module padding drift are the only things a dedicated visual pass should still confirm. If you want pixel-level density convergence enforced, run `/gt-hub-visual-qa-panel`.

## What's already earning its place (don't over-correct)
- **The backbone is real and honest.** Isolation is RLS-enforced (cross-program write denied), payments are idempotent and survive out-of-order events, reconcile is stable, parity is computed (not faked) and the banner tells the truth ("needs review", income flagged).
- **The hard product invariants hold.** $365K reconciles live (throws if it doesn't), variance auto-flags into the queue, the Leader-only gate denies both Admin and Operator with the exact spec reason, the 45-widget composable Home matches the spec's 9 categories, and Open Data actually enriches a decision.
- **Honest about what's broken** (the spec's whole point): 169 UTM issues surfaced, unreliable fields flagged, SSOT reminder shown — no green-washing.

## Coverage statement
- **Judged live (local, all 3 roles where view differs):** Home + widget picker, Status, Dashboard, Budget, CRM Ops, Decision Queue, Open Data, `/dev`, and the full RBAC HTTP matrix.
- **Authoritative tests (live services):** 184+ green across backbone + product (`vitest`).
- **Not re-rendered this pass:** 8 module pages individually (Nurture, Analytics, Library, Grassroots, Content, Summer Camp, Field & Events, Admissions) — covered by `test:frontend` (green) + code (shared 20px header) + prior per-module panels; empty/error/zero-data states; mobile/responsive.
- **Blocked:** the **live URL** could not be swept for any authenticated route (504, root-caused above); the dev server crashed twice under concurrent load (~6s middleware), so the full per-surface render loop was cut short. No silent gaps — the above is the honest extent.

## Stop condition
One full hard-gate pass complete: all 14 gates evaluated, RBAC matrix run live across 3 roles, density question answered with measurement. Not run to the two-dry-round loop over every module render (dev-server instability) — the 8 un-rendered module pages are the open tail, but they are test- and code-covered and carry no hard gate. **The P0 live-deploy break is the one thing to fix before any demo/submission.**
