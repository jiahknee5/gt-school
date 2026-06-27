# QA Value Sweep — Report

**Target:** http://localhost:3000 · branch `reconcile-status` · focus on the recent shipped work (WS0 as-of clock, talk-through narrative, WS2 owner contract, vertical compression, WS4 citations, WS6 observability).

## Verdict roll-up
- **KEEP: 7** · **FIX: 3** · **MERGE: 0** · **CUT: 0**

No surface fails V1/V3/V5 — nothing is dead weight or wrong-purpose. The recent changes all earn their place; the FIX items are **two self-inflicted regressions** from this session plus one minor audience nit.

## Prioritized fix backlog

### P0 — correctness (ship-blocker)
1. **React key collision in the Status Answer drawer.** The hero drawer concatenates the rubric Answer sections (now labelled **"Where we stand"**) with the conversion stage's `buildStageDrawer` output, which *also* emits a **"Where we stand"** heading → two children with the same React key. Console error; React may drop/duplicate a section.
   - **Fix:** key drawer sections by index (or `${heading}-${i}`) in `StatusDrawer.tsx`; and/or disambiguate the stage-position heading (e.g. "This stage — where it stands") in `buildStageDrawer` (`lib/status/board.ts`). The key fix alone clears the error; the heading rename removes the visible duplicate.

### P1 — fit / hierarchy
2. **Per-stage "Needs attention" lens tag is glued + uniform.** Renders as "**Needs attention**X / Twitter…" (no separation) and appears identically on **all six** rows (none are green at this as-of week), so it duplicates the row RAG token without differentiating.
   - **Fix (`StatusCellContent.tsx`):** give the tag a clear chip style / leading space; show **"Working"** only for green stages and **suppress** the redundant "Needs attention" label where the RAG token already carries it (or keep it but make it a distinct, non-text-glued badge). Goal: the lens should *differentiate* strengths from problems, not repeat the RAG on every row.

### P2 — audience polish
3. **All-roles scorecard links to an admin-only surface.** The Dashboard Source column ⛁ link points at `/dev/integrations` (admin-only); a Leader/Operator clicking it hits the RBAC gate.
   - **Fix:** in `MetricCite`, render the source as plain text (not a link) when the viewer isn't admin, or point non-admins at a role-safe provenance affordance. Low severity (the gate protects; it's a dead-end click, not a leak).

## What's already earning its place (don't over-correct)
- **WS0 as-of clock** — the headline fix lands: North Star reads **56/180** (week 3 cumulative), week selectors stop at today. Honest, not alarming.
- **Talk-through narrative** — the 4-beat Answer (Where we stand → What's working → What needs attention → What to do) renders and reads naturally; "What's working" adds the missing strengths beat.
- **WS2 owner contract** — accountable owner·role on every funnel row; the fixed metric contract + WoW lives in the drawer.
- **Vertical compression** — rows are tighter and de-duplicated (redundant exec chip removed).
- **WS4 dual citations** — every scorecard KPI + Status metric links to its owning module **and** its data source, and the source anchors resolve on `/dev/integrations`.
- **WS6 observability** — Ask-the-Hub and Status-gen now render in one eval table; run traces persist durably (audit.persisted is real).

## Coverage statement
- **Judged live (Admin):** `/m/status` (board + Answer drawer + stage drawer), `/m/dashboard` (scorecard + Source citations + week selector), confirmation of WS4/WS6 surfaces.
- **By test (authoritative):** RBAC matrix via `rbac.test.ts`; the as-of clock, citation mapping, data-sync contract, and observability via their unit suites (549 tests green).
- **Blocked / deferred:** live Leader/Operator browser pass (dev server bogged under concurrent compiles — rerun on a warm server / preview); empty-error-zero-data drawer states; Summer-camp program lens. None touched by the recent changes.

## Stop condition
One sweep round over the scoped surfaces; the two P0/P1 findings are concrete regressions with a file+fix. Not run to the full two-dry-round stop across all 31 app surfaces — scope was deliberately the recent changes per the invocation. A full-app dry-loop is the next pass.
