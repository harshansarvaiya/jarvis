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

const ALLOWED_USER_ID = process.env.TELEGRAM_ALLOWED_USER_ID || '864360540';
const MASTER_PIN = process.env.JARVIS_MASTER_PIN || '1001';
const gateway = new TelegramGateway();

async function handleIncomingMessage(update: TelegramUpdate) {
  const msg = update.message;
  if (!msg) return;

  const senderId = msg.from?.id;
  const chatId = msg.chat.id;

  const hasPhoto = Boolean(msg.photo && msg.photo.length > 0);
  const hasDoc = Boolean(msg.document && msg.document.mime_type?.startsWith('image/'));
  let userText = (msg.text || msg.caption || '').trim();

  if (!userText && (hasPhoto || hasDoc)) {
    userText = 'Please analyze this screenshot/image, Sir.';
  }
  if (!userText && !hasPhoto && !hasDoc) return;

  // =========================================================================
  // GUARDIAN PROTOCOL (DIRECTIVE 01): IMMUTABLE SENDER CRYPTOGRAPHIC SENTRY
  // In MTProto, msg.from.id is an immutable 64-bit integer signed by Telegram.
  // It is mathematically impossible to spoof across Telegram servers.
  // =========================================================================
  if (!senderId || String(senderId) !== String(ALLOWED_USER_ID)) {
    console.warn(
      `[GUARDIAN SENTRY] 🚨 Unauthorized packet discarded from unknown sender: ID=${senderId}, Name=${msg.from?.first_name || 'anon'}, Username=@${msg.from?.username || 'none'}`
    );
    // GHOST SENTRY: Drop silently. Zero acknowledgment, zero error, zero reconnaissance.
    return;
  }

  // Reject group chats — J.A.R.V.I.S. operates exclusively in private 1-on-1 sovereign channels
  if (msg.chat.type !== 'private') {
    console.warn(`[GUARDIAN SENTRY] 🚨 Rejected non-private chat type: ${msg.chat.type}`);
    return;
  }

  console.log(`[Telegram Gateway] 🛡️ Verified Sovereign Directive from Sir (ID: ${senderId}): "${userText.substring(0, 50)}..."${hasPhoto ? ' [PHOTO ATTACHED]' : ''}`);

  // SIR IS AUTHORIZED — DISPATCH DIRECTIVE TO CORE ENGINE
  const typingPulse = setInterval(() => {
    gateway.sendTypingAction(chatId).catch(() => {});
  }, 4000);
  await gateway.sendTypingAction(chatId);

  // Download multimodal visual media if attached
  let base64Image: string | undefined = undefined;
  if (hasPhoto && msg.photo) {
    const largestPhoto = msg.photo[msg.photo.length - 1];
    const b64 = await gateway.downloadFileAsBase64(largestPhoto.file_id);
    if (b64) base64Image = b64;
  } else if (hasDoc && msg.document) {
    const b64 = await gateway.downloadFileAsBase64(msg.document.file_id, msg.document.mime_type);
    if (b64) base64Image = b64;
  }

  try {
    // 1. Retrieve Recent Universal Chat History for Cross-Device Continuity
    const rawHistory = await getUniversalChatHistory(16);
    const contextMessages = rawHistory.map((h) => ({
      id: h.id,
      role: h.role,
      content: h.content,
      image: h.image,
    }));

    // Parse model/engine command override if supplied (e.g. /groq, /nim, /openrouter, /pro, /model <name>)
    let requestedModel = 'gemini-3.7-flash';
    let requestedMode: any = 'auto';
    let cleanUserText = userText.trim();

    if (cleanUserText.startsWith('/groq')) {
      requestedModel = 'openai/gpt-oss-120b';
      requestedMode = 'groq';
      cleanUserText = cleanUserText.replace(/^\/groq\s*/i, '').trim();
    } else if (cleanUserText.startsWith('/nim')) {
      requestedModel = 'meta/llama-3.2-90b-vision-instruct';
      requestedMode = 'nvidia';
      cleanUserText = cleanUserText.replace(/^\/nim\s*/i, '').trim();
    } else if (cleanUserText.startsWith('/openrouter')) {
      requestedModel = 'nvidia/nemotron-3-super-120b-a12b:free';
      requestedMode = 'openrouter';
      cleanUserText = cleanUserText.replace(/^\/openrouter\s*/i, '').trim();
    } else if (cleanUserText.startsWith('/pro')) {
      requestedModel = 'gemini-2.5-pro';
      requestedMode = 'auto';
      cleanUserText = cleanUserText.replace(/^\/pro\s*/i, '').trim();
    } else if (cleanUserText.startsWith('/gemini') || cleanUserText.startsWith('/flash')) {
      requestedModel = 'gemini-3.7-flash';
      requestedMode = 'auto';
      cleanUserText = cleanUserText.replace(/^\/(gemini|flash)\s*/i, '').trim();
    } else if (cleanUserText.startsWith('/friday')) {
      cleanUserText = cleanUserText.replace(/^\/friday\s*/i, '').trim();
      cleanUserText = `Friday, ${cleanUserText}`;
      requestedModel = 'gemini-3.7-flash';
      requestedMode = 'auto';
    } else if (cleanUserText.startsWith('/jarvis')) {
      cleanUserText = cleanUserText.replace(/^\/jarvis\s*/i, '').trim();
      cleanUserText = `Jarvis, ${cleanUserText}`;
      requestedModel = 'gemini-3.7-flash';
      requestedMode = 'auto';
    } else if (cleanUserText.startsWith('/model ')) {
      const match = cleanUserText.match(/^\/model\s+([^\s]+)\s*(.*)$/i);
      if (match) {
        requestedModel = match[1];
        cleanUserText = match[2].trim();
      }
    }

    if (!cleanUserText && userText) {
      cleanUserText = userText;
    }

    // Append Current Message
    const userMsgRecord: ChatMessageRecord = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: cleanUserText,
      image: base64Image,
      timestamp: new Date().toISOString(),
    };
    contextMessages.push({
      id: userMsgRecord.id,
      role: userMsgRecord.role,
      content: userMsgRecord.content,
      image: base64Image,
    });

    // 2. Invoke J.A.R.V.I.S. Agent
    const result = await runJarvisAgent(contextMessages, {
      model: requestedModel,
      orchestrationMode: requestedMode,
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

    // Append Tool Execution Summaries & Empirical Outputs if tools were executed
    if (result.toolCallsExecuted && result.toolCallsExecuted.length > 0) {
      const toolBlocks: string[] = [];
      for (const tc of result.toolCallsExecuted) {
        let block = `⚡ \`${tc.name}\``;
        const res = tc.result;
        let rawOutput = '';
        if (res) {
          if (typeof res === 'string') {
            rawOutput = res;
          } else if (typeof res === 'object') {
            rawOutput = res.stdout || res.output || res.result || '';
          }
        }
        if (rawOutput && typeof rawOutput === 'string' && rawOutput.trim()) {
          const cleanOut = rawOutput.trim();
          if (!responseText.includes(cleanOut.slice(0, 30))) {
            const truncatedOut = cleanOut.length > 400 ? cleanOut.slice(0, 400) + '...' : cleanOut;
            block += `\n\`\`\`\n${truncatedOut}\n\`\`\``;
          }
        }
        toolBlocks.push(block);
      }
      responseText += `\n\n${toolBlocks.join('\n\n')}`;
    }

    // Append Telemetry Badge (F.R.I.D.A.Y. vs J.A.R.V.I.S.)
    if (result.telemetry) {
      const engineName = result.telemetry.engineUsed || 'Vertex AI Gemini 3.8';
      const isFriday = result.telemetry.persona === 'FRIDAY';
      const badgePrefix = isFriday ? '🛡️ `[F.R.I.D.A.Y. APEX]' : '⚡ `[J.A.R.V.I.S. TACTICAL]';
      responseText += `\n\n${badgePrefix} ${engineName} // ${result.telemetry.latencyMs}ms\``;
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
  } finally {
    clearInterval(typingPulse);
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
