/**
 * J.A.R.V.I.S. Mark II — Production Harness Engineering Subsystem
 * (Inspired by Awesome Harness Engineering: Verification Loops, Sandboxing & Telemetry)
 * 
 * Implements:
 * 1. Closed-Loop Verification & Compiler Sentry
 * 2. Token Budget Compression & Syntactic Distillation
 * 3. Structured Execution Tracing & Multi-Tier Observability
 * 4. Directive 01 Guardrail Verification
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface VerificationResult {
  valid: boolean;
  stage: 'TYPESCRIPT' | 'RUNTIME' | 'SYNTAX' | 'DIRECTIVES';
  details: string;
  errors?: string[];
  executionDurationMs: number;
}

export interface HarnessTelemetryTrace {
  turnId: string;
  timestamp: string;
  engineUsed: string;
  provider: string;
  model: string;
  latencyMs: number;
  cognitiveTiersRecalled: {
    working: boolean;
    proceduralCount: number;
    semanticCount: number;
    episodicCount: number;
  };
  verificationPassed: boolean;
  tokenCompressionRatio?: number;
}

/**
 * 1. Closed-Loop Verification Harness: Runs automated TypeScript checks
 */
export async function runCompilerVerification(): Promise<VerificationResult> {
  const start = Date.now();
  try {
    const { stdout, stderr } = await execAsync('npx tsc --noEmit', {
      cwd: process.cwd(),
      timeout: 30000,
    });
    return {
      valid: true,
      stage: 'TYPESCRIPT',
      details: 'Compiler verification passed with 0 errors.',
      executionDurationMs: Date.now() - start,
    };
  } catch (err: any) {
    const output = `${err?.stdout || ''}\n${err?.stderr || ''}`.trim();
    const errorLines = output
      .split('\n')
      .filter((line) => line.includes('error TS') || line.includes('Error:'));

    return {
      valid: false,
      stage: 'TYPESCRIPT',
      details: `Compiler check failed with ${errorLines.length || 1} error(s).`,
      errors: errorLines.length > 0 ? errorLines : [output.slice(0, 300)],
      executionDurationMs: Date.now() - start,
    };
  }
}

/**
 * 2. Token Budget Compression: Compresses prompt context while preserving 100% semantic fidelity
 */
export function compressContextPayload(text: string): { compressed: string; ratio: number } {
  if (!text || text.length === 0) return { compressed: '', ratio: 1.0 };
  const initialLen = text.length;

  // 1. Normalize multi-line whitespace and redundant empty lines
  let compressed = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ');

  // 2. Strip superfluous markdown decorative comments
  compressed = compressed.replace(/<!--[\s\S]*?-->/g, '');

  const finalLen = compressed.length;
  const ratio = Number((finalLen / initialLen).toFixed(2));

  return { compressed, ratio };
}

/**
 * 3. Formats structured diagnostics for self-healing error recovery
 */
export function formatSelfHealingDiagnosticPrompt(errorOutput: string): string {
  return `
[COMPILER VERIFICATION FAILURE — SELF-HEALING HARNESS ACTIVATED]:
${errorOutput}

(Directive: Analyze the compiler/syntax error above. Determine the precise file path and line number, apply the atomic code fix, and re-verify without making unnecessary peripheral modifications.)
`;
}

// ============================================================================
// 4. CODEX HARNESS PRIMITIVES (Inspired by OpenAI Codex App Server Architecture)
// Three core primitives: Threads (sessions with fork capability), Turns, and Items.
// Edge-compatible, synced to Upstash Redis (jarvis:harness:threads).
// ============================================================================

export type HarnessItemType =
  | 'thought'
  | 'tool_call'
  | 'tool_result'
  | 'file_diff'
  | 'approval_request'
  | 'message';

export interface HarnessItem {
  id: string;
  type: HarnessItemType;
  timestamp: string;
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, any>;
  toolResult?: any;
  diff?: { path: string; oldText?: string; newText?: string };
  approval?: {
    id: string;
    action: string;
    requiredDirective: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
  };
}

export interface HarnessTurn {
  turnId: string;
  threadId: string;
  prompt: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'WAITING_FOR_APPROVAL';
  engineUsed?: string;
  items: HarnessItem[];
  startedAt: string;
  completedAt?: string;
  verification?: VerificationResult;
}

export interface HarnessThread {
  id: string;
  title: string;
  parentThreadId?: string; // Defined if forked/branched
  status: 'ACTIVE' | 'ARCHIVED' | 'FORKED';
  turns: HarnessTurn[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

const IN_MEMORY_THREADS = new Map<string, HarnessThread>();

async function syncThreadToStorage(thread: HarnessThread): Promise<void> {
  IN_MEMORY_THREADS.set(thread.id, thread);
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!upstashUrl || !token) return;

  try {
    const key = `jarvis:harness:thread:${thread.id}`;
    await fetch(`${upstashUrl}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([JSON.stringify(thread)]),
      signal: AbortSignal.timeout(4000),
    });
  } catch {}
}

/**
 * Creates a new persistent thread session in the Codex Harness
 */
export async function createThread(title: string, metadata?: Record<string, any>): Promise<HarnessThread> {
  const now = new Date().toISOString();
  const thread: HarnessThread = {
    id: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    status: 'ACTIVE',
    turns: [],
    metadata: metadata || {},
    createdAt: now,
    updatedAt: now,
  };

  await syncThreadToStorage(thread);
  return thread;
}

/**
 * Retrieves a thread by ID from memory or Upstash Redis
 */
export async function getThread(threadId: string): Promise<HarnessThread | null> {
  if (IN_MEMORY_THREADS.has(threadId)) {
    return IN_MEMORY_THREADS.get(threadId)!;
  }

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!upstashUrl || !token) return null;

  try {
    const key = `jarvis:harness:thread:${threadId}`;
    const res = await fetch(`${upstashUrl}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    });
    const data = await res.json();
    if (!data.result) return null;
    const thread: HarnessThread = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
    IN_MEMORY_THREADS.set(thread.id, thread);
    return thread;
  } catch {
    return null;
  }
}

/**
 * Fork a thread: Creates an isolated child branch containing full turn history up to this point.
 * Enables parallel subagent sandbox exploration without dirtying the parent conversation.
 */
export async function forkThread(parentThreadId: string, branchName: string): Promise<HarnessThread> {
  const parent = await getThread(parentThreadId);
  const now = new Date().toISOString();

  const forkedTurns: HarnessTurn[] = parent
    ? JSON.parse(JSON.stringify(parent.turns))
    : [];

  const forkedThread: HarnessThread = {
    id: `thread-fork-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: `${parent?.title || 'Main'} [Branch: ${branchName}]`,
    parentThreadId,
    status: 'ACTIVE',
    turns: forkedTurns,
    metadata: {
      forkedFrom: parentThreadId,
      branchName,
      inheritedTurnCount: forkedTurns.length,
    },
    createdAt: now,
    updatedAt: now,
  };

  await syncThreadToStorage(forkedThread);
  return forkedThread;
}

/**
 * Records an atomic I/O item (thought, tool_call, diff, approval) to an active turn
 */
export async function recordTurnItem(
  threadId: string,
  turnId: string,
  item: Omit<HarnessItem, 'id' | 'timestamp'>
): Promise<HarnessItem> {
  let thread = await getThread(threadId);
  if (!thread) {
    thread = await createThread(`Session ${threadId}`);
  }

  let turn = thread.turns.find((t) => t.turnId === turnId);
  if (!turn) {
    turn = {
      turnId,
      threadId,
      prompt: '',
      status: 'RUNNING',
      items: [],
      startedAt: new Date().toISOString(),
    };
    thread.turns.push(turn);
  }

  const fullItem: HarnessItem = {
    ...item,
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };

  turn.items.push(fullItem);
  thread.updatedAt = new Date().toISOString();
  await syncThreadToStorage(thread);
  return fullItem;
}

/**
 * Archives a thread when an objective is fulfilled
 */
export async function archiveThread(threadId: string): Promise<boolean> {
  const thread = await getThread(threadId);
  if (!thread) return false;
  thread.status = 'ARCHIVED';
  thread.updatedAt = new Date().toISOString();
  await syncThreadToStorage(thread);
  return true;
}
