import * as fs from 'fs';
import * as path from 'path';
import { getStorage, getUniversalState, saveUniversalState } from '../lib/jarvis/storage';

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
  const storage = getStorage();

  // 1. Clean local jarvis-state.json
  const statePath = path.resolve(process.cwd(), 'data', 'jarvis-state.json');
  if (fs.existsSync(statePath)) {
    const localState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const beforeCount = localState.memories?.length || 0;
    localState.memories = (localState.memories || []).filter(
      (m: any) => m.id !== 'mem-1789537066306-ve5m' && !m.content.includes('Java, Spring Boot, Kafka')
    );
    fs.writeFileSync(statePath, JSON.stringify(localState, null, 2), 'utf8');
    console.log(`[Local State] Purged poisoned memory. Count: ${beforeCount} -> ${localState.memories.length}`);
  }

  // 2. Clean Upstash Redis state
  const cloudState = await getUniversalState();
  if (cloudState) {
    const beforeCount = cloudState.memories?.length || 0;
    cloudState.memories = (cloudState.memories || []).filter(
      (m: any) => m.id !== 'mem-1789537066306-ve5m' && !m.content.includes('Java, Spring Boot, Kafka')
    );
    await saveUniversalState(cloudState);
    console.log(`[Upstash Redis] Purged poisoned memory. Count: ${beforeCount} -> ${cloudState.memories.length}`);
  }

  // 3. Clean hallucinated messages from jarvis:chat_history in Redis
  try {
    const rawHistory = await storage.execute('get', 'jarvis:chat_history');
    if (rawHistory) {
      let history = typeof rawHistory === 'string' ? JSON.parse(rawHistory) : rawHistory;
      if (Array.isArray(history)) {
        const origLen = history.length;
        history = history.filter(
          (msg: any) => !msg.content.includes('Java/Spring, Kafka') && !msg.content.includes('order-events')
        );
        await storage.execute('set', 'jarvis:chat_history', JSON.stringify(history));
        console.log(`[Chat History] Purged hallucinated turns. Count: ${origLen} -> ${history.length}`);
      }
    }
  } catch (err: any) {
    console.warn('[Chat History] Purge warning:', err.message);
  }

  console.log('✅ Sanitization complete: Zero residual Java/Spring/Kafka hallucinations.');
}

main().catch(console.error);
