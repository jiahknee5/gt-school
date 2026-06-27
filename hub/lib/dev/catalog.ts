/**
 * Dev catalog — the single source of truth for the in-app Developer section
 * (/dev). Documents WHERE data lives, WHAT each table/source is, and a
 * field-level data dictionary. Kept in sync by hand with:
 *   - hub/supabase/migrations/0001_backbone.sql  (real tables)
 *   - hub/lib/seed/types.ts                       (record shapes)
 *   - hub/lib/seed/campaigns.ts                   (UTM join spine)
 *
 * Pure data, no React — consumed by app/dev/*.
 */

export type Zone = "global" | "scoped" | "machinery" | "standin";

export type FieldTag =
  | "pk"
  | "fk"
  | "key"
  | "app" // app_form-authoritative
  | "hs" // HubSpot-authoritative
  | "fixture" // exists in fixtures only, not the backbone migration
  | "idem" // idempotency / dedupe
  | "rls"; // RLS isolation scope

export interface FieldDef {
  name: string;
  type: string;
  note: string;
  tags?: FieldTag[];
}

export interface TableDef {
  name: string;
  zone: Zone;
  title: string;
  /** Where the truth for this table comes from. */
  sourceOfTruth: string;
  why: string;
  fields: FieldDef[];
  relationships?: string[];
}

export const ZONE_META: Record<Zone, { label: string; blurb: string; tint: string }> = {
  global: {
    label: "Global (the who)",
    blurb: "CRM-wide people + programs. Staff see everyone. Mirrors HubSpot.",
    tint: "bg-blue-soft text-blue",
  },
  scoped: {
    label: "Program-scoped (the what)",
    blurb: "Purchases locked per program by Postgres RLS + FORCE. A query in one program cannot see another's rows.",
    tint: "bg-green-soft text-green",
  },
  machinery: {
    label: "Machinery (the trust layer)",
    blurb: "Sync authority, parity, idempotency, budget, decisions — how the picture stays honest across systems.",
    tint: "bg-violet-soft text-violet",
  },
  standin: {
    label: "Stood-in sources",
    blurb: "Channels with no live API in the build. Every row tagged _standIn + _source. Joinable, swappable for live.",
    tint: "bg-amber-soft text-amber",
  },
};

export const TAG_META: Record<FieldTag, { label: string; tint: string }> = {
  pk: { label: "PK", tint: "bg-fill text-slate" },
  fk: { label: "FK", tint: "bg-fill text-slate" },
  key: { label: "join key", tint: "bg-blue-soft text-blue" },
  app: { label: "app-authoritative", tint: "bg-green-soft text-green" },
  hs: { label: "HubSpot-authoritative", tint: "bg-violet-soft text-violet" },
  fixture: { label: "fixture-only", tint: "bg-amber-soft text-amber" },
  idem: { label: "idempotency", tint: "bg-red-soft text-red" },
  rls: { label: "RLS scope", tint: "bg-green-soft text-green" },
};

// ============================ data stores ============================

export interface DataStore {
  id: string;
  name: string;
  path: string;
  what: string;
  populate: string;
  runtimeReadByApp: boolean;
}

export const DATA_STORES: DataStore[] = [
  {
    id: "fixtures",
    name: "Committed JSON fixtures",
    path: "hub/seed-data/*.json",
    what: "Full deterministic dataset — every real table + every stood-in source, plus manifest.json (seed, counts, edge-case list, real vs stood-in labels). Git-tracked, the clean known state for walkthroughs and tests.",
    populate: "npm run seed:fixtures",
    runtimeReadByApp: false,
  },
  {
    id: "supabase",
    name: "Live Supabase (Postgres)",
    path: "hub/supabase/migrations/0001_backbone.sql",
    what: "The real CRM/backbone data model: families, children, enrollments, payments (RLS-scoped), field_state, parity_snapshot, budget_workstream, decisions, and the sync tables. Meta/GA4/X/summer are NOT tables here — they stay stood-in.",
    populate: "npm run seed  (needs APP_RW_DATABASE_URL in .env.local)",
    runtimeReadByApp: true,
  },
  {
    id: "generator",
    name: "Generator code",
    path: "hub/lib/seed/",
    what: "Where the data is DEFINED, not stored: generate.ts (builds the dataset), types.ts (shapes), campaigns.ts (UTM catalog), dictionaries.ts (distributions), invariants.ts (validators).",
    populate: "edit + re-run a seed command",
    runtimeReadByApp: false,
  },
];

// ============================ data sources ============================

export interface SourceRow {
  system: string;
  kind: "real" | "standin" | "external" | "manual" | "deferred";
  tables: string;
  joinKey: string;
  grain: string;
  note: string;
  why: string;
}

export const SOURCES: SourceRow[] = [
  { system: "Supabase app_form", kind: "real", tables: "families, children, program_membership, enrollments", joinKey: "family_id, match_key, program_id, utm_campaign", grain: "family / child / program membership", note: "App-authoritative funnel, TEFA, income, grade, and program-scoped records.", why: "The dashboard's conversion math depends on the app source of truth, not unreliable HubSpot mirror fields." },
  { system: "HubSpot CRM", kind: "real", tables: "families, enrollments, field_state", joinKey: "hubspot_contact_id, hubspot_deal_id, match_key", grain: "contact / deal / synced field", note: "CRM source for lifecycle, lead_score, source, email engagement, and pipeline.", why: "Staff work in HubSpot, while the Hub proves which fields can be trusted and which must yield to app_form." },
  { system: "HubSpot Conversations", kind: "standin", tables: "sms_threads, objections, family_quotes", joinKey: "family_id, thread_id, source_ref", grain: "conversation / theme", note: "Admissions and Nurture voice-of-customer inputs.", why: "Family questions and objections drive content, follow-up, and hot-family escalation decisions." },
  { system: "HubSpot Sequences", kind: "standin", tables: "sequences, sequence_steps, email_events", joinKey: "seq_id, hubspot_contact_id", grain: "sequence / step", note: "Read-only sequence health and conversion view.", why: "Nurture performance is a primary PRD signal and should not require operators to reconcile HubSpot manually." },
  { system: "HubSpot Reporting API", kind: "standin", tables: "report_widgets, saved_filters", joinKey: "hubspot_report_id, source", grain: "saved report widget", note: "Dashboard mirror for leadership meeting rows.", why: "Leadership sees HubSpot dashboard context beside Hub-owned metrics without logging into another system." },
  { system: "Stripe", kind: "real", tables: "payments, processed_events, sync_event_log", joinKey: "stripe_payment_intent_id, stripe_event_id, program_id", grain: "payment intent / event", note: "Money facts. Intent id is unique = idempotency layer.", why: "Phase 1 only works if payments replay, retry, refund, and stay isolated to the right program." },
  { system: "Open Data (TEA)", kind: "external", tables: "district_ratings, finance_rows, county_enrichment", joinKey: "county, district, year", grain: "district / county / year", note: "Read-only enrichment via live API, cache, and fixture fallback.", why: "A public-school signal must be able to change a decision instead of acting as decorative context." },
  { system: "Meta Business Suite", kind: "standin", tables: "meta_insights", joinKey: "utm_campaign, campaign_id, publisher_platform", grain: "campaign x date x platform", note: "Marketing API shape. Leads deliberately over-report vs CRM.", why: "Paid-social spend and platform leads must reconcile against CRM so CAC conversations stay honest." },
  { system: "X API", kind: "standin", tables: "x_posts", joinKey: "utm_campaign, tweet_id", grain: "one row per post", note: "API v2 metrics. One stale connector is intentional.", why: "The PRD treats X as a conviction channel, so it must remain separate from Meta and visibly stale when stale." },
  { system: "GA4 - gt.school", kind: "standin", tables: "ga4_days", joinKey: "utm_campaign, landingPage, site", grain: "date x site x campaign x landing page", note: "Public site sessions, pages, PDF downloads, and conversions.", why: "Public-site demand has to reconcile with UTM capture and content performance, not live as vanity traffic." },
  { system: "GA4 - anywhere.gt.school", kind: "standin", tables: "ga4_days", joinKey: "utm_campaign, landingPage, site", grain: "date x site x campaign x landing page", note: "Product site sessions and lead events as a separate property.", why: "Cross-site totals should be summed intentionally and not double-counted across linked properties." },
  { system: "Google Sheets", kind: "standin", tables: "content_sheet", joinKey: "sheet_row_id, utm_campaign", grain: "one row per content piece", note: "Content Owner production tracker.", why: "The production sheet is the PRD source of truth for content status, owner, target date, and planned UTM." },
  { system: "summer.gt.school", kind: "standin", tables: "summer_site_registrations", joinKey: "match_key, registration_id, program_id", grain: "one row per registration", note: "Transactional camp source reconciled against form and deals.", why: "Summer Camp is the clearest dual-source reconciliation test and ties directly to Phase 1 isolation." },
  { system: "Registration form", kind: "standin", tables: "registration_form_entries", joinKey: "match_key, form_id", grain: "one row per submission", note: "Alternate camp intake path.", why: "Without this feed, duplicate camp signups would inflate capacity, revenue, and conversion numbers." },
  { system: "GT Challenge capture", kind: "standin", tables: "gifted_quiz_submissions, gifted_quiz_leads", joinKey: "utm_campaign, match_key, campaign_key", grain: "submission / deduped lead", note: "Public quiz capture, scoring, and qualified-lead routing.", why: "This campaign closes the loop from spend to capture to CRM lead to Fall Enrollment routing and CPQL." },
  { system: "community.gt.school", kind: "standin", tables: "community_ambassadors, hubspot_ambassadors", joinKey: "match_key, community_id, hubspot_contact_id", grain: "one row per ambassador", note: "Dual-source ambassador reconciliation.", why: "Grassroots counts and referral performance are not trustworthy unless community and HubSpot are collapsed by person." },
  { system: "Hub manual workflows", kind: "manual", tables: "budget_entry, budget_workstream, decisions, field_events, resources", joinKey: "workstream_key, decision_id, event_id, resource_id", grain: "manual operating fact", note: "Hub-owned budget, decisions, field events, and linked resources.", why: "Budget and Decision Queue are systems of record inside the Hub; faking them as external sheets would break source-of-truth rules." },
  { system: "Google Drive / Docs", kind: "manual", tables: "resources, linked_docs", joinKey: "resource_id, url", grain: "document link", note: "Resource Library links, visibility, provenance, and link health.", why: "Operators need to trust which shared assets are current, visible, and safe to use." },
  { system: "Substack", kind: "manual", tables: "manual_audience", joinKey: "channel", grain: "weekly channel rollup", note: "Manual v1 newsletter audience.", why: "The channel matters in content summaries, but a full connector is not justified before core CRM and payment data are solid." },
  { system: "Podcast platform", kind: "manual", tables: "manual_audience", joinKey: "channel", grain: "weekly channel rollup", note: "Manual v1 podcast listens.", why: "The channel belongs in high-level summaries, but manual entry is enough until it affects budget decisions." },
  { system: "Read.ai", kind: "deferred", tables: "call_transcripts", joinKey: "meeting_id, family_id", grain: "transcript", note: "Optional admissions transcript enrichment.", why: "Useful for family voice, but the PRD makes Conversations and manual notes primary, so it stays out of the critical path." },
  { system: "Reconnectext", kind: "deferred", tables: "sms_send_rate", joinKey: "phone, message_id", grain: "message metric", note: "Known unmeasurable SMS send-rate gap.", why: "The PRD explicitly names this as a measurement hole; the Hub should show the gap rather than fake a green source." },
];

// ============================ architecture ============================

export const UTM_THREAD = [
  "X tweet (utm_campaign in link) → non_public_metrics.url_link_clicks",
  "→ GA4 sessions (same utm_campaign)",
  "→ Meta spend + (inflated) leads (same utm_campaign)",
  "→ CRM families (utm_campaign + source)",
];

export const RECONCILE_THREAD = [
  "summer.gt.school registration (match_key)",
  "⇄ registration form (match_key)  → collapse duplicates, flag week conflicts",
  "→ enrollments (program = summer_camp) → payments",
];

// ============================ edge cases ============================

export interface EdgeCase {
  key: string;
  label: string;
  proves: string;
}

export const EDGE_CASES: EdgeCase[] = [
  { key: "duplicate_family", label: "Duplicate family", proves: "Same match_key on two rows → identity resolution must merge." },
  { key: "family_in_two_programs", label: "Family in two programs", proves: "Membership keeps summer + fall isolated for one family." },
  { key: "failed_payment", label: "Failed payment", proves: "A failed intent precedes a later success on one enrollment." },
  { key: "late_payment", label: "Late payment", proves: "Succeeded retry lands weeks after the failure." },
  { key: "refunded_payment", label: "Refund", proves: "Terminal state; status_rank never regresses." },
  { key: "duplicate_stripe_event", label: "Duplicate Stripe webhook", proves: "Event delivered 2× → logged twice, ledgered once (idempotent)." },
  { key: "crm_app_conflict", label: "CRM ↔ app conflict", proves: "field_state app_value ≠ hs_value → conflict + parity drop." },
  { key: "parity_dip_below_threshold", label: "Parity dip < 95%", proves: "Week-6 snapshot trips the data-confidence banner." },
  { key: "mojibake_name", label: "Mojibake name", proves: "UTF-8 mis-decode survives the pipeline (José → JosÃ©)." },
  { key: "missing_email", label: "Missing email", proves: "Phone-only intake → match_key falls back to phone." },
  { key: "broken_utm_source", label: "Broken UTM", proves: "Null/garbage source → attribution gap surfaced, not hidden." },
  { key: "dual_source_duplicate", label: "Dual-source duplicate", proves: "Same camp signup on site + form → dedup to one." },
  { key: "dual_source_conflict", label: "Dual-source conflict", proves: "Same person, different weeks across the two feeds." },
  { key: "ambassador_conflict", label: "Ambassador conflict", proves: "community.gt.school status ≠ HubSpot status." },
  { key: "attribution_gap", label: "Attribution gap", proves: "Meta-reported leads > CRM meta-sourced families." },
];

// ============================ commands ============================

export interface Command {
  cmd: string;
  what: string;
}

export const COMMANDS: Command[] = [
  { cmd: "npm run seed:fixtures", what: "Regenerate seed-data/*.json + manifest, then validate invariants." },
  { cmd: "npm run seed:validate", what: "Run invariants only (no writes)." },
  { cmd: "npm run seed:fixtures -- --sql", what: "Also emit load.sql (admin reset+load; git-ignored)." },
  { cmd: "npm run seed:fixtures -- --families 2000 --seed 7 --weeks 16", what: "Override volume / seed / window." },
  { cmd: "npm run seed", what: "Load the LIVE Supabase DB through RLS (needs APP_RW_DATABASE_URL)." },
  { cmd: "npm run reset", what: "Clear generated rows; keep migration seeds (programs, field_authority, budget)." },
];

// ============================ the tables ============================

export const TABLES: TableDef[] = [
  // ---------------- global ----------------
  {
    name: "programs",
    zone: "global",
    title: "The two products",
    sourceOfTruth: "Hub (migration seed)",
    why: "The isolation key. Every purchase row is tagged with which program it belongs to.",
    fields: [
      { name: "id", type: "uuid", note: "Primary key.", tags: ["pk"] },
      { name: "key", type: "text", note: "summer_camp | fall_enrollment.", tags: ["key"] },
      { name: "name", type: "text", note: "Display name." },
    ],
  },
  {
    name: "families",
    zone: "global",
    title: "= HubSpot contact (the parent)",
    sourceOfTruth: "HubSpot ⇄ app_form (split authority)",
    why: "The heart of the funnel. Segments, dashboards, and conversion math all read from here. Two columns of fields — app-authoritative vs HubSpot-authoritative — are WHY the whole machinery layer exists.",
    relationships: ["children.family_id → families.id", "enrollments.family_id → families.id", "payments.family_id → families.id"],
    fields: [
      { name: "id", type: "uuid", note: "Primary key.", tags: ["pk"] },
      { name: "hubspot_contact_id", type: "text", note: "HubSpot contact id (null until synced).", tags: ["key"] },
      { name: "email", type: "text", note: "Primary identity signal.", tags: ["app"] },
      { name: "phone", type: "text", note: "Fallback identity signal." },
      { name: "first_name", type: "text", note: "Parent first name." },
      { name: "last_name", type: "text", note: "Parent last name." },
      { name: "funnel_stage", type: "text", note: "lead | applicant | shadow_day | deposit | waitlisted.", tags: ["app"] },
      { name: "tefa_status", type: "text", note: "esa_planned | esa_ineligible | no_indicator. HubSpot copy unreliable.", tags: ["app"] },
      { name: "income_band", type: "text", note: "The master conversion variable ($160K+ ≈ 25%).", tags: ["app"] },
      { name: "grade", type: "text", note: "Child grade band; K–2 is the sweet spot.", tags: ["app"] },
      { name: "lifecycle_stage", type: "text", note: "HubSpot lifecycle (subscriber…customer).", tags: ["hs"] },
      { name: "lead_score", type: "int", note: "HubSpot score; a few null (data gap).", tags: ["hs"] },
      { name: "source", type: "text", note: "Acquisition source; UTM attribution unreliable.", tags: ["hs"] },
      { name: "utm_source", type: "text", note: "Attribution join key into Meta/GA4/X.", tags: ["key", "fixture"] },
      { name: "utm_medium", type: "text", note: "Attribution medium.", tags: ["fixture"] },
      { name: "utm_campaign", type: "text", note: "Joins to meta_insights / ga4_days / x_posts.", tags: ["key", "fixture"] },
      { name: "match_key", type: "text", note: "Identity resolution: email→phone→name+zip, hashed.", tags: ["key"] },
      { name: "row_version", type: "int", note: "Optimistic-concurrency counter." },
      { name: "app_updated_at", type: "timestamptz", note: "Last app write." },
      { name: "hs_updated_at", type: "timestamptz", note: "Last HubSpot write." },
      { name: "last_synced_at", type: "timestamptz", note: "Null = never synced (no parity baseline yet)." },
      { name: "created_at", type: "timestamptz", note: "Row creation." },
    ],
  },
  {
    name: "children",
    zone: "global",
    title: "Camp seats count children, not families",
    sourceOfTruth: "app_form",
    why: "A family with two kids = two enrollments. Counting only parents undercounts capacity.",
    relationships: ["family_id → families.id"],
    fields: [
      { name: "id", type: "uuid", note: "Primary key.", tags: ["pk"] },
      { name: "family_id", type: "uuid", note: "Owning family.", tags: ["fk"] },
      { name: "first_name", type: "text", note: "Child first name." },
      { name: "grade", type: "text", note: "Child grade." },
      { name: "created_at", type: "timestamptz", note: "Row creation." },
    ],
  },
  // ---------------- scoped ----------------
  {
    name: "program_membership",
    zone: "scoped",
    title: "Who is in which program",
    sourceOfTruth: "Hub (derived from connectors)",
    why: "A family can be in BOTH programs at once; membership keeps those worlds separate. RLS-protected.",
    relationships: ["program_id → programs.id", "family_id → families.id", "child_id → children.id"],
    fields: [
      { name: "id", type: "uuid", note: "Primary key.", tags: ["pk"] },
      { name: "program_id", type: "uuid", note: "RLS scope — query in one program can't see another's.", tags: ["fk", "rls"] },
      { name: "program_key", type: "text", note: "Convenience label in fixtures (not a DB column).", tags: ["fixture"] },
      { name: "family_id", type: "uuid", note: "Member family.", tags: ["fk"] },
      { name: "child_id", type: "uuid", note: "Member child (optional).", tags: ["fk"] },
      { name: "status", type: "text", note: "active | …" },
      { name: "source", type: "text", note: "Which connector introduced it." },
      { name: "joined_at", type: "timestamptz", note: "Membership start." },
    ],
  },
  {
    name: "enrollments",
    zone: "scoped",
    title: "= HubSpot deal",
    sourceOfTruth: "HubSpot deal",
    why: "The pipeline + revenue picture: what's sold, at what stage, for how much. RLS-protected.",
    relationships: ["program_id → programs.id", "family_id → families.id", "payments.enrollment_id → enrollments.id"],
    fields: [
      { name: "id", type: "uuid", note: "Primary key.", tags: ["pk"] },
      { name: "program_id", type: "uuid", note: "RLS scope.", tags: ["fk", "rls"] },
      { name: "program_key", type: "text", note: "Fixture convenience label.", tags: ["fixture"] },
      { name: "family_id", type: "uuid", note: "Owning family.", tags: ["fk"] },
      { name: "child_id", type: "uuid", note: "Seat (optional).", tags: ["fk"] },
      { name: "hubspot_deal_id", type: "text", note: "HubSpot deal id.", tags: ["key"] },
      { name: "stage", type: "text", note: "Deal stage." },
      { name: "amount", type: "numeric", note: "Deal value (fall tuition / camp price)." },
      { name: "paid", type: "boolean", note: "Whether a succeeded payment exists." },
      { name: "created_at", type: "timestamptz", note: "Row creation." },
    ],
  },
  {
    name: "payments",
    zone: "scoped",
    title: "= Stripe",
    sourceOfTruth: "Stripe",
    why: "Money must be exactly-once and never regress. Duplicate webhooks and out-of-order events are normal; the schema makes double-charging impossible. RLS-protected.",
    relationships: ["program_id → programs.id", "enrollment_id → enrollments.id", "family_id → families.id"],
    fields: [
      { name: "id", type: "uuid", note: "Primary key.", tags: ["pk"] },
      { name: "program_id", type: "uuid", note: "RLS scope.", tags: ["fk", "rls"] },
      { name: "program_key", type: "text", note: "Fixture convenience label.", tags: ["fixture"] },
      { name: "family_id", type: "uuid", note: "Payer family.", tags: ["fk"] },
      { name: "enrollment_id", type: "uuid", note: "Billed enrollment.", tags: ["fk"] },
      { name: "stripe_payment_intent_id", type: "text", note: "UNIQUE — the business-fact idempotency layer.", tags: ["key", "idem"] },
      { name: "stripe_event_id", type: "text", note: "Webhook event id.", tags: ["idem"] },
      { name: "amount", type: "numeric", note: "Charged amount." },
      { name: "status", type: "text", note: "requires_payment | succeeded | refunded | failed." },
      { name: "status_rank", type: "int", note: "Monotonic guard — never regress a terminal state.", tags: ["idem"] },
      { name: "occurred_at", type: "timestamptz", note: "When the money event happened." },
      { name: "created_at", type: "timestamptz", note: "Row creation." },
    ],
  },
  // ---------------- machinery ----------------
  {
    name: "field_authority",
    zone: "machinery",
    title: "The sync rulebook",
    sourceOfTruth: "Hub (migration seed)",
    why: "For each field: who wins (app vs HubSpot) and which way it syncs. Resolves 'CRM says X, app says Y' deterministically instead of last-writer-wins chaos.",
    fields: [
      { name: "entity", type: "text", note: "e.g. family." },
      { name: "field", type: "text", note: "The synced field name." },
      { name: "authority", type: "enum", note: "app_form | hubspot | stripe | manual | none." },
      { name: "direction", type: "enum", note: "hs_to_app | app_to_hs | bidir_lww." },
      { name: "expected_unreliable", type: "boolean", note: "Field known to drift (tefa_status, income_band, source)." },
    ],
  },
  {
    name: "field_state",
    zone: "machinery",
    title: "Per-field app vs HubSpot value",
    sourceOfTruth: "Hub (computed)",
    why: "Powers the conflict list and the parity %.",
    relationships: ["entity_id → families.id (when entity = family)"],
    fields: [
      { name: "entity", type: "text", note: "Entity type." },
      { name: "entity_id", type: "uuid", note: "Entity row.", tags: ["fk"] },
      { name: "field", type: "text", note: "Field name." },
      { name: "app_value", type: "text", note: "Value in the app." },
      { name: "hs_value", type: "text", note: "Value in HubSpot." },
      { name: "app_updated_at", type: "timestamptz", note: "Last app write." },
      { name: "hs_updated_at", type: "timestamptz", note: "Last HubSpot write." },
      { name: "in_parity", type: "boolean", note: "app_value == hs_value." },
      { name: "last_checked_at", type: "timestamptz", note: "Last parity check." },
    ],
  },
  {
    name: "parity_snapshot",
    zone: "machinery",
    title: "Parity time series",
    sourceOfTruth: "Hub (computed)",
    why: "Drives the trend chart and the data-confidence banner when it dips below 95%.",
    fields: [
      { name: "id", type: "uuid", note: "Primary key.", tags: ["pk"] },
      { name: "taken_at", type: "timestamptz", note: "Snapshot time (weekly)." },
      { name: "scope", type: "text", note: "overall | per-field scope." },
      { name: "overall_pct", type: "numeric", note: "% of fields in parity." },
      { name: "fields", type: "jsonb", note: "Per-field parity map." },
    ],
  },
  {
    name: "processed_events",
    zone: "machinery",
    title: "Idempotency ledger",
    sourceOfTruth: "Hub",
    why: "The same Stripe/HubSpot webhook can arrive twice; this guarantees we act on it once. Keyed (source, event_id).",
    fields: [
      { name: "source", type: "text", note: "stripe | hubspot.", tags: ["idem"] },
      { name: "event_id", type: "text", note: "External event id.", tags: ["idem"] },
      { name: "first_seen_at", type: "timestamptz", note: "First delivery." },
      { name: "result", type: "jsonb", note: "Cached handler result." },
    ],
  },
  {
    name: "sync_event_log",
    zone: "machinery",
    title: "Replayable inbound log",
    sourceOfTruth: "Hub",
    why: "You can replay history and prove what happened — including duplicate deliveries and conflicts.",
    fields: [
      { name: "id", type: "uuid", note: "Primary key.", tags: ["pk"] },
      { name: "source_system", type: "text", note: "Origin system." },
      { name: "external_event_id", type: "text", note: "Source event id (repeats on redelivery).", tags: ["idem"] },
      { name: "entity", type: "text", note: "Affected entity." },
      { name: "entity_id", type: "uuid", note: "Affected row.", tags: ["fk"] },
      { name: "change", type: "jsonb", note: "The delta." },
      { name: "conflict", type: "boolean", note: "Flagged as a conflict." },
      { name: "received_at", type: "timestamptz", note: "Delivery time." },
      { name: "processed_at", type: "timestamptz", note: "Null on a duplicate no-op." },
    ],
  },
  {
    name: "sync_outbox",
    zone: "machinery",
    title: "Durable app→HubSpot queue",
    sourceOfTruth: "Hub",
    why: "If HubSpot is down, intent isn't lost — the change waits to be pushed.",
    fields: [
      { name: "id", type: "uuid", note: "Primary key.", tags: ["pk"] },
      { name: "aggregate_type", type: "text", note: "e.g. family." },
      { name: "aggregate_id", type: "uuid", note: "Row to push.", tags: ["fk"] },
      { name: "target_system", type: "text", note: "Destination." },
      { name: "op", type: "text", note: "Operation." },
      { name: "payload", type: "jsonb", note: "What to send." },
      { name: "dedupe_key", type: "text", note: "UNIQUE — prevents duplicate pushes.", tags: ["idem"] },
      { name: "status", type: "text", note: "pending | inflight | done | dead." },
      { name: "attempts", type: "int", note: "Retry count." },
      { name: "last_error", type: "text", note: "Most recent failure." },
      { name: "created_at", type: "timestamptz", note: "Row creation." },
    ],
  },
  {
    name: "sync_identity_map",
    zone: "machinery",
    title: "Our id ⇄ external id",
    sourceOfTruth: "Hub",
    why: "Identity resolution across systems (HubSpot/Stripe/community/summer_site).",
    fields: [
      { name: "id", type: "uuid", note: "Primary key.", tags: ["pk"] },
      { name: "local_table", type: "text", note: "Our table." },
      { name: "local_id", type: "uuid", note: "Our row.", tags: ["fk"] },
      { name: "system", type: "text", note: "External system.", tags: ["key"] },
      { name: "external_id", type: "text", note: "External id (unique per system).", tags: ["key"] },
    ],
  },
  {
    name: "data_quality_issue",
    zone: "machinery",
    title: "CRM Ops to-do list",
    sourceOfTruth: "Hub (auto-detected + manual)",
    why: "Surfaces broken UTM, sync drops, scoring gaps, tracking holes.",
    fields: [
      { name: "id", type: "uuid", note: "Primary key.", tags: ["pk"] },
      { name: "category", type: "text", note: "utm | sync | scoring | tracking | other." },
      { name: "severity", type: "text", note: "low | medium | high | blocker." },
      { name: "entity", type: "text", note: "Affected entity (optional)." },
      { name: "entity_id", type: "uuid", note: "Affected row (optional).", tags: ["fk"] },
      { name: "field", type: "text", note: "Affected field (optional)." },
      { name: "description", type: "text", note: "Human description." },
      { name: "status", type: "text", note: "open | resolved." },
      { name: "created_at", type: "timestamptz", note: "Raised." },
      { name: "resolved_at", type: "timestamptz", note: "Closed (if resolved)." },
    ],
  },
  {
    name: "budget_workstream",
    zone: "machinery",
    title: "Hub-owned budget — reconciles to $365,000",
    sourceOfTruth: "Hub (system of record)",
    why: "Plan vs committed vs actual, burn chart, and the >10% variance alert that auto-flags to the Decision Queue.",
    fields: [
      { name: "id", type: "uuid", note: "Primary key.", tags: ["pk"] },
      { name: "key", type: "text", note: "grassroots | thought_leadership | guerrilla | foundations.", tags: ["key"] },
      { name: "name", type: "text", note: "Workstream name." },
      { name: "recommended", type: "numeric", note: "Pre-loaded budget (sums to $365K)." },
      { name: "planned", type: "numeric", note: "Leadership-editable plan." },
      { name: "committed", type: "numeric", note: "Committed spend (DERIVED from budget_entry)." },
      { name: "actual", type: "numeric", note: "Actual spend (DERIVED from budget_entry)." },
    ],
  },
  {
    name: "budget_entry",
    zone: "machinery",
    title: "Budget spend ledger — append-only (Module 10)",
    sourceOfTruth: "Hub (system of record)",
    why: "The multi-owner + audit layer beneath budget_workstream: each owner enters their OWN committed/actual spend; aggregates are DERIVED from these rows. Append-only — corrections are new rows, never in-place edits. `origin` is the survivorship discriminator so campaign roll-ins (e.g. GT Challenge) are counted exactly once.",
    relationships: ["workstream_key → budget_workstream.key", "campaign_key → campaigns.key (when origin=campaign)"],
    fields: [
      { name: "id", type: "uuid", note: "Primary key.", tags: ["pk"] },
      { name: "workstream_key", type: "text", note: "Which of the 4 workstreams.", tags: ["fk", "key"] },
      { name: "kind", type: "text", note: "committed | actual." },
      { name: "origin", type: "text", note: "manual | campaign — survivorship discriminator (campaign roll-ins never hand-entered).", tags: ["idem"] },
      { name: "amount", type: "numeric", note: "The entry (corrections are NEW rows)." },
      { name: "entered_by", type: "text", note: "Role/user — audit trail.", tags: ["app"] },
      { name: "owner_role", type: "text", note: "Function owner responsible (RBAC scope check)." },
      { name: "note", type: "text", note: "Free text (optional)." },
      { name: "campaign_key", type: "text", note: "Set when origin=campaign (e.g. gifted_quiz).", tags: ["key"] },
      { name: "created_at", type: "timestamptz", note: "Immutable; powers weekly burn." },
    ],
  },
  {
    name: "decisions",
    zone: "machinery",
    title: "Decision Queue",
    sourceOfTruth: "Hub",
    why: "Async leadership approvals; budget overages auto-flag into here.",
    fields: [
      { name: "id", type: "uuid", note: "Primary key.", tags: ["pk"] },
      { name: "question", type: "text", note: "The decision/proposal." },
      { name: "raised_by", type: "text", note: "Submitter." },
      { name: "workstream", type: "text", note: "Related budget workstream." },
      { name: "recommendation", type: "text", note: "Suggested action (often Open-Data-backed)." },
      { name: "budget_ask", type: "numeric", note: "Dollar ask (optional)." },
      { name: "due_date", type: "date", note: "Decision deadline." },
      { name: "priority", type: "text", note: "normal | urgent." },
      { name: "status", type: "text", note: "open | decided | in_flight." },
      { name: "response", type: "text", note: "approve | reject | need_info." },
      { name: "response_note", type: "text", note: "Leadership note." },
      { name: "auto_flag", type: "boolean", note: "Raised by the >10% variance rule." },
      { name: "resolved_at", type: "timestamptz", note: "When decided." },
      { name: "created_at", type: "timestamptz", note: "Raised." },
    ],
  },
  {
    name: "home_layout",
    zone: "machinery",
    title: "Per-user Home widget layout",
    sourceOfTruth: "Hub (session user)",
    why: "Stores each actor's ordered widget keys and sizes so Home personalization survives a new session without owning widget metrics.",
    fields: [
      { name: "id", type: "uuid", note: "Primary key.", tags: ["pk"] },
      { name: "user_id", type: "text", note: "Signed session user id; unique per layout owner.", tags: ["key"] },
      { name: "role", type: "text", note: "admin | leader | operator at save time." },
      { name: "widgets", type: "jsonb", note: "Ordered array of {widget_key, size, order}." },
      { name: "version", type: "integer", note: "Incremented on each save." },
      { name: "updated_at", type: "timestamptz", note: "Touched automatically by trigger." },
    ],
  },
  // ---------------- stand-in ----------------
  {
    name: "meta_insights",
    zone: "standin",
    title: "Meta Marketing API",
    sourceOfTruth: "Stand-in (meta_marketing_api)",
    why: "Budget pacing, cost-per-lead, channel ROI. Meta-reported leads deliberately exceed CRM (the attribution gap).",
    relationships: ["utm_campaign → families.utm_campaign", "utm_campaign → ga4_days.utm_campaign"],
    fields: [
      { name: "_standIn", type: "true", note: "Honest stand-in marker.", tags: ["fixture"] },
      { name: "_source", type: "text", note: "meta_marketing_api.", tags: ["fixture"] },
      { name: "date", type: "date", note: "Report day (daily grain)." },
      { name: "campaign_id", type: "text", note: "Meta campaign id." },
      { name: "campaign_name", type: "text", note: "Human campaign name." },
      { name: "utm_campaign", type: "text", note: "Join key into CRM + GA4.", tags: ["key"] },
      { name: "publisher_platform", type: "text", note: "facebook | instagram." },
      { name: "spend", type: "number", note: "Daily spend." },
      { name: "impressions", type: "number", note: "Impressions." },
      { name: "reach", type: "number", note: "Unique reach." },
      { name: "clicks", type: "number", note: "Clicks." },
      { name: "ctr", type: "number", note: "Click-through rate." },
      { name: "cpc", type: "number", note: "Cost per click." },
      { name: "actions", type: "array", note: "action_type/value (incl. lead)." },
      { name: "attribution_window", type: "text", note: "7d_click | 1d_view." },
      { name: "leads", type: "number", note: "Rollup of actions[lead] (inflated vs CRM)." },
    ],
  },
  {
    name: "ga4_days",
    zone: "standin",
    title: "GA4 Data API",
    sourceOfTruth: "Stand-in (ga4_data_api)",
    why: "Top-of-funnel volume per site, which content converts. Join is fuzzy on purpose.",
    relationships: ["utm_campaign → families.utm_campaign"],
    fields: [
      { name: "_standIn", type: "true", note: "Honest stand-in marker.", tags: ["fixture"] },
      { name: "_source", type: "text", note: "ga4_data_api.", tags: ["fixture"] },
      { name: "date", type: "date", note: "Report day." },
      { name: "site", type: "text", note: "gt.school | anywhere.gt.school." },
      { name: "sessionDefaultChannelGroup", type: "text", note: "GA4 channel group." },
      { name: "sessionSourceMedium", type: "text", note: "source / medium." },
      { name: "landingPage", type: "text", note: "Entry path." },
      { name: "utm_campaign", type: "text", note: "Join key (null for organic/direct).", tags: ["key"] },
      { name: "sessions", type: "number", note: "Sessions." },
      { name: "totalUsers", type: "number", note: "Users." },
      { name: "engagedSessions", type: "number", note: "Engaged sessions." },
      { name: "screenPageViews", type: "number", note: "Pageviews." },
      { name: "conversions", type: "number", note: "Conversions." },
      { name: "eventCount_pdf_download", type: "number", note: "PDF downloads." },
      { name: "eventCount_generate_lead", type: "number", note: "Lead events (≈ CRM, not exact)." },
    ],
  },
  {
    name: "x_posts",
    zone: "standin",
    title: "X (Twitter) API v2",
    sourceOfTruth: "Stand-in (x_api_v2)",
    why: "Organic X is GT's primary channel; 'follows Alpha on X' is the conviction tell. link_clicks → GA4 sessions.",
    relationships: ["utm_campaign → ga4_days.utm_campaign"],
    fields: [
      { name: "_standIn", type: "true", note: "Honest stand-in marker.", tags: ["fixture"] },
      { name: "_source", type: "text", note: "x_api_v2.", tags: ["fixture"] },
      { name: "id", type: "text", note: "Tweet id." },
      { name: "created_at", type: "timestamptz", note: "Post time." },
      { name: "text", type: "text", note: "Tweet body (UTM in link)." },
      { name: "public_metrics", type: "object", note: "impression/like/retweet/reply/quote/bookmark." },
      { name: "non_public_metrics", type: "object", note: "url_link_clicks, user_profile_clicks." },
      { name: "utm_campaign", type: "text", note: "Join key into GA4/CRM.", tags: ["key"] },
      { name: "utm_source", type: "text", note: "twitter." },
      { name: "utm_medium", type: "text", note: "social." },
    ],
  },
  {
    name: "content_sheet",
    zone: "standin",
    title: "Google Sheets content calendar",
    sourceOfTruth: "Stand-in (google_sheets)",
    why: "The content pipeline — what's drafting/scheduled/published, and which campaign it feeds.",
    fields: [
      { name: "_standIn", type: "true", note: "Honest stand-in marker.", tags: ["fixture"] },
      { name: "_source", type: "text", note: "google_sheets.", tags: ["fixture"] },
      { name: "piece", type: "text", note: "Content title." },
      { name: "owner", type: "text", note: "Responsible person." },
      { name: "status", type: "text", note: "idea | drafting | review | scheduled | published." },
      { name: "target_date", type: "date", note: "Publish target." },
      { name: "utm_campaign", type: "text", note: "Campaign it feeds (optional).", tags: ["key"] },
    ],
  },
  {
    name: "summer_site_registrations",
    zone: "standin",
    title: "summer.gt.school registrations",
    sourceOfTruth: "Stand-in (summer_gt_school)",
    why: "A SECOND source of truth for camp signups that must reconcile against the registration form + HubSpot deals.",
    relationships: ["match_key → families.match_key", "→ enrollments (program = summer_camp)"],
    fields: [
      { name: "_standIn", type: "true", note: "Honest stand-in marker.", tags: ["fixture"] },
      { name: "_source", type: "text", note: "summer_gt_school.", tags: ["fixture"] },
      { name: "registration_id", type: "text", note: "Site registration id." },
      { name: "parent_email", type: "text", note: "Parent email." },
      { name: "parent_phone", type: "text", note: "Parent phone." },
      { name: "child_name", type: "text", note: "Child name." },
      { name: "campus", type: "text", note: "Campus name." },
      { name: "campus_key", type: "text", note: "Campus slug." },
      { name: "session_start", type: "date", note: "Session start date." },
      { name: "weeks", type: "number", note: "Weeks booked." },
      { name: "amount", type: "number", note: "Price (weeks × $1,450)." },
      { name: "paid", type: "boolean", note: "Paid on site." },
      { name: "status", type: "text", note: "pending | confirmed | cancelled | waitlisted." },
      { name: "utm_source", type: "text", note: "summer_site." },
      { name: "utm_medium", type: "text", note: "referral." },
      { name: "utm_campaign", type: "text", note: "summer_camp_2026.", tags: ["key"] },
      { name: "created_at", type: "timestamptz", note: "Registration time." },
      { name: "match_key", type: "text", note: "Reconciliation key → families.", tags: ["key"] },
    ],
  },
  {
    name: "registration_form_entries",
    zone: "standin",
    title: "Registration form submissions",
    sourceOfTruth: "Stand-in (registration_form)",
    why: "The other side of the dual-source dedup: same signup may appear here AND on the site (with conflicting weeks).",
    relationships: ["match_key → summer_site_registrations.match_key"],
    fields: [
      { name: "_standIn", type: "true", note: "Honest stand-in marker.", tags: ["fixture"] },
      { name: "_source", type: "text", note: "registration_form.", tags: ["fixture"] },
      { name: "form_id", type: "text", note: "Form submission id." },
      { name: "child_name", type: "text", note: "Child name." },
      { name: "parent_email", type: "text", note: "Parent email." },
      { name: "parent_phone", type: "text", note: "Parent phone." },
      { name: "campus", type: "text", note: "Campus name." },
      { name: "weeks", type: "number", note: "Weeks (may conflict with site)." },
      { name: "utm_source", type: "text", note: "summer_site." },
      { name: "utm_medium", type: "text", note: "referral." },
      { name: "utm_campaign", type: "text", note: "summer_camp_2026.", tags: ["key"] },
      { name: "created_at", type: "timestamptz", note: "Submission time." },
      { name: "match_key", type: "text", note: "Reconciliation key.", tags: ["key"] },
    ],
  },
  {
    name: "community_ambassadors",
    zone: "standin",
    title: "community.gt.school ambassadors",
    sourceOfTruth: "Stand-in (community_gt_school)",
    why: "Reconciles against HubSpot ambassador status (the two disagree on purpose).",
    relationships: ["match_key → hubspot_ambassadors.match_key"],
    fields: [
      { name: "_standIn", type: "true", note: "Honest stand-in marker.", tags: ["fixture"] },
      { name: "_source", type: "text", note: "community_gt_school.", tags: ["fixture"] },
      { name: "community_id", type: "text", note: "Community member id." },
      { name: "name", type: "text", note: "Ambassador name." },
      { name: "email", type: "text", note: "Email." },
      { name: "status", type: "text", note: "prospect | onboarded | active | champion." },
      { name: "match_key", type: "text", note: "Reconciliation key.", tags: ["key"] },
    ],
  },
  {
    name: "hubspot_ambassadors",
    zone: "standin",
    title: "HubSpot ambassador status",
    sourceOfTruth: "Stand-in (hubspot)",
    why: "Second feed for the ambassador reconciliation; status conflicts surface here.",
    relationships: ["match_key → community_ambassadors.match_key"],
    fields: [
      { name: "_standIn", type: "true", note: "Honest stand-in marker.", tags: ["fixture"] },
      { name: "_source", type: "text", note: "hubspot.", tags: ["fixture"] },
      { name: "hubspot_contact_id", type: "text", note: "HubSpot contact id.", tags: ["key"] },
      { name: "name", type: "text", note: "Ambassador name." },
      { name: "email", type: "text", note: "Email." },
      { name: "ambassador_status", type: "text", note: "HubSpot-side status (may conflict)." },
      { name: "match_key", type: "text", note: "Reconciliation key.", tags: ["key"] },
    ],
  },
  {
    name: "integration_accounts",
    zone: "standin",
    title: "Admin integration source registry",
    sourceOfTruth: "Stand-in (hub_integration_registry)",
    why: "Control-plane inventory for every PRD data source and the necessary inferred GT Challenge source. It documents owner, status, business purpose, why the data matters, source authority, join keys, privacy notes, row counts, known gaps, and freshness so Admins can tell real connectors from fixture-backed or deferred sources.",
    relationships: ["integration_id -> integration_sync_runs.integration_id"],
    fields: [
      { name: "_standIn", type: "true", note: "Honest stand-in marker for the registry row.", tags: ["fixture"] },
      { name: "_source", type: "text", note: "hub_integration_registry.", tags: ["fixture"] },
      { name: "integration_id", type: "text", note: "Stable integration key used in tests and sync-run traceability.", tags: ["key"] },
      { name: "system", type: "text", note: "External system or Hub-owned manual workflow." },
      { name: "display_name", type: "text", note: "Admin-facing label." },
      { name: "category", type: "text", note: "crm | payments | database | ads | analytics | content | program | community | voice | public-data | manual." },
      { name: "status", type: "text", note: "connected | degraded | standin | manual | deferred." },
      { name: "phase", type: "text", note: "phase_1 | phase_2 | both." },
      { name: "connector_kind", type: "text", note: "api | webhook | database | file | manual | computed." },
      { name: "synthetic_mode", type: "text", note: "live-ready | fixture-backed | manual-v1 | deferred." },
      { name: "owner_role", type: "text", note: "Business owner accountable for the source." },
      { name: "business_purpose", type: "text", note: "What business workflow this source supports." },
      { name: "why_important", type: "text", note: "Why this data is necessary for the company and dashboard, not just why it exists." },
      { name: "entities", type: "array", note: "Modeled records or module-backed fixtures represented by the source." },
      { name: "authoritative_for", type: "array", note: "Facts this source is allowed to own." },
      { name: "module_slugs", type: "array", note: "Hub modules that consume the source." },
      { name: "join_keys", type: "array", note: "Keys used to connect this source to families, campaigns, programs, or documents.", tags: ["key"] },
      { name: "privacy_notes", type: "text", note: "PII, consent, and aggregation guidance." },
      { name: "freshness_sla_minutes", type: "number", note: "Expected sync freshness; null when deferred." },
      { name: "last_sync_at", type: "timestamptz", note: "Most recent modeled sync; null when deferred." },
      { name: "row_count", type: "number", note: "Modeled source volume or module-backed fixture count." },
      { name: "health_score", type: "number", note: "Admin summary score derived from status and known gaps." },
      { name: "known_gaps", type: "array", note: "Explicit limitations, stale states, deferred work, or measurement holes." },
    ],
  },
  {
    name: "integration_sync_runs",
    zone: "standin",
    title: "Recent integration sync runs",
    sourceOfTruth: "Stand-in (hub_integration_registry)",
    why: "Traceability row per integration account. Admins can see whether a source synced, was skipped, produced warnings, wrote downstream records, or is lagging behind its freshness SLA.",
    relationships: ["integration_id -> integration_accounts.integration_id"],
    fields: [
      { name: "_standIn", type: "true", note: "Honest stand-in marker for the sync run.", tags: ["fixture"] },
      { name: "_source", type: "text", note: "hub_integration_registry.", tags: ["fixture"] },
      { name: "run_id", type: "text", note: "Stable synthetic run id.", tags: ["pk"] },
      { name: "integration_id", type: "text", note: "Foreign key to integration_accounts.integration_id.", tags: ["fk", "key"] },
      { name: "started_at", type: "timestamptz", note: "Modeled sync start." },
      { name: "completed_at", type: "timestamptz", note: "Modeled sync completion; null for deferred/skipped sources." },
      { name: "status", type: "text", note: "success | warning | failed | skipped." },
      { name: "records_read", type: "number", note: "Rows or source facts inspected." },
      { name: "records_written", type: "number", note: "Downstream rows written or updated." },
      { name: "records_errored", type: "number", note: "Rows that could not be processed." },
      { name: "lag_minutes", type: "number", note: "Age relative to the dataset as-of clock." },
      { name: "notes", type: "text", note: "Human-readable run outcome or gap." },
    ],
  },
];

export function tablesByZone(zone: Zone): TableDef[] {
  return TABLES.filter((t) => t.zone === zone);
}

export const ZONES: Zone[] = ["global", "scoped", "machinery", "standin"];
