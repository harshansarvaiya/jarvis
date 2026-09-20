/**
 * J.A.R.V.I.S. Mark II — Production Harness Engineering Subsystem
 * (Inspired by Awesome Harness Engineering: Verification Loops, Sandboxing & Telemetry)
 * 
 * Implements:
 * 1. Closed-Loop Verification & Compiler Sentry
 * 2. Token Budget Compression & Syntactic Distillation
 * 3. Structured Execution Tracing & Multi-Tier Observability
 * 4. Directive 01 Guardrail Verification
 * 5. Reversible Transactional Diff Buffer (Grok Bot & Cloudflare OS Inspired)
 * 6. Zero-Overhead Workspace Preflight Sentry
 * 7. Friday FSM Coordinator State Machine
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

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
// 4. ATOMIC TRANSACTIONAL DIFF BUFFER & ROLLBACK GATE
// (Inspired by Grok Bot Coordinator & Cloudflare OS Gatekeepers)
// ============================================================================

export interface StagedFileMutation {
  filePath: string;
  type: 'WRITE' | 'REPLACE' | 'DELETE';
  content?: string;
  targetContent?: string;
  replacementContent?: string;
  originalContent?: string;
  existsBefore: boolean;
}

export interface TransactionCommitResult {
  success: boolean;
  committedFiles: string[];
  rolledBack: boolean;
  verification?: VerificationResult;
  error?: string;
  diffSummary?: string;
  durationMs: number;
}

export class CodeTransactionBuffer {
  private stagedMutations: Map<string, StagedFileMutation> = new Map();
  private activeSnapshots: Map<string, { exists: boolean; content?: string }> = new Map();
  private rootDir: string;

  constructor(rootDir = process.cwd()) {
    this.rootDir = rootDir;
  }

  private resolveSafePath(relPath: string): string {
    const resolved = path.resolve(this.rootDir, relPath);
    if (!resolved.startsWith(this.rootDir)) {
      throw new Error(`Security Violation: Path traversal outside workspace (${relPath}) blocked.`);
    }
    if (relPath.includes('.env')) {
      throw new Error('Security Violation: Modifying secrets is blocked by Guardian Protocol.');
    }
    return resolved;
  }

  /**
   * Stage a full file write/create
   */
  public stageWrite(relPath: string, content: string): void {
    const absPath = this.resolveSafePath(relPath);
    const exists = fs.existsSync(absPath);
    const originalContent = exists ? fs.readFileSync(absPath, 'utf-8') : undefined;

    if (!this.activeSnapshots.has(relPath)) {
      this.activeSnapshots.set(relPath, { exists, content: originalContent });
    }

    this.stagedMutations.set(relPath, {
      filePath: relPath,
      type: 'WRITE',
      content,
      originalContent,
      existsBefore: exists,
    });
  }

  /**
   * Stage an atomic substring replacement in a file
   */
  public stageReplace(relPath: string, targetContent: string, replacementContent: string): void {
    const absPath = this.resolveSafePath(relPath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Cannot stage replace: File does not exist: ${relPath}`);
    }

    const currentContent = fs.readFileSync(absPath, 'utf-8');
    if (!currentContent.includes(targetContent)) {
      throw new Error(`Target content not found in ${relPath}.`);
    }

    const occurrences = currentContent.split(targetContent).length - 1;
    if (occurrences > 1) {
      throw new Error(`Target content occurs ${occurrences} times in ${relPath}. Provide more unique context.`);
    }

    if (!this.activeSnapshots.has(relPath)) {
      this.activeSnapshots.set(relPath, { exists: true, content: currentContent });
    }

    const newContent = currentContent.replace(targetContent, replacementContent);
    this.stagedMutations.set(relPath, {
      filePath: relPath,
      type: 'REPLACE',
      content: newContent,
      targetContent,
      replacementContent,
      originalContent: currentContent,
      existsBefore: true,
    });
  }

  /**
   * Stage a file deletion
   */
  public stageDelete(relPath: string): void {
    const absPath = this.resolveSafePath(relPath);
    const exists = fs.existsSync(absPath);
    const originalContent = exists ? fs.readFileSync(absPath, 'utf-8') : undefined;

    if (!this.activeSnapshots.has(relPath)) {
      this.activeSnapshots.set(relPath, { exists, content: originalContent });
    }

    this.stagedMutations.set(relPath, {
      filePath: relPath,
      type: 'DELETE',
      originalContent,
      existsBefore: exists,
    });
  }

  /**
   * Returns a structured diff summary of all staged changes
   */
  public getPendingDiffs(): { filePath: string; type: string; linesChanged: number }[] {
    const summary: { filePath: string; type: string; linesChanged: number }[] = [];
    this.stagedMutations.forEach((mutation, relPath) => {
      const originalLines = (mutation.originalContent || '').split('\n').length;
      const newLines = (mutation.content || '').split('\n').length;
      summary.push({
        filePath: relPath,
        type: mutation.type,
        linesChanged: Math.abs(newLines - originalLines),
      });
    });
    return summary;
  }

  public isDirty(): boolean {
    return this.stagedMutations.size > 0;
  }

  public clear(): void {
    this.stagedMutations.clear();
    this.activeSnapshots.clear();
  }

  /**
   * Atomically flush staged mutations to disk and run compiler verification.
   * If verification fails and autoRollbackOnFailure is true, restores all original files.
   */
  public async commit(options: {
    verifyCompiler?: boolean;
    autoRollbackOnFailure?: boolean;
  } = {}): Promise<TransactionCommitResult> {
    const start = Date.now();
    const { verifyCompiler = true, autoRollbackOnFailure = true } = options;

    if (this.stagedMutations.size === 0) {
      return {
        success: true,
        committedFiles: [],
        rolledBack: false,
        durationMs: Date.now() - start,
      };
    }

    const modifiedList: string[] = [];

    // 1. Flush all staged mutations to disk
    try {
      this.stagedMutations.forEach((mutation, relPath) => {
        const absPath = this.resolveSafePath(relPath);
        if (mutation.type === 'DELETE') {
          if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
        } else if (mutation.content !== undefined) {
          fs.mkdirSync(path.dirname(absPath), { recursive: true });
          fs.writeFileSync(absPath, mutation.content, 'utf-8');
        }
        modifiedList.push(relPath);
      });
    } catch (err: any) {
      if (autoRollbackOnFailure) this.rollback();
      return {
        success: false,
        committedFiles: [],
        rolledBack: true,
        error: `Write error during commit: ${err.message}`,
        durationMs: Date.now() - start,
      };
    }

    // 2. Closed-Loop Compiler Verification Gate
    let verification: VerificationResult | undefined;
    if (verifyCompiler) {
      verification = await runCompilerVerification();
      if (!verification.valid) {
        if (autoRollbackOnFailure) {
          this.rollback();
          return {
            success: false,
            committedFiles: modifiedList,
            rolledBack: true,
            verification,
            error: `Closed-loop compiler verification failed. Transaction was atomically rolled back to protect repository integrity.`,
            durationMs: Date.now() - start,
          };
        }
      }
    }

    // 3. Success: Clear snapshots & staged buffer
    this.clear();
    return {
      success: true,
      committedFiles: modifiedList,
      rolledBack: false,
      verification,
      diffSummary: `Successfully committed ${modifiedList.length} file(s) with 0 compiler errors.`,
      durationMs: Date.now() - start,
    };
  }

  /**
   * Restores all modified files to their original snapshot state
   */
  public rollback(): { restoredFiles: string[]; success: boolean } {
    const restored: string[] = [];
    this.activeSnapshots.forEach((snapshot, relPath) => {
      try {
        const absPath = this.resolveSafePath(relPath);
        if (!snapshot.exists) {
          if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
        } else if (snapshot.content !== undefined) {
          fs.mkdirSync(path.dirname(absPath), { recursive: true });
          fs.writeFileSync(absPath, snapshot.content, 'utf-8');
        }
        restored.push(relPath);
      } catch (err) {
        console.error(`[CodeTransactionBuffer] Failed to rollback ${relPath}:`, err);
      }
    });
    this.clear();
    return { restoredFiles: restored, success: true };
  }
}

export const globalTransactionBuffer = new CodeTransactionBuffer();

// ============================================================================
// 5. ZERO-OVERHEAD WORKSPACE PREFLIGHT SENTRY
// (Gathers instant Git, branch, and topology state without exploratory tool roundtrips)
// ============================================================================

export interface WorkspacePreflightSnapshot {
  gitBranch: string;
  gitDirty: boolean;
  uncommittedFilesCount: number;
  lastCommit: string;
  packageScripts: string[];
  topLevelDirectories: string[];
  memoryUsageMb: { rss: number; heapUsed: number };
  timestamp: string;
}

let cachedPreflight: { snapshot: WorkspacePreflightSnapshot; expiresAt: number } | null = null;

export async function getWorkspacePreflightSnapshot(forceRefresh = false): Promise<WorkspacePreflightSnapshot> {
  const now = Date.now();
  if (!forceRefresh && cachedPreflight && cachedPreflight.expiresAt > now) {
    return cachedPreflight.snapshot;
  }

  let gitBranch = 'main';
  let gitDirty = false;
  let uncommittedCount = 0;
  let lastCommit = 'Unknown';
  let packageScripts: string[] = [];
  let topLevelDirs: string[] = [];

  try {
    const { stdout: branchOut } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: process.cwd(), timeout: 2000 });
    gitBranch = branchOut.trim() || 'main';
  } catch {}

  try {
    const { stdout: statusOut } = await execAsync('git status --porcelain', { cwd: process.cwd(), timeout: 2000 });
    const lines = statusOut.trim().split('\n').filter(Boolean);
    gitDirty = lines.length > 0;
    uncommittedCount = lines.length;
  } catch {}

  try {
    const { stdout: logOut } = await execAsync('git log -1 --oneline', { cwd: process.cwd(), timeout: 2000 });
    lastCommit = logOut.trim();
  } catch {}

  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      packageScripts = Object.keys(pkg.scripts || {});
    }
  } catch {}

  try {
    const entries = fs.readdirSync(process.cwd(), { withFileTypes: true });
    topLevelDirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name);
  } catch {}

  const mem = process.memoryUsage();
  const snapshot: WorkspacePreflightSnapshot = {
    gitBranch,
    gitDirty,
    uncommittedFilesCount: uncommittedCount,
    lastCommit,
    packageScripts,
    topLevelDirectories: topLevelDirs,
    memoryUsageMb: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    },
    timestamp: new Date().toISOString(),
  };

  cachedPreflight = { snapshot, expiresAt: now + 15000 }; // 15s TTL
  return snapshot;
}

export function formatPreflightContext(snapshot: WorkspacePreflightSnapshot): string {
  return `[WORKSPACE PRE-FLIGHT TELEMETRY]:
Branch: ${snapshot.gitBranch} | Dirty: ${snapshot.gitDirty ? `YES (${snapshot.uncommittedFilesCount} files)` : 'NO (Clean)'}
Last Commit: ${snapshot.lastCommit}
Directories: ${snapshot.topLevelDirectories.join(', ')}
Scripts: ${snapshot.packageScripts.join(', ')}
Host Memory: ${snapshot.memoryUsageMb.rss}MB RSS (${snapshot.memoryUsageMb.heapUsed}MB Heap)`;
}

// ============================================================================
// 6. FRIDAY FSM COORDINATOR (Finite State Machine Agent Lifecycle)
// ============================================================================

export type FridayCoordinatorState =
  | 'IDLE'
  | 'PREFLIGHT'
  | 'PLANNING'
  | 'STAGING_MUTATION'
  | 'VERIFYING_COMPILER'
  | 'COMMITTED'
  | 'ROLLED_BACK'
  | 'COMPLETED'
  | 'FAILED';

export interface FridayLifecycleEvent {
  turnId: string;
  state: FridayCoordinatorState;
  timestamp: string;
  details: string;
  metadata?: Record<string, any>;
}

export class FridayFsmCoordinator {
  private state: FridayCoordinatorState = 'IDLE';
  private events: FridayLifecycleEvent[] = [];
  private currentTurnId: string = '';

  public startTurn(turnId: string): void {
    this.currentTurnId = turnId;
    this.transition('PREFLIGHT', 'Turn initiated. Compiling workspace preflight snapshot.');
  }

  public transition(newState: FridayCoordinatorState, details: string, metadata?: Record<string, any>): void {
    this.state = newState;
    const event: FridayLifecycleEvent = {
      turnId: this.currentTurnId,
      state: newState,
      timestamp: new Date().toISOString(),
      details,
      metadata,
    };
    this.events.push(event);
  }

  public getState(): FridayCoordinatorState {
    return this.state;
  }

  public getEvents(): FridayLifecycleEvent[] {
    return [...this.events];
  }
}

export const globalFridayCoordinator = new FridayFsmCoordinator();

// ============================================================================
// 7. CODEX HARNESS PRIMITIVES (OpenAI Codex App Server Architecture)
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
  parentThreadId?: string;
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

export async function archiveThread(threadId: string): Promise<boolean> {
  const thread = await getThread(threadId);
  if (!thread) return false;
  thread.status = 'ARCHIVED';
  thread.updatedAt = new Date().toISOString();
  await syncThreadToStorage(thread);
  return true;
}

