/**
 * Typed shapes for the seed dataset. The "real" records mirror the backbone
 * migration (hub/supabase/migrations/0001_backbone.sql) column-for-column so the
 * fixtures load straight into Postgres. The "stood-in" records carry a
 * `_standIn: true` tag and a `_source` label — the brief requires real vs.
 * stood-in to be honest and visible.
 */

// ----------------------------- real (→ Supabase) -----------------------------

export interface Family {
  id: string;
  hubspot_contact_id: string | null;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  // app_form-authoritative
  funnel_stage: string | null;
  tefa_status: string | null;
  income_band: string | null;
  grade: string | null;
  // HubSpot-authoritative
  lifecycle_stage: string | null;
  lead_score: number | null;
  source: string | null;
  /** app_form / HubSpot analytics — join key for Meta, GA4, X stand-ins. */
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  // sync bookkeeping
  match_key: string | null;
  row_version: number;
  app_updated_at: string;
  hs_updated_at: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface Child {
  id: string;
  family_id: string;
  first_name: string | null;
  grade: string | null;
  created_at: string;
}

export interface ProgramMembership {
  id: string;
  program_id: string;
  program_key: string; // convenience for fixtures/validation (not a DB column)
  family_id: string;
  child_id: string | null;
  status: string;
  source: string | null;
  joined_at: string;
}

export interface Enrollment {
  id: string;
  program_id: string;
  program_key: string;
  family_id: string;
  child_id: string | null;
  hubspot_deal_id: string | null;
  stage: string | null;
  amount: number | null;
  paid: boolean;
  created_at: string;
}

export interface Payment {
  id: string;
  program_id: string;
  program_key: string;
  family_id: string | null;
  enrollment_id: string | null;
  stripe_payment_intent_id: string;
  stripe_event_id: string | null;
  amount: number;
  status: string; // requires_payment | succeeded | refunded | failed
  status_rank: number;
  occurred_at: string | null;
  created_at: string;
}

export interface FieldState {
  entity: string;
  entity_id: string;
  field: string;
  app_value: string | null;
  hs_value: string | null;
  app_updated_at: string | null;
  hs_updated_at: string | null;
  in_parity: boolean;
  last_checked_at: string | null;
}

export interface ParitySnapshot {
  id: string;
  taken_at: string;
  scope: string;
  overall_pct: number;
  fields: Record<string, number>;
}

export interface DataQualityIssue {
  id: string;
  category: string; // utm | sync | scoring | tracking | other
  severity: string; // low | medium | high | blocker
  entity: string | null;
  entity_id: string | null;
  field: string | null;
  description: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

export interface BudgetWorkstream {
  id: string;
  key: string;
  name: string;
  recommended: number;
  planned: number;
  committed: number;
  actual: number;
}

/**
 * Append-only spend ledger (Module 10). The multi-owner + audit layer beneath the
 * `budget_workstream` aggregates: each owner enters their OWN committed/actual spend;
 * campaign roll-ins land as `origin='campaign'` rows counted exactly once. Aggregates
 * are DERIVED from these rows (see lib/budget/reconcile.ts) — corrections are new rows,
 * never in-place edits. Mirrors supabase/migrations/0004_budget.sql column-for-column.
 */
export interface BudgetEntry {
  id: string;
  workstream_key: string;
  kind: "committed" | "actual";
  origin: "manual" | "campaign"; // survivorship discriminator (campaign roll-ins never hand-entered)
  amount: number;
  entered_by: string; // role/user — audit trail
  owner_role: string; // the function owner responsible (RBAC scope check)
  note: string | null;
  campaign_key: string | null; // set when origin='campaign'
  created_at: string; // immutable; powers weekly burn
}

export interface Decision {
  id: string;
  question: string;
  raised_by: string | null;
  workstream: string | null;
  recommendation: string | null;
  budget_ask: number | null;
  due_date: string | null;
  priority: string;
  status: string;
  response: string | null;
  response_note: string | null;
  auto_flag: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface ProcessedEvent {
  source: string; // stripe | hubspot
  event_id: string;
  first_seen_at: string;
  result: Record<string, unknown> | null;
}

export interface SyncEventLogEntry {
  id: string;
  source_system: string;
  external_event_id: string | null;
  entity: string | null;
  entity_id: string | null;
  change: Record<string, unknown> | null;
  conflict: boolean;
  received_at: string;
  processed_at: string | null;
}

export interface SyncOutboxEntry {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  target_system: string;
  op: string;
  payload: Record<string, unknown>;
  dedupe_key: string;
  status: string; // pending | inflight | done | dead
  attempts: number;
  last_error: string | null;
  created_at: string;
}

export interface SyncIdentityMapEntry {
  id: string;
  local_table: string;
  local_id: string;
  system: string; // hubspot | stripe | community | summer_site
  external_id: string;
}

// --------------------------- stood-in (other sources) ---------------------------

export interface StandIn {
  _standIn: true;
  _source: string;
}

export interface MetaAction {
  action_type: string;
  value: string;
}

/** Meta Marketing API insights row — grain: campaign × date × publisher_platform. */
export interface MetaInsight extends StandIn {
  date: string;
  campaign_id: string;
  campaign_name: string;
  utm_campaign: string;
  publisher_platform: "facebook" | "instagram";
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  actions: MetaAction[];
  attribution_window: "7d_click" | "1d_view";
  /** Convenience rollup from actions where action_type = 'lead'. */
  leads: number;
}

/** GA4 Data API report row — grain: date × site × campaign × landing page. */
export interface Ga4Day extends StandIn {
  date: string;
  site: "gt.school" | "anywhere.gt.school";
  sessionDefaultChannelGroup: string;
  sessionSourceMedium: string;
  landingPage: string;
  utm_campaign: string | null;
  sessions: number;
  totalUsers: number;
  engagedSessions: number;
  screenPageViews: number;
  conversions: number;
  eventCount_pdf_download: number;
  eventCount_generate_lead: number;
}

export interface XPublicMetrics {
  impression_count: number;
  like_count: number;
  retweet_count: number;
  reply_count: number;
  quote_count: number;
  bookmark_count: number;
}

export interface XNonPublicMetrics {
  url_link_clicks: number;
  user_profile_clicks: number;
}

/** X API v2 tweet — grain: one row per tweet. */
export interface XPost extends StandIn {
  id: string;
  created_at: string;
  text: string;
  public_metrics: XPublicMetrics;
  non_public_metrics: XNonPublicMetrics;
  utm_campaign: string | null;
  utm_source: string;
  utm_medium: string;
}

export interface SheetRow extends StandIn {
  piece: string;
  owner: string;
  status: "idea" | "drafting" | "review" | "scheduled" | "published";
  target_date: string;
  utm_campaign: string | null;
}

/** summer.gt.school registration — transactional grain, match_key → families. */
export interface SummerSiteRegistration extends StandIn {
  registration_id: string;
  parent_email: string | null;
  parent_phone: string | null;
  child_name: string;
  campus: string;
  campus_key: string;
  session_start: string;
  weeks: number;
  amount: number;
  paid: boolean;
  status: "pending" | "confirmed" | "cancelled" | "waitlisted";
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
  match_key: string | null;
}

export interface RegistrationFormEntry extends StandIn {
  form_id: string;
  child_name: string;
  parent_email: string;
  parent_phone: string | null;
  campus: string;
  weeks: number;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
  match_key: string | null;
}

export interface CommunityAmbassador extends StandIn {
  community_id: string;
  name: string;
  email: string;
  status: string; // prospect | onboarded | active | champion
  match_key: string | null;
}

export interface HubspotAmbassador extends StandIn {
  hubspot_contact_id: string;
  name: string;
  email: string;
  ambassador_status: string;
  match_key: string | null;
}

// --------------------------------- the dataset ---------------------------------

export interface SeedManifest {
  seed: number;
  generatedAt: string;
  counts: Record<string, number>;
  edgeCases: string[];
  real: string[];
  standIn: string[];
}

export interface Program {
  id: string;
  key: string;
  name: string;
}

export interface SeedDataset {
  manifest: SeedManifest;
  // real
  programs: Program[];
  families: Family[];
  children: Child[];
  program_membership: ProgramMembership[];
  enrollments: Enrollment[];
  payments: Payment[];
  field_state: FieldState[];
  parity_snapshot: ParitySnapshot[];
  data_quality_issue: DataQualityIssue[];
  budget_workstream: BudgetWorkstream[];
  budget_entry: BudgetEntry[];
  decisions: Decision[];
  processed_events: ProcessedEvent[];
  sync_event_log: SyncEventLogEntry[];
  sync_outbox: SyncOutboxEntry[];
  sync_identity_map: SyncIdentityMapEntry[];
  // stood-in
  meta_insights: MetaInsight[];
  ga4_days: Ga4Day[];
  x_posts: XPost[];
  content_sheet: SheetRow[];
  summer_site_registrations: SummerSiteRegistration[];
  registration_form_entries: RegistrationFormEntry[];
  community_ambassadors: CommunityAmbassador[];
  hubspot_ambassadors: HubspotAmbassador[];
}

export interface GenerateOptions {
  seed?: number;
  families?: number;
  /** Start of the marketing sprint window (ISO date). */
  sprintStart?: string;
  /** Number of weeks of activity to generate. */
  weeks?: number;
}
