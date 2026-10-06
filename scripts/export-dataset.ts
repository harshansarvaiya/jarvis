/**
 * J.A.R.V.I.S. Mark II — Autonomous Dataset Export & Fine-Tuning Distillation CLI
 * 
 * Ingests recorded execution trajectories, filters for signal quality,
 * sanitizes secrets, and formats into standardized datasets for fine-tuning.
 * 
 * Usage:
 *   npx tsx scripts/export-dataset.ts
 *   npm run dataset:export
 */

import path from 'path';
import { exportAllFineTuningDatasets } from '../lib/jarvis/trajectory';

async function main() {
  console.log('================================================================');
  console.log('🤖 J.A.R.V.I.S. Mark II — Model Distillation & Fine-Tuning Pipeline');
  console.log('================================================================');
  console.log('Initiating trajectory ingestion, sanitization, and serialization...\n');

  const exportDir = path.resolve(process.cwd(), 'data', 'trajectories', 'export');
  const startTime = Date.now();

  try {
    const stats = exportAllFineTuningDatasets(
      {
        minPromptLength: 5,
        minReplyLength: 20,
        persona: 'ALL',
        includeThoughts: true,
        includeToolCalls: true,
        sanitizeSecrets: true,
        deduplicate: true,
      },
      exportDir
    );

    const elapsed = Date.now() - startTime;

    console.log('✅ Distillation & Dataset Generation Complete in ' + elapsed + 'ms\n');
    console.log('📊 DATASET TELEMETRY & METRICS:');
    console.log('----------------------------------------------------------------');
    console.log(`• Total Raw Trajectories Ingested:  ${stats.totalIngested}`);
    console.log(`• Quality-Filtered Valid Records:    ${stats.filteredValid}`);
    console.log(`• Pruned / Deduplicated / Outliers:   ${stats.rejectedCount}`);
    console.log(`• Train Split (90%):                 ${stats.trainCount} conversations`);
    console.log(`• Validation Split (10%):            ${stats.valCount} conversations`);
    console.log(`• Average Prompt Length:             ${stats.avgPromptChars} characters`);
    console.log(`• Average Reply Length:              ${stats.avgReplyChars} characters`);
    console.log(`• Estimated Total Tokens:            ~${stats.estimatedTotalTokens.toLocaleString()} tokens`);
    console.log(`• Tool-Calling Interactions:         ${stats.toolCallInteractions}`);
    console.log(`• Persona Breakdown:`);
    for (const [persona, count] of Object.entries(stats.personaBreakdown)) {
      console.log(`    - ${persona}: ${count}`);
    }
    console.log('----------------------------------------------------------------');
    console.log('\n📁 EXPORTED DATASET ARTIFACTS:');
    console.log(`  1. OpenAI Format (JSONL):`);
    console.log(`     -> ${path.join(exportDir, 'train_openai.jsonl')}`);
    console.log(`     -> ${path.join(exportDir, 'val_openai.jsonl')}`);
    console.log(`  2. ShareGPT Format (JSON):`);
    console.log(`     -> ${path.join(exportDir, 'train_sharegpt.json')}`);
    console.log(`     -> ${path.join(exportDir, 'val_sharegpt.json')}`);
    console.log(`  3. Alpaca Format (JSON):`);
    console.log(`     -> ${path.join(exportDir, 'train_alpaca.json')}`);
    console.log(`     -> ${path.join(exportDir, 'val_alpaca.json')}`);
    console.log(`  4. Metadata Manifest:`);
    console.log(`     -> ${path.join(exportDir, 'dataset_manifest.json')}`);
    console.log('\n🚀 READY FOR FINE-TUNING ON:');
    console.log('  • Unsloth (Llama 3.3 70B / 8B, Qwen 2.5 7B/14B, Gemma 2 9B)');
    console.log('  • OpenAI Custom Models (gpt-4o-mini / gpt-4o fine-tuning)');
    console.log('  • Axolotl / LLaMA-Factory / HuggingFace SFTTrainer\n');
  } catch (error) {
    console.error('❌ Failed to export fine-tuning datasets:', error);
    process.exit(1);
  }
}

main();
