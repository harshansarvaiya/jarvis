import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...rest] = trimmed.split('=');
      if (key && rest.length > 0 && !process.env[key.trim()]) {
        process.env[key.trim()] = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
      }
    }
  }
}

import { runJarvisAgent } from '../lib/jarvis/agent';

async function main() {
  console.log('🚀 [Test] Verifying V.I.S. with Antigravity-Parity Harness...');
  const prompt = 'Vis, Antigravity harness test: inspect package.json using read_file to check our dependencies, and run git status using run_command to report our current branch status.';

  const startTime = Date.now();
  const res = await runJarvisAgent(
    [{ role: 'user', content: prompt }],
    {
      orchestrationMode: 'sovereign-arc',
      model: 'vis',
      persona: 'VIS',
    }
  );

  const duration = Date.now() - startTime;
  console.log(`\n⏱️ Duration: ${duration}ms`);
  console.log(`🧠 Engine Used: ${res.telemetry?.engineUsed}`);
  console.log(`🔧 Tools Executed (${res.toolCallsExecuted?.length || 0}):`);
  for (const tc of res.toolCallsExecuted || []) {
    console.log(`  - [${tc.name}]:`, JSON.stringify(tc.args).slice(0, 100));
  }
  console.log('\n📜 V.I.S. Reply:\n', res.reply);
  if (res.internalThoughts) {
    console.log('\n💭 V.I.S. Thoughts:\n', res.internalThoughts);
  }
}

main().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
