import { loadEnvLocal } from "./_env";
import { scopeCheck } from "../lib/connectors/hubspot";

loadEnvLocal();

/**
 * verify-hubspot.ts — cheap token + scope proof for the HubSpot private app.
 * Lists one contact and probes the deals object. Exit 0 iff the token can read
 * contacts; exit 1 otherwise. Mutates nothing.
 *
 * Run: esbuild scripts/verify-hubspot.ts --bundle --platform=node --format=esm \
 *        --packages=external --outfile=.seed-build/verify-hubspot.mjs && node .seed-build/verify-hubspot.mjs
 */
async function main(): Promise<void> {
  const tok = process.env.HUBSPOT_PRIVATE_APP_TOKEN ?? "";
  console.log(`token present: ${tok ? `yes (${tok.slice(0, 4)}…, len ${tok.length})` : "NO"}`);

  const r = await scopeCheck();
  console.log(`contacts scope: ${r.contacts ? "OK" : "FAIL"}${r.contactSample ? ` (sample contact id ${r.contactSample})` : ""}`);
  console.log(`deals scope:    ${r.deals ? "OK" : "FAIL"}`);
  if (Object.keys(r.errors).length) console.log("errors:", JSON.stringify(r.errors, null, 2));

  if (!r.ok) {
    console.error("✗ HubSpot token/scope check FAILED (cannot read contacts).");
    process.exit(1);
  }
  console.log("✓ HubSpot token works.");
  process.exit(0);
}

main().catch((e) => {
  console.error("verify-hubspot failed:", e);
  process.exit(1);
});
