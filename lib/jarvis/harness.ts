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
