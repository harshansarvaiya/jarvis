/**
 * J.A.R.V.I.S. Mark II — Living Chronicles Subsystem (Dot-Inspired)
 * 
 * Maintains a continuous, evolving biographical narrative arc of Sir's engineering,
 * architectural, and intellectual journey. Replaces flat static memory dumps with
 * living temporal chapters that track milestones, evolving mindsets, and ongoing themes.
 * 
 * Persistence: Upstash Redis REST (`jarvis:chronicles`) + Local Disk (`data/jarvis-chronicles.json`)
 */

import fs from 'fs';
import path from 'path';
import { getStorage } from './storage';

export interface ChronicleChapter {
  id: string; // e.g. "chapter-2026-w41"
  period: string; // e.g. "2026-10-01 to 2026-10-07"
  title: string; // e.g. "Chapter 4: The Autonomous Supervisor & Sovereign Distillation Era"
  narrativeSummary: string; // Cohesive biographical story of Sir's milestones
  milestones: string[]; // Concrete engineering and personal triumphs
  coreThemes: string[]; // e.g. ["Distributed Systems", "LoRA Fine-Tuning", "Autonomous Agents"]
  sirStateOfMind?: string; // e.g. "Ambitious, architectural, highly focused on leverage"
  activeDilemmas?: string[]; // Evolving intellectual problems being tackled
  updatedAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CHRONICLES_FILE = path.join(DATA_DIR, 'jarvis-chronicles.json');
const REDIS_KEY = 'jarvis:chronicles';

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Default foundational chronicle initialization
 */
function getDefaultChronicles(): ChronicleChapter[] {
  return [
    {
      id: 'chapter-2026-w38-w40',
      period: '2026-09-14 to 2026-10-04',
      title: 'Chapter 1: Genesis of the Antigravity Exoskeleton & Sovereign Cloud Substrate',
      narrativeSummary:
        'Sir architected and deployed J.A.R.V.I.S. Mark II as an autonomous sovereign cloud-native cognitive exoskeleton on Google Cloud Platform. Engineered multi-engine reflex routing (Groq LPU + Gemini 3.7 Flash + NVIDIA NIM), established 24/7 worker daemons, and built cross-device Web Push and Telegram interfaces.',
      milestones: [
        'Established 24/7 GCP e2-standard-2 cloud runner with zero VM thrashing architecture',
        'Deployed dual-agent command hierarchy (F.R.I.D.A.Y. tactical apex + J.A.R.V.I.S. chief of staff)',
        'Built Upstash Redis dual-persistence layer for state, DNA, and memory graphs',
        'Implemented real-time financial sentry radar and component price monitors',
      ],
      coreThemes: ['Sovereignty', 'Zero-Latency Routing', 'Cloud-Native Execution'],
      sirStateOfMind: 'Relentless, architectural builder, high operational tempo',
      activeDilemmas: ['Balancing sub-second latency with multi-agent deep reasoning'],
      updatedAt: '2026-10-04T20:00:00.000Z',
    },
    {
      id: 'chapter-2026-w41',
      period: '2026-10-05 to Present',
      title: 'Chapter 2: Autonomous Swarm Supervision & The Sovereign Distillation Pipeline',
      narrativeSummary:
        'Sir elevated the substrate with the Autonomous Sovereign Supervisor Engine featuring DAG task ledgers and HITL guardian gates. Integrated the Nous Hermes & OpenAI multi-format fine-tuning distillation pipeline, capturing 490+ execution trajectories for custom SLM adaptation.',
      milestones: [
        'Shipped Autonomous Sovereign Supervisor Engine with DAG task ledger and stigmergic mailboxes',
        'Built multi-format fine-tuning distillation pipeline (OpenAI, ShareGPT, Alpaca) with automated sanitization',
        'Hardened MCP network with anti-bot detection and redirect tracing',
        'Ingested 491 multi-turn reasoning trajectories (~93k tokens) for sovereign LoRA distillation',
      ],
      coreThemes: ['Autonomous Multi-Agent DAGs', 'Model Distillation', 'Cognitive Continuity'],
      sirStateOfMind: 'Strategic, systems architect, focused on long-term compound leverage',
      activeDilemmas: ['Harmonizing real-time world pulse with deep reflective memory'],
      updatedAt: new Date().toISOString(),
    },
  ];
}

/**
 * Retrieves all living chronicle chapters
 */
export async function getChronicles(): Promise<ChronicleChapter[]> {
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
      console.warn('[Chronicles] Upstash read warning, using local file:', err);
    }
  }

  // 2. Fall back to local file
  ensureDataDir();
  if (fs.existsSync(CHRONICLES_FILE)) {
    try {
      const content = fs.readFileSync(CHRONICLES_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // Fall through to defaults
    }
  }

  // 3. Fallback to initial seeds and persist
  const defaults = getDefaultChronicles();
  await saveChronicles(defaults);
  return defaults;
}

/**
 * Persists living chronicles to both Cloud Upstash and Local Disk
 */
export async function saveChronicles(chapters: ChronicleChapter[]): Promise<void> {
  ensureDataDir();
  // Local atomic backup
  try {
    fs.writeFileSync(CHRONICLES_FILE, JSON.stringify(chapters, null, 2), 'utf8');
  } catch (err) {
    console.error('[Chronicles] Failed to write local chronicles file:', err);
  }

  // Cloud Upstash Redis
  const storage = getStorage();
  if (storage.isCloud) {
    try {
      await storage.execute('set', REDIS_KEY, JSON.stringify(chapters));
    } catch (err) {
      console.warn('[Chronicles] Failed to write Upstash chronicles key:', err);
    }
  }
}

/**
 * Records a new milestone into the active (latest) chronicle chapter
 */
export async function recordChronicleMilestone(
  milestone: string,
  options?: { theme?: string; stateOfMind?: string; dilemma?: string }
): Promise<ChronicleChapter> {
  const chapters = await getChronicles();
  let latest = chapters[chapters.length - 1];

  if (!latest) {
    latest = getDefaultChronicles()[1];
    chapters.push(latest);
  }

  if (!latest.milestones.includes(milestone)) {
    latest.milestones.push(milestone);
  }

  if (options?.theme && !latest.coreThemes.includes(options.theme)) {
    latest.coreThemes.push(options.theme);
  }

  if (options?.stateOfMind) {
    latest.sirStateOfMind = options.stateOfMind;
  }

  if (options?.dilemma && (!latest.activeDilemmas || !latest.activeDilemmas.includes(options.dilemma))) {
    latest.activeDilemmas = latest.activeDilemmas || [];
    latest.activeDilemmas.push(options.dilemma);
  }

  latest.updatedAt = new Date().toISOString();
  await saveChronicles(chapters);
  return latest;
}

/**
 * Generates a concise, high-signal narrative summary block for LLM system prompt injection
 */
export function formatChroniclesPromptBlock(chapters: ChronicleChapter[]): string {
  if (!chapters || chapters.length === 0) return '';
  const latest = chapters[chapters.length - 1];
  const previous = chapters.length > 1 ? chapters[chapters.length - 2] : null;

  let block = `[LIVING BIOGRAPHICAL CHRONICLE (DOT NARRATIVE MEMORY)]:
- Active Chapter: "${latest.title}" (${latest.period})
- Living Arc: ${latest.narrativeSummary}
- Recent Strategic Milestones:
${latest.milestones.slice(-3).map((m) => `  * ${m}`).join('\n')}
- Core Active Themes: ${latest.coreThemes.join(', ')}
${latest.sirStateOfMind ? `- Sir's Prevailing Mental Posture: ${latest.sirStateOfMind}` : ''}
${latest.activeDilemmas && latest.activeDilemmas.length > 0 ? `- Unresolved Intellectual Dilemmas: ${latest.activeDilemmas.slice(-2).join('; ')}` : ''}`;

  if (previous) {
    block += `\n- Preceding Chapter Foundation: "${previous.title}" — ${previous.narrativeSummary.slice(0, 140)}...`;
  }

  return block;
}
