# GT Marketing Hub — Module Plan Specs

One plan spec per PRD module (§3), each produced by its module-specific expert panel
(`gt-hub-<slug>-panel`) via the engine skill `gt-hub-module-panel`. These are
**planning artifacts** — they map to real files/tables but do not edit app code.

Each `PLAN.md` follows the same template: build-on-this → panel synthesis → workflow
(sub-views as data-in/processing/data-out nodes) → data model touchpoints →
cross-module contracts → files to build → provable invariants → demo → assumptions.

See also the worked example: `../06-gt-challenge/WORKFLOW.md`.

| n | Module | Owner | Source of truth | Plan |
|---|---|---|---|---|
| 1 | Home / Command Center | All (personal) | Aggregates all modules | [01-home](01-home/PLAN.md) |
| 2 | Grassroots Engine | Grassroots Owner | HubSpot + community.gt.school | [02-grassroots](02-grassroots/PLAN.md) |
| 3 | Content & Thought Leadership | Content Owner | Google Sheet + HubSpot + Meta | [03-content](03-content/PLAN.md) |
| 4 | Summer Camp | Content Owner | summer.gt.school + reg form | [04-summer-camp](04-summer-camp/PLAN.md) |
| 5 | Nurture & Lifecycle | Marketing Lead | Supabase app_form + HubSpot | [05-nurture](05-nurture/PLAN.md) |
| 6 | Dashboard / KPI | Marketing Lead | Aggregates + HubSpot reporting | [06-dashboard](06-dashboard/PLAN.md) |
| 7 | CRM / Marketing Ops | Marketing Lead | Supabase + HubSpot (parity) | [07-crm-ops](07-crm-ops/PLAN.md) |
| 8 | Field Marketing & Events | Field & Events Owner | Manual entry | [08-events](08-events/PLAN.md) |
| 9 | Admissions & VoC | Admissions Owner | HubSpot Conversations + manual | [09-admissions](09-admissions/PLAN.md) |
| 10 | Budget Tracker | Budget Owner | Hub manual entry ($365K) | [10-budget](10-budget/PLAN.md) |
| 11 | Decision Queue | Leadership only | Manual submission | [11-decisions](11-decisions/PLAN.md) |
| 12 | Resource Library | All | Manual upload + links | [12-library](12-library/PLAN.md) |
| 13 | Website & Digital Analytics | Marketing Lead | GA4 | [13-analytics](13-analytics/PLAN.md) |

## Cross-cutting review panels (skills)

Applied as gates in the per-module build loop (`../05-build/MODULE-RUNBOOK.md`):

| Skill | Layer | Output |
|---|---|---|
| `gt-hub-module-panel` | engine — per-module build/spec | each module's `PLAN.md` |
| `gt-hub-test-panel` | does it work? | `../08-tests/TEST-PLAN.md` |
| `gt-hub-security-panel` | safe to ship? | `../audits/SECURITY-REVIEW.md` |
| `gt-hub-cohesion-panel` | usable as one app? | `../use-cases/README.md` |
| `gt-hub-ia-panel` | organized the right way? (module grouping / nav IA) | `../audits/IA-MODULE-ORGANIZATION.md` |
