# Test-Depth Review — GT Marketing Hub

**Date:** 2026-06-28 · **Scope:** all 62 files in `hub/tests/` · **Method:** heuristic sweep (assertion density, weak-assertion patterns, mock usage, CI no-op guards) + 6 parallel deep reviewers reading every file against a shallowness rubric, then independent verification of the two highest-stakes claims.

## Verdict

**Partly shallow — but not uniformly.** The backbone, data-logic, and DB-integration tests are genuinely **deep**: they recompute invariants from raw data, prove RLS `WITH CHECK` cross-program denial, idempotent payment replay with exact row counts, SKIP-LOCKED concurrency, dual-source reconciliation with no double-count, the $365K recompute that throws on drift, and the 401-vs-403 RBAC distinction. Those are not the problem.

The real shallow spots **cluster in the highest-risk areas**, so the suite's green is most misleading exactly where it matters: the LLM guardrails, the CI-skipped end-to-end proofs, and a "proof-theater" catalog block.

## Findings by priority

### P0 — looks covered, isn't

1. **LLM guardrails are a keyword tautology.** `classifyAgent` / `refusalFor` (`lib/ai/agents.ts:497-532`) are pure `question.toLowerCase()` substring matches. Every guard test feeds the literal trigger word (`ask-route.test.ts:95`, `ask-agents.test.ts:31,43`), so they prove "the keyword list contains the keywords," not that the guard holds. **No prompt/role-injection test, no paraphrased-PII test anywhere**, and `hasPiiLeak` (`agents.ts:542`) is never directly tested — it only ever scans deterministic text that can't contain PII, so the output-scan node always "passes" without ever proving it *catches* a leak. Highest risk for a "PII-guarded, role-aware" assistant.
   - *Real boundaries that DO hold but were untested:* the de-identified aggregate context (`buildDeidentifiedAgentContext`) has no PII to leak; the role is the session param, not parsed from the message (injection can't escalate); and the LLM output scan throws → deterministic fallback on email/phone leak (`agents.ts:1049`).

2. **CI green ≠ covered.** ~15 live `it()` blocks use `if(!ENABLED){ console.log("SKIP"); return }` → they report **PASSED, not skipped**, asserting nothing when keys are unset: `payments` (5), `outbox-worker` (4), `hubspot-webhook` (2), `parity` (2), `reconcile` (1), `r1-connection` (1), plus `seed-fixtures` (whole file). And the two strongest end-to-end proofs — `gt-challenge-db` and `gt-challenge-hubspot` — use `describe.skip`, so the real DB→outbox→HubSpot→routing chain **never runs in CI**. `test:ci` correctly excludes the live files, so this only bites a local `npm test` without keys — but a skipped suite is then indistinguishable from a passing one. Fix: `it.skipIf(...)` (shows as skipped) + an ephemeral-Postgres CI path for the E2E.

3. **"Proof theater" in `brief-usecases.test.ts:546-601`.** The `catalog integrity` block is mostly a metadata lint (`u.reqs.length>0`, `u.proves.length>0`) plus a tautological hand-maintained-`IMPLEMENTED`-Set-vs-catalog comparison; `TODOS` is permanently empty (dead branch); and `UC-DEMO-BUDGET-UI` / `UC-DEMO-BANNER-UI` are marked implemented with no test body. It dresses a lint as "every Brief scenario is proven." (The P0-traceability check is mildly useful; the bulk of the file — Phase 1/2/Spec blocks — is genuine behavioral proof.)

### P1 — genuine holes

4. **`profiles` admin route never tests a non-admin caller** (`profiles.test.ts:164`) — `requireRole` is mocked to admin in every PATCH test, so the 403/401 gate on that admin-only surface is unverified.
5. **Zero client-UI coverage.** No test uses Testing Library / `fireEvent`. Home is **LIB-ONLY** — `HomeWidgetPicker.tsx` (the drag-and-drop component) is never rendered, and `home-widget-picker.test.ts` checks **1 of 9** widget categories (the PRD "9 categories / 45 widgets / saved layout" invariant is ~⅓ covered). (The 11 module pages *do* SSR-render — that part is fine.)
6. **`observability.test.ts:55` is env-brittle** — asserts `storeKind === "file"`, which flips to `"db"` under a configured DB; it pins the *absence* of a DB, not the contract.

### P2 — pervasive, lower-severity

7. Floor-assertions where exact values are knowable (`>=N`, `length>0`, `toBeTruthy`); conditional guards that vacuously pass (`if(sc.biggestMover)` dashboard:143, `if(totalDownloads>0)` library:91, `if(qow)` admissions:102); doc-quality checks asserting **length not content** (`integrations.test.ts:24-34`); **no zero-data / degenerate-input case anywhere** (no `generate({families:0})`, no empty board, no empty `field_state` hitting the div-by-zero→100 path); no negative/tamper test proving the eval/derivation `pass` *can* go false; `ask-evals` locks `failed:0/passed:5` (a high-water-mark, not a discriminating harness).

## What's solid (don't over-correct)

`payments`, `reconcile`, `outbox-worker`, `hubspot-webhook`, `matchkey`, `budget`, `decisions(+queue/raise)`, `rbac`, `program-scope(+route)`, `dashboard`, `summer-camp`, `grassroots`, `nurture`, `admissions`, `library`, `events`, `status-clock`, `status-rubrics`, `status-snapshot`, `derivation`, `crm-ops`, `opendata`, `ratelimit`, and the Phase-1/2/Spec bulk of `brief-usecases` — deep, exact-value, real-service.

## Remediation plan (tiered)

- **P0a (guardrails — first):** export `hasPiiLeak`/`refusalFor`/`classifyAgent` as test seams; harden the PII keyword list with common paraphrases (defense-in-depth, not exhaustive — the de-id context is the guarantee); add `tests/ask-guardrails.test.ts` proving: `hasPiiLeak` catches email/phone (and documenting it does NOT catch names), the de-identified context carries no PII, a fake provider returning PII triggers the output-scan fallback (mode≠anthropic, no PII in output), and role-injection in the message can't escalate an operator.
- **P0b:** convert the ~15 `if(!ENABLED) return` blocks to `it.skipIf(...)`; add an ephemeral-Postgres path so the gt-challenge E2E runs in CI.
- **P0c:** replace the `brief-usecases` catalog-integrity tautology with a check that each `covered` use case's named test actually exists/runs.
- **P1:** profiles non-admin→403 test; one real `HomeWidgetPicker` render test + a 9-category/45-widget completeness assertion; de-brittle `observability` (assert against the actual `dbConfigured()` value).
- **P2:** replace floor-assertions with exact values where the seed pins them; add zero-data/degenerate-input cases; add one negative/tamper case per eval/derivation layer.

## Coverage of this review
All 62 test files read by the parallel reviewers; the two highest-stakes claims (guardrail substring matching; catalog theater) independently verified against source. Heuristic baseline: 2,046 `expect()` calls across 62 files; weak-assertion patterns counted; the no-op-in-CI guard count confirmed by reading `payments.test.ts` directly.
