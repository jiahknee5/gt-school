# GT Marketing Hub — Cohesion Review (post-full-build)

> Produced by the **`gt-hub-cohesion-panel`** skill as the system-level gate after all
> 13 modules were built (runbook step 5, full-set pass). It judges the 13 modules as **one
> product** at the SEAMS — shared shell/design system, navigation/IA, one-meaning-per-metric,
> cross-module handoffs, role journeys, ease of use, a11y, learnability. The planning-side
> synthesis + workflows live in `docs/use-cases/README.md`; this file is the audit verdict
> with ranked findings. Date: 2026-06-26.

## 0. Scope reviewed

All 13 modules now ship a real `/m/<slug>` surface (no placeholders): Home (`/`), Grassroots,
Content, Summer Camp, Nurture, Dashboard, CRM Ops, Field Events, Admissions, Budget, Decision
Queue, Library, Analytics — plus the cross-cutting `My submissions`, GT Challenge campaign,
Help, and Admin-only `/dev` + `/opendata` surfaces. Verified against the cohesion pillars C1–C8.

## 1. Verdict

**The Hub hangs together as one product.** The seams the panel most feared (silent handoffs,
role dead-ends, metric drift, banner inconsistency) are largely handled by deliberate design,
not accident. No P0 cohesion defect found. Remaining items are P1 polish (command palette,
unified inbox, breadcrumbs) and the submission deliverables, not seam breaks.

## 2. Pillar scorecard

| # | Pillar | Verdict | Evidence / note |
|---|---|---|---|
| **C1** | One product, one design system | ✅ Pass | Every module reuses the shared shell (`app/_components/Sidebar.tsx`, `TopBar.tsx`, `modkit.tsx` — `Card`/`MetricTile`/`ModuleHeader`/`Pill`/`Tabs`); tokens (`globals.css`) not bespoke per module. The 4 late modules (Analytics/Camp/Events/Library) use the same `modkit` primitives. |
| **C2** | Navigation & IA | ✅ Pass | `lib/modules.ts` is the single nav source; all 13 modules + Campaigns + Help + Developer render from it in the sidebar. Home is `/`; the rest are `/m/<slug>`. Every module header links back Home. |
| **C3** | One meaning per metric | ✅ Pass (with one watch) | Budget reconciles to $365K in exactly one place; Analytics defines bounce once (`1 − engaged/sessions`) and reconciles by summation (no cross-property double-count); Summer Camp counts a family once via `match_key`. **Watch:** "qualified/applicants" semantics should keep deriving from the seed/registry, not be recomputed per module — keep new modules reading `lib/metrics/*`. |
| **C4** | Seamless handoffs | ✅ Pass | Auto-links each have a visible landing: testimonial→Content stub, objection→Content brief, hot-family→Decision Queue chip (`/m/decisions`), budget variance→DQ, parity drop→DataConfidenceBanner→CRM Ops, parent-led event→read-only Field Marketing. Proven in `brief-usecases.test.ts` (UC-SPEC-XLINK-*). |
| **C5** | Coherent role journeys | ✅ Pass | The sidebar hides the Leader-only Decision Queue from non-leaders (`visibleModules` filter) — no click-then-403 dead-end. Operators get `My submissions` (raise→decide→outcome visible) instead. Admin-only Developer links shown only to admin. Middleware enforces the same policy server-side, so UI and authz agree. |
| **C6** | Ease of use | 🟡 Pass with P1 polish | Tabs + metric tiles keep common tasks shallow. Open P1s (not seam breaks): no global command palette / jump-to-record; no single notifications/inbox (handoff chips are per-module); drill-in breadcrumbs not yet standardized. |
| **C7** | Accessibility | 🟡 Verify | Icons carry `aria-hidden`; active nav uses `aria-current`; focus/hover states present. **Not yet verified:** WCAG AA contrast on the fixed brand palette and full keyboard traversal of tab/drill-in controls — track as a P1 a11y pass. |
| **C8** | Learnability / help | ✅ Pass | Reachable in-app Help (`/help`, `lib/help/guides.ts`) documents the common journeys; the priority-workflows guide is wired. |

## 3. Ranked findings

| # | Sev | Pillar | Finding | Disposition |
|---|---|---|---|---|
| H-COH-1 | P1 | C6 | No global command palette / cross-module search to jump to a module or record. | Deferred (P1) — additive surface, no seam break. |
| H-COH-2 | P1 | C6 | Cross-module handoff chips are per-module; no single "notifications/inbox" so a leader sees every new hand-off in one place. | Deferred (P1) — the chips DO land visibly today (C4 holds); this is consolidation. |
| H-COH-3 | P1 | C7 | Brand-palette contrast (WCAG AA) and full keyboard traversal not yet formally audited. | Deferred (P1) — schedule an a11y pass; palette is fixed so contrast must be measured. |
| H-COH-4 | P2 | C6 | Drill-in breadcrumb/back-affordance standard not uniform across rosters/decision cards. | Deferred (P2). |
| H-COH-5 | P2 | C3 | New modules must keep deriving shared KPIs from `lib/metrics/*`/seed rather than recomputing, to prevent future semantic drift. | Guidance (no current violation). |

## 4. Notable cohesion strengths (preserve)

- **Banner adoption is principled, not blanket.** The DataConfidenceBanner appears on the 7
  HubSpot-consuming modules (CRM Ops, Grassroots, Dashboard, Content, Budget, Nurture,
  Admissions). Analytics deliberately omits it (reads GA4, shows its own GA4-confidence note);
  Field Events deliberately omits it (manual/uninstrumented — `events.test.ts` asserts the
  warning is absent). This is the correct C3/C4 reading, not an inconsistency.
- **One nav source of truth** (`lib/modules.ts`) consumed by sidebar + Home grid + routing.
- **UI authz mirrors server authz** — the sidebar filter and the middleware/route policy use
  the same role model, so nothing is shown that the server would later deny.

## 5. Definition of done (cohesion gate) — status

- [x] One shared shell + design system across all 13 modules.
- [x] Single nav source; every module reachable; no role dead-ends (denied entries hidden, not 403-after-click).
- [x] Cross-module auto-links each have a visible landing (C4).
- [x] One canonical definition per shared metric (C3).
- [x] In-app Help covers the common journeys (C8).
- [ ] Formal a11y pass (contrast + keyboard) — P1.
- [ ] Command palette / unified inbox — P1 polish.
