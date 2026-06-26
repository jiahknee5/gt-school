# GT Marketing Hub — Business-Objectives, Use-Case Completeness & PRD-Alignment Audit

> Produced by the **`gt-hub-cohesion-panel`** skill, run in its **C9 (business-objective
> executability)** mode — the system-level body that judges the 13 modules as one product, here
> asking the harder question the prior cohesion pass deferred: *is each module's business objective
> clear, and can a real user (per role) actually EXECUTE the intended use cases end-to-end?*
> Companion to `COHESION-REVIEW.md` (seams), `IA-MODULE-ORGANIZATION.md` (nav), and
> `SECURITY-REVIEW.md` (authz). Source of requirement: `PRD/GT_Marketing_Hub_Spec.md` +
> `PRD/GT_Technical_Project_Brief.md`. Scope: code under `hub/` + live `https://gt-school-hub.vercel.app`.
> Date: 2026-06-26. **This is an AUDIT — findings + a prioritized fix spec. No app code was changed.**

---

## 0. Headline (read this first)

The Hub is an **exceptionally honest, well-modeled READ surface** and a **thin EXECUTE surface**. Every
module page renders from one deterministic in-memory seed (`generate({ seed: 424242, families: 1200 })`)
run through the *same pure logic the live engine would use* — so the numbers are right, the SSOT
discipline is real, and the RBAC *deny* is genuinely enforced. That is a legitimate and defensible way
to ship a demo on a tight time-box, and the brief explicitly rewards deliberate stubbing.

The business-objective gap is that **the product frequently presents itself as executable when it is
not**, and the few genuinely-wired write actions **do not round-trip in the demo**:

1. **The read/write split breaks round-trips.** Pages read the seed; the four real write actions
   (record budget spend, rule a decision, edit a goal, save Home layout) write to a *live Postgres
   path the pages never read back* — and that path throws without `APP_RW_DATABASE_URL`
   (`lib/db.ts:24`). So on the deployed demo the user's action either errors or silently fails to
   appear. **C9 fail.**
2. **The operator's #1 governance journey — "raise a decision" — does not exist.** There is no UI and
   no create endpoint (only `GET` in `app/api/decisions/route.ts`; the only mutation is the
   leader-only `/decide`). Yet `My submissions` and the Help guide both *instruct the user to raise one
   from their module*. **Instructed-but-impossible. C9 fail / PRD §11c miss.**
3. **Cross-module handoffs are seeded artifacts, not user-initiated.** Testimonial→Content,
   objection→brief, hot-family→DQ, sequence approve/kill, feedback→DQ, launch-sprint, upload, set-target
   are rendered as **non-interactive pills/labels** (or absent). The *landing* exists in the seed and is
   proven by pure tests, but **no role can fire the handoff from the UI**, so the end-to-end objectives
   (objection→content, escalate hot family, run a referral sprint) don't complete in-product.
4. **The Home command center leads with grading scaffolding**, not an operator's objective. The primary
   surface opens with a "Phase 2 product spine" headline and a "Phase 2 audit" panel of requirement IDs
   (`PHASE2_REQUIREMENT_AUDIT`, covered/partial/missing) — developer/submission meta on the page a
   marketing leader is supposed to run their Monday meeting from. **C9/C1 clarity fail.**

None of this contradicts the brief's "go deep on a few, stub the rest" mandate — it is about **honesty
of affordances**: an action shown should be doable, an instruction given should be followable, and a
deliberate stub should *look* like a stub. The fixes below are mostly small and high-leverage.

---

## 1. Panel roster (persona · lens · falsifiable ask)

The standing cohesion roster plus the two C9 seats added to the skill this pass.

| Persona | Lens | Falsifiable ask (pass/fail) |
|---|---|---|
| **Business-objective steward / product owner** *(new, C9)* | "What is each module FOR, and is it clear in the UI?" | Land cold on `/` (Home) as a non-technical marketing lead — can you state the page's purpose and your next action without reading code or PRD? **FAIL** (opens on "Phase 2 product spine" + a requirement-status audit panel). |
| **Journey-completion QA / "does the action do anything" skeptic** *(new, C9)* | walk each role to the write and confirm it persists + shows | As Operator, raise a decision from your module and find it in `My submissions`. **FAIL** (no raise control or endpoint exists). As Budget Owner, "Record spend" and see the workstream actual change. **FAIL** (writes to DB; page reads seed). |
| Service designer | cross-module journeys complete | Drive the Monday-meeting journey Home→Scorecard→workstreams→Decisions and *close a decision*. **PARTIAL** (read path works; the closing ruling 404s/doesn't persist on the seed demo). |
| RBAC-experience reviewer | role sees only what it can do; no click-then-403 | Operator never sees a control they're denied. **PASS** (sidebar hides DQ; server re-checks). One nuance: Admin is fully denied the DQ view — see PRD drift PD-1. |
| Metrics-semantics steward | one meaning per metric | $365K, bounce, qualified, parity reconcile to one definition. **PASS** (`lib/metrics/*`, registry). |
| IA / navigation architect | nav truthful, no dead-ends | Every nav target renders. **PASS** (incl. `/m/gt-challenge` via the `[slug]` fallback). |
| Interaction / usability lead | common task is shallow + obvious | "Change the week" from the global top bar. **FAIL** (the top-bar week `<select>` is inert; only Dashboard's own `?week=` selector works). |
| Accessibility lead | WCAG AA on fixed palette, keyboard, labels | (deferred to the standing a11y P1 in COHESION-REVIEW H-COH-3 — not re-run here). |
| Technical writer / onboarding | a guide is a doable task | Follow `/help/raise-a-decision` literally. **FAIL** (the steps describe a control that doesn't exist). |
| Front-end architect | shared components/state | Modules reuse `modkit` + shell. **PASS**. |
| QA "every button works" skeptic | no labels masquerading as buttons | Click an action in Nurture/Grassroots/Admissions/CRM-Ops DQ. **FAIL** (most are `<Pill>`/`<span>`, not buttons). |

---

## 2. Per-module matrix — business objective · clear? · role-executability · PRD alignment

Legend — Clear: ✅ yes / 🟡 mostly / ⛔ no. Exec: ✅ executable end-to-end / 🟡 partial / ⛔ read-only or broken. PRD: ✅ aligned / 🟡 drift / ⛔ missing capability.

| # | Module (file) | Business objective (1 line) | Clear? | Role-executability finding | PRD |
|---|---|---|---|---|---|
| 1 | **Home / Command Center** (`app/page.tsx`, `HomeWidgetPicker.tsx`) | Each user composes a personal command center from the widget library and acts from it. | ⛔ | Widget **picker works** (add/remove/Up/Down/search). But **save needs a DB** (`readHomeLayout` requires `APP_RW_DATABASE_URL`; PUT falls back to non-persisting) → layout doesn't survive reload in the demo. Only ~9 of the widget library render a real value (`widgetValues` map); the rest show the widget *size/source* as the "value". Page **leads with grading scaffolding** ("Phase 2 product spine", `PHASE2_REQUIREMENT_AUDIT`). Leadership input surfaces (comments on workstream rows, goal adjustments) **absent**. | 🟡 |
| 2 | **Grassroots** (`app/m/grassroots/page.tsx`) | Run the ambassador/referral engine; reconcile HubSpot+community; own parent-led events. | ✅ | **Read-only.** No "Launch new sprint", no roster bulk actions (send toolkit / request testimonial / assign segment), no "log testimonial" (the testimonial→Content stub the spec calls for cannot be fired by a user), no "flag hot family". Dual-source reconcile + influenced-enrollment attribution are shown well. | 🟡 |
| 3 | **Content** (`app/m/content/page.tsx`) | Manage the editorial pipeline, calendar, performance, brand voice. | ✅ | **Read-only.** Kanban note says "Card move = status write → pushed to the sheet" but cards don't move (no drag/buttons). Calendar "drag to reschedule" absent. Brand-voice auditor runs on a **hardcoded sample draft** — no input box to audit your own copy. Google-Sheet *write-back* is described, not user-operable. | 🟡 |
| 4 | **Summer Camp** (`app/m/summer-camp/page.tsx`) | Run camp P&L on reconciled dual sources; manage capacity/roster/revenue. | ✅ | **Read-only.** Strong dual-source reconcile + PII-gated roster (genuine deny). Revenue **target is a hardcoded `TARGET = 180_000`** — the spec's "set the revenue target" / "approve pricing or add-session" are non-executable. | 🟡 |
| 5 | **Nurture** (`app/m/nurture/page.tsx`) | The data-rich lifecycle engine: segments, heatmap, pipeline, SMS, SLA. | ✅ | **Read-only.** Best read surface in the app. But every action is a label: "Approve → Decision", "Kill → Decision", "Quick reply", "Flag hot-family → Decision" are `<Pill>`s, not buttons. So the SMS quick-reply, sequence approve/kill, and hot-family escalation **cannot be performed**. | 🟡 |
| 6 | **Dashboard / KPI** (`app/m/dashboard/page.tsx`, `GoalPacing.tsx`) | The shared weekly scorecard for the Monday meeting. | ✅ | Scorecard/trends/SLA/mirror read cleanly; **`?week=` selector works**. Goal-edit form (leader-only) posts to `/api/dashboard/goals` (DB) — **the edit does not round-trip** (page reads the registry/seed, not the goals table; and 500s without DB). | 🟡 |
| 7 | **CRM Ops** (`app/m/crm-ops/page.tsx`, `DqQueue.tsx`) | Data-infrastructure health; own the data-confidence banner. | ✅ | Read surfaces are excellent (parity, UTM-broken, reliability flags, auto-detector preview). Overview CTA says "open the Data quality queue **to act**", but `DqQueue` is **read-only** (no resolve/file controls; `/api/crm-ops/detect` is not invoked from the UI). Operator deny is real. | 🟡 |
| 8 | **Field Events** (`app/m/events/page.tsx`) | Track GT-run events; read-only overlay of ambassador events; propose priority events. | 🟡 | **Read-only.** Event tracker CRUD and "priority event recommendation → Decision Queue" are not executable. Read-only ambassador cross-link contract holds. (Brief explicitly green-lights stubbing this.) | 🟡 |
| 9 | **Admissions / VoC** (`app/m/admissions/page.tsx`) | Objection log; objection→content bridge; VoC; feedback loop. | ✅ | **Read-only.** Bridge auto-stub + closure rate are shown, but a user can't *log an objection*, *flag feedback*, or *fire a brief*. "→ chip in Nurture · submitted to Decision Queue" is descriptive text. | 🟡 |
| 10 | **Budget** (`app/m/budget/page.tsx`, `BudgetTable.tsx`) | Reconcile spend to $365K by workstream; >10% variance → DQ. | ✅ | **$365K reconcile renders correctly** (headline win). Per-owner "Record spend" form is real and RBAC-visible, BUT posts to `/api/budget/entries` (DB insert) while the page reconciles **seed** `ds.budget_entry` → **entered spend never appears**; 500s without DB. "Adjust planned amounts" (PRD leadership) is **not editable in UI**. Variance→DQ is seeded, not user-triggered. | 🟡 |
| 11 | **Decision Queue** (`app/m/decisions/page.tsx`, `DecisionActions.tsx`) | Leadership-only async approve/reject/need-info; everyone submits. | ✅ | **The deny works** (route + server + nav, three layers). Leader ruling form is real, BUT `/api/decisions/[id]/decide` looks up the decision **in Postgres by UUID** while the page lists **seed** decisions → on the demo it returns **404 "Decision not found"** (or 500 without DB), and even on success the page re-renders from seed so the ruling **vanishes**. **No submit/raise path exists at all** (the SUBMIT half of "submit: all users"). | 🟡 |
| 12 | **Library** (`app/m/library/page.tsx`) | Flat, tag-filterable resource shelf with upload. | ✅ | **Search + tag filter work** (pure GET — genuinely executable). **Upload does not**: "+ Add resource" is a `<Pill>`, not a form (PRD §12 "team members can add new resources"). | 🟡 |
| 13 | **Analytics** (`app/m/analytics/page.tsx`) | GA4 across two sites; pages, downloads, sources, paths. | ✅ | **Read-only** (correctly — it's an analytics viewer; brief green-lights stubbing). Honest GA4-confidence framing; no banner by design. | ✅ |
| — | **My submissions** (`app/m/submissions/page.tsx`) | Submitter sees their own raises + leadership response. | ✅ | View works for all roles; but since **nothing can be raised**, every non-seeded user sees the empty state with an instruction they can't follow. | 🟡 |
| — | **GT Challenge** (`/m/gt-challenge` via `[slug]`, `app/(public)/gifted-quiz/`) | Lead-magnet quiz → capture → assess → CPQL loop. | 🟡 | Public quiz is the one genuinely public interactive surface, but capture is **in-memory only** (no durable persist — `UC-GTC-CAPTURE-PERSIST`). `/m/gt-challenge` renders the **generic `[slug]` surface** (metrics + static "Actions" spans), not a deep campaign console. The loop is shown via the seeded Home campaign summary, not a live round-trip. | 🟡 |
| — | **Help** (`app/help/`, `lib/help/guides.ts`) | Self-serve guides for the common journeys. | ✅ | Reachable, well-written. But two guides (`raise-a-decision`, partly `compose-home`) describe controls that don't exist / don't persist → **the guide over-promises**. | 🟡 |

---

## 3. Cross-module use-case completeness — does the objective complete end-to-end?

Each `docs/use-cases/README.md` objective walked as a user, not as a test.

| Objective | Spans | Completes E2E in UI? | Where it breaks |
|---|---|---|---|
| **Run the Monday meeting** | Home→Dashboard→workstreams→Decisions | 🟡 **Reads, can't close** | Every read screen exists and is shareable. The meeting's payoff — *closing a decision* — 404s/doesn't persist on the seed demo (Decision ruling, §2 #11). |
| **Launch & run the GT Challenge** | Budget→quiz→CRM/Nurture→assess→Dashboard | ⛔ | Quiz captures in-memory only; spend isn't entered by a user into Budget (and wouldn't reflect); no deep campaign surface. The loop is *narrated*, not *driven*. |
| **New applicant click→deposit** | Analytics→CRM Ops→Nurture→Admissions→Dashboard | ✅ (observe) / ⛔ (act) | Fully *traceable* read-side (good). No user action is required, so "completion" = the numbers reconcile, which they do. |
| **24-hr follow-up SLA** | Nurture→Dashboard | 🟡 | SLA + late-list + owner attribution all render. You can't *act* on a late row (no contact/assign control). |
| **Objection → content → resolved** | Admissions→Content→Analytics | ⛔ | Can't log an objection; can't fire the brief; can't move the content card. The bridge is a seeded demonstration. |
| **Escalate a hot family** | Nurture/Grassroots→Admissions→DQ | ⛔ | "Flag hot-family" is a pill in Nurture and absent in Grassroots → the chain never starts. |
| **Raise a decision & get a ruling** | any→Decision Queue | ⛔ | **No raise UI / no create endpoint** (the SUBMIT half is missing entirely); the RULE half 404s on the seed demo. The single most important govern-loop is non-executable both ways. |
| **Catch an overrun & reallocate** | Budget→Decision Queue→Budget | ⛔ | Recorded spend doesn't reflect (seed vs DB); the variance→DQ flag is pre-seeded; "approve reallocation → planned adjusts" isn't wired (planned not editable). |
| **Respond to a data-confidence drop** | CRM Ops→all→CRM Ops | 🟡 | Banner appears across HubSpot modules and links to CRM Ops (good). You can't *resolve* an issue (DqQueue read-only) so the banner can't be cleared by a user. |
| **Compose your Home** | Home (+ all sources) | 🟡 | Picker works in-session; the *save* doesn't persist without a DB. |

**Net:** 0 of the 10 cross-module objectives is *fully executable* by a user end-to-end in the deployed
demo. ~4 complete as **read/observe** journeys (where no write is required). The other 6 break at the
first user-initiated write.

---

## 4. PRD alignment — drift, missing capability, contradictions

What's honored (preserve): auth + 3 roles deny-by-default (`middleware.ts`, `lib/auth/policy.ts`),
Leader-only Decision Queue *deny* (genuine, 3-layer), SSOT per number (`lib/metrics/*`), $365K reconcile
render, dual-source reconcile surfaced (camp + ambassadors), data-confidence banner adoption
(principled), PII gating (Nurture SMS, camp roster), known-gaps surfaced honestly (UTM broken, fields
unreliable). These match the brief's non-negotiables on the read/authz side.

Drift / gaps:

| ID | PRD locus | Drift / miss | Recommendation |
|---|---|---|---|
| **PD-1** | §2 roles + §3 Module 11 | **Admin (Marketing Lead) is fully denied the Decision Queue view** (`decisionQueueRoleAllowed` = leader only). §2 says Admin has "full access to all modules except Decision Queue **decision-making**" and "can submit decisions" — implying view-but-not-decide; §11 lists view+decide as leadership (GMO/CMO/co-founder), not the Marketing Lead. The two PRD passages are themselves ambiguous; the build picks the strictest reading. | Decide intent explicitly: either let Admin **view read-only** (matches §2 "full access… except decision-making") or document the §11-strict reading in the access copy. Today the app shows Admin a hard 403 with no explanation of *why* the owner of every other module can't see this one. |
| **PD-2** | §3 Module 11c "Raise flow" + §2 "Submit (all users)" | **The submit/raise capability is entirely absent** — no UI, no `POST /api/decisions`. Half of Module 11's stated purpose ("Any team member can submit… from their own module") is unbuilt, yet `My submissions` + Help instruct it. | **P0.** Add a raise form + `POST /api/decisions` (below). |
| **PD-3** | §3 Module 1 "Leadership input surfaces on Home" | Home is missing **comments on workstream rows** and **goal/target adjustments**; exec narrative / wins / risks are **static**, not "editable by the Marketing Lead weekly". | Treat as P1; at minimum label them as not-yet-editable. |
| **PD-4** | §3 Module 10 leadership input | "**Adjust planned amounts**" is not editable in the Budget UI (only committed/actual entry). | P2 — add planned-edit for leader/admin, or label. |
| **PD-5** | §3 Module 12 | **Upload not executable** ("+ Add resource" is a pill). | P2 (Library is a sanctioned stub) — but downgrade the pill to an honest "upload coming" state. |
| **PD-6** | §2 nav "week-of selector" | The **global top-bar week selector is inert** (no state/wiring); only Dashboard's own selector works → two week concepts, one fake. | P1 — wire it or remove it. |
| **PD-7** | Brief "saved layout per user" (C5) + §3 Module 1 | Home layout **save doesn't persist without a DB** the page reads. | P1 — see RT-1. |
| **PD-8** | Brief "show us it works" (E2/E3) | The two headline *write* demos — budget reconcile *after an edit*, and a *ruling* — don't round-trip on the seed-only demo. The brief's E-signals pass as **pure tests**, but a live walkthrough of the *action* will fail unless the DB is provisioned + seeded with matching IDs. | **P0** for the walkthrough video — see RT-1. |

---

## 5. Ranked recommendations (P0 / P1 / P2) — each mapped to a file + concrete change

### P0 — executability blockers (do first; small, high-leverage)

- **RT-1 — Make the four real writes round-trip on the demo (the read/write split).**
  *Files:* `app/page.tsx`, `app/m/decisions/page.tsx`, `app/m/budget/page.tsx`, `app/m/dashboard/page.tsx` (the seed readers) vs `lib/db.ts` + the `/api/*` writers.
  *Change:* pick ONE of —
  (a) **Provision + seed the app Postgres** (`APP_RW_DATABASE_URL`) and have the pages read the DB (with the seed as the import fixture) so writes are visible; or
  (b) add a **no-DB demo persistence fallback** (e.g. a request-scoped / signed-cookie / in-memory store the pages also read) so a ruling/spend/goal/layout shows after `router.refresh()` without credentials.
  Either way the four actions must *visibly change the page*. This is the difference between "tests are green" and "a user can do it".

- **RT-2 — Build the "raise a decision" journey (PD-2).**
  *Files:* new `POST` in `app/api/decisions/route.ts` (create, any authenticated role, server-validates fields), a `RaiseDecision` client form mounted on each module's "Your access" aside (Grassroots/Content/Nurture/Admissions/Summer-Camp/Budget already have the slot + `decisionStatusHref`), landing in `My submissions`.
  *Why:* it is the operator's primary contribution, it's the SUBMIT half of the headline RBAC story, and the app already *tells users to do it*.

- **RT-3 — De-grade the Home command center (C9/C1 clarity).**
  *File:* `app/page.tsx`.
  *Change:* lead with the operator's objective (this week's scorecard topline, open decisions for leaders, your workstream health, your widgets). Move the `PHASE2_REQUIREMENT_AUDIT` / "Phase 2 product spine" content to `/dev` (admin-only) where the other submission scaffolding already lives. A marketing lead should not open onto requirement IDs.

### P1 — completes journeys / removes false affordances

- **AF-1 — Turn the action pills into real controls or honest stubs.** *Files:* `nurture/page.tsx` (SMS quick-reply, sequence approve/kill, flag hot-family), `crm-ops/_components/DqQueue.tsx` (resolve/file issue), `grassroots/page.tsx` (launch sprint, log testimonial, flag hot-family), `admissions/page.tsx` (log objection, flag feedback). Where a real write isn't in scope, render a visibly-disabled control with a "not in this build" tooltip — never a label that looks clickable.
- **AF-2 — Wire (or remove) the global week selector (PD-6).** *File:* `app/_components/TopBar.tsx` — make it drive a shared `?week=` like Dashboard, or delete it so there's one week concept.
- **AF-3 — Home value coverage + leadership inputs (PD-3).** *File:* `app/page.tsx` — compute real values for the rest of the starter widgets, or hide un-computed ones; add the exec-narrative/wins/risks edit + workstream comments, or label as read-only-v1.
- **AF-4 — Fix the Help guides that over-promise.** *File:* `lib/help/guides.ts` — `raise-a-decision` / `compose-home` should match shipped behavior (after RT-1/RT-2 they will).
- **AF-5 — Persist Home layout (PD-7).** Folds into RT-1(b).

### P2 — polish / sanctioned stubs made honest

- **PS-1 — Library upload (PD-5):** real form or honest "coming" state.
- **PS-2 — Budget planned-amount edit (PD-4)** for leader/admin, or label.
- **PS-3 — Summer Camp revenue target editable (Module 4)** instead of the `TARGET` constant.
- **PS-4 — GT Challenge deep surface:** a real `/m/gt-challenge` console (spend·submissions·qualified·CPQL) instead of the generic `[slug]` fallback; durable capture (`UC-GTC-CAPTURE-PERSIST`).
- **PS-5 — Field Events / Content CRUD:** sanctioned stubs — keep, but mark "view-only in this build" so the kanban/calendar/tracker don't imply edit.

---

## 6. Explicit PUSH-BACK (where the build diverges from business intent / PRD)

1. **"The tests are green" ≠ "the user can do it."** `PRD-CHECKLIST.md` marks C2/C4/C5/E2/E3 as ✅ on
   the strength of pure-function + live-DB tests. As a *business-objective* audit I push back: on the
   deployed seed demo a Leader's **ruling 404s**, a Budget Owner's **spend doesn't appear**, a goal
   **edit doesn't reflect**, and a Home **layout doesn't persist**. The capabilities are *proven in the
   abstract* but **not executable in the product a user touches**. Re-grade these as 🟡 "logic ✅ /
   round-trip ⛔ without DB" until RT-1 lands, so the status matrix doesn't read greener than the demo.

2. **An action you render should be an action you can take.** The pervasive `<Pill>`-as-button pattern
   (Nurture, Grassroots, Admissions, CRM-Ops queue, generic `[slug]` "Actions") is a usability
   anti-pattern: it advertises capability the product doesn't have. For an honest stub, *disable and
   say so*; don't style a label like an affordance.

3. **Don't instruct the impossible.** `My submissions` and `/help/raise-a-decision` tell users to raise
   a decision from their module. There is no such control anywhere and no create endpoint. Either build
   it (RT-2) or stop instructing it — the current state actively misleads.

4. **The command center is pointed at the grader, not the operator.** Opening Home on "Phase 2 product
   spine" + a requirement-status board optimizes for *reviewing the submission*, not for *running GT
   marketing*. The business objective of Module 1 ("Leadership's primary monitoring + input surface") is
   obscured by build meta. Move the meta to `/dev` (RT-3).

5. **Honest stubbing is good — and should LOOK stubbed.** The brief rewards going deep on a few and
   stubbing the rest. The build does the deep part well (Budget/CRM-Ops/Decision-Queue read + RBAC,
   Nurture read). The miss is that stubs are dressed as finished features. Labeling the deliberate
   view-only surfaces as such would *strengthen* the "judgment in sequencing" story the brief scores,
   not weaken it.

6. **What NOT to change (resist over-correcting):** the seed-as-truth read architecture, the SSOT
   metrics layer, the deny-by-default RBAC, the principled banner adoption, and the dual-source
   reconciles are all correct and should be preserved. The fix is to make a *small number of writes
   real and visible* (RT-1/RT-2) and to *tell the truth about the rest* — not to rush all 13 modules to
   full CRUD, which the brief explicitly calls a red flag.

---

## 7. Definition of done (business-objective gate) — status

- [ ] Each module's business objective is legible on its own surface without PRD/code (Home fails — RT-3).
- [ ] Every rendered action is executable OR visibly disabled-with-reason (fails — AF-1).
- [ ] The govern loop is executable both ways: submit (RT-2) and rule-that-persists (RT-1).
- [ ] At least the four headline writes round-trip on the demo without hidden DB setup (RT-1).
- [ ] No in-app instruction points to a control that doesn't exist (RT-2 / AF-4).
- [x] Read/observe journeys reconcile to one source of truth (already true — preserve).
- [x] RBAC *deny* is real and role journeys have no click-then-403 dead-ends (already true — preserve).
