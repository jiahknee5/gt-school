import { pathToFileURL } from "node:url";
import { loadEnvLocal } from "./_env";
import { closeDb, withoutProgram, type ScopedSql } from "../lib/db";
import { hs } from "../lib/connectors/hubspot";
// Shared with the live GT Challenge capture path so a seeded family and a captured lead
// map onto the EXACT same gt_* enum vocabulary. Imported as locals (used by
// contactProperties) AND re-exported so the seed bridge keeps its existing import surface.
import {
  mapFitBucket,
  mapGradeBand,
  mapIncomeBand,
  mapSource,
  mapTefaStatus,
} from "../lib/connectors/hs-mappings";

export { mapFitBucket, mapGradeBand, mapIncomeBand, mapSource, mapTefaStatus };

loadEnvLocal();

const SEED_BATCH = "gt_hub_bridge_v1";
const DEFAULT_LIMIT = 50;

interface Args {
  apply: boolean;
  includeLinked: boolean;
  limit: number;
  syncFields: boolean;
}

interface CandidateFamily {
  id: string;
  hubspot_contact_id: string | null;
  email: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  funnel_stage: string | null;
  tefa_status: string | null;
  income_band: string | null;
  grade: string | null;
  lifecycle_stage: string | null;
  lead_score: number | null;
  source: string | null;
  created_at: string;
}

interface HsObject {
  id: string;
  properties?: Record<string, string | null>;
}

interface SearchResult {
  results?: HsObject[];
}

interface HsError extends Error {
  status?: number;
}

interface PropertyDef {
  name: string;
  label: string;
  type: "string" | "number" | "enumeration" | "bool" | "datetime";
  fieldType: "text" | "number" | "select" | "booleancheckbox" | "date";
  options?: string[];
}

function usage(): string {
  return [
    "Usage: npm run seed:hubspot -- [--apply] [--limit N|--all] [--sync-fields] [--include-linked]",
    "",
    "Bridges live Supabase families to real HubSpot contacts so reconcile can match",
    "the seeded DB and the HubSpot portal. Defaults to dry-run and mutates nothing.",
    "",
    "  --apply           create/update HubSpot contacts and write numeric ids to families",
    "  --limit N         number of unique-email families to bridge (default 50)",
    "  --all             bridge every eligible unique-email family",
    "  --sync-fields     also write mapped GT sync fields into HubSpot custom props",
    "  --include-linked  include rows already linked to numeric HubSpot ids",
  ].join("\n");
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    apply: false,
    includeLinked: false,
    limit: DEFAULT_LIMIT,
    syncFields: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") args.apply = true;
    else if (a === "--sync-fields") args.syncFields = true;
    else if (a === "--include-linked") args.includeLinked = true;
    else if (a === "--all") args.limit = 10_000;
    else if (a === "--help" || a === "-h") {
      console.log(usage());
      process.exit(0);
    } else if (a === "--limit") {
      const raw = argv[++i];
      const n = Number(raw);
      if (!Number.isInteger(n) || n <= 0) throw new Error("--limit requires a positive integer.");
      args.limit = n;
    } else if (a.startsWith("--limit=")) {
      const n = Number(a.slice("--limit=".length));
      if (!Number.isInteger(n) || n <= 0) throw new Error("--limit requires a positive integer.");
      args.limit = n;
    } else {
      throw new Error(`Unknown argument: ${a}\n\n${usage()}`);
    }
  }

  return args;
}

const strProp = (name: string, label: string): PropertyDef => ({
  name,
  label,
  type: "string",
  fieldType: "text",
});
const numProp = (name: string, label: string): PropertyDef => ({
  name,
  label,
  type: "number",
  fieldType: "number",
});
const enumProp = (name: string, label: string, options: string[]): PropertyDef => ({
  name,
  label,
  type: "enumeration",
  fieldType: "select",
  options,
});
const boolProp = (name: string, label: string): PropertyDef => ({
  name,
  label,
  type: "bool",
  fieldType: "booleancheckbox",
  options: ["true", "false"],
});
const dateProp = (name: string, label: string): PropertyDef => ({
  name,
  label,
  type: "datetime",
  fieldType: "date",
});

const BASE_CONTACT_PROPS: PropertyDef[] = [
  strProp("gt_ext_id", "GT Ext ID"),
  strProp("gt_seed_batch", "GT Seed Batch"),
];

export const SYNC_CONTACT_PROPS: PropertyDef[] = [
  enumProp("gt_income_band", "GT Income Band (HubSpot - unreliable)", [
    "under_65k",
    "65k_160k",
    "over_160k",
  ]),
  enumProp("gt_grade_band", "GT Grade Band", ["k_2", "3_5", "6_8", "9_12"]),
  enumProp("gt_esa_status", "GT ESA Status", ["planned", "approved", "ineligible", "none"]),
  enumProp("gt_utm_source", "GT UTM Source", [
    "x_twitter",
    "facebook",
    "instagram",
    "substack",
    "podcast",
    "email",
    "referral",
    "gifted_community",
    "organic",
    "esa_navigator",
  ]),
  numProp("gt_lead_score", "GT Lead Score"),
  // GT Challenge capture enrichment — the full lead signal a deposit forwards.
  strProp("gt_utm_medium", "GT UTM Medium"),
  strProp("gt_utm_campaign", "GT UTM Campaign"),
  enumProp("gt_fit_bucket", "GT Fit Bucket", ["strong_fit", "promising", "explore"]),
  boolProp("gt_consent", "GT Consent"),
  dateProp("gt_consent_at", "GT Consent At"),
];

// DEAL custom properties (object type = deals). A GT Fall-deposit deal carries the lead's
// fit signal + the Stripe linkage so the CRM deal is legible on its own. Provisioned under
// the same --sync-fields/--apply flags as the contact props, into a deals property group.
export const DEAL_PROPS: PropertyDef[] = [
  strProp("gt_program", "GT Program"),
  strProp("gt_child_grade", "GT Child Grade"),
  enumProp("gt_fit_bucket", "GT Fit Bucket", ["strong_fit", "promising", "explore"]),
  numProp("gt_lead_score", "GT Lead Score"),
  strProp("gt_match_key", "GT Match Key"),
  strProp("gt_stripe_intent", "GT Stripe Intent"),
];

function isHsError(err: unknown): err is HsError {
  return err instanceof Error && "status" in err;
}

type HsObjectType = "contacts" | "deals";

async function ensureGroup(object: HsObjectType): Promise<void> {
  const name = "gt_marketing_hub";
  try {
    await hs(`/crm/v3/properties/${object}/groups/${name}`);
  } catch (err) {
    if (!isHsError(err) || err.status !== 404) throw err;
    await hs(`/crm/v3/properties/${object}/groups`, {
      method: "POST",
      body: { name, label: "GT Marketing Hub", displayOrder: -1 },
    });
  }
}

async function ensureProperty(object: HsObjectType, def: PropertyDef): Promise<"exists" | "created"> {
  try {
    await hs(`/crm/v3/properties/${object}/${def.name}`);
    return "exists";
  } catch (err) {
    if (!isHsError(err) || err.status !== 404) throw err;
  }

  await hs(`/crm/v3/properties/${object}`, {
    method: "POST",
    body: {
      name: def.name,
      label: def.label,
      type: def.type,
      fieldType: def.fieldType,
      groupName: "gt_marketing_hub",
      options: def.options?.map((value, displayOrder) => ({
        label: value,
        value,
        displayOrder,
        hidden: false,
      })),
    },
  });
  return "created";
}

async function ensurePropertySet(object: HsObjectType, defs: PropertyDef[]): Promise<void> {
  await ensureGroup(object);
  let created = 0;
  for (const def of defs) {
    if ((await ensureProperty(object, def)) === "created") created++;
  }
  console.log(`hubspot: ${object} properties ready (${created} created, ${defs.length - created} existed)`);
}

async function ensureProperties(syncFields: boolean): Promise<void> {
  const contactDefs = syncFields ? [...BASE_CONTACT_PROPS, ...SYNC_CONTACT_PROPS] : BASE_CONTACT_PROPS;
  await ensurePropertySet("contacts", contactDefs);
  // Deal custom props only land under --sync-fields (alongside the GT contact signal).
  if (syncFields) await ensurePropertySet("deals", DEAL_PROPS);
}

function put(props: Record<string, string>, key: string, value: string | number | undefined | null) {
  if (value == null || value === "") return;
  props[key] = String(value);
}

export function contactProperties(
  family: CandidateFamily,
  opts: { syncFields: boolean },
): Record<string, string> {
  const props: Record<string, string> = {
    email: family.email,
    firstname: family.first_name ?? "GT",
    lastname: family.last_name ?? "Family",
    gt_ext_id: `family:${family.id}`,
    gt_seed_batch: SEED_BATCH,
  };
  put(props, "phone", family.phone);

  if (opts.syncFields) {
    put(props, "lifecyclestage", family.lifecycle_stage);
    put(props, "gt_lead_score", family.lead_score);
    put(props, "gt_utm_source", mapSource(family.source));
    put(props, "gt_income_band", mapIncomeBand(family.income_band));
    put(props, "gt_grade_band", mapGradeBand(family.grade));
    put(props, "gt_esa_status", mapTefaStatus(family.tefa_status));
  }

  return props;
}

async function loadCandidates(args: Args): Promise<CandidateFamily[]> {
  return withoutProgram(async (sql) => {
    if (args.includeLinked) return selectCandidates(sql, "", args.limit);
    return selectCandidates(
      sql,
      "and (hubspot_contact_id is null or hubspot_contact_id !~ '^[0-9]+$')",
      args.limit,
    );
  });
}

async function selectCandidates(
  sql: ScopedSql,
  linkedFilter: string,
  limit: number,
): Promise<CandidateFamily[]> {
  return sql<CandidateFamily[]>`
    with unique_email as (
      select distinct on (lower(email))
        id, hubspot_contact_id, email, phone, first_name, last_name,
        funnel_stage, tefa_status, income_band, grade, lifecycle_stage,
        lead_score, source, created_at
      from families
      where email is not null and btrim(email) <> ''
        ${linkedFilter ? sql.unsafe(linkedFilter) : sql``}
      order by lower(email), created_at asc
    )
    select *
    from unique_email
    order by
      case funnel_stage
        when 'deposit' then 0
        when 'shadow_day' then 1
        when 'applicant' then 2
        when 'lead' then 3
        else 4
      end,
      created_at asc
    limit ${limit}`;
}

async function findContactByEmail(email: string): Promise<HsObject | null> {
  const res = await hs<SearchResult>("/crm/v3/objects/contacts/search", {
    method: "POST",
    body: {
      filterGroups: [
        { filters: [{ propertyName: "email", operator: "EQ", value: email }] },
      ],
      properties: ["email", "gt_ext_id", "gt_seed_batch"],
      limit: 1,
    },
  });
  return res.results?.[0] ?? null;
}

async function createContact(properties: Record<string, string>): Promise<HsObject> {
  return hs<HsObject>("/crm/v3/objects/contacts", {
    method: "POST",
    body: { properties },
  });
}

async function patchContact(id: string, properties: Record<string, string>): Promise<void> {
  await hs(`/crm/v3/objects/contacts/${id}`, {
    method: "PATCH",
    body: { properties },
  });
}

async function linkFamilyToContact(familyId: string, contactId: string): Promise<boolean> {
  return withoutProgram(async (sql) => {
    const updated = await sql<{ id: string }[]>`
      update families
         set hubspot_contact_id = ${contactId},
             hs_updated_at = now(),
             last_synced_at = now()
       where id = ${familyId}
         and not exists (
           select 1 from families
            where hubspot_contact_id = ${contactId}
              and id <> ${familyId}
         )
       returning id`;

    if (updated.length === 0) return false;

    await sql`
      insert into sync_identity_map (local_table, local_id, system, external_id)
      values ('families', ${familyId}, 'hubspot', ${contactId})
      on conflict (system, external_id) do update set
        local_table = excluded.local_table,
        local_id = excluded.local_id`;
    return true;
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const candidates = await loadCandidates(args);
  console.log(
    `hubspot bridge: ${candidates.length} unique-email families selected ` +
      `(${args.apply ? "APPLY" : "dry-run"}, syncFields=${args.syncFields})`,
  );

  if (!args.apply) {
    for (const f of candidates.slice(0, 10)) {
      console.log(
        `  ${f.email}  family=${f.id}  current_hs=${f.hubspot_contact_id ?? "null"}  ` +
          `stage=${f.funnel_stage ?? "none"}`,
      );
    }
    console.log("\nDry-run only. Re-run with --apply to create/update HubSpot contacts.");
    return;
  }

  await ensureProperties(args.syncFields);

  let created = 0;
  let updated = 0;
  let matchedExisting = 0;
  let linked = 0;
  let skippedDbConflict = 0;

  for (const family of candidates) {
    const props = contactProperties(family, { syncFields: args.syncFields });
    const existing = await findContactByEmail(family.email);
    const contact = existing ?? (await createContact(props));
    if (existing) {
      if (args.syncFields) {
        await patchContact(existing.id, props);
        updated++;
      } else {
        matchedExisting++;
      }
    } else {
      created++;
    }

    if (await linkFamilyToContact(family.id, contact.id)) linked++;
    else skippedDbConflict++;

    const action = existing ? (args.syncFields ? "updated" : "matched") : "created";
    console.log(
      `  ${action} contact=${contact.id} family=${family.id} email=${family.email}`,
    );
  }

  console.log("\nHubSpot bridge complete:");
  console.log(`  created contacts: ${created}`);
  console.log(`  updated contacts: ${updated}`);
  console.log(`  matched existing: ${matchedExisting}`);
  console.log(`  linked families:  ${linked}`);
  if (skippedDbConflict) console.log(`  skipped DB conflicts: ${skippedDbConflict}`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main()
    .then(() => closeDb())
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error("seed-hubspot failed:", err instanceof Error ? err.message : err);
      await closeDb().catch(() => {});
      process.exit(1);
    });
}
