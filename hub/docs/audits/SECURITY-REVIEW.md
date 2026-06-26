# GT Marketing Hub — Security Review (initial threat model)

> Produced by the **`gt-hub-security-panel`** skill. Read-only review of the current
> backbone surface; re-run as the security gate after each module (see
> `docs/05-build/MODULE-RUNBOOK.md` step 4). Findings feed tests via `gt-hub-test-panel`.

## 1. Threat model (assets · entry points · trust boundaries)

**Assets (what an attacker wants / what we must protect):**
- Families' and **children's PII** (minors → COPPA/FERPA-adjacent), SMS-inbox + Voice-of-Customer content.
- Money & decisions: payments, the $365K budget, Decision Queue approvals.
- Cross-program isolation (the brief explicitly scores "prove isolation").
- Secrets: Supabase login, HubSpot token, Stripe keys.

**Entry points:** public web routes (`/`, `/m/[slug]`, `/dev/*`, `/opendata/*`, future module pages),
the Stripe webhook, HubSpot webhook, the (future) GT-Challenge public quiz, the Open Data outbound fetch.

**Trust boundaries:** browser ↔ Next server ↔ Postgres (RLS) ↔ HubSpot/Stripe/Supabase/Open Data.
The critical one — **authenticated user ↔ authorized program/role** — **does not exist yet** (no auth).

## 2. Roster (pared to 8)

| Persona | Lens | Falsifiable ask |
|---|---|---|
| **Elena Vasquez** | AppSec / AuthZ | As an Operator session, GET the Decision Queue API → 403, not 200-with-hidden-UI. |
| **Kwame Osei** | Multi-tenant isolation | Forge/alter a program id on a request → 0 rows, never another program's data. |
| **Dr. Hannah Cole** | Privacy counsel — minors (COPPA/FERPA) | No real minor PII anywhere; sensitive content gated; data-minimized stand-ins. *(don't-ship seat)* |
| **Ravi Menon** | Payments & integration sec | Replay a Stripe event → processed once; unsigned/forged webhook → rejected. |
| **Sofia Lindgren** | Cloud / deploy sec | In prod, `/dev` + `/opendata` are gated; security headers + CSP present. |
| **"Vex" (red team)** | Offensive | Reach a Leader-only route as Operator, or read cross-program data — must fail. |
| **Tomáš Horák** | Secrets / data-leak | No secret in client bundle / `NEXT_PUBLIC_` / repo; none in logs. |
| **Mei Tanaka** | Logging & observability privacy | No PII/secrets in server logs or error responses. |

## 3. Findings (ranked)

### 🔴 Critical
- **[S1] No app-level authentication or authorization.** There is **no `middleware.ts`** and no session
  layer; every route — including `/dev` (data model, dictionary, **Test Theater**), `/opendata`, and every
  future module page and API — is **publicly reachable**. The Decision-Queue "Leader-only" rule and the
  Operator "submit-not-view" rule are unenforceable. *Remediation:* **Tier 0** — add auth + a
  deny-by-default middleware; role checked server-side on every handler; this is the #1 P0 gap
  (`docs/01-intake/REQUIREMENTS.md`). **Build before any module that exposes data.**

### 🟠 High
- **[S2] Isolation is correct in the DB but unauthorized at the app.** `lib/db.ts` is strong — `SET LOCAL
  ROLE app_rw` (NOBYPASSRLS), `app.current_program` GUC, RLS FORCEd, unset GUC → 0 rows (fail-closed),
  `service_role` never used. **But isolation is only as strong as the program id passed to `withProgram`.**
  Once routes exist, deriving that id from the client (query/body/header) = instant cross-tenant break
  (IDOR/BOLA). *Remediation:* derive program scope **from the authenticated session only**; never trust a
  client-supplied program id; add an isolation test that forges one. *(Blocked on S1.)*
- **[S7] Internal surfaces exposed.** `/dev/*` and `/opendata/*` reveal architecture, data model, and
  data. *Remediation:* gate to Admin (post-S1) or strip from the prod build; add a route allow-list.

### 🟡 Medium
- **[S5] Webhook integrity — verify, don't assume.** Stripe handling has signature verify + idempotency
  (`lib/payments.ts`, proven in `tests/payments.test.ts`). Confirm: signature is checked against the
  **raw** body (not parsed), the idempotency ledger is authoritative, and the **HubSpot** webhook is
  authenticated too. **Open Data fetch** → allow-list the base URL (SSRF/egress).
- **[S3] PII & minors posture.** Seed PII is synthetic (`@example.com`) — keep it. Ensure no real minor
  data enters; PII never ships in the client bundle or logs; SMS-inbox + VoC quotes are role-gated;
  document the COPPA/FERPA-adjacent stance + data-minimization for stand-ins.
- **[S6] Auditability.** Decision-Queue approve/reject and budget changes must record who/when (tamper
  trail); the parity / data-confidence signal must be computed server-side (not client-spoofable).
- **[S7] No security headers / CSP / rate limiting.** Add headers + CSP on Vercel; rate-limit the public
  GT-Challenge quiz + any submit endpoint.

### 🟢 Low / positive (keep it this way)
- **[S4] Secret hygiene is good.** `.gitignore` blocks `.env*` and keys; `APP_RW_DATABASE_URL` is the
  restricted `app_rw` login and the code explicitly refuses `service_role`. Audit for any `NEXT_PUBLIC_`
  secret leak as modules add config.
- **[S2] The fail-closed DB design** is a genuine strength — preserve it; never introduce a BYPASSRLS path.

## 4. Controls → tests (hand to gt-hub-test-panel)

| Control | Test | Status |
|---|---|---|
| Operator denied Decision Queue (server) | route/API RBAC test | `it.todo` (needs S1) → `UC-DEMO-ROLE-DENIED` |
| Program scope can't be forged | isolation test forging a program id | `it.todo` (needs S1/routes) |
| Stripe webhook signature + replay | `tests/payments.test.ts` | covered (live) |
| Cross-program read/write blocked | `tests/r1-connection.test.ts` + seed isolation | covered |
| No secret in client bundle | build-output scan | backlog (P1) |

## 5. Definition of done (security gate)

- S1 satisfied before any data-exposing module ships; every handler deny-by-default, role checked server-side.
- Program scope derived from the session; an isolation test forges a program id and fails closed.
- Webhooks verified + idempotent; Open Data egress allow-listed.
- No PII/secrets in client bundle or logs; internal surfaces gated in prod; money/decision actions audited.
