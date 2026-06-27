# Status Page — Expert Panel Review & Refine Loop

**Date:** 2026-06-27  
**Surface:** `/m/status` — Executive verdict board (funnel × spine matrix)  
**Mock source:** `hub/docs/deck/gt-funnel-matrix-mock.html`

## Role in the Hub (cohesion)

| Surface | Job | Status relationship |
|---------|-----|---------------------|
| **Home** (`/`) | Personal cockpit — composable widgets, role-aware next actions | Status links back; does not duplicate widget grid |
| **Status** (`/m/status`) | Exec verdict — one Answer, 6×4 matrix, drill-down drawer | Binding narrative before Monday standup |
| **Dashboard** (`/m/dashboard`) | Weekly scorecard — canonical KPIs for the meeting | Status cites same scorecard libs; Dashboard remains reference rail |

Distinction copy is in the page header and `board.distinctionNote`.

## Panel roster (condensed)

Panels invoked via existing GT Hub skills: Visual QA, Dashboard, Home, Cohesion, Data-Marketing, Design Taste, Refine.

## Findings (pre-refine)

### Visual QA + Design Taste
- **Pass:** De-boxed matrix with row banding; gold reserved for north-star gap (+81); drawer progressive disclosure; executive bullets not prose.
- **Pass:** RAG tokens use shape + label (▲/◑/● + text), color-blind-safe palette.
- **Fix:** Answer headline said "On pace" while weekly KPI RAG was red (semantic drift vs Dashboard `at_risk`).

### Dashboard + Data-Marketing
- **Pass:** Headline numbers from `buildScorecard`, `paceToTarget`, budget variance, decisions queue, SLA stand-in — not mock literals.
- **Pass:** Derived metrics labeled (`CPQL derived`, `est. trend`, stage spend `~$/deposit est.`).
- **Note:** SLA sparkline is illustrative (no weekly SLA history in seed); labeled in drawer.
- **Deferred:** Program lens relabels board but does not yet filter funnel families by Fall vs Camp scope.

### Home + Cohesion
- **Pass:** Command nav order `Home → Status → Dashboard → Decisions`; RBAC same as Dashboard (all authenticated roles).
- **Pass:** Ask the Hub routes to `/help/ai-agents?q=…` (existing console, not dead mock).
- **Gap (deferred):** One-way cross-links — Status → Home/Dashboard; reverse links on Home/Dashboard not added (avoid clobbering concurrent WIP on those pages).

### Narrative rubric
- **Pass:** Each Narrative cell is 1–2 scannable bullets; Answer is 4 organized bullets (demand, conversion, SLA, decisions).

## Refine iteration (applied)

1. **Answer headline ↔ RAG alignment** — When cumulative pace is ahead but weekly run rate is `at_risk` or SLA &lt; 80%, headline now reads *"Ahead on deposits but weekly run rate and SLA need defense before Aug 17"* and RAG composites gap + weekly + SLA (not deposit row alone).
2. **Ask the Hub SSR-safe** — Replaced `useRouter` with `Link` + form submit so server render tests and static export paths work.
3. **Help objectives** — Added `status` entry to `PAGE_OBJECTIVES` in `lib/help/explanations.ts` for InfoTip coverage.

## Per-cell content decisions (24 cells)

| Stage | Position | Drivers | Decisions | Narrative |
|-------|----------|---------|-----------|-----------|
| **Awareness** | GA4 conv KPI (low-confidence) | Channel ranked bars + stage spend est. | T3 nurture sequence (real DQ item) | X/Twitter engine vs paid social |
| **Acquisition** | 854 applicants, weekly vs target | CPQL bars (derived) + guerrilla spend | Guerrilla reallocation (urgent DQ) | Demand below target; approve guerrilla bet |
| **Activation** | Hot+warm→deposit % (derived tiers) | Engagement tier bars + spend est. | Thin — operational re-engage (honest) | Hot vs cold conversion gap |
| **Nurture** | SLA % + late count | SLA sparkline (est.) + spend | Thin — assign owner (no DQ item) | Speed-to-lead binding |
| **Conversion** | 150/180 deposits + pace chip | Fall funnel steps + spend est. | Camp session DQ OR budget variance | Conversion binding narrative |
| **Advocacy** | Referral→deposit % | Ambassador bars (derived) + spend | Thin — toolkit (operational) | Flywheel + influenced deps gap |

## Test & build

- `tests/status.test.ts` — board data, nav/RBAC, page smoke render
- `tests/module-groups.test.ts` — Command group includes `status` (14 modules)
- `npm run build` — **pass**
- `npm run test:ci` — **478/480 pass**; 1 pre-existing failure in `tests/phase2.test.ts` (unrelated WIP: confidence banner href includes `?tab=quality#…`)

---

# Refine #2 — "Too busy" editorial cut (2026-06-27, applied)

**Feedback:** *"It's still too busy. Be very selective on what to present and why, and let the drill-down carry the dense info."*

## The editorial principle applied

> **Top level answers one question:** *"Are we on track for Fall, and what needs my attention?"* — nothing else.
> Every default element must earn its place by tying to that question. When in doubt, **cut it from default and let the drawer carry it.** Default = calm editorial glance; drawer = the dense detail.

Operationalized as three rules:
1. **One thing per cell.** Each of the 24 matrix cells shows AT MOST one signal — a single number, a single line, or a single flag. No cell shows a number *and* a chart *and* bullets *and* economics anymore.
2. **Exception highlighting.** Status is carried by ONE compact RAG token per row (in the row header). The heavy red wash + tint is reserved for the single **binding** constraint (Conversion). All other at-risk stages recede to their RAG token, so the board reads calm even when 5/6 stages are red.
3. **Drawer is lossless.** Everything removed from default (ranked bars, funnel, sparkline, stage-spend economics, derived notes, full narrative, the decision card) is rebuilt into the per-stage drawer by `buildStageDrawer()`. Nothing disappears — it moves one click away. The ⊕ hint + "Click any cell to drill into the detail" pill make that discoverable.

## Approach chosen for reducing column / cell density — and why

Evaluated two options from the brief:
- **(a)** Default to Position-only + a per-row attention flag, hide Drivers/Decisions/Narrative until drill.
- **(b)** Keep all four C-suite columns but collapse each to a single line / flag at default; full detail in drawer.

**Chose (b).** A constraint is *keep the C-suite columns* and *keep funnel × spine legible*. Option (a) destroys the "spine" at the glance level — the whole concept is that an exec scans Position→Drivers→Decisions→Narrative across a row. Option (b) preserves that scan while removing ~80% of the ink: Drivers/Narrative become one quiet muted line, Decisions becomes a flag, Position keeps the one number. This reduces busyness the most *without* breaking the matrix metaphor.

## What shows at default — the 24-cell cut list

For each cell: **the ONE thing kept at default** → *(why)*. Everything else → drawer.

| Stage (row RAG) | ① Position (the number) | ② Drivers (one line) | ③ Decisions (a flag) | ④ Narrative (one line) |
|---|---|---|---|---|
| **Awareness** | `2.1%` GA4 conv → *where awareness stands* | "X/Twitter leads · paid social lags" → *the one driver story* | ◆ Decide: T3 nurture seq → *real open action* | top bullet: X/Twitter is the engine |
| **Acquisition** | `854` applicants → *demand level* | "Referral best CPQL · Facebook 3× trap" | ◆ Urgent: guerrilla reallocation → *needs leadership* | top bullet: demand below target |
| **Activation** | `48%` hot+warm→dep → *activation health* | "Hot 55% vs cold 11%" | — *(operational, recedes)* | top bullet: hot vs cold gap |
| **Nurture** | `55.4%` 24h SLA → *speed-to-lead* | "SLA trending down 72%→55%" | — *(assign owner, no DQ item)* | top bullet: speed-to-lead binding |
| **Conversion** *(binding)* | `150` / 180 deposits → **the north-star proof** | "854 applicants → 150 deposits · offer step leaks" | ◆ Decide: 4th camp session → *open DQ* | top bullet: conversion is binding |
| **Advocacy** | `18%` referral→dep → *flywheel ROI* | "19/25 ambassadors · 1 influenced dep" | — *(toolkit, operational)* | top bullet: advocacy is the flywheel |

**Moved to the drawer for every cell:** ranked-bar charts, the funnel-step chart, the SLA sparkline, stage-spend economics, derived/estimate notes, the full (2nd+) narrative bullets, the decision card + "Open in Decision Queue" CTA, and the Conversion pace-to-Aug-17 KV table. Built by `buildStageDrawer()` so default and drawer never drift.

## Hero "The Answer" — tightened

- **Default now shows only 2 lead bullets:** (1) the binding proof — `150/180 deposits, +81 vs pace, 11/wk vs 6 needed`; (2) the single most important action — *fix offer→deposit + assign the 67-late SLA owner*. Verdict headline + RAG + days-to-cutoff stay.
- **Supporting bullets** (demand-is-healthy, SLA detail, open-decision count) moved into the **Answer drawer** (click the hero → "The Answer · North Star"), which also carries the north-star KV breakdown (current/target/pace/gap/weekly/projection) + the Conversion drill. A `⊕ full answer` hint signals it.
- The gold is still reserved exclusively for the **−/+ north-star gap** (`+81`).

## Before → after busyness

| | Before (d80d792) | After (this refine) |
|---|---|---|
| Per cell | number + chart + bullets + economics + derived note | exactly one signal (number / line / flag) |
| Charts at default | 6 ranked-bar/funnel/sparkline blocks in the matrix | 0 (all in drawer) |
| Status signals/row | RAG token + status word + cell tint + colored border (≈4, all rows) | 1 RAG token/row; red wash only on the 1 binding row |
| Hero bullets | 4 | 2 (rest in Answer drawer) |
| Row height | `minmax(96px)` | `minmax(60px)` |
| One-viewport fit @1440×900 | ~1340px (scrolls) | **983px** (effectively one screen; only the global top bar overflows) |
| Read | "wall of data" | "calm exec glance; detail on click" |

## Test & build (refine #2)

- `tests/status.test.ts` — **11/11 pass**; added guards: each Drivers cell carries a one-line glance; Answer leads with the binding proof (not demand); every stage drawer still exposes *Where we stand / What's driving it / What we're doing* and preserves its chart (nothing lost); default SSR is calm (no `ENGINE`/`TRAP`/`est. trend` at top level, shows the glance + lead bullet instead).
- `npm run build` — **pass**.
- `npm run test:ci` — **483/484 pass**; the 1 failure is the pre-existing, unrelated `tests/phase2.test.ts` confidence-banner href (concurrent WIP, not touched here).

## Deferred (unchanged)

- Program-scoped funnel filtering (Fall vs Camp families)
- Reverse cross-links from Home/Dashboard chrome
- Live inline Ask API (uses Help console by design)

---

# Refine Loop — Rubric-Governed, Weekly, Recallable Status System (2026-06-27)

> **Surface upgrade:** `/m/status` evolved into a rubric-governed, weekly-refreshed,
> historically-recallable executive status system. New code: `lib/status/rubrics.ts`,
> `generate.ts`, `store.ts`, `ask.ts`; `StatusWeekBar`; routes `/api/cron/status-refresh`
> + `/api/status/ask`; migration `0017_status_snapshots.sql`; `vercel.json`. Spec:
> `docs/audits/STATUS-RUBRICS.md`. Based on `origin/master` (the concurrent declutter pass
> is NOT yet on origin — this work is additive and stays calm-by-default, drawer-for-depth).

## Panels convened (skills)

Dashboard, Home, Cohesion, Visual-QA, Data-Marketing, Design-Taste, Refine — plus an
explicit "trust/auditability" challenge on the concept itself.

## Pushback (and the decision taken)

1. **"A weekly LLM-written verdict is not trustworthy or auditable for a board."**
   *Decision — accepted, hardened.* The default generator is **deterministic** (real numbers
   slotted into the rubric); the LLM is an *optional* rewrite that must pass
   `checkAnswerConformance` or it is discarded. Every snapshot is labeled `source=llm|
   deterministic` with `model`, `generatedAt`, and an `inputsHash` of the grounding numbers.
   The provenance chip on `StatusWeekBar` shows this honestly. The verdict is never an
   ungrounded free-write.

2. **"Does the deterministic fallback read as honest, or like a degraded mode?"**
   *Decision — make it first-class.* Deterministic is the *intended demo path*, not an error
   state. The chip reads "▦ Deterministic · pre-loaded/on-view"; the rubric doc states the
   demo runs on it. Derived numbers already carry `derivedNote`s (added 4 missing ones to the
   Drivers cells while here).

3. **"Is the rubric the right one?"** *Decision — extend, don't reinvent.* Reused the
   `NARRATIVE-RUBRIC` L1→L5 scale and extended it to all four columns + the Answer, with
   stage specializations only where they earn their keep (conversion = binding proof; nurture
   = SLA stand-in honesty). Conformance is a falsifiable test over the live board.

4. **"Is cron + DB warranted, or over-engineered vs simpler snapshotting?"**
   *Decision — tiered, not mandatory.* The DB is *optional*: store resolution is DB → file →
   on-view generation, so the page works with **no DB and no key** (mirrors the app's existing
   cookie/file fallbacks). Cron is a thin Vercel-native schedule that just calls the same
   `refreshSnapshot` the admin trigger uses. The complexity is opt-in via env.

5. **"Ask the Hub redirecting off-page breaks the exec flow."** *Decision — answer inline.*
   The strip now posts to `/api/status/ask` and renders the answer in place with citations and
   actions; status questions are board-grounded deterministically, free-form defers to the
   guarded agent. No redirect.

6. **Cohesion/Visual-QA.** The week selector reuses Dashboard's `?week=` pill pattern and
   tokens (gold/amber-soft active state) for consistency; the provenance chip uses the
   color-blind-safe shape+text token convention (●/◑ + label). Depth stays in the drawer;
   the default board is unchanged in density.

## What the refine iterations changed

- Added rubric-structured **Answer** (Where / On track / Why / Do) rendered in the hero drawer.
- Added **week selector + provenance badge** (current vs historical, llm vs deterministic).
- Wired **inline Ask** (no redirect) with board-grounded deterministic answers.
- Added per-stage **Generated reasoning** drawer section (the why behind the verdict).
- Hardened honesty: derivation notes on all derived Drivers cells; conformance test gate.

## Test & build (this iteration)

- New: `tests/status-rubrics.test.ts`, `tests/status-snapshot.test.ts`,
  `tests/status-cron-route.test.ts`, `tests/status-ask-route.test.ts`; extended `status.test.ts`.
- `npm run test:ci` — **515/515 pass**. `npm run build` — **pass**.

## Still deferred (flip-to-enable)

- **LLM verdicts:** set `ANTHROPIC_API_KEY` + `STATUS_GEN_MODEL` (else deterministic).
- **Durable snapshots:** set `APP_RW_DATABASE_URL` + run migration `0017` (else file/on-view).
- **Scheduled refresh in prod:** set `CRON_SECRET` (route returns 503 in prod without it).
- Program-scoped funnel filtering; reverse cross-links from Home/Dashboard (unchanged).
