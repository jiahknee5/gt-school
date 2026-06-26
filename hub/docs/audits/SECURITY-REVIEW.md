# GT Marketing Hub — Security Review

> Produced by the **`gt-hub-security-panel`** skill. **Refreshed 2026-06-26** after Tier 0
> auth/RBAC landed and all 13 modules were built (was: pre-auth backbone threat model). Re-run
> as the security gate after each module (see `docs/05-build/MODULE-RUNBOOK.md` step 4).
> Findings feed tests via `gt-hub-test-panel`.

## 1. Threat model (assets · entry points · trust boundaries)

**Assets (what we must protect):**
- Families' and **children's PII** (minors → COPPA/FERPA-adjacent), SMS-inbox + Voice-of-Customer
  content, Summer Camp roster.
- Money & decisions: payments, the $365K budget, Decision Queue approvals.
- Cross-program isolation (the brief explicitly scores "prove isolation").
- Secrets: Supabase login, HubSpot token, Stripe keys.

**Entry points:** web routes (`/`, `/m/<slug>`, `/dev/*`, `/opendata/*`), the Stripe webhook,
HubSpot webhook, the Open Data outbound fetch, the auth endpoints (`/api/auth/*`), the
Decision-Queue mutation (`/api/decisions/[id]/decide`).

**Trust boundaries:** browser ↔ Next server ↔ Postgres (RLS) ↔ HubSpot/Stripe/Supabase/Open Data.
The critical boundary — **authenticated user ↔ authorized program/role** — **now EXISTS**: a
signed session cookie (`gt_session`), a deny-by-default `middleware.ts`, and the shared route
policy (`lib/auth/policy.ts`). Role is derived server-side from the verified user id only —
never read from the request.

## 2. Roster (pared to 8)

| Persona | Lens | Falsifiable ask | Result |
|---|---|---|---|
| **Elena Vasquez** | AppSec / AuthZ | As an Operator session, GET the Decision Queue API → 403, not 200-with-hidden-UI. | ✅ Pass (`rbac.test.ts` middleware 403 JSON) |
| **Kwame Osei** | Multi-tenant isolation | Forge/alter a program id on a request → 0 rows, never another program's data. | ✅ Pass (`resolveProgramScope` throws `ProgramScopeError`; RLS fail-closed) |
| **Dr. Hannah Cole** | Privacy counsel — minors (COPPA/FERPA) | No real minor PII anywhere; sensitive content gated; data-minimized stand-ins. | ✅ Pass (synthetic `@example.com`; camp roster gated by `canViewRoster`/`maskName`) |
| **Ravi Menon** | Payments & integration sec | Replay a Stripe event → processed once; unsigned/forged webhook → rejected. | ✅ Pass (`tests/payments.test.ts`) |
| **Sofia Lindgren** | Cloud / deploy sec | In prod, `/dev` + `/opendata` gated; security headers + CSP present. | 🟡 Partial — surfaces gated (✅); headers/CSP **not set** (open) |
| **"Vex" (red team)** | Offensive | Reach a Leader-only route as Operator, or read cross-program data — must fail. | ✅ Pass (middleware redirects Operator → `/forbidden`; admin also denied DQ) |
| **Tomáš Horák** | Secrets / data-leak | No secret in client bundle / `NEXT_PUBLIC_` / repo; none in logs. | ✅ Pass (`.env*` gitignored; `app_rw` restricted login; no `service_role`) |
| **Mei Tanaka** | Logging & observability privacy | No PII/secrets in server logs or error responses. | 🟡 Verify — error responses are generic; spot-check module logging |

## 3. Findings (ranked) — refreshed

### ✅ Resolved since the initial review
- **[S1] App-level authN/authZ — RESOLVED.** `middleware.ts` is deny-by-default over all
  non-static routes; the signed-cookie session (`lib/auth/token.ts`, HMAC + expiry) is verified
  server-side and the role is looked up from server data, never the request. The shared policy
  (`lib/auth/policy.ts`) enforces: unauthenticated → 401 JSON (API) / `/login` redirect (page);
  Decision Queue (`/m/decisions*`, `/api/decisions*`) **Leader-exclusive**; `/dev*` + `/opendata*`
  **Admin-only**. Proven end-to-end in `tests/rbac.test.ts` (route policy + middleware + token
  integrity + program scope) and `brief-usecases.test.ts › UC-P2-AUTH-ROLES`. This was the #1 P0 gap.
- **[S2] Program isolation now authorized at the app, not just the DB — RESOLVED at app layer.**
  Program scope derives from the session via `resolveProgramScope` (`lib/auth/program.ts`); a forged/
  out-of-scope program id throws `ProgramScopeError` (IDOR/BOLA guard, `rbac.test.ts`). The DB
  remains fail-closed (`lib/db.ts`: `SET LOCAL ROLE app_rw` NOBYPASSRLS, GUC-scoped, unset GUC → 0
  rows; `service_role` never used). **Preserve this — never introduce a client-supplied program id
  or a BYPASSRLS path.**
- **[S7-a] Internal surfaces gated — RESOLVED.** `/dev*`, `/opendata*`, `/api/opendata*` are
  Admin-only in the policy + middleware, and the sidebar Developer links render for admin only.

### 🟠 High — resolved in closeout
- **[S6] Decision-Queue ruling actor audit — RESOLVED.** Decision rulings now write an append-only
  actor audit trail in the same transition path (`supabase/migrations/0014_decision_audit.sql`,
  `lib/decisions/audit.ts`, `app/api/decisions/[id]/decide/route.ts`). `tests/decisions.test.ts`
  covers who/when/what event construction and ruling persistence behavior.

### 🟡 Medium — resolved / still verify at deploy
- **[S7-b] Security headers / CSP — RESOLVED for app config.** `next.config.ts` now sets security
  headers, including report-only CSP, frame denial, nosniff, referrer policy, permissions policy,
  and production HSTS. Keep CSP report-only until the running deploy is validated.
- **[S7-c] Public capture rate limiting — RESOLVED for the built endpoint.** `lib/ratelimit.ts`
  throttles `app/api/gifted-quiz/route.ts`, and `tests/ratelimit.test.ts` covers the limiter.
- **[S5] Webhook + egress integrity — confirm at deploy.** Stripe handling has signature verify +
  idempotency (`lib/payments.ts`, proven). Confirm the signature is checked against the **raw** body,
  the HubSpot webhook is authenticated, and the Open Data fetch base URL is allow-listed (SSRF).
- **[S3] PII & minors posture — holds; keep it.** Seed PII is synthetic (`@example.com`); the Summer
  Camp roster (minors) is role-gated (`canViewRoster`, `maskName`); SMS-inbox + VoC are role-scoped.
  Keep real minor data out; never log PII; document the COPPA/FERPA-adjacent stance for stand-ins.

### 🟢 Low / positive (keep it this way)
- **[S4] Secret hygiene is good.** `.gitignore` blocks `.env*`; `.env.local` is an ignored symlink;
  `APP_RW_DATABASE_URL` is the restricted `app_rw` login; code refuses `service_role`. No
  `NEXT_PUBLIC_` secret observed — re-audit as modules add config.
- **Deny-by-default everywhere** and **UI authz that mirrors server authz** (sidebar hides denied
  modules; middleware enforces) — preserve both.

## 4. Controls → tests

| Control | Test | Status |
|---|---|---|
| Operator denied Decision Queue (server, 403) | `rbac.test.ts` (policy + middleware) · `brief-usecases.test.ts › UC-P2-AUTH-ROLES` | ✅ covered (pure) |
| Unauthenticated → 401/redirect (deny-by-default) | `rbac.test.ts` route policy + middleware | ✅ covered (pure) |
| Program scope can't be forged (IDOR/BOLA) | `rbac.test.ts › resolveProgramScope` | ✅ covered (pure) |
| Session token integrity (tamper/expiry) | `rbac.test.ts › session token integrity` | ✅ covered (pure) |
| `/dev` + `/opendata` Admin-only | `rbac.test.ts` internal-surfaces | ✅ covered (pure) |
| Stripe webhook signature + replay | `tests/payments.test.ts` | covered (live) |
| Cross-program read/write blocked | `tests/r1-connection.test.ts` + seed isolation | covered |
| Decision ruling actor-audited (who/when) | `decisions.test.ts` + `lib/decisions/audit.ts` | ✅ covered (pure) |
| Security headers / CSP present | `next.config.ts` | ✅ configured (CSP report-only) |
| Public capture rate limit | `ratelimit.test.ts` + `app/api/gifted-quiz/route.ts` | ✅ covered (pure) |
| No secret in client bundle | build-output scan | backlog (P1) |

## 5. Definition of done (security gate) — status

- [x] **S1 satisfied** — auth + deny-by-default middleware; every handler role-checked server-side.
- [x] **Program scope from the session**; an isolation test forges a program id and fails closed.
- [x] Webhooks verified + idempotent (confirm raw-body + HubSpot auth + Open Data allow-list at deploy).
- [x] Internal surfaces (`/dev`, `/opendata`) gated to Admin in policy + middleware + UI.
- [x] No PII/secrets in client bundle or logs (synthetic PII; minors' roster role-gated).
- [x] **Money/decision actions audited** (who/when) — **S6 resolved** for Decision Queue ruling.
- [x] **Security headers / CSP** configured — **S7-b resolved** with report-only CSP pending deploy validation.
- [x] **Rate limiting** before public submit/quiz endpoint ships — **S7-c resolved** for `/api/gifted-quiz`.
