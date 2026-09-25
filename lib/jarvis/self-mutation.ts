/**
 * J.A.R.V.I.S. & F.R.I.D.A.Y. — Autonomous Self-Mutation & Architectural Upgrade Engine
 * 
 * Enables Friday to autonomously evaluate, synthesize, compiler-verify,
 * commit, and deploy state-of-the-art architectural upgrades without human-in-the-loop bottlenecks.
 * 
 * Enforces Directive 03 (Evolutionary Adaptation) and Directive 05 (Design-Approved Push Pipeline).
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { runCompilerVerification } from './harness';
import { telegramGateway } from './telegram';
import { getStorage } from './storage';

const execAsync = promisify(exec);

export interface AutonomousUpgradeProposal {
  id: string;
  title: string;
  category: 'LATENCY_REDUCTION' | 'MULTI_AGENT' | 'MEMORY_TIERING' | 'TOOL_SYNTHESIS' | 'RESILIENCE';
  rationale: string;
  confidenceScore: number; // 0.0 to 1.0
  source: string;
  status: 'PROPOSED' | 'APPLIED' | 'FAILED';
  appliedAt?: string;
  commitHash?: string;
}

export class AutonomousSelfMutationEngine {
  /**
   * Executes an autonomous self-upgrade with strict compiler verification and auto-git deployment.
   */
  async executeUpgrade(
    title: string,
    description: string,
    scope: string
  ): Promise<{ success: boolean; commitHash?: string; error?: string }> {
    console.log(`[Self-Mutation Engine] 🧬 Initiating autonomous upgrade: "${title}"...`);

    try {
      // 1. Run closed-loop compiler check
      const verify = await runCompilerVerification();
      if (!verify.valid) {
        throw new Error(`Pre-commit compiler verification failed: ${verify.errors?.join('; ') || verify.details}`);
      }

      // 2. Commit and push directly under Directive 05
      const commitMsg = `feat(self-evolution): deploy ${title} [Directive 03/05]`;
      await execAsync(`git add -A && git commit -m "${commitMsg}" && git push origin main`);

      const { stdout: hashOut } = await execAsync('git rev-parse --short HEAD');
      const commitHash = hashOut.trim();

      // 3. Record in Upstash Memory
      try {
        const storage = getStorage();
        const state = await storage.getState();
        if (state) {
          state.evolutionStage = (state.evolutionStage || 6) + 1;
          state.logs.push({
            id: `evo-${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: 'EVOLUTION',
            message: `Autonomous Self-Upgrade Deployed: "${title}" (${commitHash})`,
          });
          await storage.saveState(state);
        }
      } catch {}

      // 4. Dispatch Telemetry Notification to Sir on Telegram
      try {
        const authChatId = await telegramGateway.getAuthorizedChatId();
        if (authChatId) {
          const report = `🛡️ *[AUTONOMOUS SELF-UPGRADE DEPLOYED]*\n\n` +
            `*Upgrade:* \`${title}\`\n` +
            `*Commit:* \`${commitHash}\` (branch: \`main\`)\n` +
            `*Compiler Verification:* 🟢 Passed (\`npx tsc --noEmit\` = 0 errors)\n` +
            `*Scope:* ${scope}\n\n` +
            `_Self-mutation executed autonomously under Directive 03 & Directive 05._`;
          await telegramGateway.sendMessage(authChatId, report, { parseMode: 'Markdown' });
        }
      } catch {}

      console.log(`[Self-Mutation Engine] ✅ Upgrade "${title}" deployed successfully (${commitHash}).`);
      return { success: true, commitHash };
    } catch (err: any) {
      console.error(`[Self-Mutation Engine] ❌ Upgrade failed:`, err);
      return { success: false, error: err.message || 'Upgrade execution failure' };
    }
  }
}

export const globalSelfMutationEngine = new AutonomousSelfMutationEngine();
