import type {
  SourceConnector,
  SourceRecord,
  SourceUpdate,
  WebhookReq,
} from "./SourceConnector";

/**
 * hubspot.ts — the HubSpot side of SourceConnector (CRM source of truth).
 *
 * THIS TASK ships the client + outbound PATCH only:
 *   - hs()         zero-dep request helper with 429/5xx backoff honoring Retry-After
 *   - patchDeal()  the outbound write the Stripe sync_outbox drains
 *   - listContacts() / scopeCheck()  cheap token+scope proofs
 *
 * Full inbound sync (fetchSince) and inbound webhook verification are a LATER task,
 * so they fail-closed/notImplemented here rather than pretending to work.
 */

const BASE = "https://api.hubapi.com";

function token(): string {
  const t = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!t || !t.startsWith("pat-")) {
    throw new Error(
      "HUBSPOT_PRIVATE_APP_TOKEN missing/invalid (expected a 'pat-…' private-app token).",
    );
  }
  return t;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export interface HsError extends Error {
  status?: number;
  body?: unknown;
}

/**
 * Core HubSpot request. Retries on 429 (rate limit) and 5xx, honoring Retry-After
 * when present; otherwise linear backoff. Throws an annotated error (with .status)
 * on a non-retryable failure.
 */
export async function hs<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; retries?: number } = {},
): Promise<T> {
  const { method = "GET", body, retries = 5 } = opts;
  const url = path.startsWith("http") ? path : BASE + path;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token()}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= retries) {
        throw new Error(`${method} ${path} → ${res.status} after ${retries} retries`);
      }
      const retryAfter = Number(res.headers.get("Retry-After"));
      const wait = retryAfter ? retryAfter * 1000 : (attempt + 1) * 1500;
      await sleep(wait);
      continue;
    }
    const text = await res.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        /* non-JSON body (e.g. an HTML error page) */
      }
    }
    if (!res.ok) {
      const msg =
        (json as { message?: string } | null)?.message ||
        text.slice(0, 200) ||
        res.statusText;
      const err: HsError = new Error(`${method} ${path} → ${res.status}: ${msg}`);
      err.status = res.status;
      err.body = json ?? text;
      throw err;
    }
    return json as T;
  }
}

/* ------------------------------- outbound writes ------------------------------- */

/** PATCH a HubSpot deal's properties (e.g. {dealstage:'closedwon'}). The drain target of sync_outbox. */
export async function patchDeal(
  dealId: string,
  properties: Record<string, string>,
): Promise<{ id: string }> {
  return hs<{ id: string }>(`/crm/v3/objects/deals/${dealId}`, {
    method: "PATCH",
    body: { properties },
  });
}

/* --------------------- test-support CRUD (deals + contacts) --------------------- */
// Thin wrappers used by the live sync verifications to create/inspect/clean up a
// single real object. Production sync paths use patchDeal / fetchSince / pushUpdate.

export async function createDeal(properties: Record<string, string>): Promise<{ id: string }> {
  return hs<{ id: string }>(`/crm/v3/objects/deals`, { method: "POST", body: { properties } });
}
export async function getDeal(
  dealId: string,
  properties: string[] = ["dealstage", "dealname"],
): Promise<{ id: string; properties: Record<string, string | null> }> {
  return hs(`/crm/v3/objects/deals/${dealId}?properties=${properties.join(",")}`);
}
export async function archiveDeal(dealId: string): Promise<void> {
  await hs(`/crm/v3/objects/deals/${dealId}`, { method: "DELETE" });
}
export async function createContact(properties: Record<string, string>): Promise<{ id: string }> {
  return hs<{ id: string }>(`/crm/v3/objects/contacts`, { method: "POST", body: { properties } });
}

/**
 * Resolve a contact by exact email via the search index. Returns the HubSpot id or
 * null. Used by the outbox upsert_contact path to create-or-patch a freshly captured
 * lead (e.g. a GT Challenge gifted-quiz submission) that has no HubSpot id yet.
 */
export async function findContactIdByEmail(email: string): Promise<string | null> {
  const res = await hs<HsSearchResult>(`/crm/v3/objects/contacts/search`, {
    method: "POST",
    body: {
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
      properties: ["email"],
      limit: 1,
    },
  });
  return res.results?.[0]?.id ?? null;
}

/**
 * Create-or-update a contact keyed by email (the natural key for a new lead).
 * Idempotent at the HubSpot layer: a re-dispatched outbox row finds the same contact
 * and patches it rather than creating a duplicate.
 */
export async function upsertContactByEmail(
  email: string,
  properties: Record<string, string>,
): Promise<{ id: string; created: boolean }> {
  const existing = await findContactIdByEmail(email);
  if (existing) {
    await hs(`/crm/v3/objects/contacts/${existing}`, { method: "PATCH", body: { properties } });
    return { id: existing, created: false };
  }
  const made = await createContact({ email, ...properties });
  return { id: made.id, created: true };
}
export async function archiveContact(contactId: string): Promise<void> {
  await hs(`/crm/v3/objects/contacts/${contactId}`, { method: "DELETE" });
}

/* -------------------------------- cheap reads -------------------------------- */

export interface HsContact {
  id: string;
  properties: Record<string, string | null>;
}

/** List contacts — the cheapest read proof that the token + crm.objects.contacts scope work. */
export async function listContacts(limit = 1): Promise<HsContact[]> {
  const res = await hs<{ results?: HsContact[] }>(
    `/crm/v3/objects/contacts?limit=${limit}`,
  );
  return res.results ?? [];
}

export interface ScopeCheck {
  ok: boolean;
  contacts: boolean;
  deals: boolean;
  contactSample?: string;
  errors: Record<string, string>;
}

/**
 * Confirm the private-app token is live and which object scopes it can read.
 * Returns a structured result (never throws) so dev drivers can branch on it.
 */
export async function scopeCheck(): Promise<ScopeCheck> {
  const errors: Record<string, string> = {};
  let contacts = false;
  let deals = false;
  let contactSample: string | undefined;

  try {
    const c = await listContacts(1);
    contacts = true;
    contactSample = c[0]?.id;
  } catch (e) {
    errors.contacts = e instanceof Error ? e.message : String(e);
  }
  try {
    await hs(`/crm/v3/objects/deals?limit=1`);
    deals = true;
  } catch (e) {
    errors.deals = e instanceof Error ? e.message : String(e);
  }

  return { ok: contacts, contacts, deals, contactSample, errors };
}

/* ----------------------- field mapping (families ↔ HubSpot) ----------------------- */

/**
 * families column → HubSpot contact property. The reconciler reads DIRECTION from
 * the field_authority table; this map only says WHICH HubSpot property mirrors each
 * field. funnel_stage has no HubSpot property in this portal, so it is intentionally
 * absent (the inbound apply skips fields it can't read from HubSpot).
 */
export const HS_PROP_FOR_FIELD: Record<string, string> = {
  email: "email",
  phone: "phone",
  lifecycle_stage: "lifecyclestage",
  source: "gt_utm_source",
  lead_score: "gt_lead_score",
  income_band: "gt_income_band",
  grade: "gt_grade_band",
  tefa_status: "gt_esa_status",
};

const HS_CONTACT_PROPERTIES: string[] = [
  "email",
  "firstname",
  "lastname",
  "zip",
  "lastmodifieddate",
  ...Object.values(HS_PROP_FOR_FIELD),
];

interface HsSearchResult {
  results: { id: string; properties: Record<string, string | null> }[];
  paging?: { next?: { after?: string } };
}

/**
 * Pull contacts modified at or after `since` (HubSpot's modified-since search index),
 * paginated, sorted ascending by lastmodifieddate so a watermark can advance
 * monotonically. The reconciler calls this with (watermark − Δ) to absorb HubSpot's
 * index lag. Returns SourceRecords whose `raw` carries the full property bag (the
 * field-directional apply reads field values out of raw via HS_PROP_FOR_FIELD).
 */
export async function fetchContactsSince(since: Date): Promise<SourceRecord[]> {
  const out: SourceRecord[] = [];
  let after: string | undefined;
  do {
    const body: Record<string, unknown> = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "lastmodifieddate",
              operator: "GTE",
              value: String(since.getTime()),
            },
          ],
        },
      ],
      sorts: [{ propertyName: "lastmodifieddate", direction: "ASCENDING" }],
      properties: HS_CONTACT_PROPERTIES,
      limit: 100,
      after,
    };
    const res = await hs<HsSearchResult>(`/crm/v3/objects/contacts/search`, {
      method: "POST",
      body,
    });
    for (const r of res.results ?? []) {
      const p = r.properties ?? {};
      out.push({
        externalId: r.id,
        email: p.email ?? null,
        phone: p.phone ?? null,
        firstName: p.firstname ?? null,
        lastName: p.lastname ?? null,
        zip: p.zip ?? null,
        updatedAt: p.lastmodifieddate ?? undefined,
        raw: p,
      });
    }
    after = res.paging?.next?.after;
  } while (after);
  return out;
}

/* ---------------------------- SourceConnector shape ---------------------------- */

/**
 * The HubSpot SourceConnector. fetchSince is the live modified-since pull;
 * pushUpdate is the outbound contact PATCH. verifyWebhook fails CLOSED here — the
 * inbound webhook route does the real X-HubSpot-Signature-v3 check itself (it has
 * the method + full URI + timestamp that a v3 signature requires; WebhookReq does not).
 */
export function hubspotConnector(): SourceConnector {
  return {
    name: "hubspot",

    fetchSince(since: Date): Promise<SourceRecord[]> {
      return fetchContactsSince(since);
    },

    async pushUpdate(rec: SourceUpdate): Promise<void> {
      await hs(`/crm/v3/objects/contacts/${rec.externalId}`, {
        method: "PATCH",
        body: { properties: rec.fields },
      });
    },

    verifyWebhook(_req: WebhookReq): boolean {
      // v3 signatures sign method+URI+body+timestamp; WebhookReq carries only
      // headers+rawBody. The route owns verification — fail CLOSED here.
      return false;
    },
  };
}
