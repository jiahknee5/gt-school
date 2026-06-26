# Module 7: CRM / Marketing Operations — Plan Spec
> Status: spec / ready-to-build · Owner: Marketing Lead (Admin) · PRD §3 Module 7 (lines 690–777), §4 (1185–1212)
> Source of truth: **Supabase `app_form`** (funnel/TEFA/income/grade) + **HubSpot** (lifecycle/lead_score/source) — this module *measures their sync parity*, it does not own the data
> RBAC: Admin (Marketing Lead) + Leader read; **Operators denied**; lead scoring **read-only** (Hub never writes scores back)
> Owns: **the data-confidence banner contract** broadcast to all HubSpot-consuming modules

## 0. Build-on-this (existing backbone — reuse, do not duplicate)

| Capability | Where | Reuse for CRM Ops |
|---|---|---|
| Parity engine (compute / persist / banner read) | `lib/parity.ts` — `computeParity`, `runParityCheck`, `getBannerState`, `parityThreshold`, `normalizeValue` | Overview score, Sync-parity field detail, banner broadcast — **all read paths already exist** |
| Per-field app↔HS values | `field_state (entity, entity_id, field, app_value, hs_value, in_parity, last_checked_at)` | Field-level parity + broken-UTM drill-in (`field='source'`) |
| Field-directional policy + reliability flags | `field_authority (entity, field, authority, direction, expected_unreliable)` — seeded | Field-reliability flags read **from `expected_unreliable`**, not a hardcoded list |
| Parity time series | `parity_snapshot (taken_at, scope, overall_pct, fields jsonb)` | Trend chart + the snapshot the banner reads |
| DQ queue table (auto + manual) | `data_quality_issue (category, severity, entity, entity_id, field, description, status, resolved_at)` | The queue + resolution log — **already exists**, including categories utm/sync/scoring/tracking/other |
| Inbound reconcile + echo-suppression | `lib/sync/reconcile.ts` — `reconcile`, `applyInboundRecord`, `ReconcileResult.{conflicts,echoes,parity}` | Auto-detect hook fires **after** reconcile; echo-suppression keeps parity stable |
| HubSpot field map + connector | `lib/connectors/hubspot.ts` — `HS_PROP_FOR_FIELD` (`source→gt_utm_source`, `lead_score→gt_lead_score`, `tefa_status→gt_esa_status`, `income_band→gt_income_band`) | Attribution chain + lead-score read; names the HS property per hop |
| Sync watermark | `sync_cursor` + `families.last_synced_at` | Last-sync timestamps per connector |
| In-app data dictionary | `lib/dev/catalog.ts` (`/dev`) | Register no new tables; cite existing machinery-zone tables |

**Modeling decision (documented, per PRD §7a/§7d):** the "unreliable HubSpot fields" are exactly the seeded `field_authority.expected_unreliable = true` rows — **`tefa_status`, `income_band`, `source`**. TEFA + income are `app_to_hs` (Supabase wins; the HubSpot mirror is the unreliable copy); `source` is `hs_to_app` and is the **broken-UTM** field. The UI derives flags from this column so the decision lives in data, not code.

## 1. Expert-panel synthesis (pared to 9 — see `gt-hub-crm-ops-panel`)

| Persona | Lens (order) | Falsifiable ask |
|---|---|---|
| Priya Nair — RevOps/marketing-ops SME | decision usefulness (1) | every Overview widget links to a queue action / drill-in |
| Daniel Wu — HubSpot data-source specialist | source quirks (1) | reliability flags read from `field_authority.expected_unreliable`, not a list |
| Sofia Marchetti — attribution/UTM specialist | broken-UTM rebuild (1) | chain viz form→Supabase→HubSpot per hop; broken-UTM drill-in lists exact records |
| Lena Ostrowski — DQ/observability eng | live auto-detect (2) | detector after `reconcile()` creates issues **idempotently** (rerun = 0 dupes) |
| Sara Kim — MDM/identity-resolution | no double-count (2) | duplicate identities surface as issues, not inflated parity denominator |
| Devon Park — sync/backbone eng | banner integrity (2) | all reads via `getBannerState()`; reconcile-twice = identical state (no flap) |
| Maya Lindqvist — product/UX designer | executability (2) | all 5 sub-views reachable with empty/loading/error/duplicate states |
| Elena Schwartz — privacy counsel | **don't-ship** (2) | issue text carries `entity_id`+field, never raw TEFA/income/child values; Operators denied |
| Dr. Aisha Rahman — causal scientist | **don't-trust** (3) | a below-threshold field is visible on Overview even while overall reads green |

**Convergent:** ride the existing parity engine; the banner is a *contract*, not a component; auto-detect is the module's reason to exist. **Divergent → resolved:** "report ~98%, it's basically fine" (Nair) vs "98% is a vanity number" (Rahman) → **show overall AND worst-field side-by-side; never let overall hide a field.** **Top risks (ranked):** (1) fake/manual-only auto-detect; (2) re-implemented/stale banner; (3) vanity 98% hides a 60% field; (4) PII leak in queue/chain; (5) UTM red with no rebuild path; (6) duplicate identities inflate parity.

## 2. Workflow — sub-views as nodes (data-in / processing / data-out)

```mermaid
flowchart TD
  REC[reconcile() inbound sweep] --> FS[(field_state: app vs hs, in_parity)]
  FS --> CP[computeParity → ParityResult]
  CP --> SNAP[(parity_snapshot)]
  CP --> DET[auto-detect: drift + UTM breakage]
  DET --> DQ[(data_quality_issue: open)]
  FA[(field_authority.expected_unreliable)] --> CP
  FA --> FLAGS[field-reliability flags]
  SNAP --> N1[N1 Overview]
  FLAGS --> N1
  DQ --> N1
  FS -->|field='source'| N2[N2 Source tracking / UTM]
  HS[HubSpot gt_lead_score] --> N3[N3 Lead scoring read-only]
  CP --> N4[N4 Sync parity]
  DQ --> N5[N5 Data-quality queue]
  SNAP --> BANNER{{getBannerState · overall < threshold?}}
  BANNER -->|alarm| BROADCAST[[data-confidence banner → all HubSpot-consuming modules]]
```

| Node (sub-view) | Data in | Processing | Data out |
|---|---|---|---|
| **N1 Overview** (§7a) | latest `parity_snapshot`, `data_quality_issue` open count, `sync_cursor`/`last_synced_at`, `field_authority` | compose widgets; surface **overall % AND worst field together** (anti-vanity) | sync-parity score, UTM-health tile (red, pinned), lead-score histogram, open-issue count, last-sync timestamps, field-reliability flags |
| **N2 Source tracking / UTM** (§7b) | `field_state` where `field='source'`, `families.source`, `HS_PROP_FOR_FIELD.source = gt_utm_source` | classify `(not set)`/malformed vs resolved; build per-hop chain status | UTM-health % per param, broken-UTM drill-in (exact records), **attribution chain viz** form→Supabase `app_form`→HubSpot, fix log |
| **N3 Lead scoring** (§7c) — **read-only** | HubSpot `gt_lead_score` (via reconcile into `families.lead_score`), program outcomes for correlation | bucket into tiers; correlate score→conversion with **n + caveat** | score histogram, tier breakdown, score-to-conversion table (labeled correlation, not validation), rules change-log |
| **N4 Sync parity** (§7d) | `computeParity()` → `fieldDetail[]` (asc by pct), `field_authority` | overall + per-field %; flag below-threshold; mark `expected_unreliable` calm (amber) vs surprise (red) | overall %, field-level table, known-unreliable flags (TEFA/income/source), drift alerts, **persistent "Supabase `app_form` is SoT" reminder** |
| **N5 Data-quality queue** (§7e) | `data_quality_issue`, output of the **auto-detector** (see §3) | list open by severity; categories utm/sync/scoring/tracking/other; ack/prioritize/resolve | open-issue list (desc/severity/owner/created), resolution log, **auto-detected** drift + UTM items, leadership ack/approve actions |

**Cross-cutting:** SSOT reminder on N4 (always visible); no duplicate-identity double-count in the parity denominator (Kim); RBAC Admin/Leader only (Schwartz); the banner broadcast (§4) is driven by `getBannerState()`.

## 3. Data model touchpoints (NO backbone edits — every table below already exists)

| Table | Read | Write | Notes |
|---|---|---|---|
| `field_state` | ✓ parity, UTM drill-in | — | written only by `reconcile.ts`; CRM Ops reads |
| `field_authority` | ✓ reliability flags, direction | — | seeded; UI derives flags from `expected_unreliable` |
| `parity_snapshot` | ✓ trend + banner | ✓ (via `runParityCheck`, existing) | time series; no new column |
| `data_quality_issue` | ✓ queue | ✓ inserts (auto-detect + manual), updates (resolve/ack) | **dedupe in app logic** (see below) — no schema change |
| `families` | ✓ `source`, `lead_score`, identities | — | read-only here |
| `sync_cursor` | ✓ last-sync | — | freshness indicators |

**Additive migration: NONE required** (backbone already carries `data_quality_issue` + parity). **Idempotent auto-detect without a schema change (Ostrowski #4, additive-only constraint):** before inserting, the detector checks for an existing OPEN row with the same `(category, entity, entity_id, field)` rule signature and inserts only if absent; on resolution of the underlying condition it sets `status='resolved'`, `resolved_at=now()`. This keeps "rerun adds 0 dupes" provable using existing columns. *(If a DB-level guard is later wanted, the only additive option is a partial unique index on open issues — explicitly out of scope here to avoid touching the backbone table.)*

## 4. Cross-module contracts

### Outbound — **OWNED by this module** (the data-confidence banner)
- **Trigger:** after each `reconcile()`/`runParityCheck()`, `getBannerState()` evaluates the latest `parity_snapshot` against `parityThreshold()` (default 0.95; `PARITY_THRESHOLD` env wins).
- **Payload (the contract consumers read):** `BannerState { overallPct, thresholdPct, overallBelow, below[], surprises[], expectedUnreliable[], alarm, takenAt }` from `lib/parity.ts`.
- **Semantics:** `alarm = true` **iff a non-`expected_unreliable` field is below threshold** (a *surprise*). Known-unreliable fields (TEFA/income/source) report their true % but render **calm (amber)** and do **not** trip the alarm; a surprise renders **red**.
- **Consumers (every HubSpot-consuming module renders the banner, linking to Module 7):** M1 Home, M2 Grassroots, M3 Content, M5 Nurture, M6 Dashboard, M9 Admissions. Non-consumers (manual/GA4/site sources) do **not** show it: M4, M8, M10, M11, M12, M13.
- **Read rule:** consumers call `getBannerState()` only — they **never** recompute parity. One source of truth for "are we in parity?" (Park #6).

### Outbound — feeds
- **UTM health → M3 Content performance + M5 Nurture attribution** (PRD §7 cross-links): broken-UTM share degrades attribution confidence downstream.
- **Lead score → M5 Nurture segments + M6 KPI scorecard** (read-only passthrough).

### Inbound — consumed
- **`reconcile()` result** (`ReconcileResult.parity`, `.conflicts`, `.echoes`) is the auto-detector's trigger input.
- **Seeded edge cases** (`lib/seed/invariants.ts`): `broken_utm_source`, `attribution_gap`, `parity_dip_below_threshold`, `crm_app_conflict`, `dual_source_duplicate` — the detector must turn these into queue items.

## 5. Files to build (additive — mapped to real paths)

| File | Purpose |
|---|---|
| `lib/crm-ops/detect.ts` | the auto-detector: after reconcile, read `ParityResult.fieldDetail` (below-threshold, non-expected) + scan `field_state`/`families` for `source` `(not set)`/malformed → upsert `data_quality_issue` **idempotently** by `(category,entity,entity_id,field)` open-signature |
| `lib/crm-ops/attribution.ts` | UTM health %, broken-UTM record list, and the form→Supabase→HubSpot **chain status** per hop (using `HS_PROP_FOR_FIELD.source`) |
| `lib/crm-ops/scoring.ts` | read-only lead-score histogram + tier breakdown + score→conversion correlation (returns `n` + caveat flag) |
| `lib/crm-ops/queue.ts` | list/ack/prioritize/resolve over `data_quality_issue` (write-throughs respect RBAC) |
| `app/m/crm-ops/page.tsx` + tab bar | the 5 sub-views (Overview · Source tracking · Lead scoring · Sync parity · Data quality) |
| `app/m/crm-ops/_components/{ParityScore,FieldParityTable,AttributionChain,BrokenUtmDrill,ScoreHistogram,DqQueue,ReliabilityFlags,SotReminder}.tsx` | view components; `SotReminder` is persistent on Sync parity |
| `app/_components/DataConfidenceBanner.tsx` | the **shared** banner; reads `getBannerState()`; mounted by the 6 consumer modules; links to `/m/crm-ops` |
| `app/api/crm-ops/detect/route.ts` | run the detector (Admin/Leader only); also invoked post-reconcile |
| `lib/seed/generate.ts` (extend) | ensure `broken_utm_source` + `parity_dip_below_threshold` + a `surprise` (non-expected) field drop exist so auto-detect + alarm are demoable |

## 6. Provable invariants

1. **Banner single-source:** a consumer module's banner state equals `getBannerState()` exactly — no local recompute (Park).
2. **Alarm semantics:** `alarm` is true **iff** a non-`expected_unreliable` field is below threshold; TEFA/income/source below threshold alone → calm, `alarm=false` (Wu/Rahman).
3. **Auto-detect idempotent:** running the detector twice over unchanged state yields the same set of open `data_quality_issue` rows (0 dupes) (Ostrowski).
4. **Parity stable under echo:** `reconcile()` twice with no real change → identical `overall_pct` + banner state (echo-suppression holds) (Park).
5. **No vanity hide:** if any field pct < threshold, it is visible on the Overview even when `overallPct ≥ threshold` (Rahman).
6. **No double-count:** parity denominator is `count(field_state)` per `(entity, entity_id, field)`; a `duplicate_family`/`dual_source_duplicate` seed surfaces as an issue, not as extra parity rows (Kim).
7. **SSOT reminder present:** the "Supabase `app_form` is the source of truth for funnel/TEFA/income" line renders on Sync parity at all times (PRD §7d).
8. **RBAC denial:** an Operator request to `/m/crm-ops` and to the detect/resolve routes is denied; lead-score writes are never emitted (read-only) (Schwartz).
9. **No PII in issue text:** `data_quality_issue.description` references field name + `entity_id`, never a raw TEFA/income/child value (Schwartz).

## 7. Demo script (clickable; ties to the four "show us it works" signals)

1. Open **CRM Ops → Overview**: overall parity ~98% **and** the worst field shown beside it (a field below threshold is not hidden).
2. **Sync parity** tab: field-level table; TEFA/income/source flagged **calm/amber** (known-unreliable) with the SoT reminder pinned.
3. Edit a family's app-authoritative field in HubSpot → run **reconcile** → a **surprise** field drops below threshold → **data-confidence banner appears on Home/Nurture/Dashboard** (the §4 broadcast; *"data-confidence banner on parity drop"* signal).
4. **Data quality** tab: the auto-detector has filed the drift **and** the seeded `broken_utm_source` as open issues; run detect again → **no duplicates** (idempotent).
5. **Source tracking**: open the broken-UTM drill-in → exact `(not set)` records; the attribution chain shows the red hop (form→Supabase→**HubSpot** broken).
6. As an **Operator**, open `/m/crm-ops` → **denied** (*"role denied"* signal); confirm no lead-score write left the Hub (read-only).

## 8. Open questions / assumptions

- **A1 (UTM rebuild authority):** `field_authority` currently has `source` as `hs_to_app` + `expected_unreliable`. If the UTM rebuild makes the **form-captured UTM in Supabase `app_form`** authoritative, `source` should flip to `app_to_hs`. *Assumption: keep `hs_to_app` for now (matches seed); flag the flip as the rebuild's acceptance criterion. This is a `field_authority` **data** change, not a backbone schema edit.*
- **A2 (unreliable-field set):** assume the unreliable HubSpot fields are exactly `tefa_status`, `income_band`, `source` (the seeded `expected_unreliable=true` rows). Documented modeling decision; UI must not hardcode a different list.
- **A3 (threshold):** assume 0.95 (`parityThreshold()` default); `PARITY_THRESHOLD` env overrides. ~98% overall sits above it, so the alarm is driven by **field-level surprises**, not the overall number.
- **A4 (lead-score correlation):** score→conversion is **correlational on seeded data** (Rahman); label it, show `n`, never present as model validation.
- **A5 (owner field on issues):** `data_quality_issue` has no `owner` column; assume owner is derived (auto-detected → Marketing Lead; manual → filer) and displayed, not stored, to avoid a backbone edit.
- **A6 (banner consumer list):** assume the 6 HubSpot-consuming modules listed in §4; if a non-listed module later surfaces a HubSpot-derived number, it must adopt `getBannerState()` too.
