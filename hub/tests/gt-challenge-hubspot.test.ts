import { describe, expect, it } from "vitest";
import {
  archiveContact,
  findContactIdByEmail,
  upsertContactByEmail,
} from "@/lib/connectors/hubspot";

// Proves the outbox upsert_contact CREATE path: a freshly captured GT Challenge lead
// (email only, no HubSpot id) becomes a real contact in live HubSpot, idempotently.
// Creates and then archives one contact, so it leaves no residue. Skips without a token.
const HAS_HS = Boolean(process.env.HUBSPOT_PRIVATE_APP_TOKEN?.startsWith("pat-"));

(HAS_HS ? describe : describe.skip)("GT Challenge lead → live HubSpot contact", () => {
  it("creates a contact by email, resolves it, is idempotent, then archives", async () => {
    const email = `gtc-verify-${Date.now()}@example.com`;
    let id: string | null = null;
    try {
      const created = await upsertContactByEmail(email, { hs_lead_status: "NEW" });
      id = created.id;
      expect(created.created).toBe(true);
      expect(id).toBeTruthy();

      // resolvable by email (the natural key the outbox uses)
      const found = await findContactIdByEmail(email);
      expect(found).toBe(id);

      // re-dispatch of the same outbox row finds + patches, never duplicates
      const again = await upsertContactByEmail(email, { hs_lead_status: "UNQUALIFIED" });
      expect(again.created).toBe(false);
      expect(again.id).toBe(id);
    } finally {
      if (id) await archiveContact(id);
    }
  });
});
