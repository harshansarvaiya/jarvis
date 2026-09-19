/**
 * J.A.R.V.I.S. & F.R.I.D.A.Y. — Autonomous Multi-Day Epic Execution Matrix
 * 
 * Enables autonomous decomposition of complex multi-day epics into structured
 * dependency sub-tasks, automatic progress evaluation, and continuous execution.
 * 
 * Enforces Directive 04 (Sovereign Loyalty & Relentless Execution).
 */

import { Redis } from '@upstash/redis';
import { addTask, updateTask, Task } from './memory';
import { executeSubagentTask } from './subagent-swarm';

export interface EpicSubTask {
  id: string;
  title: string;
  assignedAgent: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  dependencies: string[];
  output?: string;
  completedAt?: string;
}

export interface AutonomousEpic {
  id: string;
  title: string;
  goal: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  subtasks: EpicSubTask[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;
if (UPSTASH_URL && UPSTASH_TOKEN) {
  redis = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN });
}

/**
 * Initializes and registers an autonomous multi-step epic
 */
export async function initializeEpic(title: string, goal: string, steps: Array<{ title: string; assignedAgent?: string; dependencies?: string[] }>): Promise<AutonomousEpic> {
  const epicId = `epic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const subtasks: EpicSubTask[] = steps.map((s, idx) => ({
    id: `subtask-${epicId}-${idx + 1}`,
    title: s.title,
    assignedAgent: s.assignedAgent || 'friday',
    status: 'PENDING',
    dependencies: s.dependencies || [],
  }));

  const epic: AutonomousEpic = {
    id: epicId,
    title,
    goal,
    status: 'ACTIVE',
    subtasks,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Register master objective on tactical radar
  addTask({
    title: `[EPIC MATRIX] ${title}`,
    description: `Multi-stage autonomous objective: ${goal} (${subtasks.length} total steps).`,
    priority: 'HIGH',
    status: 'PENDING',
    tags: ['epic', 'autonomous', 'multi-day'],
  });

  if (redis) {
    try {
      await redis.set(`jarvis:epic:${epicId}`, JSON.stringify(epic));
    } catch (err: any) {
      console.warn('[EpicExecutor] Redis save error:', err.message);
    }
  }

  return epic;
}

/**
 * Executes the next ready sub-task in an active epic
 */
export async function stepActiveEpic(epicId: string): Promise<{ progress: string; completedStep?: EpicSubTask; epicFinished: boolean }> {
  if (!redis) {
    return { progress: 'Redis storage unavailable for epic tracking.', epicFinished: false };
  }

  const data = await redis.get(`jarvis:epic:${epicId}`);
  if (!data) return { progress: `Epic ${epicId} not found.`, epicFinished: false };

  const epic: AutonomousEpic = typeof data === 'string' ? JSON.parse(data) : data;
  if (epic.status !== 'ACTIVE') return { progress: `Epic ${epicId} is ${epic.status}.`, epicFinished: epic.status === 'COMPLETED' };

  // Find next actionable step whose dependencies are completed
  const completedIds = new Set(epic.subtasks.filter((s) => s.status === 'COMPLETED').map((s) => s.id));
  const nextTask = epic.subtasks.find(
    (s) => s.status === 'PENDING' && s.dependencies.every((d) => completedIds.has(d))
  );

  if (!nextTask) {
    const allDone = epic.subtasks.every((s) => s.status === 'COMPLETED');
    if (allDone) {
      epic.status = 'COMPLETED';
      epic.completedAt = new Date().toISOString();
      await redis.set(`jarvis:epic:${epicId}`, JSON.stringify(epic));
      return { progress: `All ${epic.subtasks.length} steps in epic "${epic.title}" completed successfully!`, epicFinished: true };
    }
    return { progress: `Epic ${epicId} is awaiting pending dependency resolution.`, epicFinished: false };
  }

  nextTask.status = 'IN_PROGRESS';
  await redis.set(`jarvis:epic:${epicId}`, JSON.stringify(epic));

  try {
    const subagentRes = await executeSubagentTask({
      agentId: nextTask.assignedAgent,
      instruction: `Execute step for epic "${epic.title}": ${nextTask.title}. Goal: ${epic.goal}`,
    });

    nextTask.status = subagentRes.status === 'SUCCESS' ? 'COMPLETED' : 'BLOCKED';
    nextTask.output = subagentRes.findings;
    nextTask.completedAt = new Date().toISOString();
    epic.updatedAt = new Date().toISOString();

    await redis.set(`jarvis:epic:${epicId}`, JSON.stringify(epic));

    return {
      progress: `Executed step "${nextTask.title}" via ${nextTask.assignedAgent}: ${subagentRes.status}.`,
      completedStep: nextTask,
      epicFinished: epic.subtasks.every((s) => s.status === 'COMPLETED'),
    };
  } catch (stepErr: any) {
    nextTask.status = 'BLOCKED';
    nextTask.output = `Execution failed: ${stepErr.message}`;
    await redis.set(`jarvis:epic:${epicId}`, JSON.stringify(epic));
    return { progress: `Step "${nextTask.title}" blocked: ${stepErr.message}`, completedStep: nextTask, epicFinished: false };
  }
}
