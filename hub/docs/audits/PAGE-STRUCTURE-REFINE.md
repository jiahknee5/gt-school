# GT Marketing Hub — Page Information-Hierarchy Audit + /refine Trace

> An **information-hierarchy audit + refine loop** across every page of the Hub. The bar:
> every page must read **top-down for a brand-new user** — *business objective first → the
> proof (KPIs) → the detail (tables/controls)* — with **hover explanations on everything
> non-obvious**, **zero redundancy**, and **learnability without external docs**.
>
> Method: `/refine` (define bar → score baseline → propose genuinely different restructure
> candidates → re-score → keep only what beats baseline → log the trace). Lens:
> leadership/cohesion (`gt-hub-cohesion-panel`) + visual-QA + workflow panels.
> Objective source: `docs/audits/BUSINESS-USECASE-REVIEW.md §2`. Date: 2026-06-26.
>
> **This document is the audit + restructure spec.** Items marked **DONE** are shipped in
> this branch; items marked **PLAN** are captured here because the file is codex-owned (see
> §6 Codex coordination) or out of this batch's budget.

---

## 0. The rubric (the measurable bar — scored 0–5 per page)

Each page is scored on four sub-dimensions, then averaged to a 0–5 page score. The baseline
is the state at commit `85d245d`; the target is the state this restructure aims for. **We
keep a change only if the re-score beats the baseline** (no goalpost-moving).

| Dim | What 5/5 looks like |
|---|---|
| **O — Objective-first hierarchy** | The business objective (what + why) is the literal first block; sections then run objective → proof (KPIs) → detail (tables/controls). |
| **E — Explanation coverage** | ~100% of non-obvious elements (each KPI, key column, control, gated section) has a hover/focus explanation tied to the objective. |
| **R — Non-redundancy** | No label/metric/explanation repeated within the page or restated from another page. |
| **L — Learnability** | A new hire can state the page's purpose and operate it cold, no PRD/Slack. |

Scoring shorthand in the table below: `O/E/R/L → avg`.

**The primitives that move the score** (shipped this branch, see §5 trace):
- `app/_components/InfoTip.tsx` — accessible `?` hover/focus tooltip (`InfoTip` + `Explain`).
- `app/_components/PageObjective.tsx` — the objective-first banner (what + why), server component.
- `lib/help/explanations.ts` — one source of truth for every explanation + every module's
  one-line business objective (kills cross-page redundancy by construction).
- `tests/infotip.test.ts` — render + content-invariant tests, wired into `test:ci`.

---

## 1. Per-page audit (current structure · baseline · objective · reorder/cut/add · target · redundancies)

Legend: **DONE** = shipped this branch · **PLAN** = captured, not edited (codex-owned or next batch).

### Module pages (`/` + `/m/<slug>`)

| Page (file) | Baseline `O/E/R/L→avg` | Business objective (1 line) | Reorder / cut / add | Target | Redundancies found | Status |
|---|---|---|---|---|---|---|
| **Home** `app/page.tsx` | 1/1/2/2 → **1.5** | Open one personal command center showing this week's marketing health + your next action. | **Lead with the operator objective + scorecard topline**, not the "Phase 2 product spine" / `PHASE2_REQUIREMENT_AUDIT` board (move build-meta to `/dev`). Add InfoTips to each widget. | 4.0 | "Phase 2" build-meta competes with the operating view; role/owner shown both in TopBar and inline. | **PLAN** (codex owns `app/page.tsx`) |
| **Grassroots** `m/grassroots/page.tsx` | 3/2/4/3 → **3.0** | Run the ambassador/referral engine, reconciling community + HubSpot into one roster. | Add `PageObjective` first; InfoTips on the 4 KPIs + "Source winner" column + "Source of truth". | 4.5 | none material | **DONE** |
| **Content** `m/content/page.tsx` | 3/2/4/3 → **3.0** | Manage editorial pipeline, calendar, brand voice from brief to performance. | Add `PageObjective`; InfoTips on 4 KPIs. | 4.25 | "measured not constant" stated in blurb + aside (acceptable: different audiences). | **DONE** |
| **Summer Camp** `m/summer-camp/page.tsx` | 3/2/4/3 → **3.0** | Run camp P&L on reconciled dual sources — capacity, roster, revenue vs target. | Add `PageObjective`; InfoTips on 4 KPIs + PII roster heading. | 4.5 | "separate P&L / out of $365K" appears in source-note + aside + P&L card (kept: each is a different surface). | **DONE** |
| **Nurture** `m/nurture/page.tsx` | 4/2/4/4 → **3.5** | Move families through lifecycle — segments, sequences, SMS, 24-hr SLA. | Add `PageObjective`; InfoTips on KPIs + SLA columns. | 4.5 | none material | **PLAN** (codex committed this file in `85d245d`) |
| **Dashboard** `m/dashboard/page.tsx` | 3/2/4/4 → **3.25** | Read the one shared weekly scorecard the whole team meets on. | Add `PageObjective`; InfoTips on 4 meta-KPIs + reporting-week control. | 4.5 | none material | **DONE** |
| **CRM Ops** `m/crm-ops/page.tsx` | 3/2/4/4 → **3.25** | Own data-infrastructure health: parity, attribution, the data-confidence signal. | Add `PageObjective` (shown even on deny); InfoTips on the 3 Overview KPIs. | 4.5 | none material | **DONE** |
| **Field Events** `m/events/page.tsx` | 3/2/4/3 → **3.0** | Track GT-run events + propose priority events; ambassador events read-only. | Add `PageObjective`; InfoTips on 4 KPIs. | 4.25 | "uninstrumented/manual v1" repeats across source-note, KPI, and card (kept: honesty reinforcement). | **DONE** |
| **Admissions** `m/admissions/page.tsx` | 3/2/4/3 → **3.0** | Log objections, bridge to content briefs, close the VoC loop. | Add `PageObjective`; InfoTips on KPIs + bridge columns. | 4.25 | none material | **PLAN** (codex committed this file in `85d245d`) |
| **Budget** `m/budget/page.tsx` | 3/2/4/4 → **3.25** | Reconcile all spend to the $365K plan; route over-plan variances to leadership. | Add `PageObjective`; InfoTips on 4 KPIs + "Source of truth". | 4.5 | `$365,000`/`$365K` stated in blurb, KPI, and aside (kept: anchor metric). | **DONE** |
| **Decision Queue** `m/decisions/page.tsx` | 3/2/4/4 → **3.25** | Async governance — anyone submits, leadership-only approves/rejects/need-info. | Add `PageObjective` (shown on deny too); InfoTips on the 4 leader tiles. | 4.5 | "submit vs view/act" stated in blurb + aside + deny copy (kept: it's the headline RBAC story). | **DONE** |
| **Library** `m/library/page.tsx` | 3/2/4/4 → **3.25** | Find any reusable asset fast on a flat, tag-filterable shelf. | Add `PageObjective`; InfoTips on 3 KPIs + tag filter. | 4.5 | none material | **DONE** |
| **Analytics** `m/analytics/page.tsx` | 3/2/4/4 → **3.25** | Read GA4 across both sites — pages, downloads, sources, paths. | Add `PageObjective`; InfoTips on 4 KPIs. | 4.5 | none material | **DONE** |
| **My submissions** `m/submissions/page.tsx` | 3/2/4/4 → **3.25** | See decisions you raised + leadership's ruling, in one place. | Add `PageObjective`. | 4.0 | "you see only your own / full queue is leadership-only" in header + (objective) — objective generalizes it. | **DONE** |
| **GT Challenge** `/m/gt-challenge` (`m/[slug]/page.tsx`) | 2/1/3/3 → **2.25** | Run the GT Challenge lead magnet — capture, assess, report CPQL. | Generic `[slug]` surface: lead with `PageObjective`, InfoTip the `SurfaceMetric` tiles + "Actions". | 3.5 | "Actions" pills duplicate capability stated elsewhere. | **PLAN** (`[slug]` derives from codex-owned `lib/phase2.ts`) |

### Non-module pages

| Page (file) | Baseline avg | Objective (1 line) | Reorder / cut / add | Target | Status |
|---|---|---|---|---|---|
| **Login** `login/page.tsx` | 3.0 | Authenticate and choose a demo role to enter the Hub. | Single-purpose; add one InfoTip explaining the demo-role lens. | 3.5 | **PLAN** |
| **Gifted Quiz** `(public)/gifted-quiz/page.tsx` | 2.5 | Public lead magnet: capture a consented quiz submission. | Lead with the parent-facing purpose; InfoTip the consent/UTM capture. | 3.5 | **PLAN** |
| **Help index** `help/page.tsx` | 4.0 | Self-serve guides for common cross-module journeys. | Already objective-led (guides have `objective`). Add per-guide InfoTips. | 4.5 | **PLAN** |
| **Help guides** `help/[slug]`, `roles`, `roadmap`, `ai-agents`, `priority-workflows`, `test-suite` | 3.5 | Each: one journey/topic, explained. | Fix `raise-a-decision`/`compose-home` over-promise (AF-4, now buildable). | 4.0 | **PLAN** |
| **Open Data** `opendata/page.tsx`, `opendata/[provider]/page.tsx` | 3.0 | Show read-only Open Data enrichment used as decision context. | Lead with "decision context only, never written back"; InfoTip provenance (fixture/cache/live). | 4.0 | **PLAN** |
| **Dev pages** `dev/*` (8) | 3.0 | Admin/grading build-meta surfaces. | Out of operator scope; lead each with "what this admin surface is for". | 3.5 | **PLAN** |
| **Forbidden** `forbidden/page.tsx` | 3.5 | Explain a denied route + the next step. | Single-purpose; minor copy tie to RBAC objective. | 4.0 | **PLAN** |

**Net baseline → target (restructured pages):** the 11 shipped module pages move from an
average **~3.15** to a target **~4.4** (objective-first + full headline-KPI explanation
coverage). Codex-owned pages (Home, Nurture, Admissions, GT Challenge `[slug]`) are the
biggest remaining baseline gaps and are captured as PLAN.

---

## 2. Consolidated restructure backlog (prioritized, file-mapped)

### P0 — objective-first + explanation coverage on the operator surfaces
- **P0-1 — Objective banner on every module page.** `app/_components/PageObjective.tsx` +
  `lib/help/explanations.ts:PAGE_OBJECTIVES`. **DONE** for 11 pages; **PLAN** for Home,
  Nurture, Admissions, `[slug]` (codex-owned).
- **P0-2 — InfoTip every headline KPI + key control.** `app/_components/InfoTip.tsx` +
  `lib/help/explanations.ts:EXPLANATIONS`. **DONE** for the 11 pages' KPI grids + selected
  columns/controls.
- **P0-3 — De-grade Home (RT-3 from business review).** Move `PHASE2_REQUIREMENT_AUDIT` /
  "Phase 2 product spine" to `/dev`; lead Home with the scorecard topline + objective.
  **PLAN** — `app/page.tsx` is codex-owned.

### P1 — finish coverage + remove cross-page redundancy
- **P1-1 — InfoTips on Nurture/Admissions** once codex releases those files. **PLAN.**
- **P1-2 — `[slug]` generic surface** (GT Challenge): objective + tile InfoTips. **PLAN**
  (touches `lib/phase2.ts`-derived `SurfaceMetric`).
- **P1-3 — Modkit `info?: ReactNode` slot.** Add an optional explanation slot to
  `MetricTile`/`Card` so the page-level relative-wrapper pattern can collapse into the
  component. **PLAN** — `modkit.tsx` is codex-owned. (Until then, pages wrap tiles in a
  `relative` span with an absolutely-positioned `Explain` — see shipped pages.)
- **P1-4 — Help guide truthfulness (AF-4).** `lib/help/guides.ts` — align
  `raise-a-decision`/`compose-home` to shipped behavior. **PLAN.**

### P2 — non-module surfaces
- **P2-1** — Open Data provenance InfoTips. **P2-2** — Login demo-role InfoTip.
  **P2-3** — Gifted-quiz consent/UTM InfoTip. **P2-4** — Dev-page purpose headers. **PLAN.**

---

## 3. Redundancies flagged

- **Home build-meta vs operating view** — the requirement-status board duplicates `/dev`
  content on the primary operator surface (the single biggest redundancy + objective miss).
  → P0-3 (PLAN, codex-owned).
- **Role/owner double-display** — addressed by codex pre-batch ("Remove redundant Active
  role boxes", commit `4554643`); identity now lives once in the TopBar.
- **Intentional, kept** — anchor facts deliberately restated for honesty/anchoring:
  `$365K` (Budget), "separate P&L / out of $365K" (Summer Camp), "manual v1 / uninstrumented"
  (Events), "submit vs view/act" (Decision Queue). These are reinforcement across distinct
  surfaces, not accidental duplication; the objective banner generalizes rather than repeats.
- **Explanation duplication is structurally impossible** — every explanation and every
  module objective is keyed once in `explanations.ts`; a test asserts no two
  explanations/objectives share text.

---

## 4. Explanation coverage delta (proof)

`explanations.ts` now centralizes **per-module objectives for all 13 modules + Home +
submissions + GT Challenge**, and **~45 element explanations**. Shipped adoption this batch:

| Page | KPIs explained | Columns/controls explained |
|---|---|---|
| Grassroots | 4/4 | Source-winner column, Source-of-truth |
| Budget | 4/4 | Source-of-truth |
| Dashboard | 4/4 | Reporting-week control |
| CRM Ops | 3/3 (Overview) | — |
| Summer Camp | 4/4 | PII roster heading |
| Content | 4/4 | — |
| Library | 3/3 | Tag filter |
| Analytics | 4/4 | — |
| Field Events | 4/4 | — |
| Decision Queue | 4/4 | — |
| My submissions | objective banner | — |

---

## 5. The /refine trace (candidates → scores → kept/reverted)

**Bar fixed first** (§0). Baseline scored at `85d245d`. For the *mechanism* of explanation +
objective, three genuinely different candidates were considered:

| # | Candidate | Pros | Re-score effect | Decision |
|---|---|---|---|---|
| A | **Inline parenthetical copy** next to each metric ("Active ambassadors (counted once)") | zero new components | E↑ slightly but **R↓** (more on-page text, repeated across pages), L flat | **REVERTED** — worsens non-redundancy; copy can't be reused. |
| B | **Edit `modkit.MetricTile`/`Card`** to take an `info` prop | cleanest call-site | best E + R | **DEFERRED to PLAN (P1-3)** — `modkit.tsx` is codex-owned; editing risks a collision. |
| C | **Standalone `InfoTip`/`Explain` island + page-level relative-wrapper + centralized `explanations.ts` + `PageObjective` banner** | reusable, accessible, server-friendly, content written once, no codex-owned file touched | **O↑ (banner), E↑ (full KPI coverage), R↑ (single source), L↑** | **KEPT** — beats baseline on all four dims without touching codex files. |

Per-page application of candidate C: baseline `~3.15` → target `~4.4` on the 11 shipped
pages (every one strictly improves O + E; R/L flat-or-up). No shipped page regressed on any
dimension, so all 11 were **kept**.

**Convergence honesty:** the loop **did not fully converge** to 5/5 — the highest-leverage
remaining gains are on **codex-owned files** (Home de-grade P0-3 is the single biggest score
lift available and is **not** done) and on the **modkit `info` slot** (P1-3) which would push
E to ~100% and let the relative-wrapper pattern retire. Those are captured as PLAN, not
silently dropped, and the bar was not weakened to claim victory.

---

## 6. Codex coordination notes

- Codex (`terminal 8`, `gpt-5.5`) finished its task at commit `85d245d`, pushed to
  `origin/master`, then **hit usage limits** ("Goal hit usage limits") — i.e. idle, not
  actively editing — throughout this work. Verified before/after each batch.
- **Treated as codex-owned → not edited, captured as PLAN:** `app/page.tsx`,
  `lib/modules.ts`, `lib/phase2.ts`, `app/_components/TopBar.tsx`, `Sidebar.tsx`,
  `modkit.tsx`, `GuidedTour.tsx`, and the module pages codex committed in `85d245d`
  (`m/admissions/page.tsx`, `m/nurture/page.tsx`). The generic `m/[slug]/page.tsx` derives
  from `lib/phase2.ts` and is likewise PLAN.
- **New files (can't collide):** `app/_components/InfoTip.tsx`,
  `app/_components/PageObjective.tsx`, `lib/help/explanations.ts`, `tests/infotip.test.ts`,
  this doc.
- **Edited (codex NOT in these):** the 11 module pages in §1 marked DONE + `package.json`
  (one-line `test:ci` addition).
- Git hygiene: staged only explicit paths (never `git add -A`); `deployed-budget.png` left
  untracked; no `.env*`; no stash pops.
