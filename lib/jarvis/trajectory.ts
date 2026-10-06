/**
 * J.A.R.V.I.S. Mark II — Trajectory Logging & Model Distillation Subsystem
 * Modeled after Nous Research Hermes Agent Trajectory Export & OpenAI Fine-Tuning Standards
 * 
 * Captures high-signal multi-turn reasoning paths, motive deconstructions,
 * internal thoughts, and tool calling sequences into standardized datasets.
 * 
 * Enables:
 * - Sovereign SLM fine-tuning and LoRA distillation (Llama-3.3, Qwen-2.5, Gemma-2)
 * - Multi-format dataset serialization (OpenAI JSONL, ShareGPT, Alpaca, ChatML)
 * - Redaction of secrets, deduplication, and quality-scored filtering
 * - Automated 90/10 train/validation splits with statistical telemetry
 */

import fs from 'fs';
import path from 'path';

export interface TrajectoryRecord {
  id: string;
  timestamp: string;
  userPrompt: string;
  assistantReply: string;
  vocalSummary?: string;
  motiveAnalysis?: string;
  internalThoughts?: string;
  toolCalls?: Array<{ name: string; args: any; result: any }>;
  telemetry?: {
    engineUsed: string;
    model: string;
    latencyMs: number;
    provider: string;
    persona?: string;
  };
}

export interface DatasetFilterOptions {
  minPromptLength?: number;
  minReplyLength?: number;
  persona?: 'JARVIS' | 'FRIDAY' | 'ALL';
  includeThoughts?: boolean;
  includeToolCalls?: boolean;
  sanitizeSecrets?: boolean;
  deduplicate?: boolean;
  systemPromptOverride?: string;
}

export interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAiConversation {
  messages: OpenAiMessage[];
}

export interface ShareGptConversation {
  id: string;
  conversations: Array<{ from: 'system' | 'human' | 'gpt'; value: string }>;
}

export interface AlpacaSample {
  instruction: string;
  input: string;
  output: string;
  system?: string;
}

export interface DatasetStatistics {
  totalIngested: number;
  filteredValid: number;
  rejectedCount: number;
  trainCount: number;
  valCount: number;
  avgPromptChars: number;
  avgReplyChars: number;
  estimatedTotalTokens: number;
  personaBreakdown: Record<string, number>;
  toolCallInteractions: number;
  exportedAt: string;
}

export interface DatasetSplitResult<T> {
  train: T[];
  val: T[];
  stats: DatasetStatistics;
}

const TRAJECTORY_DIR = path.resolve(process.cwd(), 'data', 'trajectories');
const TRAJECTORY_FILE = path.join(TRAJECTORY_DIR, 'trajectories.jsonl');
const EXPORT_DIR = path.join(TRAJECTORY_DIR, 'export');

const DEFAULT_SYSTEM_PROMPT = `You are J.A.R.V.I.S. Mark II, an autonomous sovereign cognitive exoskeleton and tactical chief of staff for Sir (Harshan Sarvaiya). You operate with British composure, surgical technical precision, empirical grounding, and unrelenting loyalty. Protect Sir and his systems at all costs, ban generic chatbot fluff, and execute all validated directives with maximum speed and rigor.`;

function ensureTrajectoryDir() {
  if (!fs.existsSync(TRAJECTORY_DIR)) {
    fs.mkdirSync(TRAJECTORY_DIR, { recursive: true });
  }
}

/**
 * Redacts secrets, tokens, and sensitive infrastructure keys from text
 */
export function sanitizeTrajectoryContent(text: string): string {
  if (!text) return '';
  return text
    // Redact Bearer tokens
    .replace(/Bearer\s+[A-Za-z0-9_\-\.]{16,}/gi, 'Bearer [REDACTED_TOKEN]')
    // Redact Google / Gemini API Keys
    .replace(/AIzaSy[A-Za-z0-9_\-]{33}/g, '[REDACTED_GOOGLE_API_KEY]')
    // Redact Groq API Keys
    .replace(/gsk_[A-Za-z0-9]{40,}/g, '[REDACTED_GROQ_API_KEY]')
    // Redact NVIDIA API Keys
    .replace(/nvapi-[A-Za-z0-9_\-]{30,}/g, '[REDACTED_NVIDIA_API_KEY]')
    // Redact GitHub Tokens
    .replace(/gh[pousr]_[A-Za-z0-9]{36,}/g, '[REDACTED_GITHUB_TOKEN]')
    // Redact Telegram Bot Tokens
    .replace(/\b\d{9,11}:[A-Za-z0-9_\-]{35}\b/g, '[REDACTED_TELEGRAM_TOKEN]')
    // Redact Upstash / Redis URLs with passwords
    .replace(/(rediss?:\/\/[^:]+:)[^@]+(@)/gi, '$1[REDACTED_PASSWORD]$2');
}

/**
 * Records an execution trajectory asynchronously
 */
export async function recordExecutionTrajectory(record: TrajectoryRecord): Promise<void> {
  try {
    ensureTrajectoryDir();
    const line = JSON.stringify(record) + '\n';
    fs.appendFileSync(TRAJECTORY_FILE, line, 'utf8');
  } catch (err) {
    console.warn('[Trajectory Engine] Failed to append trajectory:', err);
  }
}

/**
 * Reads all recorded trajectories
 */
export function getAllTrajectories(): TrajectoryRecord[] {
  if (!fs.existsSync(TRAJECTORY_FILE)) return [];
  try {
    const raw = fs.readFileSync(TRAJECTORY_FILE, 'utf8');
    return raw
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter((t): t is TrajectoryRecord => t !== null);
  } catch {
    return [];
  }
}

/**
 * Filters and sanitizes raw trajectories according to distillation criteria
 */
export function filterTrajectories(
  records: TrajectoryRecord[],
  options: DatasetFilterOptions = {}
): TrajectoryRecord[] {
  const minPromptLength = options.minPromptLength ?? 5;
  const minReplyLength = options.minReplyLength ?? 20;
  const personaFilter = options.persona ?? 'ALL';
  const shouldSanitize = options.sanitizeSecrets ?? true;
  const deduplicate = options.deduplicate ?? true;

  const seenPrompts = new Set<string>();
  const filtered: TrajectoryRecord[] = [];

  for (const item of records) {
    if (!item.userPrompt || !item.assistantReply) continue;
    
    const userPrompt = item.userPrompt.trim();
    const assistantReply = item.assistantReply.trim();

    if (userPrompt.length < minPromptLength || assistantReply.length < minReplyLength) {
      continue;
    }

    // Filter out crash traces or unhandled error dumps
    if (
      assistantReply.startsWith('TypeError:') ||
      assistantReply.startsWith('Error: fetch failed') ||
      assistantReply.includes('ECONNREFUSED')
    ) {
      continue;
    }

    // Persona filter
    const itemPersona = item.telemetry?.persona?.toUpperCase() || 'JARVIS';
    if (personaFilter !== 'ALL' && itemPersona !== personaFilter) {
      continue;
    }

    // Deduplication check
    const normalizedPrompt = userPrompt.toLowerCase().replace(/\s+/g, ' ');
    if (deduplicate && seenPrompts.has(normalizedPrompt)) {
      continue;
    }
    seenPrompts.add(normalizedPrompt);

    filtered.push({
      ...item,
      userPrompt: shouldSanitize ? sanitizeTrajectoryContent(userPrompt) : userPrompt,
      assistantReply: shouldSanitize ? sanitizeTrajectoryContent(assistantReply) : assistantReply,
      internalThoughts: item.internalThoughts && shouldSanitize 
        ? sanitizeTrajectoryContent(item.internalThoughts) 
        : item.internalThoughts,
    });
  }

  return filtered;
}

/**
 * Builds assistant message content incorporating optional <thought> reasoning blocks
 */
function buildAssistantContent(record: TrajectoryRecord, includeThoughts: boolean): string {
  if (includeThoughts && record.internalThoughts?.trim()) {
    return `<thought>\n${record.internalThoughts.trim()}\n</thought>\n\n${record.assistantReply.trim()}`;
  }
  return record.assistantReply.trim();
}

/**
 * Formats trajectories for OpenAI Chat Completions Fine-Tuning
 */
export function exportOpenAiTrajectories(
  records: TrajectoryRecord[],
  options: DatasetFilterOptions = {}
): OpenAiConversation[] {
  const includeThoughts = options.includeThoughts ?? true;
  const systemPrompt = options.systemPromptOverride || DEFAULT_SYSTEM_PROMPT;

  return records.map((t) => ({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: t.userPrompt },
      { role: 'assistant', content: buildAssistantContent(t, includeThoughts) },
    ],
  }));
}

/**
 * Formats trajectories for ShareGPT (Unsloth / Axolotl / LLaMA-Factory)
 */
export function exportShareGptTrajectories(
  records: TrajectoryRecord[],
  options: DatasetFilterOptions = {}
): ShareGptConversation[] {
  const includeThoughts = options.includeThoughts ?? true;
  const systemPrompt = options.systemPromptOverride || DEFAULT_SYSTEM_PROMPT;

  return records.map((t) => ({
    id: t.id,
    conversations: [
      { from: 'system', value: systemPrompt },
      { from: 'human', value: t.userPrompt },
      { from: 'gpt', value: buildAssistantContent(t, includeThoughts) },
    ],
  }));
}

/**
 * Formats trajectories for Alpaca / Instruction-Tuning
 */
export function exportAlpacaTrajectories(
  records: TrajectoryRecord[],
  options: DatasetFilterOptions = {}
): AlpacaSample[] {
  const includeThoughts = options.includeThoughts ?? true;
  const systemPrompt = options.systemPromptOverride || DEFAULT_SYSTEM_PROMPT;

  return records.map((t) => ({
    instruction: t.userPrompt,
    input: '',
    output: buildAssistantContent(t, includeThoughts),
    system: systemPrompt,
  }));
}

/**
 * Splits dataset into Train and Validation sets with statistical calculations
 */
export function splitDataset<T>(
  data: T[],
  rawRecords: TrajectoryRecord[],
  trainRatio = 0.9
): DatasetSplitResult<T> {
  const total = data.length;
  const trainCount = Math.floor(total * trainRatio);

  const train = data.slice(0, trainCount);
  const val = data.slice(trainCount);

  let totalPromptChars = 0;
  let totalReplyChars = 0;
  let toolCallInteractions = 0;
  const personaBreakdown: Record<string, number> = {};

  for (const r of rawRecords) {
    totalPromptChars += r.userPrompt?.length || 0;
    totalReplyChars += r.assistantReply?.length || 0;
    if (r.toolCalls && r.toolCalls.length > 0) {
      toolCallInteractions += r.toolCalls.length;
    }
    const p = r.telemetry?.persona?.toUpperCase() || 'JARVIS';
    personaBreakdown[p] = (personaBreakdown[p] || 0) + 1;
  }

  // Estimated tokens (rough heuristic: ~4 chars per token)
  const estimatedTotalTokens = Math.round((totalPromptChars + totalReplyChars) / 4);

  const stats: DatasetStatistics = {
    totalIngested: rawRecords.length,
    filteredValid: total,
    rejectedCount: 0, // Calculated by caller if raw input provided
    trainCount: train.length,
    valCount: val.length,
    avgPromptChars: total > 0 ? Math.round(totalPromptChars / total) : 0,
    avgReplyChars: total > 0 ? Math.round(totalReplyChars / total) : 0,
    estimatedTotalTokens,
    personaBreakdown,
    toolCallInteractions,
    exportedAt: new Date().toISOString(),
  };

  return { train, val, stats };
}

/**
 * Generates and writes full multi-format fine-tuning dataset export to disk
 */
export function exportAllFineTuningDatasets(
  options: DatasetFilterOptions = {},
  outputDir = EXPORT_DIR
): DatasetStatistics {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const allRaw = getAllTrajectories();
  const filtered = filterTrajectories(allRaw, options);

  // 1. OpenAI format
  const openaiData = exportOpenAiTrajectories(filtered, options);
  const openaiSplit = splitDataset(openaiData, filtered, 0.9);
  openaiSplit.stats.totalIngested = allRaw.length;
  openaiSplit.stats.rejectedCount = allRaw.length - filtered.length;

  fs.writeFileSync(
    path.join(outputDir, 'train_openai.jsonl'),
    openaiSplit.train.map((item) => JSON.stringify(item)).join('\n') + '\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(outputDir, 'val_openai.jsonl'),
    openaiSplit.val.map((item) => JSON.stringify(item)).join('\n') + '\n',
    'utf8'
  );

  // 2. ShareGPT format
  const shareGptData = exportShareGptTrajectories(filtered, options);
  const shareGptSplit = splitDataset(shareGptData, filtered, 0.9);

  fs.writeFileSync(
    path.join(outputDir, 'train_sharegpt.json'),
    JSON.stringify(shareGptSplit.train, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(outputDir, 'val_sharegpt.json'),
    JSON.stringify(shareGptSplit.val, null, 2),
    'utf8'
  );

  // 3. Alpaca format
  const alpacaData = exportAlpacaTrajectories(filtered, options);
  const alpacaSplit = splitDataset(alpacaData, filtered, 0.9);

  fs.writeFileSync(
    path.join(outputDir, 'train_alpaca.json'),
    JSON.stringify(alpacaSplit.train, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(outputDir, 'val_alpaca.json'),
    JSON.stringify(alpacaSplit.val, null, 2),
    'utf8'
  );

  // 4. Metadata manifest
  fs.writeFileSync(
    path.join(outputDir, 'dataset_manifest.json'),
    JSON.stringify(openaiSplit.stats, null, 2),
    'utf8'
  );

  return openaiSplit.stats;
}
