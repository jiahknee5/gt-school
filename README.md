# GT Marketing Hub — GT School Technical Project

A centralized marketing-operations Hub for **GT Anywhere**, built on a load-bearing data
backbone: **program-isolated Postgres (RLS)**, **bidirectional CRM↔app sync** with idempotent
payments and a parity / data-confidence signal, and **app-level auth + RBAC**. On top sit the
marketing modules, a **Status command center** with a checked AI layer, and one **live
end-to-end campaign** — the GT Challenge: a real lead flows *ad → quiz → a $100 Stripe test
deposit → tracked through HubSpot*.

Guiding principle: **honesty over theater** — real code where it matters, every stand-in
labeled, gaps tracked rather than faked green.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Postgres (Supabase) ·
Stripe · HubSpot · Vitest.

| | |
|---|---|
| **Live demo** | https://gt-school-hub.vercel.app — roles: **Admin / Leader / Operator** (dev-auth, no password) |
| **Write-up (2 pages)** | https://gt-school-hub.vercel.app/writeup.html |
| **Full submission write-up** | [`hub/docs/SUBMISSION.md`](hub/docs/SUBMISSION.md) |
| **App-level README** | [`hub/README.md`](hub/README.md) |

---

## Table of contents

1. [What this is](#what-this-is)
2. [Quickstart — the pure demo (≈ 2 minutes, no accounts)](#quickstart)
3. [Prerequisites](#prerequisites)
4. [Run modes](#run-modes) — A) pure demo · B) full DB-backed + live integrations
5. [Sign in & roles](#sign-in--roles)
6. [Prove it works — the four signals](#prove-it-works)
7. [The GT Challenge — live end-to-end slice](#the-gt-challenge)
8. [Environment variables](#environment-variables)
9. [Repository structure](#repository-structure)
10. [Scripts reference](#scripts-reference)
11. [Deploy (Vercel)](#deploy)
12. [Architecture & security notes](#architecture--security)
13. [Docs index](#docs-index)

---

<a name="what-this-is"></a>
## 1. What this is

The project is **two connected phases** in one repo:

- **Phase 1 — the backbone.** A sync engine that keeps a CRM (HubSpot) in sync with isolated
  program stores in Postgres, processes payments end-to-end idempotently, and exposes a
  sync-parity / data-confidence signal. This is the load-bearing artifact.
- **Phase 2 — the product.** The GT Marketing Hub, built **on** that backbone: per-function
  modules, the canonical weekly KPI scorecard, a $365K Budget Tracker, a leadership-only
  Decision Queue, a composable per-user Home, and an Ask-the-Hub AI layer.

The runnable product lives in [`hub/`](hub/). Root-level [`db/`](db/) and [`scripts/`](scripts/)
hold the original standalone Phase-1 tooling (see [§9](#repository-structure)).

---

<a name="quickstart"></a>
## 2. Quickstart — the pure demo (≈ 2 minutes, no accounts)

The app runs end-to-end on a **deterministic seed** with no external services — perfect for a
first look.

```bash
git clone https://github.com/jiahknee5/gt-school.git
cd gt-school/hub
npm install
cp .env.example .env.local        # then set the two pure-demo vars below
npm run dev                       # → http://localhost:3000
```

In `.env.local`, for the pure demo you only need:

```bash
AUTH_SECRET=$(openssl rand -hex 32)   # paste the value; required for the session cookie
AUTH_DEV_MODE=true                    # password-less Admin/Leader/Operator switcher
```

Then verify the build and tests (no credentials needed):

```bash
npm run verify        # next build + eslint + the pure test suite
```

> In pure mode everything renders, RBAC is fully enforced, and budgets/KPIs are real math over
> the seed. The two *cause→effect* backbone proofs (a payment **moving**, parity **dropping**)
> show clearly-labeled **seed-fixtures** until you attach a database — see [Run mode B](#run-modes).

---

<a name="prerequisites"></a>
## 3. Prerequisites

- **Node 20 LTS** recommended (18.18+ minimum) · **npm**.
- **Run mode B only** — free-tier accounts you create yourself (the brief evaluates how you
  manage credentials; none are shipped): **Supabase**, **HubSpot** (developer), **Stripe**
  (test mode), **Open Data** (tryopendata.ai), **Anthropic**.

---

<a name="run-modes"></a>
## 4. Run modes

### A — Pure demo (no accounts)
As in [§2](#quickstart). Use it to explore every surface, the role gates, the budget math, and
the dev/admin pages (which read committed deterministic fixtures).

### B — Full, DB-backed + live integrations
Lights up real propagation, the live GT Challenge slice, and `/dev/payments` as **Live DB**.

```bash
cd hub
# 1) Supabase — create a project, then run the migrations IN ORDER:
#    apply every file in hub/supabase/migrations/ (0001_backbone.sql … 0018_*.sql).
#    Create the restricted login role used by the app (NOT service_role):
#      create role app_rw login password '…' nosuperuser nobypassrls;
#    Use the Supabase transaction pooler (port 6543) for APP_RW_DATABASE_URL.

# 2) Fill .env.local with your keys (full annotated list in hub/.env.example):
#    Supabase (URL, anon, service_role, APP_RW_DATABASE_URL), HubSpot, Stripe (test),
#    Open Data, Anthropic, AUTH_SECRET.

# 3) Seed:
npm run seed            # deterministic data → Supabase (seed 424242)
npm run seed:hubspot    # contacts + deals + custom gt_* props → HubSpot
npm run seed:fixtures   # committed fixtures the /dev pages read
# npm run reset         # clear back to a known state

# 4) Stripe — point a test webhook at /api/webhooks/stripe
#    (e.g. `stripe listen --forward-to localhost:3000/api/webhooks/stripe`).

npm run dev
```

Live integration tests (real Supabase/HubSpot/Stripe) run separately and skip without creds:

```bash
npm run test:live
```

---

<a name="sign-in--roles"></a>
## 5. Sign in & roles

With `AUTH_DEV_MODE=true`, `/login` offers a **password-less switcher** for three identities —
**Admin** (Marketing Lead), **Leader** (designated leadership), **Operator**. The session is a
real, server-enforced signed cookie; the role is resolved from the verified user id, never the
request. Swap in a real IdP by flipping `AUTH_DEV_MODE=false` — no call-site changes.

- **Decision Queue** is **Leader-exclusive** (`/m/decisions*`, `/api/decisions*`).
- **`/dev/*`** developer/admin pages are **Admin-only**.
- Deny-by-default middleware gates every non-static route; the public GT Challenge funnel
  (`/ad`, `/gifted-quiz`, `/track/*`) and `/writeup.html` are the explicit allow-listed paths.

---

<a name="prove-it-works"></a>
## 6. Prove it works — the four signals

| Signal | Where to watch | Proof |
|---|---|---|
| A payment propagates, no contamination | `/dev/payments` (Admin) + the live slice | `tests/payments.test.ts` |
| A budget reconciles to the total | `/m/budget` | `tests/budget.test.ts` → 4 workstreams sum to **$365K** |
| A role denied the Decision Queue | Operator → `/m/decisions` → `/forbidden`; `/api/decisions` → 403 | `tests/rbac.test.ts` |
| Data-confidence banner on parity drop | `/dev/proof` + HubSpot modules | `tests/parity.test.ts`, `module-routes.test.ts` |
| *(bonus)* Open Data query that changes a decision | `/m/decisions` (Leader) | `tests/opendata.test.ts` — `pilot → approve` flip |

`npm run verify` runs the build, lint, and the pure test suite (no external services). The
`/dev/proof` page runs the four checks live against the real functions.

---

<a name="the-gt-challenge"></a>
## 7. The GT Challenge — live end-to-end slice

The brief's worked example, built on the backbone and live in **Run mode B**:

`/ad` → `/gifted-quiz` (consent-gated) → **"pay $100 deposit"** → a real Stripe test charge runs
through the production webhook handler (records the payment, flips the enrollment to paid, queues
the HubSpot deal) → `/track/<lead>` shows that one record advance **ad → quiz → routed → paid →
synced** → spend rolls into the budget, KPIs (spend · qualified · CPQL) update on
`/m/gt-challenge`. One play exercises all four signals at once.

---

<a name="environment-variables"></a>
## 8. Environment variables

Full, annotated template: [`hub/.env.example`](hub/.env.example). **Never commit `.env.local`.**

| Variable | Purpose | Needed for |
|---|---|---|
| `AUTH_SECRET` | HMAC secret for the session cookie (`openssl rand -hex 32`) | pure + live |
| `AUTH_DEV_MODE` | `true` = password-less role switcher | pure + live |
| `APP_RW_DATABASE_URL` | restricted `app_rw` Postgres login (Supavisor pooler) | live |
| `NEXT_PUBLIC_SUPABASE_URL` · `…_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` | Supabase (service_role server-only, never on program paths) | live |
| `HUBSPOT_PRIVATE_APP_TOKEN` · `HUBSPOT_APP_SECRET` · `HUBSPOT_PORTAL_ID` | CRM sync + webhook signature | live |
| `STRIPE_SECRET_KEY` · `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` · `STRIPE_WEBHOOK_SECRET` | payments (test mode) | live |
| `OPENDATA_API_BASE` (+ `OPENDATA_API_KEY`) | Texas public-school data | live |
| `ANTHROPIC_API_KEY` · `ASK_THE_HUB_MODEL` | Ask-the-Hub + Status verdict | live (deterministic fallback otherwise) |
| `PARITY_THRESHOLD` · `PROGRAMS` · `INBOUND_HUBSPOT_DEMO` | app config | live |

---

<a name="repository-structure"></a>
## 9. Repository structure

```
hub/                       the Next.js app — the product (see hub/README.md)
  app/                     App Router routes (m/*, dev/*, api/*, (public)/ad, gifted-quiz, track)
  lib/                     backbone + domain logic (db, payments, sync, parity, auth, metrics, status, ai…)
  supabase/migrations/     0001_backbone.sql … 0018_* (apply in order)
  scripts/                 seed.ts · seed-hubspot.ts · gen-fixtures.ts · reset.ts · pay.ts
  tests/                   Vitest suites (pure CI gate + credential-gated live)
  public/                  static assets + writeup.html (deployed)
  docs/                    SUBMISSION.md, write-up, deck, walkthrough/narration scripts, audits
db/                        Phase-1 backbone SQL (original standalone schema + roles + seed)
scripts/                   Phase-1 backbone tooling (seed-hubspot · pay · stripe-service · check-parity)
PRD/                       the Technical Project Brief + Product Specification
```

---

<a name="scripts-reference"></a>
## 10. Scripts reference

Run inside `hub/`:

| Script | What it does |
|---|---|
| `npm run dev` | Next dev server on `:3000` |
| `npm run build` | Production build |
| `npm run verify` | `build` + `lint` + `test:ci` — the full pure gate |
| `npm run test:ci` | The pure test suite (no external services) |
| `npm run test:live` | Live integration tests (require real Supabase/HubSpot/Stripe) |
| `npm run seed` · `seed:hubspot` · `seed:fixtures` · `reset` | seed DB · seed HubSpot · generate dev-page fixtures · clear |

---

<a name="deploy"></a>
## 11. Deploy (Vercel)

The app is deployed at **https://gt-school-hub.vercel.app** (Vercel project `gt-school-hub`,
**Root Directory = `hub`**, zero-config Next.js).

```bash
cd hub && vercel --prod
```

Set the env vars from [§8](#environment-variables) in the Vercel project (Production + Preview).
For a truly public URL, set `AUTH_DEV_MODE=false` and wire a real IdP. The 2-page write-up is
served statically at `/writeup.html`.

---

<a name="architecture--security"></a>
## 12. Architecture & security notes

- **Program isolation (provable).** Program-scoped tables behind **RLS + FORCE**; the app runs
  as `app_rw` (`NOSUPERUSER`, `NOBYPASSRLS`) with a per-transaction GUC (`SET LOCAL
  app.current_program`). An unset scope returns **0 rows** (fail-closed); a cross-program write
  is rejected by the database. `service_role` is never used on program paths.
- **Idempotent payments.** A twice-delivered Stripe event is recorded once (`processed_events`);
  balances stay monotonic.
- **Single source of truth.** Funnel/income = Supabase `app_form`, engagement = HubSpot, budget
  = the Hub. Every number is computed in one place; the AI writes prose, never figures.
- **Secrets.** Only `hub/.env.example` (empty template) is tracked; `.env.local` is gitignored.
  No real keys are committed.

Deeper detail and the deep-vs-stubbed module reasoning are in [`hub/README.md`](hub/README.md)
and [`hub/docs/SUBMISSION.md`](hub/docs/SUBMISSION.md).

---

<a name="docs-index"></a>
## 13. Docs index

| Doc | Link |
|---|---|
| **2-page write-up** (rendered) | https://gt-school-hub.vercel.app/writeup.html · source [`hub/docs/WRITEUP.html`](hub/docs/WRITEUP.html) |
| Full submission write-up | [`hub/docs/SUBMISSION.md`](hub/docs/SUBMISSION.md) |
| Presentation deck (agenda) | [`hub/docs/DECK.html`](hub/docs/DECK.html) |
| Video narration | [`hub/docs/NARRATION.html`](hub/docs/NARRATION.html) |
| Demo walkthrough talking points | [`hub/docs/WALKTHROUGH-SCRIPT.html`](hub/docs/WALKTHROUGH-SCRIPT.html) |
| GT Challenge campaign script | [`hub/docs/CHALLENGE-SCRIPT.html`](hub/docs/CHALLENGE-SCRIPT.html) |
| PRD checklist / requirement matrix | [`hub/docs/01-intake/PRD-CHECKLIST.md`](hub/docs/01-intake/PRD-CHECKLIST.md) |
