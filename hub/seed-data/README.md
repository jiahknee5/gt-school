# Seed fixtures

Deterministic, generated fixtures for the GT Marketing Hub. **Do not hand-edit** —
they are produced from `hub/lib/seed/` by a seeded generator, so the same seed
always yields byte-identical files. This is the "clean known state" for walkthroughs.

```bash
npm run seed:fixtures     # regenerate every *.json + manifest.json here, then validate
npm run seed:validate     # run invariants only (no writes)
npm run seed:fixtures -- --sql   # also emit load.sql (admin reset+load; git-ignored)
npm run seed:fixtures -- --families 2000 --seed 7 --weeks 16
```

`npm run seed` loads the **live** Supabase DB (RLS-true). `npm run seed:fixtures`
writes the offline JSON under `seed-data/`.

`manifest.json` is the source of truth for **what is real vs. stood-in**, the seed,
the row counts, and which deliberate edge cases are present.

## Real (loads straight into Supabase — mirrors `0001_backbone.sql`)

`programs, families, children, program_membership, enrollments, payments,
field_state, parity_snapshot, data_quality_issue, budget_workstream, budget_entry,
decisions, processed_events, sync_event_log, sync_outbox, sync_identity_map`

These reach real systems in production (HubSpot ⇄ `families`/`enrollments`,
Stripe ⇄ `payments`, the Hub DB owns budget/decisions/parity).

## Stood-in (clearly labeled — every row carries `_standIn: true` + `_source`)

`meta_insights (Meta), ga4_days (GA4), x_posts (X), content_sheet (Google Sheets),
summer_site_registrations (summer.gt.school), registration_form_entries,
community_ambassadors (community.gt.school), hubspot_ambassadors,
integration_accounts, integration_sync_runs`

`integration_accounts` is the Admin/data-dictionary registry for every PRD source
and the necessary inferred GT Challenge capture source. Each row documents why the
source matters, what it is authoritative for, which modules consume it, join keys,
privacy notes, freshness, status, and known gaps. `integration_sync_runs` provides
a recent trace row per source so deferred/degraded/manual states are visible.

## Deliberate edge cases (asserted by `lib/seed/invariants.ts`)

Duplicate family (same match_key), a family in two programs, a failed→late
succeeded payment retry, a refund, a duplicated Stripe webhook (idempotency),
CRM↔app field conflicts, a parity dip below the 95% banner threshold, a mojibake
name, a phone-only (missing email) family, broken UTM attribution, a dual-source
duplicate + a dual-source conflict across summer.gt.school and the registration
form, an ambassador status conflict across community.gt.school and HubSpot, and a
**Meta over-reporting attribution gap** (Meta leads > CRM meta-sourced families).

## Stand-in API shapes (joinable, swappable for live)

| Source | Grain | Join key | Real API fields mirrored |
|--------|-------|----------|--------------------------|
| **Meta** | campaign × date × platform | `utm_campaign` | `campaign_id`, `spend`, `impressions`, `reach`, `clicks`, `ctr`, `cpc`, `actions[]`, `attribution_window` |
| **GA4** | date × site × campaign × landing page | `utm_campaign` | `sessionDefaultChannelGroup`, `sessionSourceMedium`, `landingPage`, `sessions`, `eventCount_generate_lead`, … |
| **X** | one row per tweet | `utm_campaign` (in link) | `id`, `public_metrics`, `non_public_metrics.url_link_clicks` |
| **summer.gt.school** | one row per registration | `match_key` | `registration_id`, `status`, `paid`, `session_start`, `campus_key`, UTM triple |
| **Integration registry** | one row per source / sync run | `integration_id`, module join keys | `status`, `synthetic_mode`, `authoritative_for`, `known_gaps`, sync-run volumes |

CRM `families` carry `utm_source`, `utm_medium`, `utm_campaign` (from `app_form` /
HubSpot analytics) so attribution dashboards can join: **X link_clicks → GA4
sessions → Meta spend → CRM families** on the same `utm_campaign`.

Campaign catalog: `lib/seed/campaigns.ts`.

The numbers follow the spec's shapes: a $365,000 budget (with one workstream
deliberately >10% over plan → auto-flagged to the Decision Queue), income as the
master conversion variable ($160K+ ≈ 25%), the K–2 grade sweet spot, and the
"follows Alpha on X" conviction tell (~27% among converters).
