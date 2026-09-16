import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...rest] = trimmed.split('=');
        if (key && rest.length > 0 && !process.env[key.trim()]) {
          process.env[key.trim()] = rest.join('=').trim();
        }
      }
    }
  }
}

loadEnv();

async function main() {
  const { getUniversalChatHistory, getUniversalState } = await import('../lib/jarvis/storage');
  const history = await getUniversalChatHistory(15);
  console.log('=== TOTAL CHAT HISTORY COUNT:', history.length, '===');
  for (let i = 0; i < history.length; i++) {
    const h = history[i];
    console.log(`\n[MESSAGE ${i + 1}] ROLE: ${h.role} | TIME: ${h.timestamp}`);
    if (h.telemetry) {
      console.log(`ENGINE: ${h.telemetry.engineUsed} | MODEL: ${h.telemetry.model} | PROVIDER: ${h.telemetry.provider}`);
    }
    console.log(`CONTENT: ${h.content}`);
    if (h.motiveAnalysis) {
      console.log(`MOTIVE PASS: ${h.motiveAnalysis}`);
    }
  }

  const state = await getUniversalState();
  console.log('\n=== RECENT ASSIMILATED MEMORIES ===');
  const memories = state?.memories || [];
  for (const m of memories.slice(-10)) {
    console.log(`- [${m.category}]: ${m.content} (Context: ${m.context || 'none'})`);
  }
}

main().catch(console.error);
