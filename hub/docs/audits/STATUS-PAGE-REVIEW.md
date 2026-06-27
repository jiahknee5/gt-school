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

## Deferred

- Program-scoped funnel filtering (Fall vs Camp families)
- Reverse cross-links from Home/Dashboard chrome
- Live inline Ask API (uses Help console by design)
- Deploy deferred — dirty worktree with concurrent WIP; commit locally only
