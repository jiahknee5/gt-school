# GT Marketing Hub — Home vs Dashboard: the decisive distinction & zero-redundancy plan

> Produced by a joint **leadership + cohesion + IA** expert panel (drawing the
> `gt-hub-cohesion-panel`, `gt-hub-ia-panel`, `gt-hub-home-panel`, and
> `gt-hub-dashboard-panel` rosters) to settle one question for good:
> **what is the difference between Home and Dashboard, how should each be framed so there is
> ZERO redundancy of purpose, and where does the PRD's "Weekly Standup / Monday meeting"
> concept map?** Builds on (does not redo) `BUSINESS-USECASE-REVIEW.md`,
> `COHESION-REVIEW.md`, `IA-MODULE-ORGANIZATION.md`, `WORKFLOW-ORGANIZATION-REVIEW.md`.
> Source of truth: `PRD/GT_Marketing_Hub_Spec.md` (M1 Home ~75–186, M6 Dashboard ~620–688,
> §5 meeting integration 1214–1227). Scope: `hub/` + live `https://gt-school-hub.vercel.app`.
> Date: 2026-06-26. **This is a READ / AUDIT + recommendation. No app code was changed**
> (codex is live in Home `app/page.tsx` + `TopBar.tsx`; a role-switcher worker is in TopBar).

---

## 0. The answer in one screen (read this first)

**Home is MY cockpit. Dashboard is OUR board.**

- **Home (M1)** — a **personal, composable** surface each user assembles from the widget
  library; the layout is *yours*, mutable, mixed-source; it is the only place a leader
  **acts** (decision responses, workstream comments, goal edits, the weekly exec narrative).
  *Mine · rearrangeable · the place I act.*
- **Dashboard (M6)** — the **single canonical, week-versioned scorecard** that is
  **byte-identical for everyone** and is the fixed reference in the Monday meeting; read-only,
  shared, one-definition KPIs. *Ours · fixed · the thing we all point at.*

**The decision test — "does this belong on Home or Dashboard?"** Ask, in order:

1. **Must every user see the same thing, every week, by definition?** → **Dashboard**
   (shared / fixed / versioned). If it's personal, optional, or rearrangeable → **Home**.
2. **Can one user remove or resize it without changing anyone else's view?** Yes → **Home**
   widget. No (it *is* the canonical board) → **Dashboard**.
3. **Is it about building / grading the app rather than running GT marketing?** → **neither;
   `/dev`** (admin-only).

One-line heuristic: **"Would two users legitimately disagree about whether it should be
there?"** Yes → it's personal → **Home**. No (everyone *must* see it identically) →
**Dashboard**. Data corollary: **Dashboard owns the canonical render of a metric; Home may
*mirror* that render as a widget but must never fork its definition.**

**Weekly Standup verdict:** Yes — frame Dashboard explicitly as the **Weekly Standup board**
(it already self-describes as "the shared weekly scorecard for the Monday meeting"). But the
*full* Monday run-of-show is the **§5 agenda journey** (Home exec-narrative → Dashboard
scorecard+pacing → workstream modules → Decision Queue), surfaced as a **"Run the meeting"
launcher**, **not a new tab**. **No separate "Weekly status" tab** — the Scorecard *is* the
weekly status, versioned by week; a second view would be duplicate maintenance. The
**reporting-week selector's home is the standup board**; the **Aug-17 countdown's home is Goal
pacing (6d)** — global chrome copies are acceptable only because they are now scoped + linked.

---

## 1. Panel roster (persona · lens · falsifiable ask)

Leadership + cohesion + IA seats, pared to 9. Each ask is pass/fail and tied to the
Home/Dashboard seam specifically.

| Persona | Lens | Falsifiable ask (pass/fail) |
|---|---|---|
| **Marcus Bell** — leadership operating-cadence SME | Leadership / §5 cadence | A leader runs §5 **item 1 (exec recap)** from Home and **item 2 (scan)** from Dashboard, and the same KPI shows the **same number** on both. **Today: FAIL** — Home leads with "Phase 2 product spine" + a fixed KPI strip that overlaps the board. |
| **Sam Whitfield** — leadership end-user (Monday meeting) | Leadership / 10-min scan | A non-builder leader reads "are we hitting our numbers?" on Dashboard in **≤2 min**, and lands on Home knowing **in ≤30s** "this is *my* customizable cockpit." **Today: PARTIAL** (Dashboard good; Home reads as build scaffolding). |
| **Priya Nair** — metrics-semantics steward | Cohesion C3 (one meaning) | Applicants/deposits on a **Home widget == Dashboard scorecard == source module**, byte-equal for the same `?week=`. **Today: PASS** (both read `buildScorecard`/registry) — preserve; never fork. |
| **Dana Whitfield** — service / journey designer | Cohesion C4/C5 (seams) | **Zero overlap:** every block lives on exactly one of {Home, Dashboard, `/dev`}; the scorecard appears on Home **only via the shared component**, never a copy. **Today: FAIL** — fixed KPI strip + module grid on Home duplicate Dashboard + nav. |
| **Inez Salcedo** — IA / navigation architect | IA A1/A3 (scent, MECE) | First-click test: **≥80%** correctly place "my customizable widgets" → Home and "the shared weekly scorecard everyone references" → Dashboard; the two are not confusable. **Today: RISK** — both surfaces open with a KPI-tile row and live adjacent in the *Command* group. |
| **Hank "Just-a-List" Pruitt** — don't-overcomplicate skeptic | IA A6/A8 (Tesler/YAGNI) | Reject any change that **adds** a surface without removing one: **no "Weekly status" tab**, no second module grid on Home; net surfaces go **down**. **Today: FAIL** (Home carries a redundant nav grid). |
| **Elena Vargas** — privacy / "don't ship" | RBAC / isolation | Nothing **personal/role-scoped** (VoC quotes, decision preview, my layout) leaks onto the **shared** Dashboard; nothing **shared-canonical** is forked into a personal copy on Home. **Today: PASS** (decision preview is Home-only, leader-gated) — preserve. |
| **Dr. Naomi Frank** — decision scientist / "don't trust" | Goal integrity | A goal/target is edited in **ONE** place and the edit propagates to **both** Home and Dashboard (one `kpi_goal`). **Today: N/A** — Home goal-edit is unbuilt (PD-3); when added it must reuse `/api/dashboard/goals`. |
| **Aanya Kapoor** — content / labeling steward | Workflow W5 (labels/state) | Header labels **predict** the surface ("MY cockpit" vs "OUR board / Weekly Standup"); shared counts (open decisions, a shared KPI) read the **same number** on both. **Today: FAIL** — neither header states the contrast; open-decisions count drifts (see WORKFLOW-ORGANIZATION-REVIEW W5). |

---

## 2. Content-allocation table (zero-overlap target)

Every current block on each surface → **Home** (personal/composable) · **Dashboard**
(shared/fixed) · **/dev** (build-meta) · **Cut** (redundant). File: `app/page.tsx` (Home,
**codex-owned**), `app/m/dashboard/page.tsx` + `_components/*` (Dashboard).

### 2a. Currently on Home (`app/page.tsx`)

| Block (code locus) | Verdict | Reason |
|---|---|---|
| "Phase 2 product spine" hero — headline + subhead (`page.tsx` §hero) | **/dev** | Build-meta. A marketing lead opens onto product-spine narrative, not their cockpit. (= BUSINESS-USECASE RT-3.) |
| Fixed top KPI strip — Budget actual / Open decisions / CRM confidence / GT Challenge CPQL (`MetricTile` row) | **Dashboard** *(or convert to optional Home widgets)* | A **hardcoded, non-composable** shared-KPI strip = a mini-dashboard baked into Home → **direct overlap with Dashboard's purpose**. It violates "personal/composable." Move the canonical read to Dashboard; if any stay on Home they must be **widgets the user chose**, not a fixed strip. |
| Data-confidence banner (`ConfidenceBanner`) | **Home (keep)** | Cross-module **inbound contract**; correctly appears on every HubSpot-consuming surface (incl. Home *and* Dashboard) as the **same shared component**. Not redundancy — it's the C4 banner pattern. |
| "Home widgets" composable grid (`resolveHomeWidgets`) | **Home (keep — this IS Home)** | The personal, composable widget grid is Home's entire reason to exist. |
| "Decision preview" (leader-only) (`page.tsx` §decision) | **Home (keep)** | Personal/role **input surface** — the leader *acts* here (the bridge to the Decisions module). Leader-gated; never on the shared board. |
| "Phase 2 audit" panel — `PHASE2_REQUIREMENT_AUDIT` | **/dev** | Requirement-status grid = grading scaffolding. (= BUSINESS-USECASE RT-3.) |
| Aside "Module surfaces" — Budget/CRM Ops/Decisions/GT Challenge links (`spineModules`) | **Cut** | Duplicates the sidebar/TopBar nav. Nav is the IA panel's lane; a second nav list on Home is redundant. |
| Aside "All PRD modules" grid — `MODULE_NAV_GROUPS` | **Cut** | A **full second navigation surface** on Home. The sidebar already renders this from the same `MODULES`. Pure redundancy (Pruitt). |

### 2b. Currently on Dashboard (`app/m/dashboard/page.tsx`)

| Block (code locus) | Verdict | Reason |
|---|---|---|
| Hero — "shared weekly scorecard for the Monday meeting" | **Dashboard (keep, sharpen)** | Correct framing. Sharpen to **"Weekly Standup — the shared Monday-meeting board"** + the "OUR board" contrast line. |
| 4 callout tiles — Measured KPIs / Biggest mover / At risk / Stale connectors | **Dashboard (keep)** | These are the **canonical** scan callouts (PRD "biggest mover / red flags / freshness"). Shared, fixed — exactly Dashboard's job. |
| Tabs — Scorecard / Trends / SLA / Pacing / Mirror (6a–6e) | **Dashboard (keep)** | All five PRD sub-views; the shared board's body. (Reorder — see §3.) |
| Week chips — "Snapshot history" | **Dashboard (keep — the week's true home)** | The reporting-week **belongs to the surface it versions** (the scorecard). See §3. |
| Aside — "Single source of truth" + "Goal-edit scope" | **Dashboard (keep)** | The SSOT explainer + the leader **goal-edit** affordance (Dashboard's one canonical write). |

### 2c. Net redundancy removed

Off Home → **`/dev`:** product-spine hero, Phase 2 audit. **→ Dashboard (or widgetized):**
the fixed KPI strip. **Cut:** "Module surfaces" + "All PRD modules" grid (two nav
duplicates). Home is left as: **widgets + leader inputs + the shared banner** — nothing that
competes with Dashboard, nothing that competes with the sidebar.

---

## 3. Weekly Standup / Monday-meeting recommendation

**Frame Dashboard as the Weekly Standup board — YES.** It is already the §5 *item 2* surface
("Dashboard scan, 10 min, the Marketing Lead, Module 6 Scorecard"). Make the framing explicit.

**But the standup is a journey, not one screen.** The §5 agenda spans Home (item 1, exec
recap → Home Executive-narrative widget) → **Dashboard** (item 2, the scan) → workstream
modules (items 3–7) → **Decision Queue** (item 8). Dashboard is the **shared scan board in the
middle**, not a surface that subsumes the others. The full run-of-show is the **"Run the
meeting" launcher** (a deep-linked agenda — see WORKFLOW-ORGANIZATION-REVIEW §3.3 / F6), which
*chains* the surfaces; it is **not** a Dashboard tab.

**Section order on the standup board** (so it reads top-to-bottom as the meeting does):

1. **Scorecard (6a)** — "are we hitting our numbers?" The default tab; biggest-mover +
   red-flag callouts on top (already present). *(agenda item 2)*
2. **Goal pacing (6d)** — required vs actual run-rate + "land at X by Aug 17." **The Aug-17
   countdown's authoritative home.**
3. **SLA & ops health (6c)** — the operational health check.
4. **Trends (6b)** — context / deep-dive.
5. **HubSpot mirror (6e)** — reference.

(Today's tab order is Scorecard · Trends · SLA · Pacing · Mirror; **move Pacing up to #2** so
scorecard→pacing is adjacent — that's the meeting's read order.) **Wins / risks / decisions do
NOT live on Dashboard** — they are Home (exec narrative, wins log, risks) and the Decision
Queue per §5; putting them on the shared board would duplicate Home's manual-narrative
ownership.

**Where the week selector + countdown live:**

- **Reporting-week selector → the Dashboard standup board is its authoritative home** (it
  versions the scorecard; the week *means* "which frozen scorecard"). codex has now wired a
  **global** selector that drives `?week=` for `/` and `/m/dashboard` only (`reportingHref`
  no-ops elsewhere) and added a scope tooltip. That is acceptable **only because it is scoped
  + explained**; if forced to one location, put it on the board, because a global control that
  silently affects just two of ~14 surfaces reads as "dead/confusing" on the others (the W4
  finding in WORKFLOW-ORGANIZATION-REVIEW). **Recommendation:** keep the standup board's own
  week chips as the primary control; retain the global selector **only** with its scope
  tooltip, or demote it to the two surfaces it governs.
- **Aug-17 countdown → Goal pacing (6d) is its authoritative home** (it is the pacing
  deadline). The global chrome chip is acceptable as a **single org-wide** motivator and
  **already links to `/m/dashboard?tab=pacing`** — keep it as a link, not a second source.

**Separate "Weekly status" tab? → NO.** Argued from redundancy: the **Scorecard (6a) *is* the
weekly status** — "this week / last week / delta / target / status," **versioned by week** via
the selector. A "Weekly status" tab would be a **second view of the same data** = duplicate
maintenance surface, a fresh drift risk, and a navigation tax (IA A6 "don't add clicks"). The
week selector already turns the Scorecard into "the status for week W." Adding the tab
violates the zero-redundancy goal.

---

## 4. Home reframe recommendation

Goal: a new user instantly reads **"this is MY cockpit"** vs Dashboard's **"this is OUR
board."** Minimal, high-leverage changes (the business audit's finding that Home opens on
build-meta is the root cause):

1. **Strip the build-meta** (→ `/dev`): remove the "Phase 2 product spine" hero and the
   "Phase 2 audit" panel. A marketing lead must not open onto requirement IDs. *(RT-3.)*
2. **Add one contrast line to each header — the single highest-leverage change.**
   Home header: **"Your Home, {name} — your composable cockpit. This layout is yours;
   add/remove widgets."** with a quiet link: *"Looking for the numbers everyone references? →
   Dashboard."* Dashboard header: **"Weekly Standup — OUR shared board. Identical for
   everyone, versioned by week."** with *"Want your own view? → Home."* This pairing alone
   resolves the confusion.
3. **De-fix the top KPI strip** — delete it or convert the four tiles into **optional
   widgets** in `WIDGET_LIBRARY`. A hardcoded KPI strip makes Home look like a (worse,
   non-composable) second dashboard.
4. **Drop the two nav duplicates** ("Module surfaces" + "All PRD modules") — nav lives in the
   sidebar/TopBar.
5. **Add the personal launchpad** — a role-aware **"Start here / your next actions"** strip
   (reuse `lib/help/guides.ts`): Leader → *Run the meeting · Clear the queue*; Operator →
   *Raise a decision · My submissions*. This reinforces "this is where I act." *(= WORKFLOW
   F6.)*
6. **Keep** the composable widget grid, the data-confidence banner, and the leader Decision
   preview. First-run still renders the **starter pack** (`DEFAULT_STARTER_WIDGET_IDS`) + a
   one-line "this is yours, customize it" pointer.

Net: Home = **widgets + my next actions + leader inputs + the shared banner** — personal,
composable, action-first. Zero surface that competes with Dashboard or the sidebar.

---

## 5. The bridge — scorecard-as-Home-widget (confirm + spec)

**Confirmed: the scorecard-as-Home-widget is the PRD's intended bridge** (M6 ~624: "Also
available as a Home widget … so they don't have to navigate to this module"). Behavior so it
is **not** a duplicate maintenance surface:

- **One render path, two mounts.** The Home widget mounts the **exact** Dashboard
  `app/m/dashboard/_components/Scorecard.tsx` component fed by the **same**
  `buildScorecard(ds, selectedWeek)` data. No second table, no re-derivation. *(Maya
  Lindqvist / Priya Nair invariant.)*
- **Same week.** The widget reads the **same `?week=`** as the board, so the Home scorecard
  and the Dashboard scorecard are **byte-identical** for a given week.
- **Read-only on Home.** The canonical board's only write (goal edits) happens via the
  goal-edit affordance hitting **one** `kpi_goal` store (`/api/dashboard/goals`); when Home
  exposes a leader goal-adjustment (PRD M1, currently PD-3), it must reuse that **same
  endpoint** — never a second goals table. *(Naomi Frank invariant: edit once, both move.)*
- **Today:** Home already mirrors *individual* rows (applicants-total, deposits-goal,
  conversion-channel) through `buildScorecard` — correct (single definition). What's missing
  is the **whole-table** widget; add a single `scorecard-table` library entry that renders
  `<Scorecard>`.

---

## 6. Implementation backlog (PLAN — file-mapped, ranked) — for the later coordinated cleanup

> **All items are proposals.** `app/page.tsx` (Home) and `app/_components/TopBar.tsx` are
> **codex-owned (active lane; a role-switcher worker is in TopBar)** — implement in the
> coordinated Home/Dashboard/TopBar pass, not from this audit. `app/m/dashboard/*` is open.
> No slug/route renames (preserve deep links). No new top-level surfaces.

| # | Pri | Change | Surface verdict served | File(s) — **(codex)** = active lane |
|---|---|---|---|---|
| **HD-1** | **P0** | Move build-meta off Home → `/dev`: remove "Phase 2 product spine" hero + "Phase 2 audit" panel. | de-redundancy / clarity | `app/page.tsx` **(codex)**; render `PHASE2_REQUIREMENT_AUDIT` under `app/dev/*` |
| **HD-2** | **P0** | Add the **contrast headers** ("MY cockpit" on Home, "OUR board / Weekly Standup" on Dashboard) + a one-line cross-link each way. | the distinction, made visible | `app/page.tsx` **(codex)**, `app/m/dashboard/page.tsx` |
| **HD-3** | **P0** | Remove the two Home nav duplicates ("Module surfaces" + "All PRD modules" grid). | cut redundant nav | `app/page.tsx` **(codex)** |
| **HD-4** | **P0** | De-fix the Home top KPI strip — delete or convert the 4 tiles to optional widgets. | kill the mini-dashboard overlap | `app/page.tsx` **(codex)**, `lib/phase2.ts` (`WIDGET_LIBRARY`) |
| **HD-5** | **P1** | Add a single **`scorecard-table` widget** that mounts the Dashboard `<Scorecard>` + `buildScorecard` (one render path). | the bridge | `lib/phase2.ts`, `app/page.tsx` **(codex)**, reuse `app/m/dashboard/_components/Scorecard.tsx` |
| **HD-6** | **P1** | Rename Dashboard hero → **"Weekly Standup — shared Monday-meeting board"**; reorder tabs to **Scorecard → Goal pacing → SLA → Trends → Mirror**. | standup framing + read order | `app/m/dashboard/page.tsx` |
| **HD-7** | **P1** | Make **Goal pacing (6d)** the authoritative home of the **Aug-17 countdown**; keep the global chip as a link to pacing. | week/countdown placement | `app/m/dashboard/_components/GoalPacing.tsx`, `TopBar.tsx` **(codex)** |
| **HD-8** | **P1** | Anchor the **reporting-week** control to the standup board as primary; keep the global selector only with its scope tooltip (or demote to the 2 surfaces it governs). | week placement / W4 | `TopBar.tsx` **(codex)**, `app/m/dashboard/page.tsx` |
| **HD-9** | **P2** | Add the role-aware **"Start here / your next actions"** strip to Home (reuse guides). | Home = MY cockpit (action-first) | `app/page.tsx` **(codex)**, `lib/help/guides.ts` |
| **HD-10** | **P2** | Add a **"Run the meeting" launcher** that chains §5 (Home exec-narrative → Dashboard → modules → Decisions). **Not** a tab. | standup run-of-show | `app/page.tsx` **(codex)** or a Workflows entry; reuse `lib/help/guides.ts` `weekly-meeting` |
| **HD-11** | **P2** | Surface the leader **goal-edit on Home** using the **same** `/api/dashboard/goals` form (one `kpi_goal` store) per PRD M1. | bridge integrity (PD-3) | `app/page.tsx` **(codex)**, reuse `lib/dashboard/goals.ts` |

**Sequencing note:** HD-1..HD-4 (Home) and HD-6..HD-8 (Dashboard/TopBar) should land in the
*same* coordinated pass so the contrast lands at once and the redundancy is removed in one
review — half-done, the two surfaces look more alike, not less.

---

## 7. Push-back — the redundancy/overlap that exists today (call it out)

1. **Home currently *is* a second dashboard at the top.** The hardcoded KPI strip (Budget
   actual / Open decisions / CRM confidence / GT Challenge CPQL) is a fixed, non-composable
   shared-metric board sitting above the composable grid — **the exact thing Dashboard is
   for.** Two surfaces both open with a KPI-tile row → the IA "are these the same page?"
   confusion (Salcedo A1). **Fix: HD-4.**
2. **Home carries a whole second navigation.** "Module surfaces" + "All PRD modules" reproduce
   the sidebar from the same `MODULES`. A nav on the page *and* a nav in the chrome is pure
   duplication (Pruitt A8). **Fix: HD-3.**
3. **Home opens on build-meta, not the operator's job.** "Phase 2 product spine" + the
   requirement-status audit point Home at the grader, obscuring "this is your cockpit"
   (re-confirming BUSINESS-USECASE RT-3 / C9). **Fix: HD-1.**
4. **Two week concepts, one meeting.** A global "Week of" control + the Dashboard's own week
   chips (WORKFLOW W4/W5). codex's wiring narrowed the global control to the two
   week-versioned surfaces and added a scope tooltip — good — but the principle stands: the
   week belongs to the board it versions; don't let it *look* like it governs surfaces it
   doesn't. **Fix: HD-8.**
5. **A "Weekly status" tab would be self-inflicted redundancy.** The Scorecard already is the
   weekly status, versioned by week. Resist it. **(No fix — a *don't-build*.)**
6. **What is NOT redundant — preserve it.** The **data-confidence banner on both** surfaces
   (shared C4 component, correct), the **Decision preview on Home** (personal/role input, the
   intended bridge — *not* a copy of the queue), and **Home widgets that mirror single
   scorecard rows via `buildScorecard`** (one definition, byte-equal) are all correct. The fix
   is to remove the *fixed* overlap (HD-1..HD-4), not to strip Home of every number.

---

## 8. Definition of done (Home/Dashboard distinction gate)

- [ ] A cold user states "Home = my customizable cockpit / Dashboard = our shared board" from
      the headers alone (HD-2); first-click ≥80% (Salcedo).
- [ ] Every Home/Dashboard block maps to exactly one surface — no fixed KPI strip or nav grid
      on Home duplicating Dashboard/sidebar (HD-1, HD-3, HD-4).
- [ ] The scorecard appears on Home **only** via the shared `<Scorecard>` component + same
      `?week=` — byte-identical to the board (HD-5; Priya/Naomi).
- [ ] Dashboard reads as the **Weekly Standup board**; tab order is scorecard→pacing→…; the
      Aug-17 countdown's home is Goal pacing (HD-6, HD-7).
- [ ] **No** "Weekly status" tab; the §5 run-of-show is a **launcher**, not a Dashboard tab
      (HD-10).
- [ ] The reporting-week control reads as scoped to the board (+ Home widgets), not as a
      global control that governs every page (HD-8).
- [x] The data-confidence banner, the leader Decision preview on Home, and registry-backed
      KPI mirroring are correct — preserve.
