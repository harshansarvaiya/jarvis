/**
 * J.A.R.V.I.S. Mark II / F.R.I.D.A.Y. — PTC (Program-aided Tool Calling) Runtime Engine
 * Inspired by DeepSeek Harness (packages/ptc-runtime & ptc-runtime-node).
 * 
 * Allows the agent to write a single multi-step script that executes host bindings
 * (filesystem, git, search, memory) in a single in-process/sub-process run,
 * eliminating 5-10 conversational network roundtrips and token bloat.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export interface PtcRunRequest {
  script: string;
  language?: 'typescript' | 'javascript';
  timeoutMs?: number;
  intent?: string;
  cwd?: string;
}

export interface PtcRunResult {
  success: boolean;
  returnValue?: any;
  stdout: string;
  stderr: string;
  executionDurationMs: number;
  error?: string;
}

const PTC_SCRATCH_DIR = path.join(process.cwd(), 'scratch', 'ptc');

function ensurePtcScratch(): void {
  if (!fs.existsSync(PTC_SCRATCH_DIR)) {
    fs.mkdirSync(PTC_SCRATCH_DIR, { recursive: true });
  }
}

/**
 * Executes a programmatic script against local host bindings with sandboxing safeguards
 */
export async function executePtcScript(request: PtcRunRequest): Promise<PtcRunResult> {
  const start = Date.now();
  ensurePtcScratch();

  const timeoutMs = Math.min(request.timeoutMs || 25000, 45000);
  const cwd = request.cwd || process.cwd();
  const scriptId = `ptc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const scriptPath = path.join(PTC_SCRATCH_DIR, `${scriptId}.ts`);

  // Directive 01 Guardian Safety check against dangerous script content
  const code = request.script;
  const hardDenyTokens = ['rm -rf /', 'mkfs', 'DROP TABLE', ':(){ :|:& };:'];
  for (const token of hardDenyTokens) {
    if (code.includes(token)) {
      return {
        success: false,
        stdout: '',
        stderr: `🛡️ GUARDIAN PROTOCOL HARD-DENY: Dangerous pattern "${token}" detected in PTC script.`,
        executionDurationMs: Date.now() - start,
        error: 'Security violation blocked by Guardian Protocol.',
      };
    }
  }

  // Wrap user code in async IIFE with host bindings if not already structured
  let executableScript = code;
  if (!code.includes('import ') && !code.includes('export ')) {
    executableScript = `
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

async function main() {
  ${code}
}

main().then(res => {
  if (res !== undefined) {
    console.log('[PTC_RETURN_VALUE]:' + JSON.stringify(res));
  }
}).catch(err => {
  console.error('[PTC_EXECUTION_ERROR]:', err);
  process.exit(1);
});
`;
  }

  try {
    fs.writeFileSync(scriptPath, executableScript, 'utf-8');

    // Run using npx tsx (or node if JS)
    const { stdout, stderr } = await execAsync(`npx tsx "${scriptPath}"`, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, PTC_RUN_ID: scriptId },
    });

    let returnValue: any = undefined;
    const returnMarker = '[PTC_RETURN_VALUE]:';
    const lines = stdout.split('\n');
    const filteredStdoutLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith(returnMarker)) {
        try {
          returnValue = JSON.parse(line.slice(returnMarker.length));
        } catch {
          returnValue = line.slice(returnMarker.length);
        }
      } else {
        filteredStdoutLines.push(line);
      }
    }

    return {
      success: true,
      returnValue,
      stdout: filteredStdoutLines.join('\n').trim(),
      stderr: stderr.trim(),
      executionDurationMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      success: false,
      stdout: (err.stdout || '').trim(),
      stderr: (err.stderr || err.message || 'PTC script execution failed').trim(),
      executionDurationMs: Date.now() - start,
      error: err.message,
    };
  } finally {
    // Keep scratch script for audit/debug, but prune after 24h
  }
}
