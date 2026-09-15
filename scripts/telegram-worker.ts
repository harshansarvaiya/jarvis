/**
 * J.A.R.V.I.S. Mark II — 24/7 Telegram Sovereign Gateway Worker
 * 
 * Runs continuously on the Cloud Runner VM (antigravity-cloud-runner).
 * Connects Sir's Telegram directly to J.A.R.V.I.S. Core Engine & Vertex AI Gemini 3.8.
 */

import * as fs from 'fs';
import * as path from 'path';
import { TelegramGateway, TelegramUpdate } from '../lib/jarvis/telegram';
import { runJarvisAgent } from '../lib/jarvis/agent';
import {
  getUniversalChatHistory,
  appendUniversalChatMessages,
  ChatMessageRecord,
} from '../lib/jarvis/storage';

// 1. Load Local Environment
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...rest] = trimmed.split('=');
        if (key && rest.length > 0 && !process.env[key.trim()]) {
          process.env[key.trim()] = rest.join('=').trim();
        }
      }
    }
  }
}

loadEnv();

const MASTER_PIN = process.env.JARVIS_MASTER_PIN || '1001';
const gateway = new TelegramGateway();

async function handleIncomingMessage(update: TelegramUpdate) {
  const msg = update.message;
  if (!msg || !msg.text) return;

  const chatId = msg.chat.id;
  const userText = msg.text.trim();
  const authorizedChatId = await gateway.getAuthorizedChatId();

  console.log(`[Telegram Gateway] Message from Chat ID ${chatId} (${msg.from?.first_name}): "${userText.substring(0, 50)}..."`);

  // SENTRY AUTHENTICATION CHECK
  const isAuthorized = authorizedChatId && String(authorizedChatId) === String(chatId);

  if (!isAuthorized) {
    const cleanPinCandidate = userText.replace(/^\/auth\s*/i, '').trim();
    if (cleanPinCandidate === MASTER_PIN) {
      await gateway.setAuthorizedChatId(chatId);
      await gateway.sendMessage(
        chatId,
        `🛡️ *[SENTRY VERIFICATION SUCCESSFUL]*\n\nWelcome back, Sir. J.A.R.V.I.S. Mark II Sovereign Telegram Uplink is now securely locked to your account.\n\n` +
        `• **Engine**: Google Cloud Vertex AI Enterprise (Gemini 3.8 Flash)\n` +
        `• **Mode**: Stage 5 Performance Mode\n` +
        `• **Directives**: All 5 Core Directives Enforced\n\n` +
        `How may I serve you today, Sir?`,
        { parseMode: 'Markdown' }
      );
      return;
    }

    await gateway.sendMessage(
      chatId,
      `⛔ *[ACCESS RESTRICTED — GUARDIAN PROTOCOL]*\n\n` +
      `This channel is unauthorized. J.A.R.V.I.S. Mark II requires sovereign authentication.\n\n` +
      `Please reply with your **Master Security PIN** to bind this Telegram channel to your neural substrate.`,
      { parseMode: 'Markdown' }
    );
    return;
  }

  // SIR IS AUTHORIZED — DISPATCH DIRECTIVE TO CORE ENGINE
  await gateway.sendTypingAction(chatId);

  try {
    // 1. Retrieve Recent Universal Chat History for Cross-Device Continuity
    const rawHistory = await getUniversalChatHistory(16);
    const contextMessages = rawHistory.map((h) => ({
      id: h.id,
      role: h.role,
      content: h.content,
      image: h.image,
    }));

    // Append Current Message
    const userMsgRecord: ChatMessageRecord = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString(),
    };
    contextMessages.push({
      id: userMsgRecord.id,
      role: userMsgRecord.role,
      content: userMsgRecord.content,
      image: undefined,
    });

    // 2. Invoke J.A.R.V.I.S. Agent (Vertex AI Gemini 3.8 Flash with Extended Thinking)
    const result = await runJarvisAgent(contextMessages, {
      model: 'gemini-3.8-flash',
      orchestrationMode: 'auto',
    });

    // 3. Save Both Records to Universal Storage (Syncs to Web PWA in Real-Time)
    const assistantMsgRecord: ChatMessageRecord = {
      id: `msg-${Date.now()}-a`,
      role: 'assistant',
      content: result.reply,
      vocalSummary: result.vocalSummary,
      tacticalActions: result.tacticalActions,
      toolCalls: result.toolCallsExecuted,
      internalThoughts: result.internalThoughts,
      telemetry: result.telemetry,
      timestamp: new Date().toISOString(),
    };

    await appendUniversalChatMessages([userMsgRecord, assistantMsgRecord]);

    // 4. Format Output for Telegram
    let responseText = result.reply;

    // Append Tool Action Indicators if tools were executed
    if (result.toolCallsExecuted && result.toolCallsExecuted.length > 0) {
      const toolSummaries = result.toolCallsExecuted.map((tc) => `⚡ \`${tc.name}\``).join('  ');
      responseText += `\n\n_${toolSummaries}_`;
    }

    // Append Telemetry Badge
    if (result.telemetry) {
      const engineName = result.telemetry.engineUsed || 'Vertex AI Gemini 3.8';
      responseText += `\n\n🧠 \`${engineName} // ${result.telemetry.latencyMs}ms\``;
    }

    await gateway.sendMessage(chatId, responseText, {
      parseMode: 'Markdown',
      replyToMessageId: msg.message_id,
    });
  } catch (err: any) {
    console.error('[Telegram Gateway] Processing error:', err);
    await gateway.sendMessage(
      chatId,
      `Sir, a temporary cognitive latency occurred while processing your directive: ${err.message}. State and safeguards remain nominal.`,
      { replyToMessageId: msg.message_id }
    );
  }
}

async function startTelegramGateway() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  J.A.R.V.I.S. MARK II — SOVEREIGN TELEGRAM UPLINK GATEWAY     ║');
  console.log('║  Host: antigravity-cloud-runner (GCP Compute Engine e2-micro) ║');
  console.log('║  Mode: Stage 5 Performance Substrate (Vertex AI Gemini 3.8)   ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  if (!gateway.isConfigured()) {
    console.log('⚠️ [Telegram Gateway] TELEGRAM_BOT_TOKEN is not configured.');
    console.log('To activate your private Telegram Uplink in 30 seconds:');
    console.log('  1. Open Telegram on your phone and search for @BotFather');
    console.log('  2. Send: /newbot and choose a name (e.g. "Jarvis Sir AI") and username');
    console.log('  3. Copy the Bot API Token provided by BotFather');
    console.log('  4. Add to .env.local: TELEGRAM_BOT_TOKEN=<your_token>\n');
    return;
  }

  const authorizedId = await gateway.getAuthorizedChatId();
  if (authorizedId) {
    console.log(`[Telegram Gateway] 🔒 Sovereign Channel Bound to Chat ID: ${authorizedId}`);
  } else {
    console.log('[Telegram Gateway] 🛡️ Sentry Active: Awaiting initial Master PIN from Sir.');
  }

  console.log('[Telegram Gateway] 🚀 Long-polling active. Ready for mobile directives...');

  let offset: number | undefined = undefined;

  while (true) {
    try {
      const updates = await gateway.getUpdates(offset, 30);
      for (const update of updates) {
        offset = update.update_id + 1;
        await handleIncomingMessage(update);
      }
    } catch (err: any) {
      console.warn('[Telegram Gateway] Loop warning:', err.message);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

startTelegramGateway().catch((err) => {
  console.error('[Telegram Gateway Fatal Error]:', err);
});
