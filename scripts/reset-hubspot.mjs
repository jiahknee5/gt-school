// Wipe every seeded record (gt_seed_batch=gt_seed_v1) from the HubSpot portal.
// Lets you reset to a clean known state for the walkthrough (brief requirement).
// Run:  node scripts/reset-hubspot.mjs

import { searchSeeded, batchArchive } from './lib/hubspot.mjs';
import { SEED_TAG } from './lib/data-model.mjs';

async function main() {
  console.log(`Resetting all records tagged ${SEED_TAG}…\n`);
  for (const type of ['deals', 'contacts']) {
    const ids = await searchSeeded(type, SEED_TAG);
    if (!ids.length) {
      console.log(`  ${type}: nothing to remove.`);
      continue;
    }
    await batchArchive(type, ids);
    console.log(`  ${type}: archived ${ids.length}.`);
  }
  console.log('\nClean. Re-seed with: node scripts/seed-hubspot.mjs');
}

main().catch((e) => {
  console.error('✗ Reset failed:', e.message);
  process.exit(1);
});
