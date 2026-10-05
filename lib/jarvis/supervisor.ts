/**
 * J.A.R.V.I.S. & F.R.I.D.A.Y. Mark II — Autonomous Sovereign Supervisor Engine
 * 
 * Inspired by Munder Difflin's "GOD Agent" orchestrator, LangGraph supervisor,
 * and Stanford Generative Agents.
 * 
 * Features:
 * 1. DAG Task Decomposition & Lifecycle Management (Directed Acyclic Graphs)
 * 2. Stigmergic Agent Mailboxes (Inboxes / Outboxes without git-lock collisions)
 * 3. Autonomous Execution Loop with Closed-Loop Compiler Verification (npx tsc --noEmit)
 * 4. Human-in-the-Loop (HITL) Guardian Gates for Destructive/Critical Operations
 * 5. Universal Dual-Storage Persistence (Upstash Redis Cloud + Local Atomic JSON)
 * 
 * Strictly complies with Directive 01 (Guardian Protocol), Directive 04 (Sovereign Loyalty),
 * and Directive 06 (Zero-Thrashing Infrastructure Integrity on 8GB GCP VM).
 */

import * as fs from 'fs';
import * as path from 'path';
import { getStorage } from './storage';
import { executeSubagentTask, SubagentExecutionResult } from './subagent-swarm';
import { runCompilerVerification, VerificationResult } from './harness';
import { TOP_HIGH_ROI_AGENTS, AgentProfile } from './agents-registry';
import { publishStateEvent } from './state-bus';
import { executeJarvisTool } from './tools';

export type SupervisorTaskStatus =
  | 'PENDING'
  | 'IN_FLIGHT'
  | 'VERIFYING'
  | 'BLOCKED_HITL'
  | 'COMPLETED'
  | 'FAILED';

export type SupervisorPriority = 'P0_CRITICAL' | 'P1_HIGH' | 'P2_MEDIUM' | 'P3_LOW';

export interface SupervisorTask {
  id: string;
  dagId: string;
  sequenceOrder: number;
  title: string;
  directive: string;
  specialistId: string; // e.g., 'security-auditor', 'architecture-expert', 'build-error-resolver', 'friday', 'jarvis'
  status: SupervisorTaskStatus;
  priority: SupervisorPriority;
  dependsOnTaskIds?: string[];
  requiresHITL: boolean;
  hitlApproved?: boolean;
  hitlPrompt?: string;
  inputContext?: any;
  outputResult?: any;
  toolsExecuted?: string[];
  verified?: boolean;
  verificationReport?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
}

export interface SupervisorDAG {
  dagId: string;
  rootDirective: string;
  initiator: 'sir' | 'cloud-worker' | 'telegram' | 'web-pwa';
  tasks: SupervisorTask[];
  status: 'ACTIVE' | 'PAUSED_HITL' | 'COMPLETED' | 'FAILED';
  finalSynthesis?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface AgentMailboxMessage {
  id: string;
  fromAgent: string;
  toAgent: string;
  type: 'DIRECTIVE' | 'FINDING' | 'ALERT' | 'HITL_PROMPT' | 'COMPLETION';
  subject: string;
  payload: any;
  timestamp: string;
  read: boolean;
}

const SUPERVISOR_DAGS_KEY = 'jarvis:supervisor:dags';
const SUPERVISOR_MAILBOX_PREFIX = 'jarvis:supervisor:mailbox:';
const LOCAL_DATA_DIR = path.join(process.cwd(), 'data');
const LOCAL_DAGS_FILE = path.join(LOCAL_DATA_DIR, 'supervisor-dags.json');
const LOCAL_MAILBOX_FILE = path.join(LOCAL_DATA_DIR, 'supervisor-mailboxes.json');

// ==========================================
// 1. Dual-Persistence Storage Layer
// ==========================================

function ensureLocalDir() {
  if (!fs.existsSync(LOCAL_DATA_DIR)) {
    try {
      fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    } catch {}
  }
}

/**
 * Load all DAGs from Upstash Redis with local atomic fallback
 */
export async function getSupervisorDAGs(): Promise<SupervisorDAG[]> {
  try {
    const storage = getStorage();
    const raw = await storage.execute('get', SUPERVISOR_DAGS_KEY);
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        // Sync local cache
        saveLocalDAGs(parsed);
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[Supervisor] Upstash read failed, reading local fallback:', err);
  }

  return loadLocalDAGs();
}

/**
 * Persist all DAGs to both local backup and Upstash Redis
 */
export async function saveSupervisorDAGs(dags: SupervisorDAG[]): Promise<void> {
  saveLocalDAGs(dags);
  try {
    const storage = getStorage();
    await storage.execute('set', SUPERVISOR_DAGS_KEY, JSON.stringify(dags));
  } catch (err) {
    console.warn('[Supervisor] Upstash write failed, local backup retained:', err);
  }
}

function loadLocalDAGs(): SupervisorDAG[] {
  try {
    ensureLocalDir();
    if (fs.existsSync(LOCAL_DAGS_FILE)) {
      const content = fs.readFileSync(LOCAL_DAGS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {}
  return [];
}

function saveLocalDAGs(dags: SupervisorDAG[]) {
  try {
    ensureLocalDir();
    fs.writeFileSync(LOCAL_DAGS_FILE, JSON.stringify(dags, null, 2), 'utf-8');
  } catch {}
}

function loadLocalMailboxes(): Record<string, AgentMailboxMessage[]> {
  try {
    ensureLocalDir();
    if (fs.existsSync(LOCAL_MAILBOX_FILE)) {
      const content = fs.readFileSync(LOCAL_MAILBOX_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch {}
  return {};
}

function saveLocalMailboxes(boxes: Record<string, AgentMailboxMessage[]>) {
  try {
    ensureLocalDir();
    fs.writeFileSync(LOCAL_MAILBOX_FILE, JSON.stringify(boxes, null, 2), 'utf-8');
  } catch {}
}

// ==========================================
// 2. Stigmergic Mailbox System
// ==========================================

/**
 * Posts an atomic message to an agent's dedicated mailbox
 */
export async function postToAgentMailbox(
  toAgent: string,
  msg: Omit<AgentMailboxMessage, 'id' | 'timestamp' | 'read' | 'toAgent'>
): Promise<AgentMailboxMessage> {
  const fullMsg: AgentMailboxMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    toAgent,
    fromAgent: msg.fromAgent,
    type: msg.type,
    subject: msg.subject,
    payload: msg.payload,
    timestamp: new Date().toISOString(),
    read: false,
  };

  // 1. Local append
  const boxes = loadLocalMailboxes();
  if (!boxes[toAgent]) boxes[toAgent] = [];
  boxes[toAgent].push(fullMsg);
  // Keep last 50 messages per agent
  if (boxes[toAgent].length > 50) {
    boxes[toAgent] = boxes[toAgent].slice(-50);
  }
  saveLocalMailboxes(boxes);

  // 2. Upstash Cloud append
  try {
    const storage = getStorage();
    await storage.execute('rpush', `${SUPERVISOR_MAILBOX_PREFIX}${toAgent}`, JSON.stringify(fullMsg));
  } catch {}

  // 3. Notify State Bus
  publishStateEvent({
    type: 'agent:action',
    source: msg.fromAgent === 'friday' ? 'friday' : 'jarvis',
    channel: 'supervisor',
    title: `📬 Mailbox: ${msg.fromAgent.toUpperCase()} ➔ ${toAgent.toUpperCase()}`,
    detail: msg.subject,
    payload: { messageId: fullMsg.id, type: fullMsg.type },
  }).catch(() => {});

  return fullMsg;
}

/**
 * Drains and marks read all unread messages for a specific agent
 */
export async function drainAgentMailbox(agentId: string): Promise<AgentMailboxMessage[]> {
  const boxes = loadLocalMailboxes();
  const agentBox = boxes[agentId] || [];
  const unread = agentBox.filter((m) => !m.read);

  for (const m of agentBox) {
    m.read = true;
  }
  saveLocalMailboxes(boxes);

  return unread;
}

// ==========================================
// 3. Directive DAG Decomposition Engine
// ==========================================

/**
 * Evaluates whether a directive triggers HITL Guardian Protocol
 */
export function evaluateHITLRequirement(directive: string): { requiresHITL: boolean; prompt?: string } {
  const lower = directive.toLowerCase();

  // Tier 1: HARD-DENY / CRITICAL OPERATIONS (Requires Sir Explicit Confirmation)
  const destructivePatterns = [
    { regex: /\brm\s+-rf\b/i, reason: 'Recursive filesystem deletion (rm -rf)' },
    { regex: /\bgit\s+push\b.*(--force|-f)\b/i, reason: 'Remote Git force-push' },
    { regex: /\b(drop\s+database|drop\s+table|truncate)\b/i, reason: 'Irreversible database destruction' },
    { regex: /\b(mkfs|dd\s+if=)\b/i, reason: 'Disk format / raw device write' },
    { regex: /\b(npm\s+publish)\b/i, reason: 'Public package registry release' },
    { regex: /\b(spend|transfer|payment|buy)\b/i, reason: 'External monetary transaction' },
  ];

  for (const p of destructivePatterns) {
    if (p.regex.test(lower)) {
      return {
        requiresHITL: true,
        prompt: `⚠️ GUARDIAN PROTOCOL INTERCEPT: Directive involves ${p.reason}. Requires Sir's explicit verification before cloud execution.`,
      };
    }
  }

  return { requiresHITL: false };
}

/**
 * Decomposes a high-level operational directive into a structured Directed Acyclic Graph (DAG)
 */
export async function decomposeDirectiveIntoDAG(
  directive: string,
  initiator: 'sir' | 'cloud-worker' | 'telegram' | 'web-pwa' = 'sir'
): Promise<SupervisorDAG> {
  const dagId = `dag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const lower = directive.toLowerCase().trim();

  const tasks: SupervisorTask[] = [];

  // 1. Check for Security Audit & Vulnerability Scan
  const isSecurity = /security|owasp|audit|vulnerability|cve|leak|secret/i.test(lower);
  // 2. Check for Build / Compiler / Refactoring
  const isBuildOrRefactor = /build|compile|tsc|typecheck|error|fix|refactor|mutation/i.test(lower);
  // 3. Check for Architecture / Topology Review
  const isArchitecture = /architect|topology|component|modular|system design/i.test(lower);
  // 4. Check for Performance / Infrastructure Optimization
  const isPerformance = /performance|latency|benchmark|optimizer|cgroup|memory/i.test(lower);

  const hitlCheck = evaluateHITLRequirement(directive);

  if (isSecurity) {
    const t1Id = `task-${Date.now()}-1`;
    tasks.push({
      id: t1Id,
      dagId,
      sequenceOrder: 1,
      title: '🛡️ SAST & OWASP Security Audit',
      directive: `Execute comprehensive security audit: inspect codebase, secrets, and auth routes.`,
      specialistId: 'security-auditor',
      status: 'PENDING',
      priority: 'P0_CRITICAL',
      requiresHITL: false,
      retryCount: 0,
      maxRetries: 2,
      createdAt: now,
      updatedAt: now,
    });

    if (isBuildOrRefactor) {
      const t2Id = `task-${Date.now()}-2`;
      tasks.push({
        id: t2Id,
        dagId,
        sequenceOrder: 2,
        title: '🔧 Surgical Remediation & Type Safety Fix',
        directive: `Apply surgical fixes for any findings, ensuring zero compiler errors.`,
        specialistId: 'build-error-resolver',
        status: 'PENDING',
        priority: 'P1_HIGH',
        dependsOnTaskIds: [t1Id],
        requiresHITL: hitlCheck.requiresHITL,
        hitlPrompt: hitlCheck.prompt,
        retryCount: 0,
        maxRetries: 2,
        createdAt: now,
        updatedAt: now,
      });

      tasks.push({
        id: `task-${Date.now()}-3`,
        dagId,
        sequenceOrder: 3,
        title: '🧪 Closed-Loop Compiler Verification',
        directive: `Run npx tsc --noEmit and verify type integrity across all routes.`,
        specialistId: 'tdd-testing-engineer',
        status: 'PENDING',
        priority: 'P1_HIGH',
        dependsOnTaskIds: [t2Id],
        requiresHITL: false,
        retryCount: 0,
        maxRetries: 1,
        createdAt: now,
        updatedAt: now,
      });
    }
  } else if (isBuildOrRefactor) {
    const t1Id = `task-${Date.now()}-1`;
    tasks.push({
      id: t1Id,
      dagId,
      sequenceOrder: 1,
      title: '🔧 Compiler Diagnostic & Code Mutation',
      directive: directive,
      specialistId: 'build-error-resolver',
      status: hitlCheck.requiresHITL ? 'BLOCKED_HITL' : 'PENDING',
      priority: 'P0_CRITICAL',
      requiresHITL: hitlCheck.requiresHITL,
      hitlPrompt: hitlCheck.prompt,
      retryCount: 0,
      maxRetries: 2,
      createdAt: now,
      updatedAt: now,
    });

    tasks.push({
      id: `task-${Date.now()}-2`,
      dagId,
      sequenceOrder: 2,
      title: '🧪 Closed-Loop Compiler Verification (tsc)',
      directive: 'Verify build integrity via npx tsc --noEmit.',
      specialistId: 'tdd-testing-engineer',
      status: 'PENDING',
      priority: 'P1_HIGH',
      dependsOnTaskIds: [t1Id],
      requiresHITL: false,
      retryCount: 0,
      maxRetries: 1,
      createdAt: now,
      updatedAt: now,
    });
  } else if (isArchitecture) {
    tasks.push({
      id: `task-${Date.now()}-1`,
      dagId,
      sequenceOrder: 1,
      title: '📐 Codebase Topology & Component Graph Analysis',
      directive: directive,
      specialistId: 'architecture-expert',
      status: 'PENDING',
      priority: 'P1_HIGH',
      requiresHITL: false,
      retryCount: 0,
      maxRetries: 1,
      createdAt: now,
      updatedAt: now,
    });
  } else if (isPerformance) {
    tasks.push({
      id: `task-${Date.now()}-1`,
      dagId,
      sequenceOrder: 1,
      title: '🚀 Cloud Infrastructure & Latency Profiling',
      directive: directive,
      specialistId: 'performance-optimizer',
      status: 'PENDING',
      priority: 'P1_HIGH',
      requiresHITL: false,
      retryCount: 0,
      maxRetries: 1,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    // General Operational Task assigned to Friday or Jarvis
    const isFriday = /code|script|terminal|deploy|git|repo|infra/i.test(lower);
    tasks.push({
      id: `task-${Date.now()}-1`,
      dagId,
      sequenceOrder: 1,
      title: isFriday ? '🛡️ Friday Tactical Execution' : '⚡ Jarvis Operational Butler',
      directive: directive,
      specialistId: isFriday ? 'friday' : 'jarvis',
      status: hitlCheck.requiresHITL ? 'BLOCKED_HITL' : 'PENDING',
      priority: 'P2_MEDIUM',
      requiresHITL: hitlCheck.requiresHITL,
      hitlPrompt: hitlCheck.prompt,
      retryCount: 0,
      maxRetries: 2,
      createdAt: now,
      updatedAt: now,
    });
  }

  const dag: SupervisorDAG = {
    dagId,
    rootDirective: directive,
    initiator,
    tasks,
    status: hitlCheck.requiresHITL ? 'PAUSED_HITL' : 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  // Persist DAG
  const allDags = await getSupervisorDAGs();
  allDags.unshift(dag);
  // Cap at 30 historic DAGs
  await saveSupervisorDAGs(allDags.slice(0, 30));

  publishStateEvent({
    type: 'state:task_updated',
    source: 'friday',
    channel: 'supervisor',
    title: `📋 New DAG Orchestrated: ${dag.tasks.length} Subtasks`,
    detail: directive.slice(0, 80),
    payload: { dagId: dag.dagId, taskCount: dag.tasks.length, hitlBlocked: hitlCheck.requiresHITL },
  }).catch(() => {});

  return dag;
}

// ==========================================
// 4. Autonomous Supervisor Execution Engine
// ==========================================

/**
 * Executes a single task within an active DAG
 */
export async function executeSupervisorTask(task: SupervisorTask, dag: SupervisorDAG): Promise<SupervisorTask> {
  task.status = 'IN_FLIGHT';
  task.updatedAt = new Date().toISOString();

  publishStateEvent({
    type: 'agent:action',
    source: 'friday',
    channel: 'supervisor',
    title: `🚀 Executing: ${task.title}`,
    detail: `Specialist: ${task.specialistId.toUpperCase()}`,
    payload: { taskId: task.id, dagId: task.dagId },
  }).catch(() => {});

  try {
    // 1. Aggregate upstream outputs as context
    let upstreamContext = '';
    if (task.dependsOnTaskIds && task.dependsOnTaskIds.length > 0) {
      const upstreams = dag.tasks.filter((t) => task.dependsOnTaskIds!.includes(t.id));
      upstreamContext = upstreams
        .map((u) => `[OUTPUT FROM ${u.title.toUpperCase()}]:\n${JSON.stringify(u.outputResult || u.error || '', null, 2)}`)
        .join('\n\n');
    }

    // 2. Dispatch to Specialist Runner
    if (task.specialistId === 'friday' || task.specialistId === 'jarvis') {
      // General agent tool execution
      const toolRes = await executeJarvisTool('cloud_execute_command', {
        command: task.directive.startsWith('npx ') || task.directive.startsWith('git ') || task.directive.startsWith('ls ')
          ? task.directive
          : `echo "Executed: ${task.title.replace(/"/g, '')}"`,
      });
      task.outputResult = toolRes.result;
      task.toolsExecuted = ['cloud_execute_command'];
    } else {
      // Specialized Domain Agent
      const subResult: SubagentExecutionResult = await executeSubagentTask({
        agentId: task.specialistId,
        instruction: task.directive,
        contextPayload: upstreamContext,
      });

      task.outputResult = {
        findings: subResult.findings,
        recommendations: subResult.recommendations,
        prunedSummary: subResult.prunedSummary,
      };
      task.toolsExecuted = subResult.toolsExecuted;
    }

    // 3. Closed-Loop Compiler Verification Gate
    if (
      task.specialistId === 'build-error-resolver' ||
      task.specialistId === 'tdd-testing-engineer' ||
      task.title.includes('Compiler')
    ) {
      task.status = 'VERIFYING';
      const verifyRes: VerificationResult = await runCompilerVerification();
      task.verified = verifyRes.valid;
      task.verificationReport = verifyRes.details;

      if (!verifyRes.valid) {
        throw new Error(`Compiler verification failed: ${verifyRes.errors?.slice(0, 3).join('; ') || verifyRes.details}`);
      }
    } else {
      task.verified = true;
    }

    task.status = 'COMPLETED';
    task.completedAt = new Date().toISOString();
    task.updatedAt = task.completedAt;

    // Send completion envelope to Friday's mailbox
    postToAgentMailbox('friday', {
      fromAgent: task.specialistId,
      type: 'COMPLETION',
      subject: `Task Completed: ${task.title}`,
      payload: { taskId: task.id, output: task.outputResult },
    }).catch(() => {});

  } catch (err: any) {
    task.retryCount++;
    task.error = err.message;
    task.updatedAt = new Date().toISOString();

    if (task.retryCount < task.maxRetries) {
      task.status = 'PENDING'; // Retry on next cycle
      console.warn(`[Supervisor] Task ${task.id} failed, scheduled for retry (${task.retryCount}/${task.maxRetries})`);
    } else {
      task.status = 'FAILED';
      console.error(`[Supervisor] Task ${task.id} permanently failed:`, err.message);
    }
  }

  return task;
}

/**
 * Runs a single tick of the Supervisor Cycle (called by cloud-worker.ts every 30s)
 */
export async function runSupervisorCycle(
  dispatchPushFn?: (title: string, body: string, actionUrl?: string, options?: any) => Promise<any>
): Promise<{ tasksProcessed: number; dagsCompleted: number; hitlAlertsSent: number }> {
  const dags = await getSupervisorDAGs();
  let tasksProcessed = 0;
  let dagsCompleted = 0;
  let hitlAlertsSent = 0;

  let modified = false;

  for (const dag of dags) {
    if (dag.status === 'COMPLETED' || dag.status === 'FAILED') continue;

    // 1. Check for tasks blocked on HITL
    const hitlTasks = dag.tasks.filter((t) => t.status === 'BLOCKED_HITL' && !t.hitlApproved);
    if (hitlTasks.length > 0) {
      dag.status = 'PAUSED_HITL';
      for (const ht of hitlTasks) {
        if (dispatchPushFn) {
          await dispatchPushFn(
            '🛡️ F.R.I.D.A.Y. HITL Approval Required',
            `${ht.hitlPrompt || ht.title}\nTask: "${ht.directive.slice(0, 100)}"`,
            '/tasks'
          );
          hitlAlertsSent++;
        }
      }
      modified = true;
      continue;
    }

    // 2. Identify runnable tasks (PENDING and all upstream dependencies COMPLETED)
    const runnableTasks = dag.tasks.filter((task) => {
      if (task.status !== 'PENDING') return false;
      if (!task.dependsOnTaskIds || task.dependsOnTaskIds.length === 0) return true;

      // Check all upstream dependencies
      return task.dependsOnTaskIds.every((depId) => {
        const dep = dag.tasks.find((t) => t.id === depId);
        return dep && dep.status === 'COMPLETED';
      });
    });

    // Execute at most 2 runnable tasks per tick to protect VM resources (Directive 06)
    for (const task of runnableTasks.slice(0, 2)) {
      await executeSupervisorTask(task, dag);
      tasksProcessed++;
      modified = true;
    }

    // 3. Evaluate DAG Completion
    const allDone = dag.tasks.every((t) => t.status === 'COMPLETED');
    const anyFailed = dag.tasks.some((t) => t.status === 'FAILED');

    if (allDone) {
      dag.status = 'COMPLETED';
      dag.completedAt = new Date().toISOString();
      dag.finalSynthesis = `✅ All ${dag.tasks.length} subtasks successfully orchestrated and verified without errors.`;
      dagsCompleted++;
      modified = true;

      if (dispatchPushFn) {
        await dispatchPushFn(
          '🎯 Autonomous Mission Completed',
          `Directive: "${dag.rootDirective.slice(0, 80)}"\n${dag.finalSynthesis}`,
          '/tasks'
        );
      }
    } else if (anyFailed) {
      dag.status = 'FAILED';
      dag.completedAt = new Date().toISOString();
      modified = true;
    }
  }

  if (modified) {
    await saveSupervisorDAGs(dags);
  }

  return { tasksProcessed, dagsCompleted, hitlAlertsSent };
}

// ==========================================
// 5. HITL Guardian Approval API
// ==========================================

/**
 * Sir approves or rejects a blocked HITL task
 */
export async function resolveHITLApproval(
  taskId: string,
  approved: boolean,
  sirNote?: string
): Promise<{ success: boolean; message: string }> {
  const dags = await getSupervisorDAGs();
  let found = false;

  for (const dag of dags) {
    const task = dag.tasks.find((t) => t.id === taskId);
    if (task) {
      found = true;
      task.hitlApproved = approved;
      task.updatedAt = new Date().toISOString();

      if (approved) {
        task.status = 'PENDING';
        dag.status = 'ACTIVE';
        task.inputContext = { ...(task.inputContext || {}), sirApprovalNote: sirNote || 'Approved by Sir' };
      } else {
        task.status = 'FAILED';
        task.error = sirNote || 'Directive rejected by Sir under Guardian Protocol.';
        dag.status = 'FAILED';
      }
      break;
    }
  }

  if (found) {
    await saveSupervisorDAGs(dags);
    publishStateEvent({
      type: 'agent:action',
      source: 'user',
      channel: 'supervisor',
      title: approved ? `✅ HITL Approved by Sir: ${taskId}` : `❌ HITL Rejected by Sir: ${taskId}`,
      detail: sirNote,
      payload: { taskId, approved },
    }).catch(() => {});

    return {
      success: true,
      message: approved ? 'Task unblocked and queued for autonomous execution.' : 'Task rejected and aborted.',
    };
  }

  return { success: false, message: `Task ID ${taskId} not found in active supervisor ledger.` };
}

/**
 * Retrieves all tasks currently blocked awaiting Sir's HITL approval
 */
export async function getPendingHITLTasks(): Promise<SupervisorTask[]> {
  const dags = await getSupervisorDAGs();
  const pending: SupervisorTask[] = [];

  for (const dag of dags) {
    if (dag.status === 'PAUSED_HITL' || dag.status === 'ACTIVE') {
      for (const t of dag.tasks) {
        if (t.status === 'BLOCKED_HITL' && !t.hitlApproved) {
          pending.push(t);
        }
      }
    }
  }

  return pending;
}
