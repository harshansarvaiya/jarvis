/**
 * J.A.R.V.I.S. Mark II — Open-Loop Registry & Resonance Harvester (Dot + Muse-Inspired)
 * 
 * Captures Sir's nascent, unstructured thoughts, technical hunches, and prospective ideas
 * dropped during conversation. Prevents high-value ideas from being lost to conversational entropy,
 * linking them into topological clusters and gently resurfacing them when contextual resonance peaks.
 * 
 * Persistence: Upstash Redis REST (`jarvis:open_loops`) + Local Disk (`data/jarvis-open-loops.json`)
 */

import fs from 'fs';
import path from 'path';
import { getStorage } from './storage';

export type OpenLoopCategory =
  | 'ARCHITECTURAL_HYPOTHESIS'
  | 'PRODUCT_VENTURE'
  | 'SYSTEM_EXPERIMENT'
  | 'CONTRARIAN_THOUGHT'
  | 'PERSONAL_MILESTONE';

export type OpenLoopStatus = 'OPEN' | 'RESONATING' | 'EXPLORING' | 'RESOLVED' | 'ARCHIVED';

export interface OpenLoopItem {
  id: string;
  title: string;
  originPrompt: string;
  category: OpenLoopCategory;
  status: OpenLoopStatus;
  contextNotes: string;
  associations: string[]; // Concept tags for Muse-style associative linking
  resonanceScore: number; // 1 to 100 based on recurring themes
  incubatedDossier?: {
    architecturalAngle: string;
    concreteHypothesis: string;
    experimentDesign: string;
    tradeoffsAndRisks: string[];
    externalReferences?: string[];
    incubatedAt: string;
  };
  lastResurfacedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const LOOPS_FILE = path.join(DATA_DIR, 'jarvis-open-loops.json');
const REDIS_KEY = 'jarvis:open_loops';

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Default seeded open loops based on Sir's ongoing inquiries
 */
function getDefaultOpenLoops(): OpenLoopItem[] {
  return [
    {
      id: 'loop-muse-dot-grok-integration',
      title: 'Synthesize Dot Chronicles, Muse Spatial Ideation & Grok Sparring into Core Substrate',
      originPrompt: 'can we learn anything from muse, dot or grok bot ?',
      category: 'ARCHITECTURAL_HYPOTHESIS',
      status: 'EXPLORING',
      contextNotes: 'Elevate F.R.I.D.A.Y. & J.A.R.V.I.S. with episodic biographical narrative (Dot), open-loop tracking, and aggressive contrarian sparring (Grok).',
      associations: ['episodic-memory', 'chronicles', 'open-loops', 'contrarian-sparring', 'dot', 'muse', 'grok'],
      resonanceScore: 95,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'loop-sovereign-slm-distillation',
      title: 'Distill 490+ Trajectories into Edge LoRA Adapter (Llama-3.3-8B / Qwen-2.5-7B)',
      originPrompt: 'lets fine tuning our project',
      category: 'SYSTEM_EXPERIMENT',
      status: 'OPEN',
      contextNotes: 'Train a sovereign local/edge small language model with J.A.R.V.I.S. and F.R.I.D.A.Y. persona weights and zero-prompt latency.',
      associations: ['unsloth', 'lora-fine-tuning', 'slm-distillation', 'dataset-export'],
      resonanceScore: 90,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

/**
 * Retrieves all open loops
 */
export async function getOpenLoops(): Promise<OpenLoopItem[]> {
  const storage = getStorage();

  // 1. Try Cloud Upstash Redis
  if (storage.isCloud) {
    try {
      const raw = await storage.execute('get', REDIS_KEY);
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('[OpenLoops] Upstash read warning, using local file:', err);
    }
  }

  // 2. Fall back to local file
  ensureDataDir();
  if (fs.existsSync(LOOPS_FILE)) {
    try {
      const content = fs.readFileSync(LOOPS_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // Fall through to defaults
    }
  }

  // 3. Fallback to default seeds and save
  const defaults = getDefaultOpenLoops();
  await saveOpenLoops(defaults);
  return defaults;
}

/**
 * Persists open loops to both Upstash Redis and Local Disk
 */
export async function saveOpenLoops(loops: OpenLoopItem[]): Promise<void> {
  ensureDataDir();
  // Local atomic backup
  try {
    fs.writeFileSync(LOOPS_FILE, JSON.stringify(loops, null, 2), 'utf8');
  } catch (err) {
    console.error('[OpenLoops] Failed to write local open-loops file:', err);
  }

  // Cloud Upstash Redis
  const storage = getStorage();
  if (storage.isCloud) {
    try {
      await storage.execute('set', REDIS_KEY, JSON.stringify(loops));
    } catch (err) {
      console.warn('[OpenLoops] Failed to write Upstash open-loops key:', err);
    }
  }
}

/**
 * Registers a new open loop or increments resonance if already tracked
 */
export async function registerOpenLoop(
  item: Omit<OpenLoopItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<OpenLoopItem> {
  const loops = await getOpenLoops();
  const normalizedTitle = item.title.trim().toLowerCase();

  // Check for semantic duplicate
  const existing = loops.find(
    (l) =>
      l.title.toLowerCase() === normalizedTitle ||
      (item.associations && item.associations.some((a) => l.associations.includes(a) && l.title.toLowerCase().includes(a)))
  );

  if (existing) {
    existing.resonanceScore = Math.min(100, existing.resonanceScore + 10);
    existing.updatedAt = new Date().toISOString();
    if (item.contextNotes && !existing.contextNotes.includes(item.contextNotes)) {
      existing.contextNotes += ` | ${item.contextNotes}`;
    }
    await saveOpenLoops(loops);
    return existing;
  }

  const newLoop: OpenLoopItem = {
    ...item,
    id: `loop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  loops.push(newLoop);
  await saveOpenLoops(loops);
  return newLoop;
}

/**
 * Updates an open loop's status or notes
 */
export async function updateOpenLoop(
  id: string,
  updates: Partial<OpenLoopItem>
): Promise<OpenLoopItem | null> {
  const loops = await getOpenLoops();
  const loop = loops.find((l) => l.id === id);
  if (!loop) return null;

  Object.assign(loop, updates, { updatedAt: new Date().toISOString() });
  await saveOpenLoops(loops);
  return loop;
}

/**
 * Detects whether Sir's input contains an unclosed ideational open loop
 */
export async function detectAndHarvestOpenLoops(
  userPrompt: string,
  assistantReply?: string
): Promise<OpenLoopItem | null> {
  if (!userPrompt || userPrompt.length < 15) return null;

  const prompt = userPrompt.toLowerCase();

  // Patterns that signal nascent ideas, future explorations, or open hypotheses
  const openPatterns = [
    /(?:can we|could we|what if we|we should|maybe we can|let's explore|i want to explore)\s+([^?.!]+)/i,
    /(?:i wonder if|someday|in the future|next level for|how about we)\s+([^?.!]+)/i,
    /(?:learn anything from|integrate|experiment with)\s+([^?.!]+)/i,
  ];

  for (const regex of openPatterns) {
    const match = userPrompt.match(regex);
    if (match && match[1]) {
      const ideaRaw = match[1].trim();
      if (ideaRaw.length < 8 || ideaRaw.length > 120) continue;

      let category: OpenLoopCategory = 'ARCHITECTURAL_HYPOTHESIS';
      if (/product|startup|saas|monetize|revenue|business/i.test(prompt)) {
        category = 'PRODUCT_VENTURE';
      } else if (/test|benchmark|verify|script|try|experiment/i.test(prompt)) {
        category = 'SYSTEM_EXPERIMENT';
      } else if (/contrarian|challenge|risk|danger|fail|downside/i.test(prompt)) {
        category = 'CONTRARIAN_THOUGHT';
      }

      const associations = ideaRaw
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !['with', 'from', 'what', 'about', 'this', 'that', 'have', 'been'].includes(w))
        .slice(0, 5);

      const title = ideaRaw.charAt(0).toUpperCase() + ideaRaw.slice(1);

      return await registerOpenLoop({
        title,
        originPrompt: userPrompt.slice(0, 160),
        category,
        status: 'OPEN',
        contextNotes: assistantReply ? assistantReply.slice(0, 200) + '...' : 'Captured during conversational flow.',
        associations,
        resonanceScore: 60,
      });
    }
  }

  return null;
}

/**
 * Formats active open loops for LLM context injection
 */
export function formatOpenLoopsPromptBlock(loops: OpenLoopItem[]): string {
  const active = loops
    .filter((l) => l.status === 'OPEN' || l.status === 'RESONATING' || l.status === 'EXPLORING')
    .sort((a, b) => b.resonanceScore - a.resonanceScore)
    .slice(0, 4);

  if (active.length === 0) return '';

  return `[OPEN-LOOP INTELLECTUAL REGISTRY (MUSE + DOT CONTINUITY)]:
The following unresolved ideas, hypotheses, and architectural explorations were initiated by Sir:
${active.map((l) => `- [${l.status}] ${l.title} (Score: ${l.resonanceScore}/100, Tags: ${l.associations.slice(0, 3).join(', ')})`).join('\n')}
* GUIDELINE: When relevant, naturally reference or synthesize these open loops to provide seamless intellectual momentum. Never drop Sir's ideas into oblivion.`;
}
