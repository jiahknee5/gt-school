# GT Technical Project — Requirements Checklist & Completeness Review

Derived from the **two** governing documents: `hub/PRD/GT_Technical_Project_Brief.md`
and `hub/PRD/GT_Marketing_Hub_Spec.md`. This is the compliance matrix used to judge
"are we done enough" and to sequence what's left.

> **Historical baseline:** this file was the original intake review, written before the full
> module build-out. For the current post-build status, use `docs/01-intake/PRD-CHECKLIST.md`.
> Keep this file as the baseline rationale and sequencing record; do not treat its stale module
> statuses as current evidence.

**Legend** — **★ = hard / non-negotiable** (the brief's word) · Priority **P0** (must, scored heavily) /
**P1** (important) / **P2** (optional, "noticed not scored") · Status **✅ done** · **🟡 partial** ·
**⛔ missing** · **📄 specced only** (design exists in `docs/`, not built).

> **Snapshot caveat:** this baseline reflected the repo at original intake review time, when Phase-2
> surfaces were mostly placeholders. The current post-build matrix is `PRD-CHECKLIST.md`.

---

## The single most important reframe

The brief says **explicitly**: *"You will not finish all 13 modules… trying is a red flag."*
**Completeness is NOT "all 13 modules."** It is:

1. a **trustworthy Phase-1 backbone**, then
2. a **small number of modules built deep** on it, honoring the cross-module rules, then
3. the **four "show us it works" signals** demonstrable, plus
4. the **deliverables** (README, write-up, proof, video, deployed demo + 3 role logins).

Judge completeness against *that*, not module count.

---

## A. Submission deliverables (meta — all ★)

| # | Requirement | ★ | P | Status | Notes |
|---|---|---|---|---|---|
| A1 | Git repo + README that runs in minutes | ★ | P0 | 🟡 | code present; needs a top-level run-in-minutes README + env setup |
| A2 | Write-up (1–2 pp): what's deep vs stubbed **and why**, trade-offs, bent rules, next week | ★ | P0 | ⛔ | not started — this is graded heavily ("how you read/sequence a spec") |
| A3 | Proof it works: tests/scripts/manual procedure (isolation, idempotency, dual-source, budget, role gating) | ★ | P0 | 🟡 | strong Phase-1 tests exist; Phase-2 proof (budget/role) missing |
| A4 | Walkthrough video 5–10 min, voiced, end-to-end + ≥1 failure/edge | ★ | P0 | ⛔ | record last, after the demo slice works |
| A5 | Live demo URL + credentials for all 3 roles (Admin/Leader/Operator) | ★ | P0 | ⛔ | depends on auth (C1) + deploy |
| A6 | No secrets in git; own free-tier accounts | ★ | P0 | 🟡 | `.env.example` present; verify nothing real committed |

## B. Phase 1 — backbone non-negotiables (all ★, all P0)

| # | Requirement | Status | Evidence |
|---|---|---|---|
| B1 | **Bidirectional sync** CRM↔app, consistent over time (not just first import) | ✅ | `lib/sync/reconcile.ts`, `lib/sync/outbox-worker.ts`, `app/api/webhooks/hubspot/route.ts` |
| B2 | **Program isolation**, *provable* (no cross-program read/write) | ✅ | RLS in `supabase/migrations/0001_backbone.sql`, `lib/db.ts` (`withProgram`/`withoutProgram`), `supabase/checks/r1_isolation.sql` |
| B3 | **Idempotent payment** end-to-end: payment→CRM→correct program store→app | ✅ | `lib/payments.ts` + `tests/payments.test.ts` (idempotent replay, monotonic state, RLS WITH CHECK) |
| B4 | **Sync-parity / data-confidence signal** plumbing | 🟡 | `lib/parity.ts` + `tests/parity.test.ts` compute/persist parity; **UI banner not wired** (see E4) |
| B5 | **Messy parts**: retries, partial failure, **duplicate webhooks**, rate limits, **conflicting edits**, **dual-source reconciliation** | 🟡 | dup-webhook + echo-suppression + conflict handling ✅ (`reconcile.ts`, `processed_events`); **dual-source reconcile of summer/community as product** ⛔ |

## C. Phase 2 — product non-negotiables (all ★, all P0)

| # | Requirement | Status | Notes / gap |
|---|---|---|---|
| C1 | **Auth + 3 roles enforced** (Admin, Leader, Operator) | 🟡 | Signed demo sessions, middleware, route policies, and API guards exist; production identity lifecycle remains. |
| C2 | **Decision Queue gated to Leaders** (Operators submit, never view/act) | 🟡 | Leader-only route/API guards, rendered queue, and ruling mutation exist; submitter own-status and audit workflow remain. |
| C3 | **Single source of truth** honored everywhere (no figure computed two ways) | 🟡 | SSOT map documented (`lib/dev/catalog.ts`, seed) but not *enforced in module UIs* (none built); needs a shared metrics layer |
| C4 | **Budget reconciles** to $365K everywhere + **>10% variance auto-flags** to Decision Queue | 🟡 | Append-only `budget_entry`, Budget UI, burn/allocation views, and variance→DQ payload tests ✅; approved reallocation propagation remains |
| C5 | **Composable per-user Home** (30+ widget library, starter pack, saved layout) | 🟡 | Widget library, role-aware starter pack, `home_layout`, and GET/PUT persistence exist; picker/drag board remains. |
| C6 | **Real integrations + dual-source reconciliation** (≥ HubSpot live; + summer/form or HubSpot/community) | 🟡 | HubSpot connector live ✅; **dual-source reconcile surfaced as product** ⛔ |
| C7 | **Open Data query that *changes a decision*** | 🟡 | `lib/opendata/enrich.ts` + `app/api/opendata/decision-enrichment/route.ts` ✅; needs a **decision surface** where the enrichment visibly changes the call |
| C8 | **Respect known gaps honestly** (UTM broken, event-to-consult uninstrumented, unreliable fields) | 🟡 | modeled/labeled in seed + dev docs ✅; needs the **CRM Ops module** to surface them in-product |

## D. Test data deliverable (★ — explicitly scored, all P0)

| # | Requirement | Status | Evidence |
|---|---|---|---|
| D1 | Realistic, spec shapes, owners, $365K budget (not lorem) | ✅ | `lib/seed/*`, `lib/seed/dictionaries.ts` (BUDGET=365K) |
| D2 | Volume + spread (reconciliation/dashboards/pacing actually exercised) | ✅ | `lib/seed/generate.ts` distributions |
| D3 | **Edge cases on purpose** (dupes, family in 2 programs, late/failed/dup payment, CRM↔app conflict, parity drop, mojibake/missing) | ✅ | `lib/seed/invariants.ts` (15 invariants), manifest edge-case list |
| D4 | Reproducible + honest + **reset to clean state** | ✅ | deterministic RNG (`rng.ts`), `_standIn` labels, `npm run reset`/`seed:fixtures` |

## E. "Show us it works" — the acceptance demo (all ★, all P0)

| # | Signal | Status | Gap to demoable |
|---|---|---|---|
| E1 | Watch a **payment propagate** without contamination | ✅ | `/dev/payments` watcher shows processed event/payment status, idempotent replay/no-op, program isolation/no-contamination, and seed fallback; live path remains `payments.test.ts` + DB/Stripe env |
| E2 | A **budget reconcile** to the total | ✅ | `/m/budget` + `budget.test.ts` visibly reconcile four workstreams to $365K |
| E3 | A **role denied** the Decision Queue | ⛔ | needs C1 auth + C2 module |
| E4 | **Data-confidence banner** appears when parity drops | 🟡 | parity compute ✅ (`lib/parity.ts`); banner component + cross-module wiring ⛔ |
| E5 | A real **Open Data query** (+ ≥1 failure/edge case) | 🟡 | query ✅; show it altering a decision + a failure path |

## F. Module depth — sequencing (the scored judgment, NOT all 13)

Brief's strong-answer slice: **CRM Ops + Budget + Decision Queue end-to-end** (cleanest tests of
parity/SSOT, "a number means the same everywhere", and role-gating + cross-module). Home, Nurture,
Dashboard are the next highest-leverage.

| Module | Tests | Build depth (current) | Recommended |
|---|---|---|---|
| CRM Ops | parity, UTM-broken, DQ auto-detect, field reliability — Phase-1 surfaces as product | ⛔ placeholder | **deep (P0)** |
| Budget | $365K reconcile, variance→DQ — clearest SSOT test | ✅ ledger-backed UI + tests | **deep (P0)** |
| Decision Queue | role-gating + cross-module intake | ⛔ placeholder | **deep (P0)** |
| Home | composable widgets, per-user state, aggregation spine | ⛔ grid only | deep (P1) |
| Nurture | most data-rich; HubSpot+Supabase depth | ⛔ placeholder | deep (P1) |
| Dashboard/KPI | shared scorecard, reads-everything | ⛔ placeholder | medium (P1) |
| Grassroots / Summer Camp | dual-source reconcile (community / summer+form) | ⛔ placeholder | one of them medium (P1) for C6 |
| Content / Admissions | Google-Sheet sync + AI; objection→content bridge | ⛔ placeholder | stub deliberately (P2) |
| Field Events / Analytics / Library | manual/GA4/flat shelf | ⛔ placeholder | stub deliberately (P2) |

At original intake review time, all 13 module routes rendered the placeholder in `app/m/[slug]/page.tsx`.
That historical finding is superseded by `PRD-CHECKLIST.md`; keep it here only as the sequencing rationale.

## G. Cross-module rules (★ where they gate the demo)

| Rule | Status |
|---|---|
| Single source of truth per number | 🟡 specced (`docs/`, seed); enforce via a metrics layer when modules land |
| Auto cross-links (testimonial→Content, objection→brief, hot-family→DQ, **variance→DQ**, **parity→banner**, event→Field) | 📄 specced (`docs/use-cases/`, `docs/modules/`); variance→DQ + parity→banner are P0 (E2/E4) |
| Data-confidence banner broadcast | 🟡 plumbing only |

## H. Optional / "noticed but unscored" (P2)

AI layer (brand-voice auditor, SMS auto-theme, **Ask-the-Hub agent** — on another session's roadmap),
RLS leak demo (✅ `r1_isolation.sql`), replayable event log, webhook-storm/race tests, conflict
audit trail, the **GT Challenge** worked example (`docs/06-gt-challenge/WORKFLOW.md`) — optional but
lights all four E-signals at once.

---

## Prioritized path to "complete" (the order that maximizes score)

**P0 — non-negotiables that are currently missing/at-risk (do these first):**
1. **App auth + 3 roles** (C1) — unblocks C2, E3, A5. The biggest gap.
2. **Decision Queue** deep (C2) with the **Leader-only gate** (→ E3) and cross-module intake.
3. **Budget Tracker** deep (C4): rows reconcile to **$365K** (→ E2) + **>10% variance auto-flags to DQ**.
4. **CRM Ops** deep (C8/B4): parity score + **data-confidence banner** (→ E4) + honest known-gaps + UTM-broken surface.
5. **Open Data visibly changing a decision** (C7/E5) + a failure path.
6. **Deliverables**: README (A1), write-up (A2), proof (A3), **deploy + 3 role logins** (A5), **video** (A4).

**P1 — high leverage after the P0 demo slice works:**
8. Composable **Home** (C5) — the widget spine.
9. **Nurture** deep (most data-rich).
10. **Dashboard/KPI** shared scorecard (SSOT showcase).
11. One **dual-source reconciliation** module surfaced (Summer Camp or Grassroots) for C6.

**P2 — deliberate stubs + extras (and *document why you cut them* — that's scored):**
12. GT Challenge (optional, high-wow), AI layer, remaining modules stubbed, the optional extras in H.

**Bottom line:** the foundation (Phase 1 + data) is in good shape. The score now hinges on (a) **auth/roles**,
(b) **three modules built deep** (CRM Ops + Budget + Decision Queue), (c) the **four demo signals** wired,
and (d) the **submission deliverables**. Honest stubs + a clear write-up beat a broad, rule-violating shell.
