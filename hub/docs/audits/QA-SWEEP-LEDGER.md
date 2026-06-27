# QA Value Sweep — Ledger

**Target:** http://localhost:3000 (local dev, branch `reconcile-status`)
**Scope:** Status, Dashboard, funnel-touched surfaces + WS4 citations / WS6 observability; focus on the recent changes (as-of clock, talk-through narrative, per-row owner contract, vertical compression, dual citations, persisted traces).
**Roles:** Admin (Johnny) viewed live; Leader/Operator RBAC via `rbac.test.ts` (live browser probe blocked — see coverage note).

| Surface / state | Owner role | Source of truth | Status | Verdict | Worst V# | Findings | File(s) |
|---|---|---|---|---|---|---|---|
| `/m/status` board (Admin) | Leadership | registry + dashboard/* | done | **KEEP** | — | North Star reads **56/180** as-of week 3 (not end-of-sprint); week selector bounded **06-01…06-22** (no future). Owner·role on every row; compression clean (exec chip removed, inline RAG). | — |
| `/m/status` Answer drawer | Leadership | status/generate | done | **FIX** | V8 | **P0 React key collision** — hero drawer has **two "Where we stand"** sections (Answer label collides with the conversion stage's `buildStageDrawer` heading) → console error, can drop/dupe sections. 4-beat talk-through itself renders correctly. | `app/m/status/_components/StatusDrawer.tsx`; heading from `lib/status/board.ts` |
| `/m/status` per-stage Narrative cell | Leadership | status/board | done | **FIX** | V9 | **P1 lens tag** renders glued to text ("**Needs attention**X / Twitter…") and shows on **all 6 rows** (none green) → duplicates the row RAG token; no differentiation. | `app/m/status/_components/StatusCellContent.tsx` |
| `/m/status` stage drawer · metric contract + cites | Leadership | status/rowspec + citations | done | **KEEP** | — | "Weekly metric contract" + dual cites render (▸ Module · ⛁ Source). | — |
| `/m/dashboard` scorecard (Admin) | Marketing Lead | metrics/registry | done | **KEEP** | — | Funnel-ordered groups; week selector bounded; per-week KPIs correct. | — |
| `/m/dashboard` Source column (WS4) | Marketing Lead | citations | done | **KEEP** | — | `▸ Analytics ⛁ GA4 → /dev/integrations#ga4_gt_school`, `▸ Nurture ⛁ Supabase`, etc. resolve. | — |
| Dashboard cite → `/dev/integrations` for non-admin | all roles | — | done | **FIX** | V7 | Scorecard is all-roles, but the **⛁ Source** link targets admin-only `/dev/integrations`; a non-admin clicking it lands on the RBAC gate. Minor: render source as text (not a link) for non-admins, or point at a role-safe provenance view. | `app/_components/MetricCite.tsx`, `Scorecard.tsx` |
| `/dev/agents` unified call-sites + traces (WS6) | Admin | ai/observability + trace-store | done | **KEEP** | — | "LLM call-sites · unified" table (Ask-the-Hub + Status generation, same eval shape) + "Persisted run traces" render; status-gen rows pass. | — |
| `/dev/integrations` anchors (WS4) | Admin | integrations/catalog | done | **KEEP** | — | Inventory rows carry `id` anchors + `:target` highlight so `#hubspot_crm` etc. resolve. | — |
| RBAC matrix (`/dev/*` admin-only, `/m/decisions` leader-only) | — | auth/policy | done | **KEEP** | — | Enforced by middleware + `lib/auth/policy.ts`; covered by `rbac.test.ts` (passing). Unchanged by WS4–WS6. | — |

## Coverage note
- Admin live views judged directly in-browser. **Leader/Operator live views were blocked** by dev-server slowness under concurrent first-compiles (multiple probes) — RBAC verdict rests on `rbac.test.ts` (authoritative; passing in the 549-green suite). Recommend a clean Leader/Operator browser pass on a warm server or the preview deploy before final sign-off.
- States not yet judged live: empty/error/zero-data variants of the Status drawer; Summer-camp program lens. Deferred (not touched by the recent changes).
