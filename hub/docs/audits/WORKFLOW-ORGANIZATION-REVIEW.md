# GT Marketing Hub — Workflow & Website-Organization Review

> Produced by the **`gt-hub-workflow-panel`** skill. Charter: optimize the Hub's
> **task-flows** and **findability** — can a user FIND where to start each top use case,
> does each multi-step workflow stay CONTINUOUS (next action obvious, handoffs land +
> backlink) instead of scattering, and is the site organized for UNDERSTANDING (grouping,
> labels, order, first-run guidance, entry-point coverage)? This is the **workflow + site-
> organization complement** to `gt-hub-ia-panel` (which owns the module *map*:
> `hub/docs/audits/IA-MODULE-ORGANIZATION.md`) and `gt-hub-cohesion-panel` (which owns the
> *seams*). The IA panel asks "are the 13 in the right boxes?"; this panel asks "can a user
> pull an unbroken thread *through* those boxes?"
>
> **Method:** the live app (`https://gt-school-hub.vercel.app`) was walked end-to-end as
> **Admin (Johnny Chung)**, **Leader (David Chen)**, and **Operator / Content Owner (Maya
> Patel)** — Home, Dashboard, Decision Queue, Budget (+ variance), Content, Events, Nurture,
> Admissions, My submissions, and the `/help` guide catalog. Date: 2026-06-26.
>
> **Status: PLAN / recommendation.** This doc proposes flow + organization fixes and a code
> migration PLAN; it does **not** edit nav/app code. `lib/modules.ts`, `Sidebar.tsx`,
> `TopBar.tsx`, `lib/help/guides.ts`, and module pages are in an active build lane
> (codex-owned; a stash exists) — the backlog in §4 is for a separate approved pass.

## 0. The problem in one paragraph

The Hub's *parts* are strong: every module has clean within-module tabs (Dashboard
Scorecard/Trends/SLA/Pacing/Mirror, Budget table/burn/variance, Content
pipeline/calendar/performance), a "Home" breadcrumb back-link, role-correct RBAC, and a
genuinely excellent task catalog at `/help` ("How to get things done in the Hub" — 25 guides
in 5 categories, role-aware, with click-by-click steps). The **threads between the parts** are
where it frays. The single richest task surface is filed under **"Help · User guides"** at the
bottom of a flat 13-item sidebar, so a user *with a task* never finds it (it reads as docs,
not as the front door). The Home page is a **product-spine narrative** ("One trustworthy
operating room…"), not a task launchpad — it shows status tiles but never answers "what do you
want to do?". And the headline cross-module verb — **Raise a decision** — has **no
discoverable in-app entry point**: the guide says "raise from your module," but no module
exposes a Raise button, and the one raise-like control (Budget → "Open reallocation in
Decision Queue") **silently bounces** a non-leader back with no feedback. The organization
isn't *wrong* (the IA Command/Channels/Pipeline/Operations map is right and should ship) — it
just doesn't yet **carry the user along a task**.

## 1. Roster (persona · lens · falsifiable ask · pillar)

Pared to 8 (≥3 first-order, ≥2 second, ≥1 third; no shared lens). Each ask is pass/fail and
names the pillar it defends. Pillars: **W1** continuity · **W2** findability/scent · **W3**
learnability · **W4** minimal steps · **W5** label/state clarity · **W6** entry-point coverage.

| # | Persona | Discipline / seat | Framework | Outside-view lens | Falsifiable ask | Pillar |
|---|---|---|---|---|---|---|
| 1 | **Dana Whitfield** | Service / journey-flow designer (1st) | Service blueprinting, JTBD, journey maps | Hospitality + healthcare patient-journey design | Each of the 8 top use cases is completable end-to-end by its role with **every handoff landing on a visible in-context screen**; **0 silent bounces**. | W1 |
| 2 | **Pirre Lund** | Navigation / information-scent architect (1st) | Information Scent (Pirolli), first-click / tree-test, Hick's Law | Baymard e-commerce nav teardowns | First-click test: ≥80% pick the correct **starting** surface for "raise a decision", "run the Monday meeting", "catch an overrun" — and the correct answer is **NOT "Help."** | W2 |
| 3 | **Marisol Vega** | Cross-module continuity / handoff engineer (1st) | Auto-link landings + **bidirectional backlinks**, breadcrumb/back affordance | Linear/Jira issue-trace linking | From a Decision Queue card a Leader reaches the **originating record** (the Budget variance row) in **≤1 click**; every context-carrying handoff has a backlink, not just text. | W1 |
| 4 | **Theo Brandt** | Onboarding / first-run designer (2nd) | Progressive onboarding, empty states, "start here" | Notion/Linear first-run | A brand-new operator with no training reaches the right surface for their **#1 task** in **<60s / ≤2 clicks** from first login; a first-run pointer to the guides exists. | W3 |
| 5 | **Aanya Kapoor** | Content / labeling & state-consistency steward (2nd) | Plain-language IA naming, terminology/state consistency | Design-ops content style guides | Every nav/section label predicts its destination; the **open-decisions count reads the SAME number** on Home, the DQ badge, and the DQ tab; no dev control reads as a user control. | W5 |
| 6 | **Hank "Just-a-List" Pruitt** | Reduce-clicks / reduce-confusion skeptic (2nd) | YAGNI, Hick's, **Tesler's law**, Jakob's | "Users expect flat, familiar nav" | Reject any new top-level surface that adds more confusion than it removes; the "Raise a decision" verb gets **ONE global home**, not a button duplicated into 13 modules; nothing buries the Decision Queue or the guides. | W4 |
| 7 | **Dr. Lin Zhao** | Entry-point coverage / catalog auditor (3rd) | Use-case → entry-point matrix, catalog cross-check | Compliance traceability matrices | **Every** one of the 25 `/help` guides has a reachable in-app entry point for its role; **0 guides** whose step 1 ("from your module / Raise flow") resolves to no affordance. | W6 |
| 8 | **Greta Olsson** | Measurement / usability seat (3rd) | Top-task success, time-to-start, clicks-to-complete, SUS | Treejack / UsabilityHub norms | Define the bar before redesign: top-task start success ≥85%, time-to-start <15s, ≤3 clicks to first action; state how each is tested before/after. | W2/W4 |

## 2. Per top use-case findings (walked live, per role)

Use cases drawn from `docs/use-cases/README.md` + `lib/help/guides.ts`. Legend: ✅ works ·
⚠️ friction · ❌ broken. Each row tags **[persona · W#]**.

### UC-1 — Run the Monday marketing meeting *(Leader/Lead)*
- **Entry-point clarity:** ⚠️ **W2.** No surface says "run the meeting." The guide exists
  (`/help/weekly-meeting`) but is buried under Help. The Leader's natural start (Dashboard
  Scorecard) is reachable but at flat sidebar position #6; nothing sequences the 8-item
  agenda. **[Lund · W2]**
- **Continuity:** ✅ mostly. Dashboard tabs (Scorecard → Trends → SLA → Pacing → Mirror) +
  per-module Overviews give the walk; leader Home "Decision preview" → DQ closes the meeting.
  **[Whitfield · W1]**
- **Friction:** The agenda thread lives only in prose in the guide; the app doesn't chain
  Home → Dashboard → workstreams → DQ. **Two week selectors disagree** (global TopBar "Week
  of Jun 29" vs Dashboard's own week chips defaulting to 2026-08-24) — a leader running the
  meeting can't tell which week the numbers are. **[Vega · W1 / Kapoor · W5]**
- **Fix:** Add a "Run the meeting" launcher (Home or a Workflows surface) that deep-links the
  agenda in order; make the global "Week of" selector actually drive module data **or** remove
  it from module pages. *(PLAN — codex.)*

### UC-2 — Raise a decision & get a ruling *(Operator → Leader)* — **headline gap**
- **Entry-point clarity:** ❌ **W6.** Walked Content (the module Maya owns), Events, Grassroots,
  Admissions, Nurture as operator: **no "Raise a decision / Propose" button anywhere.** The
  only decision affordance on a module is a passive **"My submissions →"** link (view, not
  raise). The guide (`/help/raise-a-decision`) step 1 says *"Raise a decision from your module
  … Any module / Raise flow"* — **that flow has no door.** **[Zhao · W6]**
- **Continuity / dead-end:** ❌ **W6.** The one raise-like control is Budget → variance →
  **"Open reallocation in Decision Queue"** (href carries intent params:
  `?intent=reallocation&workstream=guerrilla&ask=4800` — clearly designed to prefill a raise).
  Clicked as **operator**, it **silently bounces back to Budget** — no toast, no explanation,
  no redirect to My submissions. A denied role is left in the dark. **[Whitfield · W1 / Zhao · W6]**
- **What works:** ✅ The *back half* is excellent — **My submissions** shows the operator's
  raised items with the leadership response ("Approved; ship to the nurture sequence"),
  enforcing "submit-only, never sees the full queue." The loop closes; it just can't be
  *opened* from the UI. **[Vega · W1]**
- **Fix (P0):** Give "Raise a decision" **one global home** — a persistent `+ Raise a decision`
  action (TopBar, beside "Add widget", or a module-overview affordance reused by all owners)
  that opens a prefilled raise form and routes the submitter to My submissions on success. Make
  the Budget→DQ link, for non-leaders, route to the **prefilled raise form** (not a bounce).
  **Do NOT** duplicate a Raise button into all 13 module bodies (Pruitt · W4). *(PLAN — codex.)*

### UC-3 — Catch a budget overrun & reallocate *(Budget Owner → Leader)*
- **Entry-point clarity:** ✅ Budget → "Variance alerts" tab is clearly labeled; the auto-flag
  ("1 flagged", trigger explained) is legible. **[Lund · W2]**
- **Continuity:** ⚠️ **W1.** Forward auto-link (variance >10% → DQ) fires and a DQ card exists
  ("Guerrilla workstream is 12% over plan…", "RAISED BY: system (budget variance)"). But the
  **DQ card has no backlink to the Budget row** — it names the source in *text* only. A Leader
  ruling on it can't jump to the variance context in ≤1 click. **[Vega · W1]**
- **Fix:** Add a "View in Budget" backlink on auto-flagged DQ cards (link to
  `/m/budget?tab=variance&workstream=…`). *(PLAN — codex.)*

### UC-4 — New applicant click → deposit *(Lead)*
- **Continuity:** ✅ The funnel modules exist and the data-confidence banner ("Open CRM Ops")
  follows the user across Home/Dashboard/Content — a real, working forward handoff. **[Whitfield
  · W1]**
- **Friction:** ⚠️ **W2.** The journey spans Analytics → CRM Ops → Nurture → Admissions →
  Dashboard, but the flat sidebar gives no sense these belong to one pipeline; the user
  module-hops by memory. (Exactly what the IA "Pipeline" group is meant to fix — see §3.)
  **[Lund · W2]**

### UC-5 — Objection → content → resolved *(Admissions + Content)*
- **Continuity:** ✅ The objection→content bridge is a designed handoff (Admissions
  objection log → "brief from admissions" card in Content pipeline).
- **Friction:** ⚠️ **W6.** Confirm the *landing* (a visible "brief from admissions" card in
  Content) exists for the owner role; if it's only a DB write it's a silent handoff. Flag for
  build-time verification. **[Zhao · W6]**

### UC-6 — Escalate a hot family *(any → Leader)*
- **Continuity:** ⚠️ shares UC-2's gap — escalation that needs a leadership call relies on the
  same (missing) raise/DQ door for non-leaders. **[Whitfield · W1]**

### UC-7 — Hit the 24-hr follow-up SLA *(Lead/Operators)*
- **Entry-point + continuity:** ✅ Nurture "SLA tracker" → Dashboard "SLA & ops health" is a
  clean, labeled two-step. Good baseline. **[Whitfield · W1]**

### UC-8 — Respond to a data-confidence drop *(Lead)*
- **Continuity:** ✅ **The model handoff of the app.** The data-confidence banner appears
  automatically on HubSpot-consuming modules and links to CRM Ops; Home surfaces the same
  ("source 81.5% … CRM Ops owns the fix"). Forward scent + landing both present. **[Vega · W1]**
- **Friction:** ⚠️ **W5.** Confirm the banner *clears* automatically on recovery (claimed in
  guide) — flag for verification.

### Cross-cutting state/label findings
- ❌ **W5 — one concept, three numbers.** Open decisions reads **"1 pending"** on the Leader's
  Home, **"3"** on the Decision Queue title badge, and **"(4)"** on the "Active decisions" tab —
  same concept, three numbers, on adjacent surfaces. Erodes trust in every count. **[Kapoor · W5]**
- ⚠️ **W5 — dev control in the user surface.** The **admin/leader/operator role switcher** is
  rendered in the production TopBar (and again inline on module headers). To a real user it
  reads as "pick your role," not "dev-only lens." Gate it behind dev mode or label it
  unmistakably. **[Kapoor · W5]**
- ⚠️ **W4 — dead global control.** The TopBar "Week of" selector doesn't drive module data
  (Dashboard keeps its own week). A control that does nothing is worse than no control. **[Pruitt · W4]**
- ✅ **W3 — within-module wayfinding is good.** Consistent tab strips + a "Home" breadcrumb on
  every module page; deep links (`?tab=…&week=…`) are shareable. Keep this pattern.

## 3. Site-organization recommendations

### 3.1 Module grouping — **AGREE with the IA panel, with one refinement**
The IA panel's **Command / Channels / Pipeline / Operations** (4 always-open section headers,
3/4/3/3, funnel-ordered) is the right map and should ship as specified in
`IA-MODULE-ORGANIZATION.md` §4–5. It directly fixes the "module-hop by memory" friction in
UC-4. This panel **endorses it unchanged** and adds, from the *flow* lens:
- **Refinement (workflow ordering inside groups):** within each group, order by **task
  frequency on the live cadence**, not by PRD `n`. In **Command**: Home → Dashboard → Decision
  Queue (Leader's daily path). In **Pipeline**: Nurture → CRM Ops → Admissions (the click→
  deposit order of UC-4, so the group reads as the journey). This is an *ordering* note for the
  IA migration, not a new scheme — no MECE change.
- **Endorse:** keep groups **always-open** (no accordions over daily modules), keep
  Decision Queue in **Command** for Leaders and hidden for others.

### 3.2 The big one — **promote the task catalog from "Help" to a "Start / Workflows" front door**
`/help` is already the answer to "where do I start each use case" (25 role-aware, click-by-
click guides in 5 categories) — but it's labeled **"User guides"** under **"Help"** at the
bottom of the nav, which is **documentation scent, not workflow scent** (W2). A user with a
*task* will not look there. Recommended:
- **Rename + reposition** the sidebar entry from "Help · User guides" to a **top, task-oriented
  surface**: e.g. a **"Workflows"** (or "Get things done") section near the top, above or just
  under **Command**. Keep the URL (`/help`) to preserve deep links; change the **label + order**
  only. (Pruitt's guardrail: this *replaces* a buried entry, it doesn't add a new one — net
  confusion goes **down**.)
- **First-run pointer (W3):** on first login / empty Home, show a one-line "New here? Start
  with a workflow →" linking the catalog, dismissible. No tour, just a door.
- **Don't** build a separate heavyweight "workflow engine." The catalog *is* the surface;
  reposition and link it (Tesler — conserve complexity).

### 3.3 Make Home a launchpad, not a manifesto
Home today opens with "One trustworthy operating room for GT marketing" (product-spine
narrative) + status tiles + a module grid. It never answers "what do you want to do?" Add a
**role-aware "Start here / Your next actions"** strip at the top of Home that deep-links the 3–4
highest-frequency workflows for the signed-in role (Leader → Run the meeting · Clear the queue;
Operator → Raise a decision · Track my submissions; all → the relevant guide). This reuses the
catalog from §3.2 — no new content.

### 3.4 Give cross-module verbs a global home
"Raise a decision" is a verb that belongs to **no single module** (UC-2). Put it in **one**
global place (TopBar `+ Raise a decision`, beside `+ Add widget`), opening a prefilled form,
routing to My submissions. This is the entry-point fix for UC-2/UC-6 and the catalog's biggest
W6 gap — solved once, not 13 times.

## 4. Ranked fix backlog (P0/P1/P2) — PLAN (codex owns nav/app files)

> All items are **proposals**. `lib/modules.ts`, `Sidebar.tsx`, `TopBar.tsx`,
> `lib/help/guides.ts`, and module pages are codex-owned / stashed — implement in a separate
> approved pass. No slug/route renames (preserve deep links).

| # | Pri | Fix | Pillar | File(s) |
|---|---|---|---|---|
| F1 | **P0** | Give "Raise a decision" a **global home** (TopBar `+ Raise a decision` → prefilled form → My submissions). | W6 | `TopBar.tsx` (+ a `RaiseDecision` form component, new) |
| F2 | **P0** | Kill the **silent dead-end**: Budget→DQ "Open reallocation" for non-leaders routes to the **prefilled raise form** (or shows "submitted to leadership → My submissions"), never a bounce. | W6/W1 | `app/m/budget/_components/VarianceAlerts.tsx`, decisions route guard |
| F3 | **P0** | **One number per concept**: open-decisions count identical on Home widget, DQ badge, DQ "Active" tab. | W5 | DQ data selector + `app/page.tsx` / decisions page |
| F4 | **P1** | **Reposition + rename** the task catalog: sidebar "Help · User guides" → top **"Workflows"** entry (keep `/help` URL). | W2 | `Sidebar.tsx`, `TopBar.tsx` |
| F5 | **P1** | Add **backlinks on auto-flagged DQ cards** → originating Budget variance row (and other source records). | W1 | `app/m/decisions/_components/DecisionCard.tsx`, decision data (source ref) |
| F6 | **P1** | **Home "Start here" strip** — role-aware deep links to top workflows. | W3/W2 | `app/page.tsx` (+ reuse `lib/help/guides.ts`) |
| F7 | **P1** | Adopt the **IA grouping** (Command/Channels/Pipeline/Operations) with §3.1 intra-group ordering. | W2/W3 | `lib/modules.ts` (+`group`), `Sidebar.tsx`, `TopBar.tsx` — per IA migration |
| F8 | **P2** | Resolve **two week selectors**: global "Week of" drives module data, or remove it from module pages. | W4/W1 | `TopBar.tsx`, dashboard/module week wiring |
| F9 | **P2** | Gate / clearly label the **role switcher** so it doesn't read as a user control in prod. | W5 | `TopBar.tsx`, module header switcher |
| F10 | **P2** | **First-run pointer** to Workflows on empty Home; verify objection→Content and data-confidence-clear **landings** exist (not silent writes). | W3/W6 | `app/page.tsx`, Content/Admissions/CRM Ops components |

## 5. Push-back — what NOT to do

- **Don't duplicate "Raise a decision" into 13 module bodies.** One global home (F1), not a
  button per module — Tesler's law: don't multiply surface to fake convenience. **[Pruitt · W4]**
- **Don't add a new top-level surface on top of Help.** Reposition/rename the *existing*
  catalog (F4); a parallel "Workflows" page beside an unchanged "User guides" forks the content
  and adds confusion. Net surfaces should stay flat or shrink. **[Pruitt · W4]**
- **Don't bury or demote the Decision Queue.** It stays in **Command** for Leaders, hidden for
  others; the ≤1-click leader path (Home preview → DQ) must survive any reorg. **[Vega · W1]**
- **Don't over-nest the sidebar.** No accordions/collapsibles over daily modules — the IA
  panel's always-open headers are correct; flows need *fewer* clicks, not an expand step.
  **[Pruitt · W4]**
- **Don't re-derive the IA map.** Command/Channels/Pipeline/Operations is agreed; this panel
  only adds intra-group ordering + the workflow front door. **[Lund · W2]**
- **Don't ship a heavyweight onboarding tour.** A dismissible one-line "start here" pointer
  beats a multi-step coachmark sequence for this audience. **[Brandt · W3]**
- **Don't fix counts by hiding them.** F3 means *reconcile* the open-decisions number, not
  remove the badge. **[Kapoor · W5]**
- **Don't edit nav/app code from this audit.** Panel proposes; codex's approved pass edits
  `modules.ts`/`Sidebar.tsx`/`TopBar.tsx`/`guides.ts`/module pages.

## 6. Definition of done (workflow gate)

- [ ] **UC-2 has a door:** a global "Raise a decision" entry reachable by every owner role,
      landing in My submissions (F1); no silent bounce for denied roles (F2).
- [ ] **Entry-point coverage = 100%:** every `/help` guide's step 1 resolves to a real in-app
      affordance for its role (Zhao's matrix, 0 dead references).
- [ ] **One number per concept:** open-decisions count identical across Home / badge / tab (F3).
- [ ] **Findability:** the task catalog is reachable from a top, task-labeled entry — first-click
      test for "where do I start X" does **not** land users in "Help" (F4); ≥80% start success.
- [ ] **Continuity:** every context-carrying handoff (variance→DQ, objection→Content) lands on a
      visible screen **with a backlink** to its source (F5, F10).
- [ ] **IA map shipped** (F7) with workflow ordering; **no** slug/route renames; `npm run
      test:ci` green.
