import { createHash } from "node:crypto";

/**
 * SourceConnector — the uniform shape every external data source presents to the
 * Hub (HubSpot, Stripe, summer.gt.school, community.gt.school, Meta, GA4). The
 * sync engine programs against this interface only; concrete connectors are
 * swapped in as live credentials arrive.
 */

export interface SourceRecord {
  /** Native id in the source system (HubSpot contact id, Stripe customer id, …). */
  externalId: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  zip?: string | null;
  /** ISO timestamp of the source's last update, when the source provides one. */
  updatedAt?: string;
  /** Untyped source-native payload, retained for the event log. */
  raw?: Record<string, unknown>;
}

export interface SourceUpdate {
  externalId: string;
  fields: Record<string, unknown>;
}

export interface WebhookReq {
  headers: Record<string, string | string[] | undefined>;
  /** The exact raw request body — signature checks must run over bytes, not parsed JSON. */
  rawBody: string;
}

export interface SourceConnector {
  readonly name: string;
  fetchSince(since: Date): Promise<SourceRecord[]>;
  pushUpdate(rec: SourceUpdate): Promise<void>;
  verifyWebhook(req: WebhookReq): boolean;
}

/* ----------------------------- identity resolution ----------------------------- */

type Identity = Pick<
  SourceRecord,
  "email" | "phone" | "firstName" | "lastName" | "zip"
>;

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * The dual-source identity-resolution key. Picks the strongest available signal
 * in priority order — normalized email → phone digits → name+zip — then hashes a
 * type-tagged string (the tag stops an email and a phone from ever colliding).
 * Returns null when no usable signal exists. Mirrors families.match_key in the DB.
 */
export function matchKey(rec: Identity): string | null {
  const email = rec.email?.trim().toLowerCase();
  if (email) return sha256(`email:${email}`);

  const phone = (rec.phone ?? "").replace(/\D/g, "");
  if (phone.length >= 7) return sha256(`phone:${phone}`);

  const name = [rec.firstName, rec.lastName]
    .map((s) => s?.trim().toLowerCase() ?? "")
    .filter(Boolean)
    .join(" ");
  const zip = (rec.zip ?? "").trim().toLowerCase();
  if (name && zip) return sha256(`namezip:${name}|${zip}`);

  return null;
}

/* --------------------------------- mock source --------------------------------- */

/**
 * mockConnector — a clearly-labeled, seeded stand-in for the sources we don't yet
 * have live keys for (summer / community / meta / ga4). Deterministic so tests and
 * demos are reproducible. NOT for production: verifyWebhook accepts everything.
 */
export function mockConnector(name: string): SourceConnector {
  const seed: SourceRecord[] = [
    {
      externalId: `mock-${name}-1`,
      email: "AVA.Reyes@example.com",
      phone: "(512) 555-0142",
      firstName: "Ava",
      lastName: "Reyes",
      zip: "78704",
      updatedAt: "2026-06-01T12:00:00.000Z",
      raw: { _mock: true, source: name },
    },
    {
      externalId: `mock-${name}-2`,
      email: null,
      phone: "512-555-0177",
      firstName: "Noah",
      lastName: "Kim",
      zip: "78745",
      updatedAt: "2026-06-02T09:30:00.000Z",
      raw: { _mock: true, source: name },
    },
    {
      externalId: `mock-${name}-3`,
      email: null,
      phone: null,
      firstName: "Mia",
      lastName: "Patel",
      zip: "78702",
      updatedAt: "2026-06-03T15:45:00.000Z",
      raw: { _mock: true, source: name },
    },
  ];

  return {
    name: `mock:${name}`,
    async fetchSince(since: Date): Promise<SourceRecord[]> {
      return seed.filter(
        (r) => !r.updatedAt || new Date(r.updatedAt) >= since,
      );
    },
    async pushUpdate(_rec: SourceUpdate): Promise<void> {
      // mock: accepted and discarded — no external write.
    },
    verifyWebhook(_req: WebhookReq): boolean {
      // mock: no real signature — accepts all. Never use in production.
      return true;
    },
  };
}

/* ------------------------- real connectors (stubs / TODO) ------------------------ */

function notImplemented(name: string): never {
  throw new Error(
    `${name} connector is not implemented yet — it needs live credentials. ` +
      `Implement against the live API once keys are provisioned.`,
  );
}

/** HubSpot is the CRM source of truth for contacts/deals. TODO: implement live. */
export function hubspotConnector(): SourceConnector {
  return {
    name: "hubspot",
    async fetchSince(_since: Date): Promise<SourceRecord[]> {
      // TODO: GET /crm/v3/objects/contacts?... with HUBSPOT_PRIVATE_APP_TOKEN.
      notImplemented("hubspot");
    },
    async pushUpdate(_rec: SourceUpdate): Promise<void> {
      // TODO: PATCH /crm/v3/objects/contacts/{id} (field-directional authority applies).
      notImplemented("hubspot");
    },
    verifyWebhook(_req: WebhookReq): boolean {
      // TODO: validate X-HubSpot-Signature-v3 with HUBSPOT_APP_SECRET over rawBody.
      notImplemented("hubspot");
    },
  };
}

/** Stripe (test mode) for payments. TODO: implement live. */
export function stripeConnector(): SourceConnector {
  return {
    name: "stripe",
    async fetchSince(_since: Date): Promise<SourceRecord[]> {
      // TODO: list customers/charges created>=since with STRIPE_SECRET_KEY.
      notImplemented("stripe");
    },
    async pushUpdate(_rec: SourceUpdate): Promise<void> {
      notImplemented("stripe");
    },
    verifyWebhook(_req: WebhookReq): boolean {
      // TODO: Stripe-Signature check via STRIPE_WEBHOOK_SECRET over rawBody.
      notImplemented("stripe");
    },
  };
}
