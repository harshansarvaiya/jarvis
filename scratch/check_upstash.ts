import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const envVars = Object.fromEntries(
  env.split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

async function run() {
  const url = envVars.UPSTASH_REDIS_REST_URL;
  const token = envVars.UPSTASH_REDIS_REST_TOKEN;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['GET', 'jarvis:chat_history']),
  });
  const data = await res.json();
  const msgs = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
  console.log(`Total messages in Upstash history: ${msgs.length}`);
  const slice = msgs.slice(-5);
  slice.forEach((m: any, i: number) => {
    console.log(`\n======================================================`);
    console.log(`[MESSAGE ${msgs.length - slice.length + i + 1} of ${msgs.length}]`);
    console.log(`Role: ${m.role} | Source: ${m.source || 'n/a'} | Channel: ${m.channel || 'n/a'} | Timestamp: ${m.timestamp}`);
    console.log(`Content:\n${m.content}`);
    if (m.vocalSummary) console.log(`\nVocal Summary:\n${m.vocalSummary}`);
    if (m.telemetry) console.log(`\nTelemetry:\n`, JSON.stringify(m.telemetry, null, 2));
  });
}

run().catch(console.error);
