import { buildObjections } from "../admissions/ingest";
import { FIELD_EVENTS } from "../events/data";
import { SAMPLE_RESOURCES } from "../library/data";
import { buildInbox } from "../nurture/sms";
import { SEQUENCES } from "../nurture/sequences";
import type {
  IntegrationAccount,
  IntegrationCategory,
  IntegrationPhase,
  IntegrationStatus,
  IntegrationSyncRun,
  SeedDataset,
} from "../seed/types";

const MIN = 60_000;

type IntegrationId =
  | "supabase_app_form"
  | "hubspot_crm"
  | "hubspot_conversations"
  | "hubspot_sequences"
  | "hubspot_reporting"
  | "stripe"
  | "open_data"
  | "meta_business"
  | "x_api"
  | "ga4_gt_school"
  | "ga4_anywhere"
  | "google_sheets_content"
  | "summer_gt_school"
  | "registration_form"
  | "gt_challenge_capture"
  | "community_gt_school"
  | "hub_manual_workflows"
  | "resource_docs"
  | "substack_manual"
  | "podcast_manual"
  | "read_ai_transcripts"
  | "reconnectext_sms";

export interface IntegrationDefinition {
  integration_id: IntegrationId;
  system: string;
  display_name: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  phase: IntegrationPhase;
  connector_kind: IntegrationAccount["connector_kind"];
  synthetic_mode: IntegrationAccount["synthetic_mode"];
  owner_role: string;
  business_purpose: string;
  why_important: string;
  entities: string[];
  authoritative_for: string[];
  module_slugs: string[];
  join_keys: string[];
  privacy_notes: string;
  freshness_sla_minutes: number | null;
  last_sync_age_minutes: number | null;
  known_gaps: string[];
}

export const INTEGRATION_DEFINITIONS: IntegrationDefinition[] = [
  {
    integration_id: "supabase_app_form",
    system: "Supabase app_form",
    display_name: "GT Anywhere application database",
    category: "database",
    status: "connected",
    phase: "both",
    connector_kind: "database",
    synthetic_mode: "live-ready",
    owner_role: "Marketing Lead",
    business_purpose: "Own the application funnel, TEFA, income band, grade, identities, and program-scoped records.",
    why_important: "This is the PRD source of truth for conversion math. If it drifts, the dashboard cannot answer who applied, who deposited, or which segment is real.",
    entities: ["families", "children", "program_membership", "enrollments", "field_state"],
    authoritative_for: ["funnel_stage", "tefa_status", "income_band", "grade", "match_key"],
    module_slugs: ["home", "dashboard", "nurture", "crm-ops", "summer-camp"],
    join_keys: ["family_id", "match_key", "program_id", "utm_campaign"],
    privacy_notes: "Contains family and child records. App views aggregate or role-scope this data.",
    freshness_sla_minutes: 15,
    last_sync_age_minutes: 8,
    known_gaps: [],
  },
  {
    integration_id: "hubspot_crm",
    system: "HubSpot CRM",
    display_name: "Contacts, deals, lead score, engagement",
    category: "crm",
    status: "connected",
    phase: "both",
    connector_kind: "api",
    synthetic_mode: "live-ready",
    owner_role: "Marketing Lead",
    business_purpose: "Mirror contacts, deals, lifecycle, source, score, and engagement back to the Hub.",
    why_important: "HubSpot is where staff see everyone, but unreliable fields must not override app_form truth. The sync engine proves that split authority.",
    entities: ["families", "enrollments", "field_state", "parity_snapshot", "data_quality_issue"],
    authoritative_for: ["lifecycle_stage", "lead_score", "source", "email engagement", "deal pipeline"],
    module_slugs: ["dashboard", "nurture", "crm-ops", "grassroots", "content"],
    join_keys: ["hubspot_contact_id", "hubspot_deal_id", "match_key"],
    privacy_notes: "Contact-level CRM data. The Hub returns aggregate summaries unless a role has a reason to see details.",
    freshness_sla_minutes: 60,
    last_sync_age_minutes: 41,
    known_gaps: ["TEFA, income, and source are known unreliable as HubSpot fields."],
  },
  {
    integration_id: "hubspot_conversations",
    system: "HubSpot Conversations",
    display_name: "GT Anywhere SMS and family voice inbox",
    category: "voice",
    status: "standin",
    phase: "phase_2",
    connector_kind: "api",
    synthetic_mode: "fixture-backed",
    owner_role: "Admissions Owner",
    business_purpose: "Feed SMS themes, objections, hot-family flags, and consent-safe family quotes.",
    why_important: "Admissions and Nurture need to know what families are actually asking before content or follow-up decisions are made.",
    entities: ["sms_threads", "objections", "family_quotes"],
    authoritative_for: ["sms themes", "objection themes", "inbound reply state"],
    module_slugs: ["home", "nurture", "admissions", "content"],
    join_keys: ["family_id", "thread_id", "source_ref"],
    privacy_notes: "Raw messages and phone numbers are PII. Operator views mask or aggregate these fields.",
    freshness_sla_minutes: 60,
    last_sync_age_minutes: 52,
    known_gaps: ["Keyword rules are v1. LLM auto-theming is intentionally deferred."],
  },
  {
    integration_id: "hubspot_sequences",
    system: "HubSpot Sequences",
    display_name: "Read-only email sequence mirror",
    category: "crm",
    status: "standin",
    phase: "phase_2",
    connector_kind: "api",
    synthetic_mode: "fixture-backed",
    owner_role: "Marketing Lead",
    business_purpose: "Show sequence health, open/click/conversion rates, and review candidates.",
    why_important: "Nurture performance is the strongest predictor in the PRD, so leadership needs a read-only sequence health view without mutating HubSpot.",
    entities: ["sequences", "sequence_steps", "email_events"],
    authoritative_for: ["sequence sends", "opens", "clicks", "sequence conversions"],
    module_slugs: ["home", "nurture", "dashboard"],
    join_keys: ["seq_id", "hubspot_contact_id"],
    privacy_notes: "Aggregated sequence stats only in the Hub.",
    freshness_sla_minutes: 240,
    last_sync_age_minutes: 180,
    known_gaps: [],
  },
  {
    integration_id: "hubspot_reporting",
    system: "HubSpot Reporting API",
    display_name: "HubSpot dashboard mirror",
    category: "crm",
    status: "standin",
    phase: "phase_2",
    connector_kind: "computed",
    synthetic_mode: "fixture-backed",
    owner_role: "Marketing Lead",
    business_purpose: "Mirror saved HubSpot report widgets inside the Dashboard module.",
    why_important: "Leadership should not need to reconcile the Hub and HubSpot manually during the Monday meeting.",
    entities: ["report_widgets", "saved_filters", "dashboard_rows"],
    authoritative_for: ["HubSpot dashboard mirror"],
    module_slugs: ["dashboard", "crm-ops"],
    join_keys: ["hubspot_report_id", "source"],
    privacy_notes: "Aggregated report data only.",
    freshness_sla_minutes: 240,
    last_sync_age_minutes: 211,
    known_gaps: ["Live Reporting API credentials are optional in this fixture build."],
  },
  {
    integration_id: "stripe",
    system: "Stripe",
    display_name: "Payments and webhook state",
    category: "payments",
    status: "connected",
    phase: "phase_1",
    connector_kind: "webhook",
    synthetic_mode: "live-ready",
    owner_role: "Budget Owner",
    business_purpose: "Drive payment state into the correct program store and back to CRM without duplicate writes.",
    why_important: "Phase 1 only works if a payment can be replayed, retried, refunded, and still land in the right program.",
    entities: ["payments", "processed_events", "sync_event_log", "sync_outbox"],
    authoritative_for: ["payment status", "payment amount", "payment event idempotency"],
    module_slugs: ["dashboard", "summer-camp", "crm-ops"],
    join_keys: ["stripe_payment_intent_id", "stripe_event_id", "program_id"],
    privacy_notes: "No card data is stored. Only payment intent and event identifiers are retained.",
    freshness_sla_minutes: 15,
    last_sync_age_minutes: 6,
    known_gaps: [],
  },
  {
    integration_id: "open_data",
    system: "Open Data",
    display_name: "Texas public-school enrichment",
    category: "public-data",
    status: "connected",
    phase: "phase_2",
    connector_kind: "api",
    synthetic_mode: "live-ready",
    owner_role: "Marketing Lead",
    business_purpose: "Add external school-market context to field, budget, and decision recommendations.",
    why_important: "The PRD requires a real external signal that can change a decision. This keeps field bets grounded in local market evidence.",
    entities: ["district_ratings", "finance_rows", "county_enrichment"],
    authoritative_for: ["public-school context", "market enrichment"],
    module_slugs: ["decisions", "events", "dashboard"],
    join_keys: ["county", "district", "year"],
    privacy_notes: "Public aggregate data only. It must never be written back to family records.",
    freshness_sla_minutes: 10080,
    last_sync_age_minutes: 1440,
    known_gaps: ["Falls back to fixture/cache when the public endpoint is unavailable."],
  },
  {
    integration_id: "meta_business",
    system: "Meta Business Suite",
    display_name: "Facebook and Instagram campaign insights",
    category: "ads",
    status: "standin",
    phase: "phase_2",
    connector_kind: "api",
    synthetic_mode: "fixture-backed",
    owner_role: "Content Owner",
    business_purpose: "Report spend, impressions, clicks, and lead actions for paid social campaigns.",
    why_important: "Meta is intentionally modeled as over-reporting versus CRM so CAC and CPQL conversations stay honest.",
    entities: ["meta_insights", "campaign_actions"],
    authoritative_for: ["Meta spend", "Meta impressions", "Meta clicks", "Meta reported leads"],
    module_slugs: ["home", "content", "dashboard", "crm-ops"],
    join_keys: ["utm_campaign", "campaign_id", "publisher_platform"],
    privacy_notes: "Campaign-level data, not family-level data.",
    freshness_sla_minutes: 1440,
    last_sync_age_minutes: 320,
    known_gaps: ["Attribution window inflates leads versus CRM."],
  },
  {
    integration_id: "x_api",
    system: "X API",
    display_name: "X/Twitter organic post metrics",
    category: "ads",
    status: "degraded",
    phase: "phase_2",
    connector_kind: "api",
    synthetic_mode: "fixture-backed",
    owner_role: "Content Owner",
    business_purpose: "Track X post reach, engagement, and link clicks for the high-conversion organic channel.",
    why_important: "The PRD calls X the conviction channel. It must stay separate from Meta so the dashboard does not blend social channels.",
    entities: ["x_posts", "public_metrics", "non_public_metrics"],
    authoritative_for: ["X impressions", "X engagement", "X link clicks"],
    module_slugs: ["home", "content", "dashboard", "analytics"],
    join_keys: ["utm_campaign", "tweet_id"],
    privacy_notes: "Post-level metrics only.",
    freshness_sla_minutes: 1440,
    last_sync_age_minutes: 4320,
    known_gaps: ["Seeded stale connector proves stale-but-green risk in the dashboard."],
  },
  {
    integration_id: "ga4_gt_school",
    system: "Google Analytics 4",
    display_name: "gt.school web property",
    category: "analytics",
    status: "standin",
    phase: "phase_2",
    connector_kind: "api",
    synthetic_mode: "fixture-backed",
    owner_role: "Marketing Lead",
    business_purpose: "Track public site sessions, landing pages, PDF downloads, and conversion events.",
    why_important: "Website demand has to reconcile with UTM capture and content performance, not live as a vanity chart.",
    entities: ["ga4_days", "landing_pages", "events"],
    authoritative_for: ["gt.school sessions", "gt.school page performance", "PDF downloads"],
    module_slugs: ["home", "analytics", "dashboard", "content"],
    join_keys: ["utm_campaign", "landingPage", "site"],
    privacy_notes: "Aggregated web analytics only.",
    freshness_sla_minutes: 1440,
    last_sync_age_minutes: 700,
    known_gaps: [],
  },
  {
    integration_id: "ga4_anywhere",
    system: "Google Analytics 4",
    display_name: "anywhere.gt.school web property",
    category: "analytics",
    status: "standin",
    phase: "phase_2",
    connector_kind: "api",
    synthetic_mode: "fixture-backed",
    owner_role: "Marketing Lead",
    business_purpose: "Track GT Anywhere sessions, product landing pages, and generate-lead events.",
    why_important: "The product site is where campaign traffic converts. Cross-site totals must be summed, not double-counted.",
    entities: ["ga4_days", "landing_pages", "events"],
    authoritative_for: ["anywhere.gt.school sessions", "lead events", "cross-site aggregate"],
    module_slugs: ["home", "analytics", "dashboard", "crm-ops"],
    join_keys: ["utm_campaign", "landingPage", "site"],
    privacy_notes: "Aggregated web analytics only.",
    freshness_sla_minutes: 1440,
    last_sync_age_minutes: 700,
    known_gaps: ["GA4 cross-site linking remains TBD per PRD; this fixture sums properties explicitly."],
  },
  {
    integration_id: "google_sheets_content",
    system: "Google Sheets",
    display_name: "Content production tracker",
    category: "content",
    status: "standin",
    phase: "phase_2",
    connector_kind: "file",
    synthetic_mode: "fixture-backed",
    owner_role: "Content Owner",
    business_purpose: "Mirror the Content Owner's production kanban and UTM plan.",
    why_important: "The spec says the sheet is the production source of truth, so content status should not be invented in the Hub.",
    entities: ["content_sheet", "content_pieces"],
    authoritative_for: ["content status", "owner", "target date", "planned UTM"],
    module_slugs: ["home", "content", "library"],
    join_keys: ["sheet_row_id", "utm_campaign"],
    privacy_notes: "Work-planning data, no family PII.",
    freshness_sla_minutes: 1440,
    last_sync_age_minutes: 1180,
    known_gaps: ["Read-write sync is represented by deterministic conflict tests, not live Sheets credentials."],
  },
  {
    integration_id: "summer_gt_school",
    system: "summer.gt.school",
    display_name: "Summer registration app",
    category: "program",
    status: "standin",
    phase: "both",
    connector_kind: "api",
    synthetic_mode: "fixture-backed",
    owner_role: "Content Owner",
    business_purpose: "Provide summer registrations, rosters, payment facts, and campus capacity inputs.",
    why_important: "This is the cleanest dual-source reconciliation test and ties directly to Phase 1 program isolation.",
    entities: ["summer_site_registrations", "program_membership", "enrollments"],
    authoritative_for: ["summer registration", "campus", "weeks", "paid flag"],
    module_slugs: ["summer-camp", "dashboard", "crm-ops"],
    join_keys: ["match_key", "registration_id", "program_id"],
    privacy_notes: "Contains child names in the source feed. Hub surfaces aggregate capacity and role-scoped roster views.",
    freshness_sla_minutes: 60,
    last_sync_age_minutes: 49,
    known_gaps: [],
  },
  {
    integration_id: "registration_form",
    system: "Registration form",
    display_name: "Alternate summer intake path",
    category: "program",
    status: "standin",
    phase: "both",
    connector_kind: "file",
    synthetic_mode: "fixture-backed",
    owner_role: "Content Owner",
    business_purpose: "Capture alternate camp signups and reconcile them against summer.gt.school.",
    why_important: "Without this feed, the Hub cannot prove it avoids double-counting duplicate camp registrations.",
    entities: ["registration_form_entries"],
    authoritative_for: ["alternate summer intake", "form UTM"],
    module_slugs: ["summer-camp", "crm-ops"],
    join_keys: ["match_key", "form_id"],
    privacy_notes: "Contains parent and child intake fields. Aggregated outside roster views.",
    freshness_sla_minutes: 1440,
    last_sync_age_minutes: 330,
    known_gaps: ["Alternate form conflicts are surfaced, not silently overwritten."],
  },
  {
    integration_id: "gt_challenge_capture",
    system: "GT Challenge capture",
    display_name: "Gifted quiz public lead capture",
    category: "program",
    status: "standin",
    phase: "phase_2",
    connector_kind: "computed",
    synthetic_mode: "fixture-backed",
    owner_role: "Marketing Lead",
    business_purpose: "Capture consented quiz submissions, preserve UTM, score fit, and route qualified leads into Fall Enrollment.",
    why_important: "This is the worked campaign in the technical brief. It connects spend, public capture, CRM lead creation, program routing, and CPQL reporting.",
    entities: ["gifted_quiz_submissions", "gifted_quiz_leads", "families", "meta_insights", "budget_entry"],
    authoritative_for: ["GT Challenge consented submissions", "quiz fit bucket", "campaign CPQL"],
    module_slugs: ["gt-challenge", "home", "dashboard", "crm-ops", "budget"],
    join_keys: ["utm_campaign", "match_key", "campaign_key"],
    privacy_notes: "Contains parent contact details and child quiz responses. Public capture requires consent before persistence.",
    freshness_sla_minutes: 60,
    last_sync_age_minutes: 18,
    known_gaps: ["Route uses an in-memory adapter in the demo; a transactional DB adapter is tracked separately."],
  },
  {
    integration_id: "community_gt_school",
    system: "community.gt.school",
    display_name: "Parent ambassador community",
    category: "community",
    status: "standin",
    phase: "both",
    connector_kind: "api",
    synthetic_mode: "fixture-backed",
    owner_role: "Grassroots Owner",
    business_purpose: "Track ambassador stages, community participation, and referral activity.",
    why_important: "Grassroots data is dual-source with HubSpot. Reconciliation prevents inflated ambassador counts and fake referral performance.",
    entities: ["community_ambassadors", "hubspot_ambassadors"],
    authoritative_for: ["community ambassador status", "community identity"],
    module_slugs: ["grassroots", "dashboard", "crm-ops"],
    join_keys: ["match_key", "community_id", "hubspot_contact_id"],
    privacy_notes: "Parent ambassador identity is role-scoped.",
    freshness_sla_minutes: 1440,
    last_sync_age_minutes: 620,
    known_gaps: ["HubSpot and community status can conflict; survivorship is documented in Grassroots."],
  },
  {
    integration_id: "hub_manual_workflows",
    system: "Hub manual workflows",
    display_name: "Budget, events, decisions, library",
    category: "manual",
    status: "manual",
    phase: "phase_2",
    connector_kind: "manual",
    synthetic_mode: "manual-v1",
    owner_role: "Marketing Lead",
    business_purpose: "Capture the Hub-owned facts that the PRD says should not come from external tools.",
    why_important: "Budget and Decision Queue are system-of-record inside the Hub. Treating them as external sheets would violate the source-of-truth rules.",
    entities: ["budget_entry", "budget_workstream", "decisions", "field_events", "resource_library"],
    authoritative_for: ["budget", "decision status", "field event consults", "manual risks"],
    module_slugs: ["home", "budget", "decisions", "events", "library"],
    join_keys: ["workstream_key", "decision_id", "event_id", "resource_id"],
    privacy_notes: "Manual operating data, with leadership-only decisions where applicable.",
    freshness_sla_minutes: 10080,
    last_sync_age_minutes: 2880,
    known_gaps: ["Event-to-consult remains manual and uninstrumented by design."],
  },
  {
    integration_id: "resource_docs",
    system: "Google Drive / Docs",
    display_name: "Linked docs, slides, sheets, PDFs",
    category: "content",
    status: "manual",
    phase: "phase_2",
    connector_kind: "file",
    synthetic_mode: "manual-v1",
    owner_role: "Marketing Lead",
    business_purpose: "Keep reference documents discoverable without pretending the Hub owns their contents.",
    why_important: "The Resource Library should show link health, visibility, and provenance so operators trust shared assets.",
    entities: ["resources", "linked_docs"],
    authoritative_for: ["document links", "visibility", "resource tags"],
    module_slugs: ["library", "content", "home"],
    join_keys: ["resource_id", "url"],
    privacy_notes: "Leadership-only documents remain gated.",
    freshness_sla_minutes: 10080,
    last_sync_age_minutes: 1440,
    known_gaps: ["One fixture link is intentionally unreachable to exercise the dead-link state."],
  },
  {
    integration_id: "substack_manual",
    system: "Substack",
    display_name: "Newsletter audience manual v1",
    category: "content",
    status: "manual",
    phase: "phase_2",
    connector_kind: "manual",
    synthetic_mode: "manual-v1",
    owner_role: "Content Owner",
    business_purpose: "Track newsletter reach beside other content channels until an API integration is justified.",
    why_important: "Substack is a content channel in the PRD, but it is not important enough to build a full connector before CRM, payments, and analytics are trustworthy.",
    entities: ["manual_audience"],
    authoritative_for: ["Substack subscribers", "newsletter reach"],
    module_slugs: ["content", "home"],
    join_keys: ["channel"],
    privacy_notes: "Aggregate audience counts only.",
    freshness_sla_minutes: 10080,
    last_sync_age_minutes: 4320,
    known_gaps: ["PRD defers Substack API integration to later."],
  },
  {
    integration_id: "podcast_manual",
    system: "Podcast platform",
    display_name: "Podcast audience manual v1",
    category: "content",
    status: "manual",
    phase: "phase_2",
    connector_kind: "manual",
    synthetic_mode: "manual-v1",
    owner_role: "Content Owner",
    business_purpose: "Carry podcast listens into content channel summaries without pretending a live API exists.",
    why_important: "The company needs the channel represented in high-level summaries, but manual v1 is enough until it affects budget decisions.",
    entities: ["manual_audience"],
    authoritative_for: ["podcast listens"],
    module_slugs: ["content", "home"],
    join_keys: ["channel"],
    privacy_notes: "Aggregate audience counts only.",
    freshness_sla_minutes: 10080,
    last_sync_age_minutes: 4320,
    known_gaps: ["PRD defers podcast API integration to later."],
  },
  {
    integration_id: "read_ai_transcripts",
    system: "Read.ai",
    display_name: "Optional call transcript import",
    category: "voice",
    status: "deferred",
    phase: "phase_2",
    connector_kind: "api",
    synthetic_mode: "deferred",
    owner_role: "Admissions Owner",
    business_purpose: "Optionally enrich admissions objection logs with recorded call transcripts.",
    why_important: "Useful for family voice, but the PRD makes Conversations and manual notes primary, so this stays out of the critical path.",
    entities: ["call_transcripts"],
    authoritative_for: [],
    module_slugs: ["admissions"],
    join_keys: ["meeting_id", "family_id"],
    privacy_notes: "Would contain sensitive voice transcripts. Needs consent and redaction before activation.",
    freshness_sla_minutes: null,
    last_sync_age_minutes: null,
    known_gaps: ["Deferred because it is optional and secondary in the PRD."],
  },
  {
    integration_id: "reconnectext_sms",
    system: "Reconnectext",
    display_name: "External SMS send-rate platform",
    category: "voice",
    status: "deferred",
    phase: "phase_2",
    connector_kind: "api",
    synthetic_mode: "deferred",
    owner_role: "Marketing Lead",
    business_purpose: "Would measure SMS send-rate, if available.",
    why_important: "The PRD explicitly says this gap is unmeasurable. The Admin tab should show it as a known hole, not a fake green source.",
    entities: ["sms_send_rate"],
    authoritative_for: [],
    module_slugs: ["nurture", "crm-ops"],
    join_keys: ["phone", "message_id"],
    privacy_notes: "Would involve phone numbers and message metadata.",
    freshness_sla_minutes: null,
    last_sync_age_minutes: null,
    known_gaps: ["Unmeasurable in v1 per PRD."],
  },
];

export const PRD_REQUIRED_INTEGRATION_IDS: IntegrationId[] = [
  "supabase_app_form",
  "hubspot_crm",
  "hubspot_conversations",
  "hubspot_sequences",
  "hubspot_reporting",
  "stripe",
  "open_data",
  "meta_business",
  "x_api",
  "ga4_gt_school",
  "ga4_anywhere",
  "google_sheets_content",
  "summer_gt_school",
  "registration_form",
  "gt_challenge_capture",
  "community_gt_school",
  "hub_manual_workflows",
  "resource_docs",
  "substack_manual",
  "podcast_manual",
  "read_ai_transcripts",
  "reconnectext_sms",
];

function isoAt(asOfMs: number, ageMinutes: number | null): string | null {
  if (ageMinutes === null) return null;
  return new Date(asOfMs - ageMinutes * MIN).toISOString();
}

function healthFor(def: IntegrationDefinition): number {
  if (def.status === "connected") return def.known_gaps.length ? 88 : 96;
  if (def.status === "standin") return def.known_gaps.length ? 78 : 84;
  if (def.status === "degraded") return 62;
  if (def.status === "manual") return 70;
  return 35;
}

function countRows(id: IntegrationId, ds: SeedDataset): number {
  switch (id) {
    case "supabase_app_form":
      return ds.families.length + ds.children.length + ds.program_membership.length + ds.enrollments.length;
    case "hubspot_crm":
      return ds.families.filter((f) => f.hubspot_contact_id).length + ds.enrollments.filter((e) => e.hubspot_deal_id).length + ds.field_state.length;
    case "hubspot_conversations":
      return buildInbox(ds.families, ds.manifest.generatedAt).length + buildObjections(ds).length;
    case "hubspot_sequences":
      return SEQUENCES.length;
    case "hubspot_reporting":
      return 6;
    case "stripe":
      return ds.payments.length + ds.processed_events.filter((e) => e.source === "stripe").length;
    case "open_data":
      return 4;
    case "meta_business":
      return ds.meta_insights.length;
    case "x_api":
      return ds.x_posts.length;
    case "ga4_gt_school":
      return ds.ga4_days.filter((row) => row.site === "gt.school").length;
    case "ga4_anywhere":
      return ds.ga4_days.filter((row) => row.site === "anywhere.gt.school").length;
    case "google_sheets_content":
      return ds.content_sheet.length;
    case "summer_gt_school":
      return ds.summer_site_registrations.length;
    case "registration_form":
      return ds.registration_form_entries.length;
    case "gt_challenge_capture":
      return (
        ds.families.filter((row) => row.utm_campaign === "gifted_quiz_2026").length +
        ds.meta_insights.filter((row) => row.utm_campaign === "gifted_quiz_2026").length
      );
    case "community_gt_school":
      return ds.community_ambassadors.length + ds.hubspot_ambassadors.length;
    case "hub_manual_workflows":
      return ds.budget_entry.length + ds.budget_workstream.length + ds.decisions.length + FIELD_EVENTS.length;
    case "resource_docs":
      return SAMPLE_RESOURCES.length;
    case "substack_manual":
    case "podcast_manual":
      return 1;
    case "read_ai_transcripts":
    case "reconnectext_sms":
      return 0;
  }
}

export function buildIntegrationAccounts(ds: SeedDataset): IntegrationAccount[] {
  const asOfMs = Date.parse(ds.manifest.generatedAt);
  return INTEGRATION_DEFINITIONS.map((def) => {
    const { last_sync_age_minutes, ...account } = def;
    return {
      _standIn: true,
      _source: "hub_integration_registry",
      ...account,
      last_sync_at: isoAt(asOfMs, last_sync_age_minutes),
      row_count: countRows(def.integration_id, ds),
      health_score: healthFor(def),
    };
  });
}

export function buildIntegrationSyncRuns(ds: SeedDataset): IntegrationSyncRun[] {
  const asOfMs = Date.parse(ds.manifest.generatedAt);
  const accounts = ds.integration_accounts.length ? ds.integration_accounts : buildIntegrationAccounts(ds);
  return accounts.map((account, index) => {
    const lag = account.last_sync_at ? Math.round((asOfMs - Date.parse(account.last_sync_at)) / MIN) : 0;
    const isDeferred = account.status === "deferred";
    const isWarning = account.status === "degraded" || account.known_gaps.length > 0;
    const status: IntegrationSyncRun["status"] = isDeferred ? "skipped" : isWarning ? "warning" : "success";
    const recordsRead = isDeferred ? 0 : account.row_count;
    const recordsWritten =
      account.connector_kind === "manual" || account.status === "deferred"
        ? 0
        : Math.max(0, Math.round(recordsRead * (account.integration_id === "hubspot_crm" ? 0.14 : 0.04)));
    const recordsErrored = account.status === "degraded" ? Math.max(1, Math.round(recordsRead * 0.02)) : 0;
    const completedAt = account.last_sync_at ?? null;
    const startedAt = completedAt ? new Date(Date.parse(completedAt) - (45 + index * 7) * 1000).toISOString() : new Date(asOfMs).toISOString();
    return {
      _standIn: true,
      _source: "hub_integration_registry",
      run_id: `run_${account.integration_id}`,
      integration_id: account.integration_id,
      started_at: startedAt,
      completed_at: completedAt,
      status,
      records_read: recordsRead,
      records_written: recordsWritten,
      records_errored: recordsErrored,
      lag_minutes: lag,
      notes: isDeferred
        ? "Deferred by PRD priority. Tracked so the gap is visible."
        : isWarning
          ? account.known_gaps[0] ?? "Connector needs attention."
          : "Synthetic sync completed inside expected freshness window.",
    };
  });
}

export function integrationCoverage(accounts: IntegrationAccount[]): {
  total: number;
  connected: number;
  represented: number;
  deferred: number;
  degraded: number;
} {
  return {
    total: accounts.length,
    connected: accounts.filter((row) => row.status === "connected").length,
    represented: accounts.filter((row) => row.status !== "deferred").length,
    deferred: accounts.filter((row) => row.status === "deferred").length,
    degraded: accounts.filter((row) => row.status === "degraded").length,
  };
}

export function missingRequiredIntegrations(accounts: IntegrationAccount[]): string[] {
  const present = new Set(accounts.map((row) => row.integration_id));
  return PRD_REQUIRED_INTEGRATION_IDS.filter((id) => !present.has(id));
}
