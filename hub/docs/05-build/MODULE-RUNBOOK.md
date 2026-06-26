# Module build runbook — the per-module loop

The repeatable loop for building each module in priority order (see the in-app
**Build roadmap**, `/help/roadmap`, data in `lib/help/roadmap.ts`). Every module runs the
same loop; the loop — not the code — is the product.

> **Coordination note.** App code is built by one owner at a time per module to avoid
> collisions. Planning + verification (this runbook, the panels, the checklists) is
> additive and safe to run alongside. Do not rewrite/move another session's live test
> files mid-flight (see `docs/08-tests/TEST-PLAN.md`).

## Build order (summary)

`Tier 0` Auth + RBAC + shell → `Tier 1` CRM Ops (7) · Budget (10) · Decision Queue (11) →
`Tier 2` Dashboard (6) · Nurture (5) · Home (1) → `Tier 3` Grassroots (2) · Admissions (9) ·
Content (3) · Analytics (13) → `Tier 4` Summer Camp (4) · Field & Events (8) · Library (12).

Rationale lives in `/help/roadmap`. Foundation first (RBAC is the #1 P0 gap), then the
modules that prove the four "show us it works" signals, then depth, then funnel/loop, then
the light manual surfaces.

## The loop (run for EACH module, in order)

```
1. BUILD     implement the module per docs/modules/<NN>-<slug>/PLAN.md (additive; honor cross-module contracts)
2. TEST LOOP gt-hub-test-panel → add/extend tests for this module; run; fix until green or honest todo
3. PANEL     gt-hub-<slug>-panel → review the built module vs its PLAN; apply needed changes
4. SECURITY  gt-hub-security-panel → review the module (mandatory for auth/payments/PII/Decision-Queue surfaces); findings → fixes + tests
5. COHESION  gt-hub-cohesion-panel → review ALL built-so-far modules together (seams, IA, one-metric-meaning, handoffs, role journeys)
6. PRD CHECK both PRDs → fill the per-module checklist below; nothing silently dropped
7. GATE      npm run verify (build + lint + test:ci); regenerate /dev/tests report from the pure set if a live session is active
```

Repeat. At each module completion you produce: a green (or honestly-todo) test delta, a
panel review note, a cohesion re-review of everything built, and a filled PRD checklist.

### 1. Build
- Implement only what `docs/modules/<NN>-<slug>/PLAN.md` specifies; reuse the backbone/seed (don't duplicate).
- Honor the module's cross-module contracts (in/out auto-links) and SSOT map.
- Cover empty / loading / error / duplicate states (the UX seat won't pass otherwise).

### 2. Test loop (`gt-hub-test-panel`)
- Add module use cases to `lib/dev/usecases.ts`; prove the `covered` ones in tests, `it.todo` the rest.
- Keep `tests/brief-usecases.test.ts` integrity green; flip any now-buildable `pending` → real test.
- Run `npm run test:<domain>` for the touched domain, then `npm run test:ci` (pure gate).

### 3. Per-module panel (`gt-hub-<slug>-panel`)
- Score the BUILT module against the module pillars (M1–M5) + its specialist seats' falsifiable asks.
- Any failing ask → make the change now, re-run the loop from step 1 for that delta.

### 4. Security review (`gt-hub-security-panel`)
- Score against S1–S8; **mandatory** for any module touching auth, payments, PII/minors, or the Decision Queue.
- Server-side RBAC (not UI-only), program scope from the session (never the client), secrets server-only, internal surfaces gated.
- Findings → fixes now + an RBAC-denial / isolation / webhook-replay test (or a tracked `it.todo`). Threat model lives in `docs/audits/SECURITY-REVIEW.md`.

### 5. Cohesion review (`gt-hub-cohesion-panel`)
- Review ALL modules built so far as ONE product against C1–C8 (design system, IA, one-meaning-per-metric, seamless handoffs, role journeys, ease of use, a11y, learnability).
- A journey that works per-module but breaks at a seam is a FAIL — fix before moving on.

### 6. PRD requirements checklist (fill per module)

Copy this block into `docs/modules/<NN>-<slug>/CHECKLIST.md` and complete it at module completion.

```markdown
# Module <N>: <Name> — PRD requirements checklist
> Reviewed against: GT_Technical_Project_Brief.md + GT_Marketing_Hub_Spec.md · Date: <date>

## A. Spec fidelity (Marketing Hub Spec §3 Module <N>)
- [ ] every sub-view / tab present
- [ ] every default widget present (Home/overview modules)
- [ ] Inputs & Outputs (developer reference) all covered
- [ ] source-of-truth map respected (reads the authoritative source, not a duplicate)

## B. Cross-module contracts (Spec §4)
- [ ] inbound auto-links consumed (with payload + visible landing)
- [ ] outbound auto-links emitted (testimonial / objection / hot-family / variance / parity / event as applicable)

## C. RBAC & isolation (Brief + Spec §2 roles)
- [ ] role gating correct (esp. Decision Queue Leader-only; Operator submit-not-view)
- [ ] program isolation holds; data-confidence banner shows when parity drops

## D. Test coverage (gt-hub-test-panel)
- [ ] every covered use case has an always-green assertion
- [ ] every pending feature tracked as it.todo (nothing faked green)
- [ ] demo signal(s) for this module have a test or a tracked todo

## E. Demo signal(s) (Brief "show us it works")
- [ ] the signal(s) this module lights are demonstrable (or honestly todo)

## F. Security (gt-hub-security-panel)
- [ ] every route/handler deny-by-default; role checked SERVER-side (not just UI)
- [ ] no IDOR/BOLA; program scope derived from the session, never the client
- [ ] all DB access via withProgram/withoutProgram; no service_role / BYPASSRLS
- [ ] sensitive content (PII/minors/SMS/VoC) role-gated; none in logs/client bundle
- [ ] secrets server-only (no NEXT_PUBLIC_ leak); webhooks verified + idempotent
- [ ] internal/dev surfaces gated or stripped in prod; security headers set; money/decision actions audited

## Gaps & assumptions
- <list anything deferred, with why, per the Brief's "write down your assumptions">
```

### 7. Gate
- `npm run verify` (build + lint + `test:ci`). If a live build/test session is active, regenerate the `/dev/tests`
  report from the **pure set only** (don't poke live HubSpot/Stripe).

## End-of-each-module: review everything built

After step 5, re-run the cohesion panel over the full set built so far AND re-check the
global checklist (`docs/01-intake/REQUIREMENTS.md`) — update statuses (done / partial /
missing) so the project-level completeness view stays honest.
