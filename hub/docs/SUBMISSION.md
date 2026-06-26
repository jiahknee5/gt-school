# GT Marketing Hub — Candidate Submission Write-up

> **Live demo (A5):** https://gt-school-hub.vercel.app — public, no Vercel login wall.
> Dev auth mode is ON, so the `/login` switcher lets reviewers pick **Admin / Leader /
> Operator** (no password) and still mints a real, server-enforced session. See §8 for the
> deploy and the `AUTH_DEV_MODE` trade-off.

> Technical Project submission for GT Anywhere. This is the A2 deliverable: what was
> built, what is deep vs. stood-in (and why), the trade-offs and rules I bent, and how to
> verify it. Evidence is pulled from the repo's own audits — `docs/01-intake/PRD-CHECKLIST.md`,
> `docs/audits/SECURITY-REVIEW.md`, `docs/audits/COHESION-REVIEW.md` — and the test suite.
> Date: 2026-06-26.

---

## 1. TL;DR — what this is

A centralized marketing-operations Hub for GT Anywhere built on a **single load-bearing
backbone**: program-isolated Postgres (RLS + FORCE), field-directional CRM↔app sync with
idempotency ledgers and parity tracking, and an app-level auth/RBAC layer. On top of that
backbone sit **13 module surfaces** and one campaign play — the **GT Challenge** — that
exercises every theme at once.

The guiding principle was **honesty over theater**: real code paths where it matters
(isolation, idempotency, dual-source reconcile, budget math, role gating), clearly-labeled
stand-ins everywhere else, and gaps tracked rather than faked green.

**Verification in one line:** `npm run verify` (build + lint + `test:ci`). Current status:
**385 tests passing, 0 todo**; production build clean; eslint clean.

---

## 2. Architecture

### 2.1 Phase 1 — the backbone (the artifact that's actually load-bearing)

- **Program isolation (provable).** `supabase/migrations/0001_backbone.sql` defines GLOBAL
  tables (CRM-wide) vs. PROGRAM-SCOPED tables protected by **RLS + FORCE**. Program reads/
  writes run as the restricted `app_rw` role (`NOSUPERUSER`, `NOBYPASSRLS`) with a
  per-transaction GUC (`SET LOCAL app.current_program`). An unset GUC returns **0 rows**
  (fail-closed). `service_role`/any BYPASSRLS role is **never** used on program-scoped paths.
  Program scope is derived from the session (`lib/auth/program.ts`), so a forged/out-of-scope
  program id throws `ProgramScopeError` (IDOR/BOLA guard).
- **Bidirectional sync, consistent over time.** `lib/sync/reconcile.ts` (inbound),
  `lib/sync/outbox-worker.ts` (durable outbound `sync_outbox`), and the HubSpot/Stripe
  webhook routes. Field-directional authority decides who wins per column (app_form vs.
  HubSpot vs. Stripe). Echo-suppression + `processed_events` kill duplicate-delivery loops.
- **Idempotent payments end-to-end.** `lib/payments.ts` — a twice-delivered Stripe event is
  recorded once; balances are monotonic; RLS `WITH CHECK` blocks cross-program writes.
- **Parity / data-confidence.** `lib/parity.ts` computes a per-entity parity score; a drop
  below threshold raises the **data-confidence banner** (`DataConfidenceBanner`) across the
  7 HubSpot-consuming modules.

### 2.2 Auth / RBAC (Tier 0)

- Deny-by-default `middleware.ts` over every non-static route. A signed-cookie session
  (`gt_session`, HMAC + expiry, `lib/auth/token.ts`) is verified **server-side**; role is
  looked up from the verified user id, **never** read from the request.
- Shared, pure route policy (`lib/auth/policy.ts`): unauthenticated → 401 JSON (API) /
  `/login` redirect (page); **Decision Queue is Leader-exclusive** (`/m/decisions*`,
  `/api/decisions*`); `/dev*` + `/opendata*` are **Admin-only**. The public GT Challenge
  funnel (`/gifted-quiz`, `/api/gifted-quiz`) is the one explicitly allow-listed public path.
- Three demo identities (`DEMO_USERS`) and a password-less dev role switcher that still mints
  a real, server-enforced session — swap in a real IdP without changing call sites.

### 2.3 The 13 modules (depth is intentionally uneven)

| Tier | Modules | Depth |
|---|---|---|
| 1 (deep, P0) | CRM Ops · Budget · Decision Queue | ledger / parity / role-gating + tests |
| 2 | Dashboard · Nurture · Home | built (Home picker is the C5 partial) |
| 3 | Grassroots · Admissions · Content · Analytics | built |
| 4 | Summer Camp · Field Events · Library | Camp deep (dual-source/C6); Events/Library lighter on purpose |

Cross-module rules are wired and each has a visible landing: testimonial→Content,
objection→brief, hot-family→Decision Queue, **budget variance >10%→Decision Queue**,
parity→banner, event→Field.

### 2.4 GT Challenge (the one play that lights all four signals)

End-to-end, built **on** the backbone (not forked):

1. **Public capture** — `app/(public)/gifted-quiz/` is a mobile-first, no-Hub-chrome quiz
   (≤6 questions, consent checkbox directly above submit, explicit result screen, graceful
   duplicate/error states). It POSTs to `app/api/gifted-quiz/route.ts`.
2. **Consent + dedup + grade** — `lib/gt-challenge/capture.ts` rejects non-consented
   submissions before persistence, collapses duplicate `idempotency_key`s to one submission +
   one lead, normalizes missing UTM to `(not set)` (never dropped), and resolves identity via
   `matchKey`. `lib/gt-challenge/assess.ts` is a deterministic grader behind a swappable
   `Grader` interface with **no "not gifted" bucket** — the lowest bucket is `explore`.
3. **Report** — submissions/qualified/CPQL definitions live in one place; the reviewer view is
   `/m/submissions`. CPQL is a **measured** number (spend ÷ counted qualified), not a constant.

The GT Challenge demonstrates all four "show us it works" signals: a submission propagates
capture → lead → score; its spend rolls into the `grassroots` budget workstream (total still
$365K); a "raise Challenge budget" decision is denied to non-leaders; and an inbound edit to a
Challenge lead drops parity → banner.

---

### 2.5 Ask-the-Hub AI agents

The AI layer is implemented as a read-only, role-aware operating assistant rather than an
unbounded chatbot. `/api/ask` and `/help/ai-agents` expose four deterministic no-key agents:
Growth Strategy, Data Quality, Decision Support, and Operator Coach. They retrieve from the Hub's
source-of-truth rules, seeded business facts, Decision Queue/Budget helpers, CRM Ops parity, Help
guides, and Open Data enrichment. Every answer returns citations, confidence, caveats, and next
actions.

The guardrails are explicit: exact CAC-by-channel is refused while UTM attribution is broken;
Operators get coaching and own-submission guidance instead of the full Decision Queue; raw PII,
SMS bodies, child names, and unconsented quotes are refused; Open Data stays read-only decision
context. A live LLM summarizer and persisted ask-audit rows are deferred behind the pure, tested
route.

## 3. Data strategy — honest by construction

- **Real vs. stood-in is labeled.** Seed records that mirror the backbone migration
  column-for-column load straight into Postgres; everything else carries a `_standIn: true`
  tag and a `_source` label. The brief requires this honesty to be **visible**, so it is.
- **Reproducible.** Deterministic RNG (`generate({ seed: 424242, families: 1200 })`),
  `npm run reset`, `npm run seed:fixtures`.
- **Edge cases on purpose.** 15 deliberate edge cases (duplicate webhook delivery, missing
  UTM, conflicting dual-source rows, budget variance, etc.) in `lib/seed/invariants.ts`,
  asserted by tests.
- **Budget is exactly $365K** across 4 workstreams (`lib/seed/dictionaries.ts`), reconciled by
  summation in one place — no figure is computed two ways.

---

## 4. The four acceptance signals (and where to watch them)

| Signal | Where to watch | Proof |
|---|---|---|
| Watch a payment propagate (no contamination) | `/dev/payments` | `tests/payments.test.ts` (live) + `payment-propagation-surface.test.ts` (pure) |
| A budget reconcile to the total | `/m/budget` | `tests/budget.test.ts` → 4 workstreams sum to $365K |
| A role denied the Decision Queue | sign in as Operator → `/m/decisions` → `/forbidden` | `tests/rbac.test.ts`, `UC-DEMO-ROLE-DENIED-AUTH-UI` |
| Data-confidence banner on parity drop | any HubSpot module after an inbound edit | `tests/module-routes.test.ts`, `lib/parity.ts` |
| (bonus) Open Data query that changes a decision | `/m/decisions` | `tests/opendata.test.ts` — `pilot -> approve` recommendation flip |

---

## 5. What this closeout pass added (final hardening)

This pass closed the remaining security/legibility gaps that the audits had tracked as open:

| Item | Status | Files | Resolves |
|---|---|---|---|
| Public GT Challenge quiz UI (no Hub chrome) | DONE | `app/(public)/gifted-quiz/{page,GiftedQuiz}.tsx` | Lindqvist legibility gate; A-level demo step 1 |
| Decision ruling **actor audit trail** (who/when/what) | DONE | `supabase/migrations/0014_decision_audit.sql`, `lib/decisions/audit.ts`, `app/api/decisions/[id]/decide/route.ts`, `tests/decisions.test.ts` | **S6** |
| Security headers + report-only CSP | DONE | `next.config.ts` | **S7-b** |
| Rate limiting on the public capture endpoint | DONE | `lib/ratelimit.ts`, applied in `app/api/gifted-quiz/route.ts`, `tests/ratelimit.test.ts` | **S7-c** |

Design notes / trade-offs:

- **No-chrome public route, the safe way.** The proper Next.js pattern for a marketing page
  with no app chrome is a multi-root-layout route-group split — but that edits the shared root
  layout, which a parallel agent owns and is restructuring. To avoid corrupting that work, the
  quiz renders as a **full-bleed `fixed inset-0` overlay** inside a `(public)` route group: it
  visually carries no sidebar/top bar without touching `app/layout.tsx`, `Sidebar.tsx`, or
  `TopBar.tsx`. If/when the root-layout split lands, the page can drop the overlay wrapper.
- **Append-only audit, in-transaction.** `decision_event` is granted `select, insert` only
  (never update/delete) so the trail can't be rewritten from the app path. The audit row is
  written in the **same transaction** as the ruling, so a ruling can never persist without its
  who/when/what. `buildDecisionEvent` is a pure function, so the audit content is unit-tested
  without a live DB.
- **CSP ships report-only** first (`Content-Security-Policy-Report-Only`) so it can't break
  Next's inline styles / RSC payloads before the running app is validated; tighten to enforcing
  after deploy. The other headers (`X-Frame-Options`, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, HSTS-in-prod) enforce immediately.

---

## 6. Honest gaps (tracked, not faked green)

- **GT Challenge persistence is a contract, not a live DB write.** The route uses an
  in-memory store with the exact transactional contract (consent gate, idempotent replay, UTM
  honesty, score/bucket/qualified). The migration for the persistent tables is specced in
  `docs/06-gt-challenge/WORKFLOW.md` §3; swapping the in-memory store for a transactional DB
  adapter over `campaigns`/`quiz_submissions` is the remaining work (the route response says
  so explicitly in its `dbGap` field).
- **C5 composable Home** — widget library, role-aware starter pack, and `home_layout` GET/PUT
  all exist; a browser drag-and-drop E2E remains.
- **A1 top-level README** — `.env.example` and this write-up cover setup; a dedicated
  run-in-minutes `README.md` is still recommended (see §7 for the exact steps it should hold).
- **Live integration tests** (`test:live`: reconcile, payments, webhook, parity, R1
  connection) require real credentials and are excluded from the pure CI gate by design.

---

## 7. Run it in minutes

```bash
cd hub
npm install
cp .env.example .env.local      # fill with YOUR OWN free-tier keys (see §8); .env.local is gitignored
npm run verify                  # build + lint + test:ci (the pure gate, no external creds needed)
npm run dev                     # http://localhost:3000
```

- **Sign in:** dev auth mode is ON outside production — the top-bar role switcher mints a real,
  server-enforced session for **Admin / Leader / Operator** (no password). Use it to demo role
  gating (Operator → `/m/decisions` → `/forbidden`).
- **Public funnel:** open `/gifted-quiz` (no account needed) to run the GT Challenge.
- **Seed a DB (optional, needs Supabase):** `npm run seed` then `npm run seed:fixtures`.

---

## 8. Deploy (A5) — LIVE

**Live URL:** https://gt-school-hub.vercel.app (Vercel project `gt-school-hub`, Root
Directory = `hub`, zero-config Next.js — there is **no `vercel.json`**).

**Demo deploy config (what's actually live):**
- `AUTH_SECRET` — a real 32-byte secret, generated with `openssl rand -hex 32` and set as a
  Vercel **production** env var. It is **not** committed anywhere in the repo.
- `AUTH_DEV_MODE=true` — deliberate choice for this demo URL so reviewers can pick
  Admin/Leader/Operator from the `/login` switcher with no password. This is safe for a
  *private demo link* but means anyone with the URL can assume any role; for a truly public
  deployment, flip to `AUTH_DEV_MODE=false` and wire a real IdP (see §9).
- No database is attached — the pure demo runs without one (the live/DB-backed paths in §8.2
  light up only after Supabase is provisioned and seeded).

**Smoke test (passed on the live URL):** `/` redirects to `/login`; all three role logins mint
a session; `/m/decisions` is Leader-only (Operator → `/forbidden`, `/api/decisions` → 403 JSON);
`/gifted-quiz` is publicly reachable (200, no auth); `/m/budget` reconciles to **$365K** across
4 workstreams; the **data-confidence banner** renders on `/m/nurture`.

To re-deploy: `cd hub && vercel --prod --yes`. To make it truly public, see §9.

### 8.1 Steps (full DB-backed deploy)

1. **Create the Vercel project** pointing at this repo, **Root Directory = `hub`**. Framework:
   Next.js (auto). Build command `next build`, output auto.
2. **Provision Supabase** (free tier): run the migrations in `supabase/migrations/` in order
   (`0001` … `0014`). Create the restricted `app_rw` login (NOSUPERUSER, NOBYPASSRLS). Then
   `npm run seed` against it for demo data.
3. **Set environment variables in Vercel** (Production + Preview) — see §8.2. At minimum the
   app needs `AUTH_SECRET` (and you almost certainly want `AUTH_DEV_MODE=false` + a real IdP
   for a public URL; with dev mode on, anyone can pick a role).
4. **Deploy**, then validate the report-only CSP against the running app before flipping it to
   enforcing (`Content-Security-Policy`) in `next.config.ts`.
5. **Smoke test the 3 role logins** and the four acceptance signals (§4) on the live URL.

### 8.2 Environment variables the deploy needs

Required for the app to boot securely:

- `AUTH_SECRET` — HMAC secret for the session cookie (`openssl rand -hex 32`). **Required in
  production.**
- `AUTH_DEV_MODE` — set **`false`** for a public deploy (dev mode is a password-less role
  switcher; fine for a private demo URL, unsafe for a truly public one).

Required for the live/DB-backed paths (the pure demo runs without them):

- `APP_RW_DATABASE_URL` — restricted `app_rw` Postgres login (via Supavisor pooler).
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  (server-only; never used on program-scoped paths).
- `HUBSPOT_PRIVATE_APP_TOKEN`, `HUBSPOT_APP_SECRET`, `HUBSPOT_PORTAL_ID` — CRM sync.
- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` — payments.
- `OPENDATA_API_BASE` (+ `OPENDATA_API_KEY` if required) — Open Data enrichment.
- `ANTHROPIC_API_KEY`, `ASK_THE_HUB_MODEL` — the Ask-the-Hub agent.
- App config: `PROGRAMS`, `PARITY_THRESHOLD`, `INBOUND_HUBSPOT_DEMO`.

Full annotated list lives in `.env.example`. **Never commit `.env.local` or real secrets.**

---

## 9. Still needs the user (cannot be faked)

- **A4 — walkthrough video (5–10 min, +≥1 failure/edge).** Record against the live URL
  (https://gt-school-hub.vercel.app). Suggested script: sign in as Leader → the four
  acceptance signals (§4: `/m/budget` $365K, data-confidence banner on `/m/nurture`,
  `/dev/payments` as Admin) + the GT Challenge end-to-end (`/gifted-quiz` → `/m/submissions`,
  §2.4) + one deliberate failure (sign in as Operator → `/m/decisions` → `/forbidden`, or a
  duplicate quiz submit returning the same lead).
- **A5 — deployment: DONE.** Live at https://gt-school-hub.vercel.app with `AUTH_DEV_MODE=true`
  (see §8). To make it a *truly public* URL, set `AUTH_DEV_MODE=false`, wire a real IdP, and
  provision + seed Supabase per §8.1–8.2 so the DB-backed paths light up.

---

## 10. Proof index

- `npm run verify` → build + lint + `test:ci` (**385 passing, 0 todo**).
- Backbone/security: `tests/rbac.test.ts`, `tests/payments.test.ts`, `tests/parity.test.ts`,
  `tests/reconcile.test.ts`.
- Product: `tests/budget.test.ts`, `tests/decisions.test.ts` (incl. the new S6 audit trail),
  `tests/crm-ops.test.ts`, `tests/summer-camp.test.ts`, `tests/gt-challenge.test.ts`,
  `tests/ratelimit.test.ts`, `tests/opendata.test.ts`, `tests/ask-agents.test.ts`,
  `tests/ask-route.test.ts`.
- Audits: `docs/01-intake/PRD-CHECKLIST.md`, `docs/audits/SECURITY-REVIEW.md`,
  `docs/audits/COHESION-REVIEW.md`.
