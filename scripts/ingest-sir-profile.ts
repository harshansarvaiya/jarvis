import * as fs from 'fs';
import * as path from 'path';
import { ingestKnowledgeDocument } from '../lib/jarvis/rag';
import { getStorage } from '../lib/jarvis/storage';

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
  const profileMd = fs.readFileSync(path.resolve(process.cwd(), 'knowledge', 'sir-master-profile.md'), 'utf8');
  const res = await ingestKnowledgeDocument({
    title: 'Master Operational Profile: Sir (Harshan Kishor Sarvaiya)',
    content: profileMd,
    category: 'CREATOR_PROFILE',
    tags: ['harshan', 'profile', 'morgan-stanley', 'java', 'schedule', 'fitness', 'nutrition'],
  });

  console.log(`[RAG Engine] Successfully indexed Sir's Master Profile: ${res.chunksIndexed} chunks (${res.totalCharacters} chars).`);

  const storage = getStorage();
  const profileJson = fs.readFileSync(path.resolve(process.cwd(), 'data', 'sir-profile.json'), 'utf8');
  await storage.execute('set', 'jarvis:sir_profile', profileJson);
  console.log('[Storage Engine] Successfully synchronized jarvis:sir_profile to Upstash Redis.');
}

main().catch(console.error);
