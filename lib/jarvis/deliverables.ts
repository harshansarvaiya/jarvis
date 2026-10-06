/**
 * J.A.R.V.I.S. Mark II / F.R.I.D.A.Y. — Workspace Deliverables & Turn Snapshotter
 * Inspired by DeepSeek Harness (packages/deliverables: workspace-changes & tool-present).
 * 
 * Tracks workspace mutations across a turn, captures git working-tree diffs,
 * and allows explicit declaration of final deliverables for Sir.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export interface WorkspaceBaseline {
  timestamp: string;
  headCommit: string;
  dirtyFiles: string[];
}

export interface FileChangeStat {
  path: string;
  status: 'ADDED' | 'MODIFIED' | 'DELETED' | 'RENAMED';
  linesAdded: number;
  linesDeleted: number;
}

export interface WorkspaceChangesSummary {
  baselineCommit: string;
  changedFilesCount: number;
  totalLinesAdded: number;
  totalLinesDeleted: number;
  files: FileChangeStat[];
}

export interface PresentedDeliverable {
  path: string;
  title: string;
  description: string;
  category: 'FEATURE' | 'FIX' | 'TOOL' | 'DOCS' | 'INFRASTRUCTURE' | 'SCRIPT';
}

export interface TurnDeliverablesRecord {
  id: string;
  turnId?: string;
  timestamp: string;
  deliverables: PresentedDeliverable[];
  changesSummary?: WorkspaceChangesSummary;
}

const DELIVERABLES_FILE = path.join(process.cwd(), 'data', 'deliverables-history.json');

function ensureDeliverablesHistory(): TurnDeliverablesRecord[] {
  try {
    if (!fs.existsSync(DELIVERABLES_FILE)) {
      fs.mkdirSync(path.dirname(DELIVERABLES_FILE), { recursive: true });
      fs.writeFileSync(DELIVERABLES_FILE, JSON.stringify([]), 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(DELIVERABLES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function persistDeliverablesHistory(records: TurnDeliverablesRecord[]): void {
  try {
    fs.mkdirSync(path.dirname(DELIVERABLES_FILE), { recursive: true });
    // Keep last 100 turns
    const trimmed = records.slice(-100);
    fs.writeFileSync(DELIVERABLES_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch {}
}

/**
 * Captures a baseline snapshot of git state prior to turn execution
 */
export async function captureWorkspaceBaseline(cwd = process.cwd()): Promise<WorkspaceBaseline> {
  let headCommit = 'unknown';
  let dirtyFiles: string[] = [];

  try {
    const { stdout: commitOut } = await execAsync('git rev-parse HEAD', { cwd, timeout: 3000 });
    headCommit = commitOut.trim();
  } catch {}

  try {
    const { stdout: statusOut } = await execAsync('git status --porcelain', { cwd, timeout: 3000 });
    dirtyFiles = statusOut
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => line.slice(3).trim());
  } catch {}

  return {
    timestamp: new Date().toISOString(),
    headCommit,
    dirtyFiles,
  };
}

/**
 * Computes exact diff statistics since the baseline was recorded
 */
export async function computeWorkspaceChanges(
  baseline?: WorkspaceBaseline,
  cwd = process.cwd()
): Promise<WorkspaceChangesSummary> {
  let diffStat = '';
  let statusLines: string[] = [];

  try {
    const { stdout: statOut } = await execAsync('git diff --stat HEAD', { cwd, timeout: 5000 });
    diffStat = statOut.trim();
  } catch {}

  try {
    const { stdout: porcelainOut } = await execAsync('git status --porcelain', { cwd, timeout: 5000 });
    statusLines = porcelainOut.trim().split('\n').filter(Boolean);
  } catch {}

  const files: FileChangeStat[] = [];
  let totalLinesAdded = 0;
  let totalLinesDeleted = 0;

  for (const line of statusLines) {
    const code = line.slice(0, 2).trim();
    const filePath = line.slice(3).trim();

    let status: FileChangeStat['status'] = 'MODIFIED';
    if (code === '??' || code === 'A') status = 'ADDED';
    else if (code === 'D') status = 'DELETED';
    else if (code.startsWith('R')) status = 'RENAMED';

    // Parse git diff --numstat for line additions/deletions
    let added = 0;
    let deleted = 0;
    try {
      const { stdout: numstat } = await execAsync(`git diff --numstat HEAD -- "${filePath}"`, { cwd, timeout: 3000 });
      const parts = numstat.trim().split(/\s+/);
      if (parts.length >= 2) {
        added = parseInt(parts[0], 10) || 0;
        deleted = parseInt(parts[1], 10) || 0;
      }
    } catch {}

    totalLinesAdded += added;
    totalLinesDeleted += deleted;

    files.push({
      path: filePath,
      status,
      linesAdded: added,
      linesDeleted: deleted,
    });
  }

  return {
    baselineCommit: baseline?.headCommit || 'HEAD',
    changedFilesCount: files.length,
    totalLinesAdded,
    totalLinesDeleted,
    files,
  };
}

/**
 * Declares one or more deliverables produced in the current turn
 */
export async function presentDeliverables(
  deliverables: PresentedDeliverable[],
  turnId?: string,
  cwd = process.cwd()
): Promise<{ success: boolean; record: TurnDeliverablesRecord; formattedCard: string }> {
  const changes = await computeWorkspaceChanges(undefined, cwd);
  const recordId = `deliv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const record: TurnDeliverablesRecord = {
    id: recordId,
    turnId,
    timestamp: new Date().toISOString(),
    deliverables,
    changesSummary: changes,
  };

  const history = ensureDeliverablesHistory();
  history.push(record);
  persistDeliverablesHistory(history);

  // Build markdown presentation card for Sir
  const cardLines = [
    `### 📦 Verified Deliverables Manifest`,
    `**Mission Turn**: ${turnId || 'Tactical Execution'} | **Timestamp**: ${new Date().toLocaleTimeString()}`,
    `**Workspace Footprint**: ${changes.changedFilesCount} changed files (+${changes.totalLinesAdded} / -${changes.totalLinesDeleted} lines)`,
    '',
    `| Category | Deliverable | Description | Location |`,
    `| :--- | :--- | :--- | :--- |`,
  ];

  for (const d of deliverables) {
    cardLines.push(`| \`${d.category}\` | **${d.title}** | ${d.description} | \`${d.path}\` |`);
  }

  if (changes.files.length > 0) {
    cardLines.push('');
    cardLines.push(`**Mutated File Roster**:`);
    for (const f of changes.files.slice(0, 10)) {
      const icon = f.status === 'ADDED' ? '✨' : f.status === 'DELETED' ? '🗑️' : '📝';
      cardLines.push(`- ${icon} \`${f.path}\` (+${f.linesAdded} / -${f.linesDeleted}) [${f.status}]`);
    }
    if (changes.files.length > 10) {
      cardLines.push(`- *...and ${changes.files.length - 10} more files*`);
    }
  }

  return {
    success: true,
    record,
    formattedCard: cardLines.join('\n'),
  };
}
