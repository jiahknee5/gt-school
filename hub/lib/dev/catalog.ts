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
  kind: "real" | "standin" | "external";
  tables: string;
  joinKey: string;
  grain: string;
  note: string;
}

export const SOURCES: SourceRow[] = [
  { system: "HubSpot", kind: "real", tables: "families, enrollments", joinKey: "match_key, hubspot_contact_id", grain: "contact / deal", note: "CRM source of truth for lifecycle, lead_score, source." },
  { system: "Stripe", kind: "real", tables: "payments", joinKey: "stripe_payment_intent_id", grain: "payment intent / event", note: "Money facts. Intent id is unique = idempotency layer." },
  { system: "Hub DB", kind: "real", tables: "budget_workstream, decisions, parity_snapshot, field_state, data_quality_issue", joinKey: "—", grain: "various", note: "Hub-owned: budget, Decision Queue, parity + conflict state." },
  { system: "Meta", kind: "standin", tables: "meta_insights", joinKey: "utm_campaign", grain: "campaign × date × platform", note: "Marketing API shape. Leads deliberately over-report vs CRM (attribution gap)." },
  { system: "GA4", kind: "standin", tables: "ga4_days", joinKey: "utm_campaign", grain: "date × site × campaign × landing page", note: "Data API shape. Loose join on purpose (uninstrumented steps)." },
  { system: "X (Twitter)", kind: "standin", tables: "x_posts", joinKey: "utm_campaign (in link)", grain: "one row per tweet", note: "API v2 metrics. url_link_clicks → GA4 sessions." },
  { system: "Google Sheets", kind: "standin", tables: "content_sheet", joinKey: "utm_campaign", grain: "one row per content piece", note: "Content calendar; status pipeline." },
  { system: "summer.gt.school", kind: "standin", tables: "summer_site_registrations", joinKey: "match_key", grain: "one row per registration", note: "Transactional. Reconciles against the registration form + HubSpot deals." },
  { system: "Registration form", kind: "standin", tables: "registration_form_entries", joinKey: "match_key", grain: "one row per submission", note: "Second source for camp signups → dual-source dedup." },
  { system: "community.gt.school", kind: "standin", tables: "community_ambassadors", joinKey: "match_key", grain: "one row per ambassador", note: "Reconciles against HubSpot ambassador status." },
  { system: "Open Data (TEA)", kind: "external", tables: "(queried at decision time)", joinKey: "county / district", grain: "PEIMS / STAAR / A–F", note: "Read-only enrichment via lib/opendata. Live API + cache + fixture fallback." },
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
      { name: "committed", type: "numeric", note: "Committed spend." },
      { name: "actual", type: "numeric", note: "Actual spend." },
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
];

export function tablesByZone(zone: Zone): TableDef[] {
  return TABLES.filter((t) => t.zone === zone);
}

export const ZONES: Zone[] = ["global", "scoped", "machinery", "standin"];
