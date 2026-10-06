/**
 * J.A.R.V.I.S. Mark II / F.R.I.D.A.Y. — Text Spill Subsystem
 * Inspired by DeepSeek Harness (dsh-spill / spill-policy / spill-local).
 * 
 * Prevents context bloat and token degradation by offloading oversized tool outputs
 * (compiler dumps, logs, git diffs, directory trees) to persistent scratch files,
 * returning a lightweight preview and locator (SpillRef) to the LLM.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface SpillRef {
  __spillRef: true;
  spillId: string;
  spillPath: string;
  totalBytes: number;
  totalLines: number;
  sourceTool?: string;
  preview: string;
  retrievalGuidance: string;
  createdAt: string;
}

export interface SpillReadOptions {
  startLine?: number;
  endLine?: number;
  searchPattern?: string;
  maxLines?: number;
}

const SPILL_DIR = path.join(process.cwd(), 'scratch', 'spills');

function ensureSpillDir(): void {
  if (!fs.existsSync(SPILL_DIR)) {
    fs.mkdirSync(SPILL_DIR, { recursive: true });
  }
}

/**
 * Saves arbitrary text to a persistent spill file and returns a SpillRef
 */
export function saveTextSpill(
  content: string,
  metadata: { sourceTool?: string; intent?: string } = {}
): SpillRef {
  ensureSpillDir();
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 7);
  const spillId = `spill-${timestamp}-${randomSuffix}`;
  const filePath = path.join(SPILL_DIR, `${spillId}.log`);

  fs.writeFileSync(filePath, content, 'utf-8');

  const lines = content.split('\n');
  const totalLines = lines.length;
  const totalBytes = Buffer.byteLength(content, 'utf-8');

  // Head and tail preview
  const headLinesCount = Math.min(25, totalLines);
  const tailLinesCount = Math.min(15, Math.max(0, totalLines - headLinesCount));

  const head = lines.slice(0, headLinesCount).join('\n');
  const tail = tailLinesCount > 0 ? lines.slice(totalLines - tailLinesCount).join('\n') : '';
  const omitted = totalLines - headLinesCount - tailLinesCount;

  const preview = tailLinesCount > 0
    ? `${head}\n\n[... SPILL OVERFLOW: ${omitted} lines (${Math.round((totalBytes - head.length - tail.length) / 1024)} KB) omitted from context ...]\n\n${tail}`
    : head;

  return {
    __spillRef: true,
    spillId,
    spillPath: filePath,
    totalBytes,
    totalLines,
    sourceTool: metadata.sourceTool,
    preview,
    retrievalGuidance: `Full output spilled to disk (${totalLines} lines, ${(totalBytes / 1024).toFixed(1)} KB). To inspect specific lines or search, use the 'read_spill' tool with spillId="${spillId}".`,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Checks if text exceeds threshold and spills to disk if necessary.
 */
export function createSpillIfNeeded(
  text: string,
  maxInlineChars = 3500,
  maxInlineLines = 85,
  metadata: { sourceTool?: string; intent?: string } = {}
): { isSpilled: boolean; content: string; spillRef?: SpillRef } {
  if (!text) {
    return { isSpilled: false, content: '' };
  }

  const linesCount = text.split('\n').length;
  if (text.length <= maxInlineChars && linesCount <= maxInlineLines) {
    return { isSpilled: false, content: text };
  }

  const spillRef = saveTextSpill(text, metadata);
  const formattedContent = `${spillRef.preview}\n\n[NOTICE]: ${spillRef.retrievalGuidance}`;

  return {
    isSpilled: true,
    content: formattedContent,
    spillRef,
  };
}

/**
 * Reads specific lines or searches within a spilled file
 */
export function readSpill(
  spillId: string,
  options: SpillReadOptions = {}
): { success: boolean; data?: string; totalLines?: number; error?: string } {
  try {
    ensureSpillDir();
    // Path traversal check
    const safeId = path.basename(spillId).replace(/[^a-zA-Z0-9_-]/g, '');
    const candidatePath = path.join(SPILL_DIR, safeId.endsWith('.log') ? safeId : `${safeId}.log`);

    if (!fs.existsSync(candidatePath)) {
      return { success: false, error: `Spill file not found: ${spillId}` };
    }

    const content = fs.readFileSync(candidatePath, 'utf-8');
    const lines = content.split('\n');
    const totalLines = lines.length;

    // Pattern search mode
    if (options.searchPattern) {
      const regex = new RegExp(options.searchPattern, 'i');
      const matches: string[] = [];
      const contextRadius = 2;

      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          const start = Math.max(0, i - contextRadius);
          const end = Math.min(lines.length - 1, i + contextRadius);
          matches.push(`--- Match near Line ${i + 1} ---`);
          for (let j = start; j <= end; j++) {
            matches.push(`${j + 1}: ${lines[j]}`);
          }
          if (matches.length > 100) {
            matches.push(`[... Further matches truncated ...]`);
            break;
          }
        }
      }

      return {
        success: true,
        data: matches.length > 0 ? matches.join('\n') : `No matches found for pattern "${options.searchPattern}".`,
        totalLines,
      };
    }

    // Line slice mode
    const startLine = Math.max(1, options.startLine || 1);
    const maxLines = Math.min(options.maxLines || 100, 200);
    const endLine = options.endLine
      ? Math.min(totalLines, options.endLine)
      : Math.min(totalLines, startLine + maxLines - 1);

    const slice = lines.slice(startLine - 1, endLine);
    const formatted = slice.map((line, idx) => `${startLine + idx}: ${line}`).join('\n');

    return {
      success: true,
      data: formatted,
      totalLines,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to read spill file' };
  }
}

/**
 * Cleans up spills older than maxAgeMs (default: 48 hours)
 */
export function pruneOldSpills(maxAgeMs = 48 * 60 * 60 * 1000): number {
  ensureSpillDir();
  let prunedCount = 0;
  try {
    const files = fs.readdirSync(SPILL_DIR);
    const now = Date.now();
    for (const f of files) {
      if (!f.endsWith('.log')) continue;
      const fullPath = path.join(SPILL_DIR, f);
      const stat = fs.statSync(fullPath);
      if (now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(fullPath);
        prunedCount++;
      }
    }
  } catch {}
  return prunedCount;
}
