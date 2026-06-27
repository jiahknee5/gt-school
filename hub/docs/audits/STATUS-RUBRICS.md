# GT Marketing Hub — Status Page Rubrics & Generation System

> **What this is.** The governing spec for the `/m/status` executive verdict board: the
> per-cell rubric each matrix cell must satisfy, the overall-status ("The Answer") rubric,
> and how the weekly verdict is generated, persisted, recalled, and asked about.
>
> **Single source of truth in code:** `hub/lib/status/rubrics.ts`. Generation
> (`hub/lib/status/generate.ts`), the conformance tests (`hub/tests/status-rubrics.test.ts`),
> and this doc all reference those typed definitions. Extends `NARRATIVE-RUBRIC.md` (the
> L1→L5 quality scale) from the Narrative column to all four spine columns + the Answer.

---

## 1. Per-cell rubrics (one per spine column, specialized per stage where it matters)

Each cell answers ONE question, cites REAL data, and follows a required structure. The
default board shows ONE signal (calm); the drawer carries the depth.

| Column | Question it answers | Must cite | Default shows | Drawer shows | Bar |
|---|---|---|---|---|---|
| **① Position** | Where do we stand on this stage? | headline KPI + RAG + a vs-reference | the headline number + RAG | full reading + delta + derivation note + confidence | L4+ (derived values labeled) |
| **② Drivers** | What's driving the position? | ranked breakdown/trend + economics | one glance line naming the lead driver | the ranked chart, per-stage economics, method | L4 (names the mechanism) |
| **③ Decisions** | What needs a leadership decision? | an open queue item **or** an explicit "no open ask" reason | attention flag only when real | the decision question + urgency + queue link | Honesty (never invents a decision) |
| **④ Narrative** | The one-line C-suite story? | headline number + binding driver + consequence | the single top headline bullet | full bullets + generated reasoning | **L5** (board-ready, ~25 words, RAG cue) |

**Stage specializations** (`STAGE_CELL_RUBRICS`):
- `position.conversion` — must state deposits/target, gap-to-pace, and run-rate gap (the binding-constraint proof).
- `narrative.conversion` — must name conversion as the binding constraint, mirroring the Answer.
- `position.nurture` — 24h SLA %, late count, worst owner; labeled a deterministic stand-in (not live HubSpot).

**Conformance is falsifiable.** `checkCellConformance(cell, column, stage, rag)` returns the
list of failures (empty = pass). `tests/status-rubrics.test.ts` runs it over every cell of the
live board and fails the build if any cell drops below its bar.

## 2. Overall-status rubric — "The Answer" (`ANSWER_RUBRIC`)

> **Question:** *Are we on track for Fall enrollment — and what should leadership do this week?*

The Answer is **organized bullets, not prose**, and must resolve four C-suite questions in
order, leading with the verdict:

1. **Where we are** — the position in one bullet (deposits/target, gap to pace, demand).
2. **On track?** — yes/no with the magnitude vs pace (run rate vs required, projection).
3. **Why / why not** — the ONE binding constraint named (conversion, not demand) + SLA risk.
4. **What to do** — the lever + the clock (offer→deposit step before Aug 17) + open decisions.

`checkAnswerConformance` enforces: a one-line headline verdict, all four sections present and
non-empty, real numbers cited, and a tie to the Fall goal / the clock.

## 3. Weekly generation pipeline (pre-loaded, scheduled)

`hub/lib/status/generate.ts` fills every cell + the Answer per the rubrics, grounded in the
REAL board numbers (scorecard, pacing, budget variance, decisions, SLA, channels, engagement).

- **Deterministic generator (always on).** Slots the real numbers into the rubric structure.
  No API key required — this is what the demo runs on. `source = "deterministic"`,
  `model = "deterministic-rubric-v1"`.
- **LLM step (optional, pluggable).** `AnthropicStatusProvider` rewrites the deterministic
  draft to the rubric via a **direct `fetch`** (litellm is BANNED). The output must still pass
  `checkAnswerConformance`, else the deterministic draft stands. So the feature works with no
  key and degrades safely on provider error. `source = "llm"` only on a validated LLM run.
- **Every run is labeled** `source=llm|deterministic`, with `model`, `generatedAt`, and an
  `inputsHash` of the grounding numbers (stale detection).

**Schedule (Vercel Cron).** `vercel.json` → `{"path":"/api/cron/status-refresh","schedule":"0 7 * * 1"}`.
The route refreshes the current reporting week for every program and **persists** the snapshot,
so the page is PRE-LOADED, not generated on page load. Secured by `CRON_SECRET` (Vercel sends
`Authorization: Bearer <CRON_SECRET>` automatically).

> **Timezone caveat.** Vercel Cron runs in **UTC** (no timezone field). `0 7 * * 1` is 07:00
> UTC Monday. For 07:00 **America/Chicago**, use `0 12 * * 1` (CDT). Documented in `.env.example`.

**Manual trigger (demos).** `POST /api/cron/status-refresh` is admin/leader-only and regenerates
+ persists the current week on demand.

## 4. Persistence + recall (DB → file → on-view generation)

`hub/lib/status/store.ts` resolves the most durable store available:

1. **DB** when `APP_RW_DATABASE_URL` is set — table `status_snapshot` (migration
   `0017_status_snapshots.sql`), one row per `(program, week_start)`, upserted through the
   `app_rw` path with no program GUC (like `kpi_goal`/`home_layout`). RLS-respecting; additive.
2. **File** otherwise — JSON per `(program, week)` under `STATUS_SNAPSHOT_DIR` (default OS tmp).

On top of either, `loadOrGenerateSnapshot` **never crashes the page**: a week with no stored
snapshot is generated deterministically on view (and best-effort persisted). So the board + the
week selector work with no DB and no key — mirroring the app's existing cookie/file fallbacks.

## 5. Week selector (recall history, not recompute)

The Status page reuses the reporting-week concept (`weekMondays()` / `?week=`). Selecting a
past week loads **that week's saved snapshot** (what the verdict said then). The
`StatusWeekBar` shows a **Current week** vs **Historical snapshot** badge and a provenance chip
(`LLM` / `Deterministic` · pre-loaded/on-view · date). Missing weeks degrade to on-view
generation rather than erroring.

## 6. Inline Ask the Hub (no redirect)

`AskTheHubStrip` answers **in place** via `POST /api/status/ask`, grounded in the current (or
selected-week) snapshot + the Hub source-of-truth helpers:
- Status-specific questions (deposits/pace, worst CPQL, blocking decision, SLA) are answered
  deterministically with the board's real numbers (`hub/lib/status/ask.ts`) + citations.
- Free-form questions are handed to the full Ask-the-Hub agent (RBAC + PII guarded), which is
  LLM-backed when a key is configured and a deterministic cited answer otherwise.
- With no key, the answer is still grounded + inline, with a "configure a key for free-form
  synthesis" note. It **never redirects**.

## 7. New environment

| Var | Purpose |
|---|---|
| `STATUS_GEN_MODEL` | Model for the Status verdict generator (falls back to `ASK_THE_HUB_MODEL`). |
| `STATUS_GEN_LIVE` | `"false"` forces deterministic even with a key. |
| `CRON_SECRET` | Authorizes the Vercel Cron refresh route. Required in production. |
| `STATUS_SNAPSHOT_DIR` | File-store dir for the no-DB fallback (default OS tmp). |

To enable **full fidelity**: set `ANTHROPIC_API_KEY` + `STATUS_GEN_MODEL` (LLM verdicts),
`APP_RW_DATABASE_URL` + run migration `0017` (durable snapshots), and `CRON_SECRET`
(scheduled refresh). With none of these the demo still works end-to-end (deterministic + file).
