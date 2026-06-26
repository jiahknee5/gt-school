# GT Marketing Hub — Visual + Functional QA Audit

**Panel:** `gt-hub-visual-qa-panel` (visual consistency, token fidelity, responsive
parity, accessibility, state coverage, functional correctness, brand alignment).
**Method:** live browser pass (agent-browser) against the deployed app + code mapping.
**Subject (live):** https://gt-school-hub.vercel.app · **Code:** `~/projects/gt-school/hub`
**Roles exercised:** Admin (Johnny Chung) · Leader (David Chen) · Operator (Maya Patel).
**Viewports:** desktop 1280px / 1024px · mobile 390px (iPhone-class).
**Date:** 2026-06-26. **Screenshots:** `hub/docs/audits/qa-shots/`.

> **This is an AUDIT.** No app code was edited. Findings map to the file/route a later
> coordinated fix-pass should change. Severity: **P0** = broken/unusable/RBAC-wrong ·
> **P1** = clearly wrong but usable · **P2** = polish.

## Tally

- **P0:** 0
- **P1:** 6
- **P2:** 7
- Plus 1 deploy-window caveat (transient, see §Blocked).

The app is in good shape: **RBAC is fully correct across all three roles**, the public
gifted-quiz funnel works end-to-end, dark mode is solid, and 9 of 11 module pages are
clean on mobile. The headline issues are a **half-applied density refactor** (two
visual densities coexist) and **two modules that overflow horizontally on phones**.

---

## 1 · Roster (persona · lens · falsifiable ask · live verdict)

| Persona | Lens (Q#) | Falsifiable ask | Verdict |
|---|---|---|---|
| Visual-consistency lead | Q1/Q8 | Card padding + header type match on ≥11/13 modules | **FAIL** — 3 modules (dashboard, crm-ops, budget) use a denser, different header template than the other ~9 |
| Design-systems / token engineer | Q2 | Zero raw/off-token colors in rendered surfaces | **PASS** — all surfaces use tokens (`bg-canvas`, `text-ink/muted/label`, tint `*-soft`); no raw hex spotted |
| Responsive / front-end engineer | Q3 | No horizontal scroll at 390px on any of the 13 pages | **FAIL** — Budget (802px) + Dashboard (722px) overflow; Home topbar overflows ~31px |
| Accessibility lead | Q4 | AA contrast on text; visible focus; keyboard operable | **PARTIAL** — keyboard reaches all controls, but `--label` + `--gold`-as-text fail AA; focus uses browser default only |
| Interaction / states reviewer | Q5 | Every data section shows real content or an intentional empty/error state | **PASS** — Library "1 dead link flagged", Decision Queue empty/await states, quiz result state all present |
| Per-page functional QA skeptic | Q6 | Every nav link resolves; Decision Queue denied to Operator+Admin, works for Leader; quiz submits | **PASS** — all RBAC correct; quiz submits + renders result; no dead nav links found |
| Brand steward (gt.school) | Q7 | GT logo renders un-stretched, correct color, every header | **PASS** (current deploy) — atom "GT School" mark consistent; gold/serif/mono on-brand |

---

## 2 · Per-page findings

> Files are relative to `hub/`. Where a token is the root cause, the fix lives in
> `app/globals.css` — flagged, but **out of scope for this pass** (do-not-touch list);
> a later coordinated token pass owns it.

### Cross-cutting (affects many pages)

| # | Issue | Sev | Q# | File(s) to fix | Suggested fix |
|---|---|---|---|---|---|
| X1 | **Half-applied density pass → two coexisting densities.** Dashboard, CRM Ops, Budget render denser (H1 ~20px, tight padding, plain "Module N" breadcrumb, sentence-case "Active role"); the other ~9 modules render looser (H1 ~30px, pill breadcrumb "Home / MODULE N / OWNER", uppercase mono "ACTIVE ROLE"). | P1 | Q1/Q8 | `app/m/{dashboard,crm-ops,budget}/page.tsx` + `_components/primitives.tsx`; `app/m/[slug]/page.tsx`; migration `scripts/_density.mjs` | Finish the density pass across all modules **or** converge on one shared page-header (breadcrumb style + label casing + H1 scale). Pick one and apply everywhere. |
| X2 | **`--label` (#7891a0) fails WCAG AA for normal text** — 3.04:1 on canvas, 3.28:1 on surface (needs 4.5). Used pervasively for small mono labels, breadcrumbs, "13 workstreams", metadata. | P1 | Q4 | `app/globals.css` (`--label`) | Darken `--label` to ≥4.5:1 on `--canvas`/`--surface` (e.g. toward `#5b7686`). Token-only change. |
| X3 | **`--gold` (#e48b53) used as text/link fails AA** — 2.57:1 on surface, 2.38:1 on canvas (fails even large-text 3.0). Appears as readable text: help eyebrows ("From the spec", "Good"), "Open …" links, hover states. | P1 | Q4 | `app/globals.css` (`--gold`); usages `app/help/page.tsx`, `app/help/[slug]/page.tsx`, `text-gold` "Open" links injected by `scripts/_density.mjs` | Reserve gold for accents/icons/backgrounds; introduce a darker `--gold-text` for readable text, or darken `--gold`. |
| X4 | **No custom `:focus-visible` styling.** Keyboard focus relies on the browser-default outline (thin blue, off-brand, low-contrast against the salmon sidebar + dark active row). | P2 | Q4 | `app/globals.css` (add a brand focus ring) | Add `:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px }` (or a ring token). |
| X5 | **Public/auth surfaces inherit internal nav in the DOM.** Sidebar (incl. leader-only "Decision Queue" label) is rendered in the DOM on `/login` and `/gifted-quiz`. On `/login` it is also **painted** (full sidebar + week selector + role switcher visible to anon users). | P1 | Q6/Q7 | `app/layout.tsx` (Sidebar/TopBar always mounted); `app/(public)/…`, `app/login/page.tsx` | Suppress the app chrome on `/login` + `(public)` routes via a route-group layout, so anon/public pages don't expose internal IA or a chrome that bypasses the login cards. |

### Page: `/login`

| Issue | Sev | Q# | File | Fix |
|---|---|---|---|---|
| Full authenticated app shell painted to an unauthenticated user — sidebar lists all 13 modules; topbar shows week selector, "52 days to cutoff", and a **role switcher that logs you in by clicking, bypassing the role cards** (two competing login affordances). | P1 | Q6/Q7 | `app/layout.tsx`, `app/login/page.tsx` | Render `/login` without Sidebar/TopBar (route-group layout); keep only the role-card flow. See X5. |
| Post-login redirect can render nav chrome as signed-out ("Sign in" in sidebar+topbar) until a hard reload (layout caching). | P2 | Q6 | `app/layout.tsx` (session read / caching) | Make the chrome dynamic per-request or revalidate after `/api/auth/login`. Transient. |

_Screenshot: `qa-shots/01-login.png`._

### Page: `/` (Home)

| Issue | Sev | Q# | File | Fix |
|---|---|---|---|---|
| **Mobile topbar overflow.** At 390px the top row (logo + "+ Widget" picker + role switcher + username + Dark) doesn't wrap/scroll; "Dark" sits at x=421 → ~31px page-level horizontal scroll. | P1 | Q3 | `app/_components/TopBar.tsx` (top `flex` row); `app/_components/HomeWidgetPicker.tsx` | Let the control cluster wrap or scroll on small screens; hide the week selector below `sm` (it already moves to the second row but the top cluster still overflows). |
| Banner wording drift: Home says "**Data confidence needs review**"; modules say "**Data confidence warning**". | P2 | Q3-semantic | `app/page.tsx:110` vs `app/m/[slug]/page.tsx:105` / `app/_components/DataConfidenceBanner.tsx:78` | Use one phrase everywhere (and ideally one shared `DataConfidenceBanner`). |

_Screenshots: `qa-shots/02-home-admin.png`, `qa-shots/role-operator-home.png`, `qa-shots/mobile-home.png`._

### Page: `/m/budget`

| Issue | Sev | Q# | File | Fix |
|---|---|---|---|---|
| **Severe mobile overflow (scrollWidth 802px @ 390px).** The 7-column budget table is not wrapped in a horizontal-scroll container, so it forces its column to ~800px and drags the metric-tile grid off-screen. Worst offender in the app. | P1 | Q3 | `app/m/budget/_components/BudgetTable.tsx`; `app/m/budget/page.tsx` | Wrap the table in `<div className="overflow-x-auto">` (or a responsive card list on small screens) so it scrolls within its column instead of blowing out the page. |
| Denser header template (see X1). | P1 | Q1 | `app/m/budget/page.tsx`, `_components/primitives.tsx` | Converge with the standard header. |

_Screenshots: `qa-shots/v2-budget.png`, `qa-shots/mobile-budget.png`._

### Page: `/m/dashboard`

| Issue | Sev | Q# | File | Fix |
|---|---|---|---|---|
| **Mobile overflow (scrollWidth 722px @ 390px).** Wide tab content / tables (Scorecard, week selector row, Trends) not constrained to the viewport. | P1 | Q3 | `app/m/dashboard/_components/{Scorecard,Trends,GoalPacing}.tsx`; `app/m/dashboard/page.tsx` | Wrap wide tables/rows in `overflow-x-auto`; let the week-selector chip row scroll. |
| Denser header template + sentence-case "Active role" (see X1). | P1 | Q1/Q8 | `app/m/dashboard/page.tsx`, `_components/primitives.tsx` | Converge with standard header. |

_Screenshots: `qa-shots/v2-dashboard.png`, `qa-shots/dark-dashboard.png` (dark mode — good)._

### Page: `/m/crm-ops`

| Issue | Sev | Q# | File | Fix |
|---|---|---|---|---|
| Denser header template (see X1) — but **mobile is clean** (390px, no overflow), so its tables are already wrapped. Good pattern to copy to Budget/Dashboard. | P1 | Q1 | `app/m/crm-ops/page.tsx`, `_components/primitives.tsx` | Converge header only; reuse its table-wrapping pattern for Budget/Dashboard. |

_Screenshot: `qa-shots/v2-crm-ops.png`._

### Page: `/m/gt-challenge` (campaign surface)

| Issue | Sev | Q# | File | Fix |
|---|---|---|---|---|
| Role-lens card laid out 3-across (vs the 2×2 card on standard modules) and uses a "Worked example" plain breadcrumb — a third header variant. | P2 | Q1 | `app/m/[slug]/page.tsx` (gt-challenge branch) | Align the card layout + breadcrumb with the chosen standard. |

_Screenshot: `qa-shots/m-gt-challenge.png`._

### Modules that are clean (visual + mobile): grassroots, content, summer-camp, nurture, events, admissions, library, analytics

| Issue | Sev | Q# | File | Fix |
|---|---|---|---|---|
| Tinted metric-pill labels: **amber** label (#9b5f2f on #f8e6d9) = 4.25:1 at ~10px — marginally below AA for small text (green/violet/blue tints pass). | P2 | Q4 | `app/globals.css` (`--amber`) | Nudge `--amber` darker to clear 4.5:1, or render those labels ≥14px-bold. |

_Screenshots: `qa-shots/m-grassroots.png`, `m-content.png`, `m-summer-camp.png`, `v2-nurture.png`, `m-events.png`, `m-admissions.png`, `m-library.png`, `m-analytics.png`._

### Page: `/m/decisions` (Leader) & `/m/submissions`

| Observation | Sev | Q# | Verdict |
|---|---|---|---|
| Decision Queue renders fully for Leader (metrics, Active/History tabs, decision cards with Open/Auto-flagged/Urgent pills). Uses the denser header (see X1). | P2 | Q1 | Works; header style only |
| `/m/submissions` ("My submissions") renders the signed-in user's own raised decisions with status pill. | — | Q6 | **Good** |

_Screenshots: `qa-shots/role-leader-decisions.png`, `qa-shots/m-submissions.png`._

### Page: `/gifted-quiz` (public funnel)

| Observation | Sev | Q# | Verdict |
|---|---|---|---|
| Clean public design (atom "GT Anywhere" mark, no painted sidebar), 5 questions + contact + consent gate, submit disabled until complete. **Submits successfully** (fetch fires → "Test Child: Strong fit" result panel with "What happens next" + "Explore GT Anywhere" CTA). | — | Q6/Q7 | **Good** |
| Internal sidebar nav (incl. leader-only "Decision Queue") remains in the DOM though not painted (a11y/SEO leak). | P2 | Q6 | See X5 |

_Screenshots: `qa-shots/pub-gifted-quiz.png`, `qa-shots/pub-quiz-result2.png`._

### Pages: `/forbidden`, `/dev/*`, `/opendata`, `/help/*`

| Observation | Sev | Q# | Verdict |
|---|---|---|---|
| `/forbidden` renders a clean "403 — Access denied / This surface is restricted" with "Back to Home" + "Switch role". | — | Q5/Q6 | **Good** |
| Dev surfaces (`/dev`, data-model, payments, test theater) + `/opendata` are polished and internally consistent (tabbed, metric cards, entity/event cards). | — | Q1 | **Good** |
| `/help` index + guides render well (current deploy). | — | Q1 | **Good** (see Blocked for a deploy-window artifact) |
| `/opendata` has its own secondary header ("Marketing Hub · Open Data Explorer · LIVE") with the older orange "GT" square mark — a minor sub-brand inconsistency vs the atom mark. | P2 | Q7 | `app/opendata/page.tsx` |

_Screenshots: `qa-shots/rbac-admin-decisions.png` (forbidden), `v2-dev-data-model.png`, `v2-dev-payments.png`, `v2-dev-tests.png`, `v2-opendata.png`._

### RBAC truth table (functional — all correct)

| Path | Operator | Admin | Leader | Verdict |
|---|---|---|---|---|
| `/m/decisions` | → `/forbidden` (leader-only) | → `/forbidden` (leader-only) | renders Decision Queue | **PASS** |
| `/dev` | → `/forbidden` (admin-only) | renders | → `/forbidden` (admin-only) | **PASS** |
| Sidebar shows "Decision Queue" | hidden | hidden | shown | **PASS** |
| Sidebar shows Dev/Open Data links | hidden | shown | hidden | **PASS** |

---

## 3 · Prioritized fix backlog (execute top-down)

### P1

1. **Wrap wide tables in horizontal-scroll containers (mobile).** Budget table (`app/m/budget/_components/BudgetTable.tsx`) and Dashboard tables (`app/m/dashboard/_components/{Scorecard,Trends,GoalPacing}.tsx`) in `<div className="overflow-x-auto">`; verify `scrollWidth === 390` at 390px. CRM Ops already does this — copy its pattern. *(Fixes Budget 802px + Dashboard 722px overflow.)*
2. **Fix the mobile topbar overflow.** `app/_components/TopBar.tsx` — let the right-side control cluster (`+ Widget` / role switcher / username / Dark) wrap or scroll below `lg`; ensure Home reaches `scrollWidth === innerWidth` at 390px.
3. **Converge the page-header template (finish the density pass).** Bring Dashboard, CRM Ops, Budget (and the gt-challenge branch) to one header: breadcrumb style (pill vs plain), label casing ("ACTIVE ROLE" vs "Active role"), and H1 scale. Files: `app/m/{dashboard,crm-ops,budget}/page.tsx` + `_components/primitives.tsx`, `app/m/[slug]/page.tsx`. Decide one direction (the denser one is the migration target).
4. **Darken `--label` to pass AA** (`app/globals.css` `--label` → ≥4.5:1 on canvas/surface). *Token pass — out of scope here.*
5. **Stop using `--gold` as readable text** (`app/globals.css` + `app/help/*`, `text-gold` "Open" links): add a darker gold-text token or darken `--gold`; keep gold for accents only. *Token pass.*
6. **Don't render internal app chrome on `/login` and `(public)` routes.** `app/layout.tsx` → conditional/route-group layout; removes the anon IA leak + the bypass role switcher on `/login`.

### P2

7. Add a brand `:focus-visible` ring (`app/globals.css`).
8. Unify the data-confidence banner copy + component (`app/page.tsx` vs `app/m/[slug]/page.tsx` vs `app/_components/DataConfidenceBanner.tsx`).
9. Fix post-login stale chrome (dynamic/revalidate the layout session read).
10. Align the gt-challenge role-lens card + breadcrumb with the standard (`app/m/[slug]/page.tsx`).
11. Nudge `--amber` to clear AA for small tinted labels (`app/globals.css`).
12. Unify the `/opendata` secondary header mark with the atom "GT School" logo (`app/opendata/page.tsx`).
13. Remove internal nav from the DOM on public routes (a11y/SEO) — same route-group fix as #6 (`app/layout.tsx`).

---

## 4 · What's already good (protect these in the fix pass)

- **RBAC is correct and server-enforced** for all three roles — the highest-value functional surface. Decision Queue is genuinely leader-only (Operator **and** Admin denied), dev/opendata are admin-only, nav hides what a role can't reach, and `/forbidden` + `/login?next=` redirects work.
- **The public gifted-quiz funnel works end-to-end** and is on-brand (clean public chrome, consent-gated, submits, renders a real "Strong fit" result + CTA).
- **Dark mode is well-executed** — dark navy canvas, readable text, gold accents preserved, no obvious contrast regressions (see `qa-shots/dark-dashboard.png`).
- **A strong, coherent design language** across the ~9 standard modules: consistent pill breadcrumb, role-lens card, data-confidence banner, tinted metric tiles, and a "Source of truth" aside. Body/heading contrast is excellent (muted 5.5:1, ink 13.9:1).
- **Token discipline** — surfaces use the design tokens; no raw hex spotted in rendered output.
- **Good empty/edge states** — Library's "1 dead link flagged unreachable", Decision Queue's await/empty states, the quiz's disabled-until-valid submit.
- **CRM Ops is mobile-clean** despite being data-heavy — its table-wrapping pattern is the template the fix pass should copy to Budget/Dashboard.

---

## Blocked / caveats

- **A Vercel deploy rolled out during the pass.** The first capture of `/help`
  rendered **completely unstyled** (CSS chunk mismatch during deploy; see
  `qa-shots/x-help.png`), and the topbar logo changed mid-pass from an orange "GT"
  square to the atom "GT School" mark. On re-check `/help` rendered correctly
  (`qa-shots/x-help-recheck.png`) and the logo was consistent. **These are
  deploy-window artifacts, not standing bugs** — but note that the brief unstyled
  window means in-flight users can momentarily get unstyled HTML during a deploy
  (a CDN/atomicity consideration, P2). Early admin/module screenshots (`m-*.png`,
  `x-dev*.png`) were taken on the pre-deploy build; `v2-*.png` are the current build
  and supersede them where they differ.
- The tree was hot (a density worker + codex editing live); some module padding may
  shift again after this audit. Finding X1 is explicitly about that in-flight state.
- Live/seeded data was used (e.g. "Decision Queue 3", budget figures); functional
  verdicts are about behavior, not data values.
