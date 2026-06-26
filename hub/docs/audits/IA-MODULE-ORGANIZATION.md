# GT Marketing Hub — Information Architecture & Module Organization

> Produced by the **`gt-hub-ia-panel`** skill. Charter: decide how the **13 modules**
> should be **grouped, categorized, labelled, and navigated** — the *map* of the Hub, not
> the contents of any one module (that's `gt-hub-<slug>-panel`) and not the seams between
> them (that's `gt-hub-cohesion-panel`). Subject of audit: the **flat** nav today —
> `lib/modules.ts` → `app/_components/Sidebar.tsx` (icon list, ≥lg) + `TopBar.tsx` (pill
> strip, <lg). Date: 2026-06-26.
>
> **Status: PLAN / recommendation.** This doc proposes a grouping and a code migration; it
> does **not** edit nav code. `lib/modules.ts`, `Sidebar.tsx`, and `TopBar.tsx` are in an
> active build lane — the migration in §5 is for a separate approved pass.

## 0. The problem

The sidebar's **Modules** section is a flat list of 13, in PRD numeric order
(Home, Grassroots, Content, Summer Camp, Nurture, Dashboard, CRM Ops, Field Events,
Admissions, Budget, Decision Queue, Library, Analytics). 13 ≈ the top of Miller's 7±2 —
scannable, but the *order is the PRD's, not the user's*: adjacent items have no relationship
(Summer Camp next to Nurture next to Dashboard), so a user scans the whole list every time
instead of jumping to a known neighborhood. The sidebar already groups *other* things
(Modules / Campaigns / Developer / Help) — the modules themselves are the only ungrouped
block. The question is not "should we group" (the shell already groups) but **"into which
MECE categories, with what labels and order, without adding clicks or burying anyone."**

## 1. Roster (persona · lens · falsifiable ask)

Pared to 8 (≥3 first-order, ≥2 second, ≥1 third; no shared lens). Each ask is pass/fail and
names the pillar it defends.

| # | Persona | Discipline / seat | Framework wielded | Outside-view lens | Falsifiable ask | Pillar |
|---|---|---|---|---|---|---|
| 1 | **Dr. Maya Okonkwo** | IA / taxonomy lead (1st) | Open + closed **card-sort**, **tree-testing**, **MECE** | Faceted classification / library science (Ranganathan) | In a closed card-sort of the 13 onto the proposed groups, ≥80% agreement on placement for ≥11 of 13 modules; **0 modules orphaned or double-placed** (counts sum to 13). | A3 |
| 2 | **Lars Østergaard** | UX / navigation designer (1st) | **Information Scent** (Pirolli), **Hick's Law**, **Fitts's Law** | E-commerce mega-nav teardown (Baymard) | First-click test: ≥80% of operators click the **correct group first** for "where do I log a school visit?" and "where do I see this week's KPIs?" | A1 |
| 3 | **Renée Salcedo** | Domain SME — marketing-ops / RevOps org (1st) | **Funnel/RevOps taxonomy** (demand→pipeline→ops), **RACI** | How a real K-12 / DTC marketing team is actually staffed | Each group maps to a **real owner or stage** a marketer would name unprompted; no group is an engineering artifact ("misc/other"). | A2 |
| 4 | **Hank "Just-a-List" Pruitt** | The don't-overcomplicate skeptic (2nd) | **YAGNI**, **Miller's 7±2**, **Jakob's Law** | "Users spend most of their time on *other* sites" — they expect flat, familiar nav | Prove the grouping **beats the flat list** on a tree-test directness score; if it doesn't, ship flat. Reject any scheme with >4 top-level groups or any default-collapsed group over a daily module. | A6/A8 |
| 5 | **Dr. Aiko Tanaka** | Measurement / usability seat (2nd) | **Tree-testing** (success + directness), **first-click**, **SUS**, time-on-task | Treejack / UsabilityHub norms | Define the *measurable* bar before redesign: success ≥85%, directness ≥70%, median time-to-find <10s; recommendation must state how each would be tested. | A1/A6 |
| 6 | **Marcus Bell** | RBAC role-journey reviewer (2nd) | **Role-fit grouping**, per-persona first-screen | Salesforce/HubSpot role-scoped nav | For each role (Admin/Leader/Operator) the **first group they see contains their highest-frequency module**; the Leader reaches Decision Queue in ≤1 click; no role sees an all-denied group. | A2 |
| 7 | **Priya Raman** | Front-end / responsive nav engineer (3rd) | **Gestalt grouping** (proximity/similarity), progressive disclosure, single-source nav | Design-system nav components (shadcn/Radix) | The grouping renders from **one** `modules.ts` field into **both** the sidebar (section headers) and the `<lg` pill strip (dividers/labels) with no second list; mobile parity holds. | A7 |
| 8 | **Sofia Lindgren** | IA-governance / naming steward (3rd) | Naming taxonomy, **scalability rule**, label microcopy | Design-ops content style guides | A hypothetical module #14 ("Partnerships") has **one obvious home** under the existing groups with **zero group-definition changes**; every group label is plain-language (no jargon, ≤2 words, distinct from module names). | A4/A5 |

## 2. Synthesis

### Convergent (the panel agrees)

- **C-1 — Group, but shallow & always-open. [Okonkwo A3 · Pruitt A6 · Raman A7]** Eight of
  eight favor **labelled section headers inside the existing "Modules" block** over either
  the status-quo flat list *or* collapsible accordions. Headers add *scent* (A1) without
  adding *clicks* (A6). No nested/collapsible groups over daily modules.
- **C-2 — Exactly 4 groups, ≤4 items each. [Pruitt A6/A8 · Tanaka A1]** 13 modules into
  **4 groups of 3–4** keeps each group within glance range and the whole list under one
  Miller span per neighborhood. 3 groups makes one group too fat; 5+ groups out-clicks the
  flat list it's meant to beat.
- **C-3 — Pin a "command" neighborhood at the top. [Bell A2 · Salcedo A2]** Home + the two
  cross-org surfaces every leader opens first (Dashboard, Decision Queue) belong together
  at the top — it's where every role's session starts and where the Leader's exclusive
  action lives.
- **C-4 — Keep the Decision Queue visible & high for Leaders; keep it hidden for others.
  [Bell A2]** The current `leaderOnly` filter is correct; grouping must not re-expose it,
  and must not push it below the fold for the one role that acts on it.
- **C-5 — One source of truth, two renders. [Raman A7]** The grouping is a `category` field
  on `ModuleDef`; sidebar and pill strip both derive from it. No second hand-maintained list.
- **C-6 — Plain-language labels. [Lindgren A5 · Salcedo]** No funnel jargon (MOFU/BOFU) in
  the UI. Labels must be ≤2 words and not collide with a module's own name.

### Divergent (surfaced, not buried)

- **D-1 — Funnel-stage vs. function as the spine.** Salcedo (SME) prefers a **funnel**
  spine (Acquire→Convert→Operate) because that's how marketers narrate the work; Okonkwo
  and Pruitt counter that funnel stages are **fuzzy at the boundaries** (is CRM Ops
  "engage" or "operate"? is Analytics "acquire-measurement" or "intelligence"?), which
  hurts MECE (A3) and card-sort agreement. **Resolution:** use a **function** spine (more
  MECE), but *order the groups along the funnel* so the narrative survives.
- **D-2 — Where does Analytics live?** Tanaka/Bell put **Analytics in the command/intel
  neighborhood** (it's measurement); Salcedo/Lindgren put it in **Operations & Reference**
  (it's a channel-source lookup tool, while Dashboard is the KPI command surface). Both are
  defensible; Dashboard already owns the cockpit role, so the recommendation files Analytics
  under Operations and **flags this as the one swap to A/B in a tree-test.**
- **D-3 — Should we group at all? [Pruitt]** Pruitt reserves the right to ship the flat list
  if a tree-test can't show a directness win. The panel accepts this as the **falsifiable
  gate**: grouping ships only if it beats flat on directness (per Tanaka's A1/A6 bar).

### Ranked recommendations

1. **R-1 (do) —** Adopt the **function spine, funnel order, 4 groups** in §4 (Recommended).
   Render as always-open section headers in the sidebar + dividers in the pill strip.
2. **R-2 (do) —** Add a `category` field to `lib/modules.ts` + a `GROUPS` order array as the
   single source; both nav surfaces derive from it (§5).
3. **R-3 (gate) —** Before merge, run a tree-test (Tanaka's bar: success ≥85%, directness
   ≥70%) and the Analytics A/B (D-2). Ship grouping only if it beats flat.
4. **R-4 (don't) —** No collapsible/accordion groups; no >4 groups; no slug/route/`n`
   renames; no second nav list.

## 3. Candidate groupings (each MECE — every module placed once, counts = 13)

### Candidate A — By funnel stage (Acquire / Engage / Convert / Operate)

The way a marketer narrates the work. Lumpy at the edges (D-1).

| Group | Modules | n |
|---|---|---|
| **Acquire** (generate demand) | Grassroots, Content, Summer Camp, Field Events | 4 |
| **Engage** (work the leads) | Nurture, CRM Ops, Analytics | 3 |
| **Convert** (enroll) | Admissions | 1 |
| **Operate** (run the org) | Home, Dashboard, Budget, Decision Queue, Library | 5 |

✅ MECE (4+3+1+5 = 13). ⚠️ **Convert** is an orphan-of-one and **Operate** is overweight (5);
Analytics-in-Engage is arguable. Fails C-2 (balance) — kept as a reference lens, not chosen.

### Candidate B — By function (Channels / Lifecycle / Operations / Intelligence)

Cleaner MECE; groups map to stable functions rather than fuzzy stages.

| Group | Modules | n |
|---|---|---|
| **Channels** (where we reach people) | Grassroots, Content, Summer Camp, Field Events | 4 |
| **Lifecycle** (move people forward) | Nurture, CRM Ops, Admissions | 3 |
| **Operations** (run team / money / reference) | Budget, Decision Queue, Library | 3 |
| **Intelligence** (see the truth) | Home, Dashboard, Analytics | 3 |

✅ MECE (4+3+3+3 = 13), balanced (4/3/3/3). Strong on A3/A4. ⚠️ Splits the "command"
surfaces (Decision Queue lands in Operations, away from Home/Dashboard in Intelligence) —
weakens C-3/A2 (the Leader's cockpit is split across two groups).

### Candidate C — By role / owner (who lives here)

Organizes by the person, not the work.

| Group | Modules | n |
|---|---|---|
| **Everyone** (personal / shared) | Home, Library | 2 |
| **Channel owners** | Grassroots, Content, Summer Camp, Field Events, Admissions | 5 |
| **Marketing Lead** (cross-cutting ops) | Nurture, CRM Ops, Dashboard, Analytics | 4 |
| **Leadership** | Decision Queue, Budget | 2 |

✅ MECE (2+5+4+2 = 13). Great for A2 (role-fit). ⚠️ Brittle for A4/A8: ownership changes
(re-org, a new hire) would re-shuffle the *nav* — taxonomy shouldn't track the org chart.
Two thin groups (2) and one fat (5). Kept as reference; ownership is better shown as a
per-module badge than as the top-level spine.

## 4. Recommended grouping — "Command, then work the funnel, then run the org"

A **function spine (Candidate B's MECE strength) re-balanced to pin the command
neighborhood (C-3)** and **ordered along the funnel (D-1 resolution)**. Four always-open
sections of 3–4.

| Order | Group (formal) | Group (plain-language) | Modules | n |
|---|---|---|---|---|
| 1 | **Command** | "Overview" | Home, Dashboard, Decision Queue | 3 |
| 2 | **Channels** | "Get the word out" | Grassroots, Content, Summer Camp, Field Events | 4 |
| 3 | **Pipeline** | "Move families forward" | Nurture, CRM Ops, Admissions | 3 |
| 4 | **Operations** | "Run the show" | Budget, Analytics, Library | 3 |

**MECE check:** 3 + 4 + 3 + 3 = **13**, each module placed exactly once, no orphan, no overlap. ✅

### Rationale (per pillar)

- **A1 / scent —** A user with an intent ("reach more families" / "log a visit" / "this
  week's numbers" / "did we overspend?") maps it to a group name on the first read.
- **A2 / role-fit —** **Command** is first because every role starts there; the Leader's
  exclusive **Decision Queue** sits in the top group (≤1 click, never buried). A channel
  **Operator** finds their single module in **Channels** without scanning Pipeline/Ops.
- **A3 / MECE —** function spine avoids the funnel-boundary ambiguity that made Candidate A
  fail; counts sum to 13 with balanced 3/4/3/3.
- **A4 / scalability —** a new module has a clear rule: is it a *surface to see/decide*
  (Command), a *way to reach people* (Channels), a *step that moves a family* (Pipeline), or
  *plumbing/reference* (Operations)? E.g. a future "Partnerships" → Channels; "Forecasting"
  → Command; "Onboarding" → Pipeline; "Integrations" → Operations. Zero group redefinition.
- **A5 / labels —** two label sets provided; ship the **plain-language** set if the audience
  skews non-marketers, the **formal** set if it skews RevOps. Both are ≤2 words and distinct
  from every module name.
- **A6 / clicks —** groups are always-open headers; no module gets *slower* to reach than
  today. Daily modules (Home, Dashboard, Nurture) sit high.
- **A8 / stability —** no slug/route/`n`/icon changes; only visual grouping + order. Muscle
  memory and deep links survive.

### Nav mapping

- **Sidebar (≥lg, `Sidebar.tsx`):** inside the existing **Modules** block, render four
  `<p class="mono … text-label">` section headers (same component the sidebar already uses
  for *Campaigns/Developer/Help*) — `Command`, `Channels`, `Pipeline`, `Operations` — each
  followed by its `<ul>` of links, in the §4 order. No collapse/expand. `My submissions`,
  `Campaigns`, `Developer`, `Help` stay exactly where they are below.
- **Pill strip (<lg, `TopBar.tsx`):** keep the single horizontal scroll, but insert a small
  non-interactive group label / divider before each group's pills (e.g. a `mono text-label`
  chip), so the same four neighborhoods read left-to-right. This keeps **A7 parity** — both
  surfaces derive from the same `category` field.

### Role-aware ordering

- **Leader —** sees all four groups; **Command** first with Decision Queue present.
- **Admin (Marketing Lead) —** same four groups; Decision Queue still rendered (can submit,
  not decide) per current policy; Developer section remains admin-only below.
- **Operator —** Decision Queue hidden by the existing `leaderOnly` filter, so **Command**
  shows Home + Dashboard (2); the Operator's own channel/pipeline module sits in its group;
  `My submissions` remains the Operator's path into the decision flow. **No empty group**
  results (every group still has ≥2 visible items for an Operator). *(Verify at build: if a
  future role empties a group, hide that header.)*

## 5. Migration PLAN (code — flagged: nav files are in an active build lane)

> ⚠️ `lib/modules.ts`, `Sidebar.tsx`, `TopBar.tsx` are currently owned by another in-flight
> session (stashed WIP on help/sidebar). **Do not edit as part of this audit.** This is the
> plan for a later approved, additive pass. All changes are additive — no slug/route/`n`
> changes.

1. **`hub/lib/modules.ts` (additive):**
   - Add `export type ModuleGroup = "command" | "channels" | "pipeline" | "operations";`
   - Add an optional `group: ModuleGroup` to `ModuleDef` and set it on each of the 13 per §4.
   - Add an ordered registry:
     ```ts
     export const MODULE_GROUPS: { id: ModuleGroup; label: string; plain: string }[] = [
       { id: "command",    label: "Command",    plain: "Overview" },
       { id: "channels",   label: "Channels",   plain: "Get the word out" },
       { id: "pipeline",   label: "Pipeline",   plain: "Move families forward" },
       { id: "operations", label: "Operations", plain: "Run the show" },
     ];
     ```
   - Add a helper `modulesByGroup(role)` that filters `leaderOnly` then buckets by `group`
     in `MODULE_GROUPS` order — so both nav surfaces share one grouping function.
2. **`hub/app/_components/Sidebar.tsx` (render-only):** replace the single
   `visibleModules.map(...)` under the "Modules" header with a loop over `MODULE_GROUPS`,
   emitting the existing section-header `<p>` + the existing `<li>`/`<Link>` markup per
   group. Reuse the current active/aria-current logic verbatim; **skip a group whose
   filtered list is empty.**
3. **`hub/app/_components/TopBar.tsx` (render-only):** in the `<lg` `<nav>` pill loop,
   iterate groups and prepend a non-interactive label/divider per group; pills unchanged.
4. **No migration / no DB / no route changes.** Pure UI. Keep `npm run test:ci` green; add
   a tiny unit test asserting `modulesByGroup` is MECE (every visible module appears exactly
   once across groups; counts sum correctly per role).

## 6. Risks / what NOT to do

- **Don't over-nest.** No accordions or collapsible groups over daily-use modules — that
  trades a 0-click scan for a 1-click expand (A6 regression). Headers only.
- **Don't hide or demote the Decision Queue.** Keep it in **Command** for Leaders, keep it
  hidden for non-leaders via the existing filter. Never make a leader hunt for their one
  exclusive action.
- **Don't create orphan or >4 groups.** A single-item group (Candidate A's "Convert") or a
  5th group fails C-2; fold or re-balance instead.
- **Don't fork the nav.** Both surfaces must derive from the one `category`/`group` field —
  no second hand-maintained list (A7).
- **Don't reorganize by org chart.** Ownership belongs on a per-module badge, not the
  top-level spine (Candidate C's A4/A8 fragility).
- **Don't rename slugs/routes/`n` or change icons.** Grouping is visual + order only; deep
  links and muscle memory must survive (A8).
- **Don't skip the gate.** Ship grouping only if a tree-test beats the flat list on
  directness (R-3); the flat list is a legitimate fallback (Pruitt, D-3).

## 7. Definition of done (IA gate)

- [ ] `category`/`group` field added to `lib/modules.ts` with one `MODULE_GROUPS` order array (single source).
- [ ] Sidebar + pill strip both render groups from that field (A7 parity); empty groups hidden.
- [ ] MECE unit test green (every visible module in exactly one group; counts per role correct).
- [ ] Tree-test passes the bar (success ≥85%, directness ≥70%) vs. the flat baseline; Analytics placement A/B resolved.
- [ ] No slug/route/`n`/icon changes; `npm run test:ci` green.
