/**
 * J.A.R.V.I.S. Mark II — Project A.R.C. Background Dataset Scaling Daemon
 * 
 * Periodically compiles high-entropy synthetic pairs into the raw distillation ledger
 * and updates the master training corpus. Runs with low CPU/RAM priority to strictly
 * adhere to Directive 06 (Zero VM Thrashing).
 * 
 * Usage:
 *   npx tsx scripts/distill/daemon-forge.ts --batches 10 --batch-size 4
 */

import { runDistillationForge } from './generate-dataset';

async function main() {
  const args = process.argv.slice(2);
  let totalBatches = 5;
  let batchSize = 4;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--batches' && args[i + 1]) {
      totalBatches = parseInt(args[i + 1], 10) || 5;
      i++;
    } else if (args[i] === '--batch-size' && args[i + 1]) {
      batchSize = parseInt(args[i + 1], 10) || 4;
      i++;
    }
  }

  console.log(`[A.R.C. Daemon Forge] Initializing background expansion: ${totalBatches} batches of ${batchSize} pairs...`);

  for (let b = 1; b <= totalBatches; b++) {
    console.log(`\n--- Batch ${b}/${totalBatches} ---`);
    await runDistillationForge(batchSize, 'ALL');
    // Cooling period between batches to prevent API rate spikes and zero VM contention
    if (b < totalBatches) {
      console.log('Sleeping 3 seconds before next distillation cycle...');
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log('\n[A.R.C. Daemon Forge] Background expansion cycle completed successfully.');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Daemon Forge error:', err);
    process.exit(1);
  });
}
