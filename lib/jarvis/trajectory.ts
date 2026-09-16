/**
 * J.A.R.V.I.S. Mark II — Trajectory Logging & Model Distillation Subsystem
 * Modeled after Nous Research Hermes Agent Trajectory Export
 * 
 * Captures high-signal multi-turn reasoning paths, motive deconstructions,
 * internal thoughts, and tool calling sequences into standardized datasets.
 * 
 * Enables:
 * - Post-90-day model distillation into low-cost or local edge models
 * - Empirical performance benchmarking and error-pattern discovery
 * - Export in ShareGPT and OpenAI fine-tuning JSONL formats
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
  };
}

const TRAJECTORY_DIR = path.resolve(process.cwd(), 'data', 'trajectories');
const TRAJECTORY_FILE = path.join(TRAJECTORY_DIR, 'trajectories.jsonl');

function ensureTrajectoryDir() {
  if (!fs.existsSync(TRAJECTORY_DIR)) {
    fs.mkdirSync(TRAJECTORY_DIR, { recursive: true });
  }
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
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

/**
 * Exports trajectories in standard ShareGPT format for model fine-tuning
 */
export function exportShareGptTrajectories(): Array<{ conversations: Array<{ from: string; value: string }> }> {
  const all = getAllTrajectories();
  return all.map((t) => ({
    conversations: [
      { from: 'human', value: t.userPrompt },
      {
        from: 'gpt',
        value: t.internalThoughts
          ? `<thought>\n${t.internalThoughts}\n</thought>\n\n${t.assistantReply}`
          : t.assistantReply,
      },
    ],
  }));
}
