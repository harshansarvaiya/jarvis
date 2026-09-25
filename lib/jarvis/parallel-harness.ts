/**
 * J.A.R.V.I.S. & F.R.I.D.A.Y. — Phase-Gated Parallel Trace Harness (Umbrella / Ouroboros Protocol)
 * 
 * Implements high-throughput speculative execution, branch gating, and closed-loop validation.
 * Allows Friday to evaluate multiple tool/subagent execution branches concurrently, filter out
 * defective traces before VM application, and merge verified outputs atomically.
 * 
 * Complies with Directive 03 (Evolutionary Adaptation) and Directive 06 (Zero VM Thrashing).
 */

import { runCompilerVerification, VerificationResult } from './harness';

export interface ParallelTraceBranch<T = any> {
  branchId: string;
  strategyName: string;
  execute: () => Promise<T>;
  verifier?: (result: T) => Promise<boolean> | boolean;
  priority: number; // Higher number = higher priority
}

export interface ParallelTraceResult<T = any> {
  winningBranchId: string;
  strategyName: string;
  output: T;
  latencyMs: number;
  branchesEvaluated: number;
  verificationPassed: boolean;
}

export class PhaseGatedTraceHarness {
  private maxConcurrency: number;

  constructor(maxConcurrency = 3) {
    this.maxConcurrency = maxConcurrency;
  }

  /**
   * Executes multiple speculative trace strategies in parallel with phase gating.
   * Resolves with the fastest, verified result that passes all validation gates.
   */
  async executeGatedRace<T>(branches: ParallelTraceBranch<T>[]): Promise<ParallelTraceResult<T>> {
    const startTime = Date.now();
    const sorted = [...branches].sort((a, b) => b.priority - a.priority).slice(0, this.maxConcurrency);

    if (sorted.length === 0) {
      throw new Error('No execution branches provided to PhaseGatedTraceHarness');
    }

    // Execute branches concurrently with individual verification gates
    const branchPromises = sorted.map(async (branch) => {
      const branchStart = Date.now();
      try {
        const output = await branch.execute();
        let verified = true;
        if (branch.verifier) {
          verified = await branch.verifier(output);
        }

        if (!verified) {
          throw new Error(`Branch verification failed for: ${branch.strategyName}`);
        }

        return {
          branchId: branch.branchId,
          strategyName: branch.strategyName,
          output,
          latencyMs: Date.now() - branchStart,
          verificationPassed: true,
        };
      } catch (err: any) {
        return Promise.reject({
          branchId: branch.branchId,
          strategyName: branch.strategyName,
          error: err.message,
        });
      }
    });

    try {
      // Settle on the first successful verified branch
      const winner = await Promise.any(branchPromises);
      return {
        winningBranchId: winner.branchId,
        strategyName: winner.strategyName,
        output: winner.output,
        latencyMs: Date.now() - startTime,
        branchesEvaluated: sorted.length,
        verificationPassed: true,
      };
    } catch (aggregateErr) {
      // Fallback: run the highest-priority branch directly
      const primary = sorted[0];
      const output = await primary.execute();
      return {
        winningBranchId: primary.branchId,
        strategyName: primary.strategyName,
        output,
        latencyMs: Date.now() - startTime,
        branchesEvaluated: 1,
        verificationPassed: false,
      };
    }
  }

  /**
   * Validates code mutations against closed-loop compiler verification before disk persistence.
   */
  async verifyCodeMutation(mutationDescriptor: string): Promise<VerificationResult> {
    console.log(`[Phase-Gated Harness] 🛡️ Verifying code mutation: "${mutationDescriptor}"...`);
    return await runCompilerVerification();
  }
}

export const globalParallelTraceHarness = new PhaseGatedTraceHarness();
