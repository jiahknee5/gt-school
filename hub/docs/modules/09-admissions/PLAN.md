# Module 9: Admissions & Voice of Customer — Plan Spec
> Status: spec / ready-to-build · Owner: Admissions Owner / Field & Events Owner (Operator) · PRD §3 Module 9 (lines 840–930)
> Source of truth: **HubSpot Conversations** (SMS/chat — primary) + **manual** (BDR notes, event follow-ups, Shadow Day surveys) + **Supabase `app_form` comment fields** + **Read.ai transcripts** (optional/secondary). Pipeline numbers derive from `families.funnel_stage` (app-authoritative — NOT HubSpot field values).
> RBAC: Operator (Admissions/Field & Events) read/write own module, reads others, **submits** to Decision Queue but cannot view/act on it · Admin (Marketing Lead) full · Leader comments on objection patterns + prioritizes briefs + acts on the queue.

## 0. Build-on-this (existing backbone/tables/connectors to reuse, not duplicate)

| Capability | Where | Reuse for Module 9 |
|---|---|---|
| Family identity + funnel stage (app-authoritative) | `families.funnel_stage` (`lead`/`applicant`/`shadow_day`/`deposit`/`waitlisted`), `match_key` | Admission pipeline numbers + resolve an objection/quote to a family — never re-derive counts from HubSpot |
| HubSpot connector + match-key identity | `lib/connectors/hubspot.ts`, `lib/connectors/SourceConnector.ts` (`matchKey`) | Pull Conversations threads; resolve a thread's contact → `family_id` |
| Inbound reconcile + parity + data-confidence banner | `lib/sync/reconcile.ts`, `lib/parity.ts`, `parity_snapshot` | Module 9 consumes HubSpot → shows the shared parity banner |
| Idempotency ledger | `processed_events` (source,event_id), `sync_event_log` | De-dup Conversations message ingest so one thread ≠ many objections |
| Decision Queue | `decisions` table (`raised_by`, `workstream`, `status`, `auto_flag`) | Feedback-to-marketing items flagged "urgent/actionable" submit here (Operator submit-only) |
| Budget workstreams ($365K) | `budget_workstream` | No edit; content produced off a brief may roll spend into `thought_leadership` (Module 3's concern, not 9) |
| In-app dev docs | `lib/dev/catalog.ts`, `/dev/*` | Register the new tables here with zone + PII field tags |
| Module registry | `lib/modules.ts` (n=9, slug=`admissions`, route `/m/admissions`) | Tab bar host for the 5 sub-views |

No backbone table is altered. Everything below is **additive**.

## 1. Expert-panel synthesis (gt-hub-admissions-panel, pared to 9)

| Persona | Lens | The catch it enforces |
|---|---|---|
| Marisol Vega — Admissions/VoC SME | Theme validity (domain) | The 8 themes are the closed PRD set incl. verbatim **"is my kid gifted enough"**; nothing silently dumped in `other` |
| Priya Nandakumar — HubSpot Conversations / text data specialist | Primary-source quirks | One objection = one tagged span w/ thread/message ref + `source`; re-surfacing a thread does not inflate frequency |
| Dr. Eun-Ji Park — qualitative/NLP theming scientist | Theme ≠ keyword noise | Store raw verbatim + theme + `theme_confidence`; human re-tag + audit; spot-check accuracy bar before trend arrows are trusted |
| Devon Park — backbone/integration eng | SSOT + RBAC + banner | Pipeline counts read `app_form` funnel_stage; additive tables only; parity banner wired |
| Tomás Rivera — content-bridge integration eng | Cross-module payload | Brief payload = {theme, verbatim[], suggested_angle, target_persona, urgency}; one open brief per theme (idempotent); shows as "brief from admissions" in Module 3 |
| Hannah Cho — feedback-loop / RevOps ops lead | Closure, not write-only | closure_rate = actioned≤7d ÷ flagged, computed from rows; open item → chip in Nurture **and** Decision Queue |
| Elena Schwartz — privacy & compliance counsel | **"don't ship" seat** | No family quote surfaces (esp. Home widget) without `consent` + child-PII redaction |
| Maya Lindqvist — product/UX designer | **workflow executability** | All 5 sub-views reachable with empty/loading/error/duplicate states; bridge + feedback have visible affordances; mobile-legible |
| Dr. Aisha Rahman — causal/decision scientist | **"don't trust" seat** | Bridge effect = measured pre/post delta w/ window + denominator, labeled correlational unless a control is named; counts normalized per active conversation |

**Convergent:** objections are the product — they must be real spans (not keyword hits), de-duped per thread, theme-validated, and consent-gated before any quote goes public; the bridge and the feedback loop are only worth building if their *outcome* (objection frequency drop / 7-day closure) is computed, not asserted.
**Divergent → resolved:** "show the objection-drop as proof the content worked" (Vega/Rivera) vs "that's correlational" (Rahman) → **report the pre/post delta with its window + denominator and label it correlational; a holdout is a future enhancement, not a claim made now.** Auto-theming (Park-NLP speed) vs human-coded validity (Vega) → **auto-suggest theme + confidence, human can re-tag, audit trail retained.**
**Risks (ranked, sourced):** (1) family-quote/minors' PII leak to Home widget — *Schwartz*; (2) theme noise → untrustworthy frequency/trend — *Park-NLP, Vega*; (3) circular/correlational bridge "effectiveness" — *Rahman*; (4) double-counted objections from multi/re-surfaced threads — *Nandakumar*; (5) write-only feedback loop, no closure — *Cho*; (6) pipeline numbers off HubSpot or duplicate brief stubs / banner unwired — *Devon Park, Rivera*; (7) sub-views not executable — *Lindqvist*.
**Open:** retention window for raw verbatims; whether Read.ai transcripts are in-scope for v1; sentiment model choice (lexicon vs LLM) and its audit story.

## 2. Workflow — sub-views as nodes (data-in / processing / data-out)

```mermaid
flowchart TD
  subgraph IN[Sources]
    HS[HubSpot Conversations\nSMS/chat threads — PRIMARY]
    MAN[Manual: BDR notes /\nevent follow-ups / Shadow Day surveys]
    APP[(app_form comment fields)]
    RAI[Read.ai transcripts\noptional/secondary]
  end
  HS --> ING[Ingest + dedup\nprocessed_events]
  MAN --> ING
  APP --> ING
  RAI --> ING
  ING --> THEME[Theme + sentiment + family resolve\nmatchKey -> family_id]
  THEME --> OBJ[(objection)]
  THEME --> VQ[(family_quote)]
  OBJ --> N2[9b Objection log\nfreq + 4wk trend + verbatim]
  OBJ --> N1[9a Overview\nwidgets]
  FAM[(families.funnel_stage\napp-authoritative)] --> N1
  N2 --> N3[9c Objection->content bridge]
  N3 -->|payload: theme, verbatim[], angle, persona, urgency| CB[(content_brief)]
  CB -->|brief from admissions| M3[Module 3 Content pipeline]
  M3 -->|published_at| EFF[pre/post objection delta\nbridge hit-rate]
  EFF --> N1
  VQ --> N4[9d Voice of Families\nsentiment + quote-of-week]
  N4 -->|consented only| HOME[Module 1 Home widget]
  N5[9e Feedback-to-marketing loop] --> FB[(marketing_feedback)]
  FB -->|category/actionable| CHIP[Module 5 Nurture chip]
  FB -->|actionable + Operator submit| DQ[(decisions) Module 11]
  FB --> CR[closure rate <=7d]
  NUR[Nurture / Grassroots\nhot-family flag] --> FLAG[(family_flag)]
  FLAG --> CHIPIN[hot-family chip IN on 9a/9d]
```

### Node table (one per sub-view)

| Node | Data in | Processing | Data out |
|---|---|---|---|
| **9a Overview** | `objection` rows; `families.funnel_stage`; `content_brief` (hit-rate + resolution time); `family_quote` (notable); `marketing_feedback` (open); inbound `family_flag` | Composable widget grid: top-3 objections this week + freq; 4-wk theme trend; pipeline numbers by week (from funnel_stage); feedback-open count; objection→resolution time; bridge hit-rate; notable quotes | Dashboard widgets; data-confidence banner if parity < threshold; empty state when no data |
| **9b Objection log** | `objection` (theme, verbatim, source, surfaced_at, family_id, theme_confidence) | Group by theme → this-week + cumulative freq; 4-wk comparison → trend `up/stable/down` (↑→↓); attach ≥1 example verbatim; sortable by freq, filterable by theme/source/date | Sortable/filterable table; per-theme freq + trend arrow + verbatim; re-tag affordance (audit) |
| **9c Objection→content bridge** | top `objection` themes (by freq/trend); `content_brief` status; Module 3 publish signal | For a qualifying theme, **idempotently** stub one open `content_brief` w/ payload {theme, verbatim[], suggested_angle, target_persona, urgency}; track status → published; compute pre/post objection-frequency delta (window + denominator shown) | `content_brief` row → Module 3 ("brief from admissions"); bridge **hit-rate** (sent→produced); objection→resolution time; correlational drop label |
| **9d Voice of Families** | `family_quote` (verbatim, sentiment, source, family_id, consent); weekly sentiment | Filter to **consented + child-PII-redacted**; compute pos/neg/neutral ratio per week; pick rotating **quote-of-week** from consented pool | Qualitative feed; sentiment trend per week; quote-of-week → also a Module 1 Home widget; escalations list |
| **9e Feedback-to-marketing loop** | Operator-entered items (category ∈ messaging gap / persona mismatch / objection pattern / positive signal / urgent) | Persist `marketing_feedback`; if actionable → render chip in Nurture (Module 5) + **submit** to Decision Queue (Module 11) as Operator; compute closure_rate = actioned≤7d ÷ flagged | `marketing_feedback` rows; Nurture chip; `decisions` submission; closure-rate metric |

**Cross-cutting:** SSOT (funnel_stage→`app_form`; voice→Conversations); dedup at ingest (one thread ≠ many objections); RBAC (Operator submit-not-view on the queue); data-confidence banner on this HubSpot-consuming module; cross-link in/out edges (§4); every screen has empty/loading/error/duplicate states.

## 3. Data model touchpoints (additive only — NO backbone edits)

Reads: `families` (funnel_stage, match_key, id), `parity_snapshot`, `decisions`.
New additive migration `supabase/migrations/0003_admissions_voc.sql` (5 tables; grants `app_rw` r/w, `staff_ro` read; register in `lib/dev/catalog.ts` with PII tags on verbatim/quote columns):

**`objection`** (global; one surfaced objection = one tagged span)
| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `theme` | text | enum: `accreditation`/`cost`/`gifted_enough`/`scheduling`/`curriculum`/`social`/`tech`/`other` (closed PRD set) |
| `verbatim` | text | example quote (PII-tagged) |
| `source` | text | `hubspot_conversations`/`bdr_note`/`event`/`form`/`shadow_day_survey`/`read_ai` |
| `source_ref` | text | thread/message id or manual ref — **dedup anchor** so re-surfaced threads don't inflate |
| `theme_confidence` | numeric | auto-theming confidence; supports re-tag + spot-check |
| `retagged_by` | text nullable | audit: human override |
| `sentiment` | text nullable | pos/neg/neutral |
| `family_id` | uuid → `families.id` nullable | resolved via matchKey |
| `surfaced_at` | timestamptz | drives this-week + 4-wk trend |
| `created_at` | timestamptz | |

**`content_brief`** (global; the objection→content bridge payload → Module 3)
| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `objection_theme` | text **unique while status=open** | idempotent: one open brief per theme |
| `verbatim_examples` | jsonb | array of representative quotes (consent-checked) |
| `suggested_angle` | text | content angle |
| `target_persona` | text | persona |
| `urgency` | text | `normal`/`high` |
| `status` | text | `open`→`in_production`→`published`→`closed` (mirrors Content) |
| `content_ref` | text nullable | links to produced piece (Module 3) |
| `freq_before` | int nullable | theme freq at brief creation (pre/post denominator) |
| `freq_after` | int nullable | theme freq after `published_at` (window-bounded) |
| `published_at` | timestamptz nullable | starts the objection→resolution clock |
| `created_at` | timestamptz | |

**`family_quote`** (global; Voice of Families feed — consent-gated)
| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `quote` | text | verbatim (PII-tagged) |
| `sentiment` | text | pos/neg/neutral (weekly ratio) |
| `source` | text | as `objection.source` |
| `family_id` | uuid → `families.id` nullable | |
| `consent` | boolean not null default false | **no public/Home surface unless true** (Schwartz) |
| `redacted` | boolean default false | child-PII removed for public display |
| `quote_of_week` | boolean default false | rotating pick (from consented pool only) |
| `captured_at` | timestamptz | |

**`marketing_feedback`** (global; feedback-to-marketing loop)
| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `category` | text | `messaging_gap`/`persona_mismatch`/`objection_pattern`/`positive_signal`/`urgent` |
| `note` | text | what marketing needs to know |
| `actionable` | boolean | drives Nurture chip + Decision Queue submission |
| `decision_id` | uuid → `decisions.id` nullable | set when submitted to Module 11 |
| `status` | text | `open`→`actioned`/`dismissed` |
| `flagged_at` | timestamptz | closure-rate clock start |
| `actioned_at` | timestamptz nullable | closure_rate = actioned≤7d ÷ flagged |

**`family_flag`** (global; inbound hot-family cross-link consumed here)
| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `family_id` | uuid → `families.id` | |
| `origin_module` | text | `nurture`/`grassroots` (who flagged) |
| `reason` | text | why hot |
| `status` | text | `open`/`acknowledged` |
| `created_at` | timestamptz | renders as chip on 9a/9d |

## 4. Cross-module contracts

**Inbound (consumed):**
- **Hot family flagged in Nurture/Grassroots → chip in Admissions/VoC.** Trigger: a row in `family_flag` (origin `nurture`/`grassroots`). Rendered as a hot-family chip on 9a + 9d. (PRD cross-module rule, line 1205.)

**Outbound (emitted):**
- **Top objection → auto content brief in Content (Module 3).** Trigger: theme qualifies (freq/trend). Payload: **`{ objection_theme, verbatim_examples[], suggested_angle, target_persona, urgency }`** → `content_brief` (idempotent: one open brief per theme), surfaced in Module 3 as "brief from admissions." Tracks **bridge hit-rate** (sent→produced) + objection-frequency delta after `published_at`. (Line 1204.)
- **Feedback-to-marketing → chip in Nurture (Module 5) + Decision Queue (Module 11).** Trigger: `marketing_feedback.actionable=true`. Nurture renders a chip; if urgent/actionable the Operator **submits** a `decisions` row (submit-only RBAC). Closure rate = actioned≤7d ÷ flagged. (Lines 890–896.)
- **Quote-of-week → Home widget (Module 1).** Trigger: `family_quote.quote_of_week=true` AND `consent=true`. Home pulls only consented + redacted quotes. (Lines 886, 928.)

**Cross-cutting:** sync-parity drop → shared data-confidence banner on this module (consumes HubSpot Conversations).

## 5. Files to build (additive — mapped to real paths)

| File | Purpose |
|---|---|
| `hub/supabase/migrations/0003_admissions_voc.sql` | `objection` + `content_brief` + `family_quote` + `marketing_feedback` + `family_flag` + grants |
| `hub/lib/admissions/themes.ts` | closed theme enum + auto-theme suggest + `theme_confidence` + re-tag helper |
| `hub/lib/admissions/ingest.ts` | normalize Conversations/manual/app_form/Read.ai → `objection`/`family_quote`; dedup via `source_ref` + `processed_events`; matchKey → `family_id` |
| `hub/lib/admissions/metrics.ts` | single defs: weekly + cumulative freq, 4-wk trend arrow, objection→resolution time, bridge hit-rate, sentiment ratio, closure rate |
| `hub/lib/admissions/bridge.ts` | idempotent `content_brief` stub from a qualifying theme + pre/post freq delta (window + denominator) |
| `hub/app/m/admissions/page.tsx` | module shell + tab bar (5 sub-views) + data-confidence banner |
| `hub/app/m/admissions/_components/Overview.tsx` | 9a composable widgets + hot-family chips |
| `hub/app/m/admissions/_components/ObjectionLog.tsx` | 9b sortable/filterable table + trend arrows + re-tag |
| `hub/app/m/admissions/_components/ContentBridge.tsx` | 9c brief stubs + hit-rate + resolution time |
| `hub/app/m/admissions/_components/VoiceOfFamilies.tsx` | 9d feed + sentiment + quote-of-week (consent-gated) |
| `hub/app/m/admissions/_components/FeedbackLoop.tsx` | 9e flag form + chip/queue submission + closure rate |
| `hub/app/_components/QuoteOfWeekWidget.tsx` | Home (Module 1) widget — consented quotes only |
| `hub/lib/dev/catalog.ts` (extend) | register 5 new tables w/ zone + PII field tags |
| `hub/lib/seed/generate.ts` (extend) | seed objections across all 8 themes incl. **re-surfaced thread** + **multi-objection thread** + **unconsented quote** + **missing UTM/family** edge cases |
| `hub/lib/seed/invariants.ts` (extend) | new invariants (§6) |
| `hub/tests/admissions.test.ts` | dedup, theme closure, idempotent bridge, consent gate, closure-rate math, RBAC denial |

## 6. Provable invariants (against seeded data)

1. **No double-count:** N Conversations messages from one thread (same `source_ref`) → at most the tagged objections in that thread; re-delivery is a no-op (`processed_events`); frequency does not inflate.
2. **Theme closure:** every `objection.theme` ∈ the 8-value PRD set; the verbatim **"is my kid gifted enough"** maps to `gifted_enough`, never silently to `other`.
3. **Pipeline SSOT:** Overview admission numbers (applicants/Shadow Days/offers/deposits) equal counts derived from `families.funnel_stage` — not HubSpot lifecycle.
4. **Bridge idempotency + honesty:** a qualifying theme stubs exactly one **open** `content_brief`; "effectiveness" is a stored `freq_before`/`freq_after` pre/post delta with its window, labeled correlational — never a hard-coded "content fixed it."
5. **Consent gate:** no `family_quote` with `consent=false` appears in Voice-of-Families public view or the Home quote-of-week widget.
6. **Closure rate computable:** `closure_rate = count(actioned within 7d) ÷ count(flagged)` from `marketing_feedback` rows; every actionable item has a Nurture chip and (if urgent) a `decisions` submission.
7. **RBAC denial:** an Operator can submit a feedback item to the Decision Queue but **cannot** view or decide queue items.
8. **Cross-link fired:** a `family_flag` from Nurture/Grassroots renders a hot-family chip on 9a/9d.
9. **Trend correctness:** the 4-wk trend arrow (↑→↓) matches the sign of (this-period freq − prior-period freq) per theme.

## 7. Demo script (clickable)

1. Open **Admissions → Objection log**: see themes ranked by frequency with ↑→↓ 4-wk arrows and a verbatim each; filter to `gifted_enough` and read the quote.
2. Re-ingest the same Conversations thread → frequency **does not** change (dedup).
3. On the top theme, hit **Send brief** (9c) → a `content_brief` stubs once with {theme, verbatim[], angle, persona, urgency}; open **Module 3** and see it as "brief from admissions"; re-click → no duplicate.
4. Mark that brief **published** → 9c shows objection→resolution time + a pre/post frequency **delta labeled correlational**, and **bridge hit-rate** ticks up.
5. **Voice of Families** (9d): rotating quote-of-week shows; an **unconsented** quote is absent from the feed and the Home widget (consent gate).
6. **Feedback loop** (9e): flag "messaging gap / urgent" → a chip appears in **Nurture**, the item is **submitted** to the Decision Queue; as Operator, confirm you **cannot view/decide** the queue; closure-rate metric updates.
7. A **hot-family flag** raised in Nurture appears as a chip on the Overview.

## 8. Open questions / assumptions

- **Assumption:** admission pipeline numbers map to `families.funnel_stage` values `applicant`/`shadow_day`/`deposit` (Shadow Days completed counted from `shadow_day`); "offers extended" has no funnel_stage value yet → **open:** add an `offer` stage vs track via a manual field.
- **Assumption:** auto-theming suggests theme + `theme_confidence`; humans may re-tag (audit retained). Sentiment model (lexicon vs LLM) is **open** and must carry an audit story (Rahman/Park).
- **Assumption:** Read.ai transcripts are optional/secondary and may be **out of scope for v1**; if included they normalize into the same `objection`/`family_quote` shape with `source=read_ai`.
- **Assumption:** "qualifying theme" for the bridge = top-N by frequency or a rising trend; exact threshold is **open** (set with the Content Owner).
- **Assumption:** bridge effectiveness is reported **correlational** (pre/post delta + window + denominator); a holdout/control is a future enhancement, not claimed now (Rahman).
- **Open:** retention window + minimization policy for raw verbatims and quotes carrying minors' PII (Schwartz) — set before any real (non-seed) data persists.
- **Assumption:** `family_flag` is written by Modules 2/5; Module 9 only reads it. If those modules ship a different flag table, point this consumer at it (no duplicate).
