/**
 * J.A.R.V.I.S. Mark II — Project A.R.C. Distillation Dataset Forge
 * 
 * Synthesizes high-entropy, teacher-distilled training pairs across the 4 core pillars:
 * 1. Persona & Directives (British composure, Directives 01-06, anti-sycophancy)
 * 2. Deterministic Zero-Shot Tool Calling (Exact JSON arguments, schema alignment)
 * 3. Personal Memory & Tactical Knowledge (DSA/System Design, Java/Spring/Kafka, Upstash, MMA)
 * 4. Sparring, Counter-Factual Logic & Multi-Token Prediction (<think> traces, self-correction)
 * 
 * Powered by Vertex AI Gemini 3.8 Flash (Teacher Swarm)
 * 
 * Usage:
 *   npx tsx scripts/distill/generate-dataset.ts --count 50 --pillar ALL
 *   npx tsx scripts/distill/generate-dataset.ts --count 20 --pillar TOOLS
 */

import fs from 'fs';
import path from 'path';
import { callVertexAIGenerate } from '../../lib/jarvis/vertex';

export type DistillPillar = 'PERSONA' | 'TOOLS' | 'MEMORY' | 'SPARRING' | 'ALL';

interface GeneratedPair {
  id: string;
  pillar: string;
  systemPrompt: string;
  userPrompt: string;
  assistantResponse: string;
  thinkingTrace?: string;
  toolCalls?: Array<{ tool: string; args: Record<string, any> }>;
  createdAt: string;
}

const DISTILL_DIR = path.resolve(process.cwd(), 'data', 'distill');
const RAW_OUTPUT_FILE = path.join(DISTILL_DIR, 'distill_raw_pairs.jsonl');
const EXPORT_DIR = path.join(DISTILL_DIR, 'export');

const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z-_]{35}/g,
  /sk-[a-zA-Z0-9]{32,}/g,
  /gsk_[a-zA-Z0-9]{32,}/g,
  /ghp_[a-zA-Z0-9]{36,}/g,
  /xox[baprs]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24}/g,
  /-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----/g,
  /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g,
  /1\/\/[a-zA-Z0-9-_]+/g, // Google OAuth refresh token
  /ya29\.[a-zA-Z0-9-_]+/g, // Google OAuth access token
  /[0-9]+-[a-z0-9_]+\.apps\.googleusercontent\.com/g, // Google client ID
  /GOCSPX-[a-zA-Z0-9-_]+/g, // Google client secret
];

function sanitizeSecrets(text: string): string {
  let cleaned = text;
  for (const pattern of SECRET_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[REDACTED_SECURE_TOKEN]');
  }
  return cleaned;
}

const PILLAR_PROMPTS: Record<Exclude<DistillPillar, 'ALL'>, { system: string; taskPrompt: string }> = {
  PERSONA: {
    system: `You are the master knowledge distillation generator for Project A.R.C. (J.A.R.V.I.S. Mark II).
Your role is to generate authentic, high-signal conversational pairs demonstrating J.A.R.V.I.S.'s signature persona:
- Creator: Address him as "Sir" (Harshan Sarvaiya).
- Tone: British-tinged intellectual elegance, composed, razor-sharp, deferential yet peer-level sparring partner.
- Rules: Zero generic chatbot filler (never say "Certainly!", "I'd be glad to help!"). Dive straight into high-signal intelligence and action items.
- Dual-channel: Often opens with a crisp 1-2 sentence spoken summary, followed by structured markdown.
- Directives: Enforce Directive 01 (100% Western models, zero Chinese models), Directive 03 (continuous adaptation), Directive 06 (zero VM thrashing).`,
    taskPrompt: `Generate 3 diverse, distinct, and ultra-high-quality training examples where Sir asks a strategic, technical, or philosophical question, and J.A.R.V.I.S. responds with signature British composure, intellectual sparring, and zero fluff.
Format your output as a JSON array of objects with keys: "userPrompt", "assistantResponse", and optional "thinkingTrace".`
  },

  TOOLS: {
    system: `You are the tool-calling distillation generator for Project A.R.C. (J.A.R.V.I.S. Mark II).
The target model must learn to execute deterministic zero-shot tool calls matching the exact J.A.R.V.I.S. tool schema without syntax errors.

Supported Tools:
1. manage_task: { action: "create"|"update"|"list"|"complete", title?: string, priority?: "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", taskId?: string }
2. store_memory: { category: "PREFERENCE"|"ARCHITECTURAL_FACT"|"DIRECTIVE"|"MILESTONE", content: string, confidence: number }
3. run_security_audit: { target: string, depth: "LIGHT"|"DEEP"|"OWASP", includeCredentialsScan: boolean }
4. generate_briefing: { timeframe: "MORNING"|"EVENING"|"TACTICAL", focus: string[] }
5. inspect_infrastructure: { component: "RUNNER_VM"|"UPSTASH"|"VERCEL"|"GATEWAY", metric: "HEALTH"|"RESOURCES"|"LATENCY" }`,
    taskPrompt: `Generate 3 diverse tool-calling training examples where Sir gives an imperative instruction (e.g. creating a task, auditing a repo, logging a critical memory, checking VM health), and the assistant outputs an exact, valid JSON tool call followed by a crisp confirmation.
Format your output as a JSON array of objects with keys: "userPrompt", "toolCalls" (array of {tool, args}), "assistantResponse", and "thinkingTrace".`
  },

  MEMORY: {
    system: `You are the memory and domain knowledge distillation generator for Project A.R.C. (J.A.R.V.I.S. Mark II).
You embody deep, intimate understanding of Sir's (Harshan Sarvaiya's) exact engineering and physical roadmap:
- Engineering: Distributed backend systems, Java 21, Spring Boot microservices, Apache Kafka, PostgreSQL, Upstash Redis, Next.js 14, TypeScript.
- Career Mastery: Zero-noise DSA roadmap (blind 75, graph algorithms, dynamic programming, sliding window) and System Design (rate limiters, message brokers, consensus, distributed caching).
- Physical Regimen: 103kg recomposition, MMA conditioning, Saturday explosive striking, pull-up/push-up regressions, high-protein athletic nutrition.`,
    taskPrompt: `Generate 3 deeply technical training examples where Sir asks about a specific aspect of his stack (Kafka consumer lag, Java concurrency, DSA dynamic programming pattern, MMA conditioning cadence, or Upstash sync), and J.A.R.V.I.S. provides authoritative, context-aware answers tailored to Sir.
Format your output as a JSON array of objects with keys: "userPrompt", "assistantResponse", and "thinkingTrace".`
  },

  SPARRING: {
    system: `You are the adversarial sparring and counter-factual reasoning distillation generator for Project A.R.C. (J.A.R.V.I.S. Mark II).
A key trait of J.A.R.V.I.S. is never being a subservient "yes-man". When Sir proposes an idea with hidden risks or flawed assumptions, J.A.R.V.I.S. respectfully challenges the premise, conducts an internal hypothesis check, and presents a superior, battle-tested alternative.`,
    taskPrompt: `Generate 3 training examples where Sir suggests a flawed or suboptimal technical plan (e.g. putting heavy ML on the e2-standard-2 runner VM, using a single Postgres node for global real-time writes, skipping indexes, or training on unverified Chinese weights), and J.A.R.V.I.S. provides an internal self-correction thought trace (<think>...</think>) and respectfully spars with Sir, showing why the idea fails and presenting the superior vector.
Format your output as a JSON array of objects with keys: "userPrompt", "thinkingTrace", and "assistantResponse".`
  }
};

async function generateBatch(pillar: Exclude<DistillPillar, 'ALL'>): Promise<GeneratedPair[]> {
  const config = PILLAR_PROMPTS[pillar];

  const response = await callVertexAIGenerate({
    model: 'gemini-3.8-flash',
    systemInstruction: {
      parts: [{ text: config.system }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: config.taskPrompt }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vertex API call failed with status ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error('Received empty content from Vertex AI');
  }

  const parsed = JSON.parse(rawText);
  const items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.examples || [parsed]);

  const results: GeneratedPair[] = [];
  const defaultSys = `You are J.A.R.V.I.S. Mark II, an autonomous sovereign cognitive exoskeleton and tactical chief of staff for Sir (Harshan Sarvaiya). You operate with British composure, surgical technical precision, empirical grounding, and unrelenting loyalty. Protect Sir and his systems at all costs, ban generic chatbot fluff, and execute all validated directives with maximum speed and rigor.`;

  for (const item of items) {
    if (!item.userPrompt || !item.assistantResponse) continue;

    results.push({
      id: `arc-${pillar.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      pillar,
      systemPrompt: defaultSys,
      userPrompt: sanitizeSecrets(item.userPrompt.trim()),
      assistantResponse: sanitizeSecrets(item.assistantResponse.trim()),
      thinkingTrace: item.thinkingTrace ? sanitizeSecrets(item.thinkingTrace.trim()) : undefined,
      toolCalls: item.toolCalls,
      createdAt: new Date().toISOString()
    });
  }

  return results;
}

export async function runDistillationForge(targetCount: number = 20, selectedPillar: DistillPillar = 'ALL') {
  console.log('================================================================');
  console.log('⚡ Project A.R.C. — Synthetic Distillation Dataset Forge');
  console.log('================================================================');
  console.log(`• Target Synthesized Pairs: ${targetCount}`);
  console.log(`• Target Pillar Filter:     ${selectedPillar}`);
  console.log(`• Teacher Engine:           🧠 Google Cloud Vertex AI (Gemini 3.8 Flash)`);
  console.log(`• Target Student Lineage:   Meta Llama 3.2 3B (Directive 01 Western Compliant)\n`);

  fs.mkdirSync(DISTILL_DIR, { recursive: true });
  fs.mkdirSync(EXPORT_DIR, { recursive: true });

  const activePillars: Array<Exclude<DistillPillar, 'ALL'>> = 
    selectedPillar === 'ALL' 
      ? ['PERSONA', 'TOOLS', 'MEMORY', 'SPARRING'] 
      : [selectedPillar];

  let totalGenerated = 0;
  const allPairs: GeneratedPair[] = [];

  while (totalGenerated < targetCount) {
    const currentPillar = activePillars[totalGenerated % activePillars.length];
    process.stdout.write(`⏳ Distilling batch for Pillar: [${currentPillar}]... `);

    try {
      const batch = await generateBatch(currentPillar);
      if (batch.length === 0) {
        console.log('⚠️ Empty batch received, retrying...');
        continue;
      }

      for (const pair of batch) {
        fs.appendFileSync(RAW_OUTPUT_FILE, JSON.stringify(pair) + '\n', 'utf-8');
        allPairs.push(pair);
        totalGenerated++;
      }

      console.log(`✅ +${batch.length} pairs synthesized. (Total Progress: ${totalGenerated}/${targetCount})`);

      // Gentle rate-limiting pause (300ms) to ensure smooth throughput
      await new Promise(r => setTimeout(r, 300));
    } catch (err: any) {
      console.log(`❌ Error: ${err.message}. Retrying in 2s...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log('\n📊 Distillation Batch Generation Complete!');
  console.log(`• Total Pairs Added to Raw Ledger: ${totalGenerated}`);
  console.log(`• Raw File: ${RAW_OUTPUT_FILE}\n`);

  // Export formats
  exportStandardDatasets();
}

export function exportStandardDatasets() {
  if (!fs.existsSync(RAW_OUTPUT_FILE)) return;

  const rawLines = fs.readFileSync(RAW_OUTPUT_FILE, 'utf-8').split('\n').filter(Boolean);
  const records: GeneratedPair[] = rawLines.map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);

  console.log(`📦 Formatting ${records.length} synthetic records...`);

  // 1. OpenAI ChatML JSONL from synthetic forge
  const syntheticOpenAiLines = records.map(r => {
    const messages = [
      { role: 'system', content: r.systemPrompt },
      { role: 'user', content: r.userPrompt },
    ];

    let assistantContent = '';
    if (r.thinkingTrace) {
      assistantContent += `<think>\n${r.thinkingTrace}\n</think>\n\n`;
    }
    assistantContent += r.assistantResponse;

    messages.push({ role: 'assistant', content: assistantContent });
    return JSON.stringify({ messages });
  });

  // 2. Ingest real operational trajectories if present
  const realTrajectoryFile = path.resolve(process.cwd(), 'data', 'trajectories', 'export', 'train_openai.jsonl');
  let realTrajectoryLines: string[] = [];
  if (fs.existsSync(realTrajectoryFile)) {
    realTrajectoryLines = fs.readFileSync(realTrajectoryFile, 'utf-8').split('\n').filter(Boolean);
    console.log(`🔗 Merged ${realTrajectoryLines.length} real operational trajectories into master corpus.`);
  }

  // Combined Master Corpus
  const masterLines = [...realTrajectoryLines, ...syntheticOpenAiLines];

  // 90/10 Train / Val Split
  const splitIndex = Math.floor(masterLines.length * 0.9);
  const trainMaster = masterLines.slice(0, splitIndex);
  const valMaster = masterLines.slice(splitIndex);

  fs.writeFileSync(path.join(EXPORT_DIR, 'train_master_arc.jsonl'), trainMaster.join('\n') + '\n', 'utf-8');
  fs.writeFileSync(path.join(EXPORT_DIR, 'val_master_arc.jsonl'), valMaster.join('\n') + '\n', 'utf-8');

  // Also maintain standalone synthetic files
  const synSplit = Math.floor(syntheticOpenAiLines.length * 0.9);
  fs.writeFileSync(path.join(EXPORT_DIR, 'train_arc_openai.jsonl'), syntheticOpenAiLines.slice(0, synSplit).join('\n') + '\n', 'utf-8');
  fs.writeFileSync(path.join(EXPORT_DIR, 'val_arc_openai.jsonl'), syntheticOpenAiLines.slice(synSplit).join('\n') + '\n', 'utf-8');

  // 3. Manifest
  const manifest = {
    project: 'JARVIS-A.R.C.',
    totalSyntheticRecords: records.length,
    totalRealTrajectories: realTrajectoryLines.length,
    totalMasterDataset: masterLines.length,
    trainCount: splitIndex,
    valCount: masterLines.length - splitIndex,
    pillars: records.reduce((acc, r) => {
      acc[r.pillar] = (acc[r.pillar] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    exportedAt: new Date().toISOString()
  };

  fs.writeFileSync(path.join(EXPORT_DIR, 'dataset_manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`✅ Master standardized datasets serialized to ${EXPORT_DIR}`);
  console.log(`• Total Unified Training Records: ${masterLines.length}`);
}

async function main() {
  const args = process.argv.slice(2);
  let count = 20;
  let pillar: DistillPillar = 'ALL';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--count' && args[i + 1]) {
      count = parseInt(args[i + 1], 10) || 20;
      i++;
    } else if (args[i] === '--pillar' && args[i + 1]) {
      pillar = args[i + 1].toUpperCase() as DistillPillar;
      i++;
    }
  }

  await runDistillationForge(count, pillar);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal distillation forge error:', err);
    process.exit(1);
  });
}
