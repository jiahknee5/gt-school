# GT Marketing Hub

A centralized marketing-operations Hub for **GT Anywhere** — built on one load-bearing
backbone (program-isolated Postgres, bidirectional CRM↔app sync, app-level auth/RBAC),
with **13 module surfaces** and one end-to-end campaign play (the **GT Challenge**) layered
on top. The guiding principle is **honesty over theater**: real code paths where it matters
(isolation, idempotency, dual-source reconcile, budget math, role gating), clearly-labeled
stand-ins everywhere else, and gaps tracked rather than faked green.

Built with **Next.js 16** (App Router) · **React 19** · **TypeScript** · **Tailwind v4** ·
**Postgres (Supabase)** · **Vitest**.

> Full submission write-up (what's deep vs. stood-in, trade-offs, proof index):
> [`docs/SUBMISSION.md`](docs/SUBMISSION.md).

---

## Architecture

### Phase 1 — the backbone (the actually load-bearing artifact)

- **Program isolation (provable).** `supabase/migrations/0001_backbone.sql` separates GLOBAL
  (CRM-wide) tables from PROGRAM-SCOPED tables protected by **RLS + FORCE**. Program reads/
  writes run as a restricted `app_rw` role (`NOSUPERUSER`, `NOBYPASSRLS`) with a
  per-transaction GUC (`SET LOCAL app.current_program`). An unset GUC returns **0 rows**
  (fail-closed); `service_role`/any BYPASSRLS role is never used on program-scoped paths.
  Program scope is derived from the session (`lib/auth/program.ts`), so a forged/out-of-scope
  program id throws `ProgramScopeError` (IDOR/BOLA guard).
- **Bidirectional sync, consistent over time.** `lib/sync/reconcile.ts` (inbound),
  `lib/sync/outbox-worker.ts` (durable outbound `sync_outbox`), and HubSpot/Stripe webhook
  routes. Field-directional authority decides who wins per column; echo-suppression +
  `processed_events` kill duplicate-delivery loops.
- **Idempotent payments end-to-end.** `lib/payments.ts` — a twice-delivered Stripe event is
  recorded once, balances stay monotonic, and RLS `WITH CHECK` blocks cross-program writes.
- **Parity / data-confidence.** `lib/parity.ts` computes a per-entity parity score; a drop
  below `PARITY_THRESHOLD` raises the **data-confidence banner** across the 7 HubSpot-consuming
  modules.

### Auth / RBAC (Tier 0)

- Deny-by-default `middleware.ts` over every non-static route. A signed-cookie session
  (`gt_session`, HMAC-SHA256 + expiry, `lib/auth/token.ts`) is verified **server-side**; the
  role is looked up from the verified user id, never read from the request.
- Shared, pure route policy (`lib/auth/policy.ts`): unauthenticated → 401 JSON (API) /
  `/login` redirect (page); the **Decision Queue is Leader-exclusive** (`/m/decisions*`,
  `/api/decisions*`); `/dev*` + `/opendata*` are **Admin-only**. The public GT Challenge funnel
  (`/gifted-quiz`, `/api/gifted-quiz`) is the one explicitly allow-listed public path.
- Three demo identities (`DEMO_USERS`: Admin / Leader / Operator) behind a password-less dev
  role switcher that still mints a real, server-enforced session — swap in a real IdP without
  changing call sites.

### The 13 modules

CRM Ops · Budget · Decision Queue (Tier 1, deep) · Dashboard · Nurture · Home (Tier 2) ·
Grassroots · Admissions · Content · Analytics (Tier 3) · Summer Camp · Field Events · Library
(Tier 4). Cross-module rules are wired with a visible landing each: testimonial→Content,
objection→brief, hot-family→Decision Queue, **budget variance >10%→Decision Queue**,
parity→banner, event→Field. Depth is intentionally uneven (and labeled); see `docs/SUBMISSION.md` §2.3.

### GT Challenge — the play that lights all four signals

A public quiz (`app/(public)/gifted-quiz/`) POSTs to `app/api/gifted-quiz/route.ts`. Capture
(`lib/gt-challenge/capture.ts`) enforces a consent gate, collapses duplicate `idempotency_key`s,
keeps UTM honest, and resolves identity; assessment (`lib/gt-challenge/assess.ts`) is a
deterministic grader with **no "not gifted" bucket**. One submission propagates capture → lead
→ score, its spend rolls into the `grassroots` budget workstream, a "raise budget" decision is
denied to non-leaders, and an inbound edit drops parity → banner.

---

## Quickstart

```bash
cd hub
npm install
cp .env.example .env.local      # fill with YOUR OWN free-tier keys; .env.local is gitignored
npm run verify                  # build + lint + test:ci (the pure gate — no external creds needed)
npm run dev                     # http://localhost:3000
```

- **Sign in:** dev auth mode is ON outside production — the role switcher mints a real,
  server-enforced session for **Admin / Leader / Operator** (no password). Use it to demo role
  gating (Operator → `/m/decisions` → `/forbidden`).
- **Public funnel:** open `/gifted-quiz` (no account needed) to run the GT Challenge.
- **Admin integrations:** sign in as Admin and open `/dev/integrations` to inspect every
  PRD source, manual-v1 channel, deferred gap, join key, owner, and synthetic sync run.
- **AI agents:** open `/help/ai-agents` after signing in to ask cited, role-aware
  operating questions. With `ANTHROPIC_API_KEY` + `ASK_THE_HUB_MODEL` set, the final synthesis
  uses Anthropic over de-identified RAG context; the no-key/test path is deterministic. Admins can
  inspect node/eval traces at `/dev/agents`.
- **Seed a DB (optional, needs Supabase):** run the migrations in `supabase/migrations/` in
  order, create the restricted `app_rw` login, then `npm run seed` followed by
  `npm run seed:fixtures`. Data is deterministic (`seed: 424242`); `npm run reset` clears it.

### Useful scripts (`package.json`)

| Script | What it does |
|---|---|
| `npm run dev` | Next dev server on `:3000` |
| `npm run build` | Production build (`next build`) |
| `npm run verify` | `build` + `lint` + `test:ci` — the full pure gate |
| `npm run test:ci` | The pure test suite (no external creds) — **423 passing, 0 todo** |
| `npm run test:live` | Live integration tests (require real Supabase/HubSpot/Stripe creds) |
| `npm run seed` / `seed:fixtures` / `reset` | Seed / generate fixtures / clear the DB |

---

## The four acceptance signals (and where to watch them)

| Signal | Where to watch | Proof |
|---|---|---|
| Watch a payment propagate (no contamination) | `/dev/payments` (Admin) | `tests/payments.test.ts` (live) + `payment-propagation-surface.test.ts` (pure) |
| A budget reconcile to the total | `/m/budget` | `tests/budget.test.ts` → 4 workstreams sum to **$365K** |
| A role denied the Decision Queue | sign in as Operator → `/m/decisions` → `/forbidden` | `tests/rbac.test.ts` |
| Data-confidence banner on parity drop | any HubSpot module after an inbound edit | `tests/module-routes.test.ts`, `lib/parity.ts` |
| (bonus) Open Data query that changes a decision | `/m/decisions` (Leader) | `tests/opendata.test.ts` — `pilot → approve` flip |

---

## Environment variables

The pure demo runs with just `AUTH_SECRET` (+ `AUTH_DEV_MODE=true`). The live/DB-backed paths
need Supabase, HubSpot, Stripe, Open Data, and Anthropic credentials. The fully annotated list
lives in [`.env.example`](.env.example); deploy guidance is in `docs/SUBMISSION.md` §8.

- `AUTH_SECRET` — HMAC secret for the session cookie (`openssl rand -hex 32`). **Required in
  production.** Never commit the real value.
- `AUTH_DEV_MODE` — `true` enables the password-less Admin/Leader/Operator switcher (fine for a
  private demo URL). Set `false` and wire a real IdP for a truly public deployment.

---

## Tests & verification

`npm run verify` runs build + lint + the pure test suite (`test:ci`): **423 passing, 0 todo**,
production build clean, eslint clean. Live integration tests (`test:live`) are excluded from the
pure gate by design — they need real credentials.

For the full submission narrative, proof index, honest gaps, and deploy steps, see
[`docs/SUBMISSION.md`](docs/SUBMISSION.md).
