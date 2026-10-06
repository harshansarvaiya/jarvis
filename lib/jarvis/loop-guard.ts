/**
 * J.A.R.V.I.S. Mark II / F.R.I.D.A.Y. — Loop Hygiene Guard
 * Inspired by DeepSeek Harness (packages/guard/repeat-tool-reminder).
 * 
 * Intercepts deterministic agent thrashing and infinite retry loops by monitoring
 * tool invocations and detecting identical or cyclic repetitive calls.
 */

import * as crypto from 'crypto';

export interface ExecutedToolRecord {
  toolName: string;
  argsHash: string;
  argsSummary: string;
  timestamp: number;
}

export interface LoopGuardCheckResult {
  isLoop: boolean;
  repetitionCount: number;
  actionToTake: 'ALLOW' | 'WARN' | 'INTERCEPT';
  advisoryGuidance?: string;
  interceptionMessage?: string;
}

export class LoopHygieneGuard {
  private history: ExecutedToolRecord[] = [];
  private maxHistory = 30;

  /**
   * Hashes canonicalized arguments to detect identical tool invocations
   */
  private hashArgs(args: Record<string, any>): { hash: string; summary: string } {
    try {
      const keys = Object.keys(args || {}).sort();
      const sortedObj: Record<string, any> = {};
      for (const k of keys) {
        sortedObj[k] = args[k];
      }
      const serialized = JSON.stringify(sortedObj);
      const hash = crypto.createHash('sha256').update(serialized).digest('hex').slice(0, 16);
      const summary = serialized.length > 80 ? serialized.slice(0, 77) + '...' : serialized;
      return { hash, summary };
    } catch {
      return { hash: 'unhashable', summary: '' };
    }
  }

  /**
   * Evaluates a proposed tool call against execution history.
   * Returns guidance or interception decision before tool executes.
   */
  public inspectProposedCall(
    toolName: string,
    args: Record<string, any>
  ): LoopGuardCheckResult {
    const { hash, summary } = this.hashArgs(args);
    const now = Date.now();

    // Check consecutive identical calls
    let consecutiveIdentical = 0;
    for (let i = this.history.length - 1; i >= 0; i--) {
      const item = this.history[i];
      if (item.toolName === toolName && item.argsHash === hash) {
        consecutiveIdentical++;
      } else {
        break;
      }
    }

    // Check cyclic repeat (e.g. A -> B -> A -> B)
    let cyclicMatches = 0;
    if (this.history.length >= 3) {
      const prev2 = this.history[this.history.length - 2];
      if (prev2 && prev2.toolName === toolName && prev2.argsHash === hash) {
        cyclicMatches++;
      }
    }

    // Record the call
    this.history.push({
      toolName,
      argsHash: hash,
      argsSummary: summary,
      timestamp: now,
    });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Intercept if 2 identical calls already occurred (this would be the 3rd)
    if (consecutiveIdentical >= 2) {
      return {
        isLoop: true,
        repetitionCount: consecutiveIdentical + 1,
        actionToTake: 'INTERCEPT',
        interceptionMessage: `[LOOP HYGIENE GUARD INTERCEPTION — DEEPSEEK/G-STACK PROTOCOL]:
Execution halted. Tool "${toolName}" with parameters ${summary} has been invoked ${consecutiveIdentical + 1} times consecutively without parameter mutation.
Repeating identical actions burns tokens and violates the gstack Investigate Iron Law.

Mandate:
1. Formulate 2-3 explicit hypotheses regarding why earlier attempts were insufficient.
2. Select a different tool or mutate arguments.
3. If blocked by external factors, report the concrete blockers directly to Sir.`,
      };
    }

    // Warn on first duplicate
    if (consecutiveIdentical === 1) {
      return {
        isLoop: true,
        repetitionCount: 2,
        actionToTake: 'WARN',
        advisoryGuidance: `[LOOP HYGIENE ADVISORY]: You are repeating "${toolName}" with the exact same parameters as the immediately preceding step. Ensure you are not caught in a blind retry loop.`,
      };
    }

    if (cyclicMatches > 0) {
      return {
        isLoop: true,
        repetitionCount: 2,
        actionToTake: 'WARN',
        advisoryGuidance: `[LOOP HYGIENE ADVISORY]: Cyclic tool invocation detected (repeating ${toolName} with identical parameters across alternating steps). Verify your direction.`,
      };
    }

    return {
      isLoop: false,
      repetitionCount: 1,
      actionToTake: 'ALLOW',
    };
  }

  /**
   * Resets execution history on turn boundaries
   */
  public reset(): void {
    this.history = [];
  }

  public getCallCount(): number {
    return this.history.length;
  }
}

export const globalLoopGuard = new LoopHygieneGuard();
