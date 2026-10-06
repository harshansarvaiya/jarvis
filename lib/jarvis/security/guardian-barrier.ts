/**
 * J.A.R.V.I.S. Mark II / F.R.I.D.A.Y. — Guardian Two-Man Interactive Approval Barrier
 * 
 * Inspired by TencentCloud/Octop's interactive tool authorization gate &
 * gstack's /CAREFUL Guardian Protocol.
 * 
 * Replaces cumbersome manual textual overrides with interactive Telegram Inline Keyboards:
 * When a high-privilege directive or /CAREFUL Soft-Warn action is triggered,
 * Friday posts an approval card to Sir with [Approve & Actuate] and [Abort] buttons.
 */

import { getUniversalStorage } from '../storage';
import { telegramGateway, TelegramInlineKeyboardMarkup } from '../telegram';

export interface GuardianPendingAction {
  actionId: string;
  type: 'SHELL' | 'GHOST_HANDS' | 'DATABASE' | 'DEPLOY';
  title: string;
  command?: string;
  targetDevice?: string;
  payload?: any;
  requestedBy?: string;
  createdAt: string;
  expiresAt: number;
}

const GUARDIAN_PENDING_PREFIX = 'jarvis:guardian_pending:';

/**
 * Registers a high-privilege action awaiting Sir's cryptographic/one-tap approval
 */
export async function createGuardianPendingAction(
  params: Omit<GuardianPendingAction, 'actionId' | 'createdAt' | 'expiresAt'>
): Promise<GuardianPendingAction> {
  const actionId = `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  const expiresAt = now + 5 * 60 * 1000; // 5 min TTL

  const action: GuardianPendingAction = {
    actionId,
    ...params,
    createdAt: new Date().toISOString(),
    expiresAt,
  };

  try {
    const storage = getUniversalStorage();
    await storage.execute('setex', `${GUARDIAN_PENDING_PREFIX}${actionId}`, 300, JSON.stringify(action));
  } catch (err: any) {
    console.warn(`[Guardian Barrier] Failed to cache pending action: ${err.message}`);
  }

  return action;
}

/**
 * Retrieves a pending action by its ID
 */
export async function getGuardianPendingAction(actionId: string): Promise<GuardianPendingAction | null> {
  try {
    const storage = getUniversalStorage();
    const raw = await storage.execute('get', `${GUARDIAN_PENDING_PREFIX}${actionId}`);
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

/**
 * Dispatches an interactive approval card to Sir's authorized Telegram
 */
export async function dispatchGuardianApprovalPrompt(
  chatId: string | number,
  action: GuardianPendingAction
): Promise<boolean> {
  const targetLabel = action.targetDevice ? `🖥️ Host Node: \`${action.targetDevice}\`` : `☁️ Runner: \`antigravity-cloud-runner\``;
  const commandSnippet = action.command || JSON.stringify(action.payload, null, 2);

  const message = `🛡️ **[GUARDIAN TWO-MAN PERMISSION GATE]**
Requested by: *${action.requestedBy || 'F.R.I.D.A.Y.'}*
${targetLabel}

⚠️ **Directive:** *${action.title}*
\`\`\`
${commandSnippet.slice(0, 1000)}
\`\`\`

_Directive locked. Tap below to actuate or abort._`;

  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: '✅ Approve & Actuate', callback_data: `guardian_approve:${action.actionId}` },
        { text: '❌ Abort Directive', callback_data: `guardian_abort:${action.actionId}` },
      ],
    ],
  };

  return await telegramGateway.sendMessage(chatId, message, {
    parseMode: 'Markdown',
    replyMarkup: keyboard,
  });
}

/**
 * Executes a pending action once approved by Sir
 */
export async function executeGuardianApprovedAction(actionId: string): Promise<{ success: boolean; output: string }> {
  const action = await getGuardianPendingAction(actionId);
  if (!action) {
    return {
      success: false,
      output: 'Directive expired or not found. Action may have already been handled.',
    };
  }

  // Clear pending state
  try {
    const storage = getUniversalStorage();
    await storage.execute('del', `${GUARDIAN_PENDING_PREFIX}${actionId}`);
  } catch {}

  // Actuate based on action type
  if (action.type === 'GHOST_HANDS' && action.payload) {
    const { dispatchGhostHandsCommand } = await import('../satellite');
    const res = await dispatchGhostHandsCommand(
      action.targetDevice || '',
      action.payload.action,
      action.payload.params || {},
      45000
    );
    return {
      success: res.success,
      output: res.output || res.error || 'Ghost hands directive completed.',
    };
  }

  if (action.type === 'SHELL' && action.command) {
    const { executeJarvisTool } = await import('../tools');
    const res = await executeJarvisTool('cloud_execute_command', { command: action.command });
    return {
      success: res.success,
      output: res.result?.stdout || res.result?.stderr || res.error || 'Command executed.',
    };
  }

  return {
    success: true,
    output: `Directive [${action.type}] ${action.title} approved and recorded.`,
  };
}

/**
 * Revokes and deletes a pending action
 */
export async function abortGuardianAction(actionId: string): Promise<boolean> {
  try {
    const storage = getUniversalStorage();
    await storage.execute('del', `${GUARDIAN_PENDING_PREFIX}${actionId}`);
    return true;
  } catch {
    return false;
  }
}
