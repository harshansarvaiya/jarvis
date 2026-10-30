/**
 * J.A.R.V.I.S. Mark II — V.I.S. v3 Unified Curriculum Compiler
 * 
 * Combines v2 grounded agentic trajectories with v3 multi-step chaining
 * trajectories into a unified, high-entropy training master file for 70B QLoRA.
 */

import fs from 'fs';
import path from 'path';

export function compileUnifiedV3Corpus() {
  const v2Path = path.resolve(process.cwd(), 'data', 'distill', 'v2_agentic', 'train_master_v2.jsonl');
  const v3Path = path.resolve(process.cwd(), 'data', 'distill', 'v3_70b', 'train_master_v3.jsonl');
  const unifiedDir = path.resolve(process.cwd(), 'data', 'distill', 'v3_70b');
  const unifiedPath = path.join(unifiedDir, 'train_master_v3_unified.jsonl');

  if (!fs.existsSync(unifiedDir)) {
    fs.mkdirSync(unifiedDir, { recursive: true });
  }

  const placeholderRegex = /(MyApp|src\/main\.py|src\/auth\/oauth\.py|foo\/bar|test\.py)/i;

  const sanitizeLine = (lineStr: string): string | null => {
    if (placeholderRegex.test(lineStr)) return null;
    try {
      const obj = JSON.parse(lineStr);
      const msgs = obj.messages || obj.conversations || [];
      for (const m of msgs) {
        if (m.content) {
          // Normalize duplicate or nested thought tags
          m.content = m.content
            .replace(/<thought>\s*<thought>/g, '<thought>')
            .replace(/<\/thought>\s*<\/thought>/g, '</thought>');
        }
      }
      return JSON.stringify(obj);
    } catch {
      return null;
    }
  };

  const v2Lines = fs.existsSync(v2Path)
    ? fs.readFileSync(v2Path, 'utf-8').trim().split('\n').filter(l => l.trim())
    : [];
  
  const v3Lines = fs.existsSync(v3Path)
    ? fs.readFileSync(v3Path, 'utf-8').trim().split('\n').filter(l => l.trim())
    : [];

  const sanitizedV2: string[] = [];
  for (const l of v2Lines) {
    const s = sanitizeLine(l);
    if (s) sanitizedV2.push(s);
  }

  const sanitizedV3: string[] = [];
  for (const l of v3Lines) {
    const s = sanitizeLine(l);
    if (s) sanitizedV3.push(s);
  }

  const combined = [...sanitizedV2, ...sanitizedV3];
  fs.writeFileSync(unifiedPath, combined.join('\n') + '\n', 'utf-8');

  console.log(`[V.I.S. v3 Curriculum] 🚀 Unified training corpus compiled!`);
  console.log(`  - v2 Grounded Trajectories: ${sanitizedV2.length} (from ${v2Lines.length})`);
  console.log(`  - v3 Multi-Step Chaining Trajectories: ${sanitizedV3.length} (from ${v3Lines.length})`);
  console.log(`  - Total Master Sequences: ${combined.length}`);
  console.log(`  - Destination: ${unifiedPath}`);
}

if (process.argv[1] && process.argv[1].includes('prepare_v3_corpus')) {
  compileUnifiedV3Corpus();
}
