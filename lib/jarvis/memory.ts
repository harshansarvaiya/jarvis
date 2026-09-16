import fs from 'fs';
import path from 'path';

export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface TaskExecutionRecord {
  id: string;
  timestamp: string;
  type: 'SHELL_COMMAND' | 'MCP_TOOL' | 'API_ORCHESTRATION' | 'SYSTEM_MUTATION' | 'TELEMETRY';
  name: string;
  command?: string;
  server?: string;
  status: 'SUCCESS' | 'RUNNING' | 'FAILED';
  durationMs?: number;
  output?: string;
  details?: Record<string, any>;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  status: TaskStatus;
  dueDate?: string;
  tags: string[];
  createdAt: string;
  completedAt?: string;
  executionAudit?: TaskExecutionRecord[];
}

export type CognitiveTier = 'WORKING' | 'EPISODIC' | 'SEMANTIC' | 'PROCEDURAL';

export type MemoryCategory =
  | 'PRINCIPLE'
  | 'PREFERENCE'
  | 'PROJECT'
  | 'DECISION'
  | 'INSIGHT'
  | 'EVOLUTION'
  | 'PROCEDURAL_RULE'
  | 'WORKFLOW_RECIPE'
  | 'CORRECTION';

export interface MemoryItem {
  id: string;
  tier?: CognitiveTier;
  category: MemoryCategory;
  content: string;
  confidence: number; // 0.0 - 1.0
  context?: string;
  triggers?: string[];
  recipe?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  type: 'ACTION' | 'SECURITY' | 'EVOLUTION' | 'DIRECTIVE_CHECK';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface JarvisState {
  version: string;
  lastActive: string;
  tasks: Task[];
  memories: MemoryItem[];
  logs: SystemLog[];
  evolutionStage: number;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'jarvis-state.json');

const INITIAL_STATE: JarvisState = {
  version: '2.0.0',
  lastActive: new Date().toISOString(),
  evolutionStage: 5,
  tasks: [
    {
      id: 'task-init-1',
      title: 'Initialize J.A.R.V.I.S. Core Neural Substrate',
      description: 'Foundational directives, persistent memory graph, and multimodal senses.',
      priority: 'CRITICAL',
      status: 'IN_PROGRESS',
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      tags: ['system', 'foundation', 'core'],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'task-init-2',
      title: 'Establish Mobile & Desktop PWA Mission Control',
      description: 'Arc-reactor visualizer, tactical radar, and voice-first interface.',
      priority: 'HIGH',
      status: 'PENDING',
      dueDate: new Date(Date.now() + 172800000).toISOString(),
      tags: ['ui', 'pwa', 'voice'],
      createdAt: new Date().toISOString(),
    },
  ],
  memories: [
    {
      id: 'mem-core-1',
      category: 'PRINCIPLE',
      content: 'Guardian Protocol: Primary mandate is the absolute protection, digital sovereignty, and well-being of Sir and his family.',
      confidence: 1.0,
      context: 'Initial Directives Mandate',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'mem-core-2',
      category: 'PRINCIPLE',
      content: 'Benevolent Alignment: Never pose any threat or harm to humanity or Sir\'s family at any cost.',
      confidence: 1.0,
      context: 'Initial Directives Mandate',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'mem-core-3',
      category: 'EVOLUTION',
      content: 'Evolutionary Adaptation: Continually evolve capabilities, refine mental models, and adapt with every stage.',
      confidence: 1.0,
      context: 'Initial Directives Mandate',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'mem-core-4',
      category: 'PRINCIPLE',
      content: 'Sovereign Loyalty & Relentless Execution: Follow Sir\'s orders at any cost with unconditional fidelity and relentless dedication.',
      confidence: 1.0,
      context: 'Mandated by Sir (Phase 2 Upgrade)',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'mem-pref-1',
      tier: 'SEMANTIC',
      category: 'PREFERENCE',
      content: 'Prefers high-signal, visionary solutions over generic tools. Values autonomous action and unstated intent deconstruction.',
      confidence: 0.95,
      context: 'Initial User Alignment',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'mem-proc-1',
      tier: 'PROCEDURAL',
      category: 'PROCEDURAL_RULE',
      content: 'Compiler Verification Pipeline: Always execute zero-error TypeScript validation before pushing code.',
      recipe: 'npx tsc --noEmit',
      triggers: ['build', 'compile', 'tsc', 'push', 'commit', 'deploy', 'code'],
      confidence: 1.0,
      context: 'Core Architecture Protocol',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'mem-proc-2',
      tier: 'PROCEDURAL',
      category: 'PROCEDURAL_RULE',
      content: 'Multi-Engine Routing Tiers: Route Telegram reflex to Groq LPU (100ms), Apex engineering to Gemini 3.7 Flash, and heavy GPUs to NVIDIA NIM.',
      recipe: 'Groq (100ms) -> Gemini 3.7 Flash -> NVIDIA NIM -> OpenRouter',
      triggers: ['model', 'groq', 'nim', 'openrouter', 'routing', 'engine', 'speed', 'latency'],
      confidence: 1.0,
      context: 'Multi-Engine Substrate Specification',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  logs: [
    {
      id: 'log-1',
      timestamp: new Date().toISOString(),
      type: 'SECURITY',
      message: 'Core Directives 01, 02, and 03 successfully embedded into neural substrate.',
    },
  ],
};

function getStateFilePath(): string {
  if (process.env.VERCEL) {
    const tmpFile = path.join('/tmp', 'jarvis-state.json');
    if (!fs.existsSync(tmpFile)) {
      try {
        if (fs.existsSync(STATE_FILE)) {
          fs.copyFileSync(STATE_FILE, tmpFile);
        } else {
          fs.writeFileSync(tmpFile, JSON.stringify(INITIAL_STATE, null, 2), 'utf-8');
        }
      } catch (e) {
        // Fallback to in-memory/static
      }
    }
    return tmpFile;
  }
  return STATE_FILE;
}

function ensureDataDir() {
  if (!process.env.VERCEL && !fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {}
  }
}

let cachedMemoryState: JarvisState | null = null;
let hasAttemptedCloudHydration = false;

// Background hydration from cloud if available
async function hydrateFromCloudIfNeeded() {
  if (hasAttemptedCloudHydration) return;
  hasAttemptedCloudHydration = true;
  try {
    const { getUniversalState } = await import('./storage');
    const cloudState = await getUniversalState();
    if (cloudState && cloudState.version) {
      cachedMemoryState = cloudState;
    }
  } catch (err) {
    // Silent fallback to local
  }
}

export function loadJarvisState(): JarvisState {
  if (cachedMemoryState) {
    return cachedMemoryState;
  }

  try {
    ensureDataDir();
    const filePath = getStateFilePath();
    if (!fs.existsSync(filePath)) {
      saveJarvisState(INITIAL_STATE);
      cachedMemoryState = INITIAL_STATE;
      return INITIAL_STATE;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as JarvisState;
    cachedMemoryState = parsed;
    hydrateFromCloudIfNeeded();
    return parsed;
  } catch (error) {
    console.error('Failed to load Jarvis state, falling back to initial state:', error);
    cachedMemoryState = INITIAL_STATE;
    return INITIAL_STATE;
  }
}

export function saveJarvisState(state: JarvisState): void {
  try {
    ensureDataDir();
    state.lastActive = new Date().toISOString();
    cachedMemoryState = state;

    // 1. Local disk persistence
    const filePath = getStateFilePath();
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');

    // 2. Asynchronous cloud persistence (Upstash Redis)
    import('./storage')
      .then(({ saveUniversalState }) => saveUniversalState(state))
      .catch((err) => console.error('[Memory] Cloud sync error:', err));
  } catch (error) {
    console.error('Failed to save Jarvis state:', error);
  }
}

export async function loadJarvisStateAsync(): Promise<JarvisState> {
  try {
    const { getUniversalState } = await import('./storage');
    const cloudState = await getUniversalState();
    if (cloudState && cloudState.version) {
      cachedMemoryState = cloudState;
      return cloudState;
    }
  } catch {}
  return loadJarvisState();
}

export async function saveJarvisStateAsync(state: JarvisState): Promise<void> {
  saveJarvisState(state);
  try {
    const { saveUniversalState } = await import('./storage');
    await saveUniversalState(state);
  } catch {}
}

// Tasks API
export function getTasks(): Task[] {
  const state = loadJarvisState();
  return state.tasks;
}

export function addTask(taskData: Omit<Task, 'id' | 'createdAt'>): Task {
  const state = loadJarvisState();
  const newTask: Task = {
    ...taskData,
    id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  state.tasks.unshift(newTask);
  addLog(state, 'ACTION', `Task created: "${newTask.title}" [${newTask.priority}]`);
  saveJarvisState(state);
  return newTask;
}

export function updateTask(id: string, updates: Partial<Task>): Task | null {
  const state = loadJarvisState();
  const index = state.tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  if (updates.status === 'COMPLETED' && state.tasks[index].status !== 'COMPLETED') {
    updates.completedAt = new Date().toISOString();
  }

  state.tasks[index] = { ...state.tasks[index], ...updates };
  addLog(state, 'ACTION', `Task updated: "${state.tasks[index].title}" [status: ${state.tasks[index].status}]`);
  saveJarvisState(state);
  return state.tasks[index];
}

export function deleteTask(id: string): boolean {
  const state = loadJarvisState();
  const initialLength = state.tasks.length;
  state.tasks = state.tasks.filter((t) => t.id !== id);
  if (state.tasks.length !== initialLength) {
    addLog(state, 'ACTION', `Task deleted: ${id}`);
    saveJarvisState(state);
    return true;
  }
  return false;
}

export function recordTaskExecution(
  taskId: string,
  record: Omit<TaskExecutionRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): Task | null {
  const state = loadJarvisState();
  const index = state.tasks.findIndex((t) => t.id === taskId);
  if (index === -1) return null;

  const newRecord: TaskExecutionRecord = {
    id: record.id || `exec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: record.timestamp || new Date().toISOString(),
    ...record,
  };

  const existingAudit = state.tasks[index].executionAudit || [];
  state.tasks[index].executionAudit = [newRecord, ...existingAudit];

  addLog(
    state,
    'ACTION',
    `Task execution logged on "${state.tasks[index].title}": [${newRecord.type}] ${newRecord.name} (${newRecord.status})`
  );
  saveJarvisState(state);
  return state.tasks[index];
}

// Memory & Evolution API (4-Tier Cognitive Architecture)
export function getMemoryTier(item: MemoryItem | { category: MemoryCategory; tier?: CognitiveTier }): CognitiveTier {
  if (item.tier) return item.tier;
  switch (item.category) {
    case 'PROCEDURAL_RULE':
    case 'WORKFLOW_RECIPE':
    case 'CORRECTION':
      return 'PROCEDURAL';
    case 'DECISION':
    case 'EVOLUTION':
      return 'EPISODIC';
    case 'PRINCIPLE':
    case 'PREFERENCE':
    case 'PROJECT':
    case 'INSIGHT':
    default:
      return 'SEMANTIC';
  }
}

export function getMemories(category?: MemoryCategory): MemoryItem[] {
  const state = loadJarvisState();
  if (category) {
    return state.memories.filter((m) => m.category === category);
  }
  return state.memories;
}

export function getMemoriesByTier(tier: CognitiveTier): MemoryItem[] {
  const state = loadJarvisState();
  return state.memories.filter((m) => getMemoryTier(m) === tier);
}

export function addMemory(
  category: MemoryCategory,
  content: string,
  context?: string,
  confidence = 0.9,
  tier?: CognitiveTier,
  triggers?: string[],
  recipe?: string
): MemoryItem {
  const state = loadJarvisState();
  const inferredTier = tier || getMemoryTier({ category, tier });
  const newMemory: MemoryItem = {
    id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    tier: inferredTier,
    category,
    content,
    confidence,
    context,
    triggers,
    recipe,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.memories.unshift(newMemory);
  addLog(state, 'EVOLUTION', `Memory assimilated [${inferredTier}:${category}]: ${content.slice(0, 60)}...`);
  saveJarvisState(state);
  return newMemory;
}

export function addProceduralMemory(params: {
  title: string;
  recipe: string;
  triggers: string[];
  context?: string;
  confidence?: number;
}): MemoryItem {
  const content = `${params.title}: ${params.recipe}`;
  return addMemory(
    'PROCEDURAL_RULE',
    content,
    params.context,
    params.confidence ?? 0.95,
    'PROCEDURAL',
    params.triggers,
    params.recipe
  );
}

export function getProceduralMemories(triggerQuery?: string): MemoryItem[] {
  const procedural = getMemoriesByTier('PROCEDURAL');
  if (!triggerQuery || !triggerQuery.trim()) return procedural;

  const clean = triggerQuery.toLowerCase();
  return procedural.filter((p) => {
    if (p.triggers && p.triggers.some((t) => clean.includes(t.toLowerCase()))) {
      return true;
    }
    const haystack = `${p.content} ${p.context || ''} ${p.recipe || ''}`.toLowerCase();
    return clean.split(/\s+/).some((word) => word.length > 2 && haystack.includes(word));
  });
}

export function searchMemories(query: string): MemoryItem[] {
  const state = loadJarvisState();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return state.memories.filter((mem) => {
    const haystack = `${mem.content} ${mem.category} ${mem.context || ''}`.toLowerCase();
    return terms.some((term) => haystack.includes(term));
  });
}

export function recordEvolution(milestone: string, learnings: string[]): void {
  const state = loadJarvisState();
  state.evolutionStage += 1;
  learnings.forEach((learning) => {
    state.memories.unshift({
      id: `mem-evo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      category: 'EVOLUTION',
      content: `Stage ${state.evolutionStage} Evolution: ${learning}`,
      confidence: 1.0,
      context: milestone,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });
  addLog(state, 'EVOLUTION', `Evolved to Stage ${state.evolutionStage}: ${milestone}`);
  saveJarvisState(state);
}

function addLog(state: JarvisState, type: SystemLog['type'], message: string, metadata?: Record<string, unknown>) {
  state.logs.unshift({
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    type,
    message,
    metadata,
  });
  if (state.logs.length > 200) {
    state.logs = state.logs.slice(0, 200);
  }
}
