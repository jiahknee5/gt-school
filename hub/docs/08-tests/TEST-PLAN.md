# GT Marketing Hub — Test Plan

> Produced by the **`gt-hub-test-panel`** skill. The suite spine is `lib/dev/usecases.ts`
> (catalog), `lib/dev/suites.ts` (layout), `tests/brief-usecases.test.ts` (runnable proofs +
> integrity), `lib/seed/*` (generator + 15 invariants), and `/dev/tests` (Test Theater).
> Verification layer over `gt-hub-module-panel` + `gt-hub-cohesion-panel`.

## 1. Panel roster (pared to 9)

| Persona | Lens (discipline) | Falsifiable ask (pass/fail) |
|---|---|---|
| **Priya Nair** | SDET / test architect | Every use case sits at the cheapest layer that still proves it — no integration test doing a unit's job. |
| **Tomás Reyes** | Data-quality / generator-test | All 15 edge cases present across 5 seeds × 3 sizes; same seed → byte-identical dataset. |
| **Dana Whitfield** | Backbone / integration test eng | `reconcile` is STABLE across two runs; payments idempotent on replay; every live test restores state in `afterAll`. |
| **Sergei Volkov** | Flake hunter / reliability | Pure suite 100× → byte-identical; shuffle file order → still green; zero `Date.now`/`Math.random` in pure paths. |
| **Aisha Bello** | Security & RBAC test | An Operator is denied the Decision Queue at route + data + UI; no PII / minor data in committed fixtures or logs. |
| **Marcus Tan** | Test-theater skeptic ("don't trust") | Delete any test whose assertion cannot fail; no mock-asserts-mock; no fake-green `todo`. |
| **Lena Hoffmann** | Frontend / e2e (Playwright) | Watch a payment propagate and the data-confidence banner appear in a headless browser run. |
| **Raj Malhotra** | Performance / volume | Generate 5k families + validate in < 2s; reconcile pacing test bounded. |
| **Noor Haddad** | CI / release | `test:ci` green with no keys in < 5s; report renders in `/dev/tests`; PR gate = build + lint + ci. |

## 2. Synthesis

**Convergent (panel agrees):**
- The brief/spec → test traceability is real and now machine-checked: the catalog (`usecases.ts`) is the
  contract, `brief-usecases.test.ts` proves the pure ones and `it.todo`s the rest, and an integrity test
  keeps them in sync. *(Priya, Marcus — T1/T8)*
- The generator is the strongest asset: deterministic, 15 deliberate edge cases, invariant-checked. The
  pure data layer carries most of the brief's "show us it works" *backbone* proofs. *(Tomás — T2/T4)*
- Honesty discipline is correct: `covered` / `live` / `pending`, live skips without keys, nothing faked. *(Marcus — T6)*

**Divergent (surfaced, not buried):**
- *Pyramid shape.* The suite is heavy at data + integration and still **empty at browser e2e**. Server-rendered
  pages and state helpers are covered, but the demo signals ultimately need Playwright or an equivalent
  browser run. **Resolution:** keep the current pure gate honest; add Playwright before claiming e2e UI coverage.
- *Live-test pollution risk.* Dana flags that live reconcile/payments mutate shared HubSpot/DB state; Sergei
  wants them quarantined from the pure gate. **Resolution:** already split — `test:ci` is pure-only; live
  files run via `test:live`/`test:backend`. Keep regenerating the `/dev/tests` report from the **pure set**
  while build sessions are live.

**Risks (ranked, tagged T# + persona):**
1. **[T1, Priya] Silent coverage holes** — a P0 requirement could lose its only test and no one notices.
   *Mitigation (done):* a traceability test asserts every P0 id is referenced by ≥1 use case.
2. **[T4, Tomás] Messy-data edges under-asserted** — the brief explicitly names *mojibake* and *missing
   fields*; the seed models both but they had no dedicated use case. *Mitigation (done):* `UC-DATA-MESSY`.
3. **[T5, Dana] Live cleanup drift** — a future live test that forgets `afterAll` cleanup corrupts the
   seeded demo state. *Mitigation:* cleanup audit (P2) + reviewer checklist.
4. **[T6, Marcus] Fake-green creep** — pressure to turn a `todo` green before the feature exists. *Mitigation:*
   integrity test forbids a `pending` use case without a matching `todo`.
5. **[T2, Sergei] Hidden non-determinism** — a pure test that sneaks in wall-clock/order dependence. *Mitigation:*
   flake audit (P2): run pure suite repeatedly + shuffled.
6. **[T7, Noor] No enforced gate** — `verify` exists but isn't wired to a PR/hook. *Mitigation:* CI wiring (P1).

**Open questions:**
- When auth lands, is RBAC tested at the route layer, the data layer, or both? (Aisha: both.)
- Do we want a tiny golden-fixture diff test, or is the deterministic generator enough? (Tomás: generator is enough.)
- e2e against a seeded ephemeral DB or against mocks? (Lena vs Priya — decide when the first screen ships.)

## 3. Coverage scorecard (by phase)

Source of truth: `lib/dev/usecases.ts` (`useCaseCounts()`), surfaced live at `/dev/tests`.

| Phase | Covered (pure) | Live (svc) | Pending (todo) |
|---|---|---|---|
| Phase 1 · Backbone | 8 | 1 | 0 |
| Test data | 8 | 0 | 0 |
| Phase 2 · Product | 10 | 0 | 0 |
| Spec · Marketing Hub | 14 | 0 | 0 |
| Demo signal | 8 | 0 | 0 |
| **Total** | **48** | **1** | **0** |

`npm run test:ci` (pure gate): green, no keys, < 5s. Latest pure gate:
28 files, 374 passed, 0 todo. `tests/brief-usecases.test.ts`: all `covered`
catalog entries are proven; there are currently no `pending` catalog entries.

## 4. Prioritized backlog

**P0 — do now (pure, high value):** ✅ both shipped in this pass
- `UC-DATA-MESSY` — assert mojibake names + missing-field families exist (brief: "mojibake or missing fields"). → `tests/brief-usecases.test.ts`, pure.
- **P0 traceability** — every P0 hard requirement id is referenced by ≥1 use case. → integrity test in `tests/brief-usecases.test.ts`, pure.

**P1 — next (needs build or a live harness):**
- Stand up **Playwright** browser coverage for the demo path. Server-rendered route tests now cover
  Budget, banner, and role-denial surfaces; browser coverage should prove the same signals through the
  actual navigation/session flow. → `tests/frontend/`.
- **Production auth gap**: signed demo sessions and route/API RBAC are covered, but Supabase Auth account
  provisioning and real identity lifecycle remain pending under `UC-P2-AUTH-ROLES`.
- **Browser workflow coverage**: Home picker state + API persistence are covered, but add Playwright before
  claiming browser-level drag/reorder/save coverage.
- **GT Challenge persistence**: public quiz ingest and idempotency contract are covered with an in-memory
  store; add the DB migration/transactional adapter and HubSpot outbox handoff before claiming live persistence.
- **Decision Queue workflow remainder**: Leader approve/reject/need-info persistence, immutable audit history,
  and submitter own-status are covered; notification and source-link propagation remain.
- Wire **`npm run verify`** (build + lint + test:ci) into a PR check / pre-push hook. *(Noor — T7)*

**P2 — hardening:**
- **Flake audit:** run the pure suite repeatedly + shuffled file order; assert byte-stable. *(Sergei — T2)*
- **Live-cleanup audit:** confirm every live test restores cursors/contacts/rows in `afterAll`. *(Dana — T5)*
- **Volume test:** `generate({ families: 5000 })` validates in < 2s; invariants hold. *(Raj — T2/T7)*
- **Accessibility** smoke for Help + `/dev` pages (contrast is fixed-palette → must be checked). *(reuse cohesion panel)*
- **Folder move** to `tests/{data,backend,scenarios,frontend}/` + `@/` imports, once the live suite is idle.

## 5. Definition of done (the bar)

- Every **P0** requirement → ≥1 use case (traceability test green).
- Every `covered` use case has an always-green assertion; any future `pending` use case must have an
  `it.todo`; nothing faked.
- `test:ci` green with no keys, deterministic, fast.
- Live tests skip cleanly without keys and clean up with keys.
- Each of the four "show us it works" signals has a pure/live test; browser-level proof remains the
  explicit frontend backlog.
