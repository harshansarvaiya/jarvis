/**
 * J.A.R.V.I.S. Mark II — 24/7 Telegram Sovereign Gateway Worker
 * 
 * Runs continuously on the Cloud Runner VM (antigravity-cloud-runner).
 * Connects Sir's Telegram directly to J.A.R.V.I.S. Core Engine & Groq LPU Voice Substrate.
 * 
 * Capabilities:
 * - Direct Groq Whisper sub-200ms voice memo transcription
 * - Multimodal vision analysis for screenshots/photos
 * - Interactive Inline Action Keyboards & Callbacks
 * - Dual-agent support (⚡ J.A.R.V.I.S. vs 🛡️ F.R.I.D.A.Y.)
 * - 100% Western AI foundation models (Directive 01)
 */

import * as fs from 'fs';
import * as path from 'path';
import { TelegramGateway, TelegramUpdate, TelegramInlineKeyboardMarkup } from '../lib/jarvis/telegram';
import { transcribeAudioBuffer } from '../lib/jarvis/audio';
import { runJarvisAgent } from '../lib/jarvis/agent';
import {
  getUniversalChatHistory,
  appendUniversalChatMessages,
  appendAgentChatMessage,
  ChatMessageRecord,
} from '../lib/jarvis/storage';
import {
  getPersonaConfig,
  updatePersonaConfig,
  DEFAULT_PERSONA_CONFIG,
  PersonaTone,
  VerbosityLevel,
  SparringIntensity,
} from '../lib/jarvis/persona';
import {
  listSpecializedAgents,
  getSpecializedAgentProfile,
  AgentProfile,
} from '../lib/jarvis/agents-registry';
import { sanitizeInboundText } from '../lib/jarvis/security/shield';

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

// 1.1 Single-Instance Process Mutex Lock (Guarantees zero duplicate workers)
const LOCK_FILE = '/tmp/jarvis-telegram-worker.lock';

function acquireSingleInstanceLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const existingPidStr = fs.readFileSync(LOCK_FILE, 'utf8').trim();
      const existingPid = parseInt(existingPidStr, 10);
      if (!isNaN(existingPid) && existingPid !== process.pid && existingPid !== process.ppid) {
        try {
          process.kill(existingPid, 'SIGTERM');
          console.log(`[Telegram Gateway] 🔄 Terminated previous stale worker instance (PID: ${existingPid}) to yield to latest deploy.`);
        } catch {
          // Process not running, stale lockfile
        }
      }
    }
    fs.writeFileSync(LOCK_FILE, String(process.pid), 'utf8');

    const cleanLock = () => {
      try {
        if (fs.existsSync(LOCK_FILE)) {
          const stored = fs.readFileSync(LOCK_FILE, 'utf8').trim();
          if (stored === String(process.pid)) {
            fs.unlinkSync(LOCK_FILE);
          }
        }
      } catch {}
    };

    process.on('exit', cleanLock);
    process.on('SIGINT', () => { cleanLock(); process.exit(0); });
    process.on('SIGTERM', () => { cleanLock(); process.exit(0); });
  } catch (err) {
    console.warn('[Telegram Gateway] Process lock warning:', err);
  }
}

acquireSingleInstanceLock();

const ALLOWED_USER_ID = process.env.TELEGRAM_ALLOWED_USER_ID || '864360540';
const gateway = new TelegramGateway();

// -------------------------------------------------------------
// INCOGNITO STEALTH MODE STATE (Zero History, Zero Memories)
// -------------------------------------------------------------
const incognitoChats = new Set<string>();

async function isIncognitoActive(chatId: string | number): Promise<boolean> {
  const idStr = String(chatId);
  if (incognitoChats.has(idStr)) return true;
  try {
    const { getStorage } = await import('../lib/jarvis/storage');
    const storage = getStorage();
    const val = await storage.execute('get', `jarvis:incognito:${idStr}`);
    if (val === '1' || val === 'true') {
      incognitoChats.add(idStr);
      return true;
    }
  } catch {}
  return false;
}

async function setIncognitoActive(chatId: string | number, active: boolean): Promise<void> {
  const idStr = String(chatId);
  if (active) {
    incognitoChats.add(idStr);
  } else {
    incognitoChats.delete(idStr);
  }
  try {
    const { getStorage } = await import('../lib/jarvis/storage');
    const storage = getStorage();
    if (active) {
      await storage.execute('setex', `jarvis:incognito:${idStr}`, 7200, '1');
    } else {
      await storage.execute('del', `jarvis:incognito:${idStr}`);
    }
  } catch {}
}

/**
 * Builds the interactive specialized subagents matrix keyboard
 */
function buildSubagentsKeyboard(): TelegramInlineKeyboardMarkup {
  const agents = listSpecializedAgents();
  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: [],
  };

  // 2 subagents per row
  for (let i = 0; i < agents.length; i += 2) {
    const row: any[] = [];
    const a1 = agents[i];
    row.push({
      text: `${a1.name.split(' ')[0]} ${a1.role.slice(0, 18)}`,
      callback_data: `subagent:${a1.id}`,
    });
    if (agents[i + 1]) {
      const a2 = agents[i + 1];
      row.push({
        text: `${a2.name.split(' ')[0]} ${a2.role.slice(0, 18)}`,
        callback_data: `subagent:${a2.id}`,
      });
    }
    keyboard.inline_keyboard.push(row);
  }

  // Navigation shortcuts
  keyboard.inline_keyboard.push([
    { text: '📊 Main Briefing', callback_data: 'cmd:briefing' },
    { text: '🎭 Persona Matrix', callback_data: 'persona:status' },
  ]);

  return keyboard;
}

/**
 * Builds quick tactical action keyboard for Telegram replies
 */
function buildActionKeyboard(tacticalActions?: string[], isIncognito?: boolean): TelegramInlineKeyboardMarkup {
  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: [],
  };

  // Stealth action row if incognito is active
  if (isIncognito) {
    keyboard.inline_keyboard.push([
      { text: '🔓 Exit Incognito', callback_data: 'cmd:incognito_exit' },
      { text: '🗑️ Burn Message', callback_data: 'cmd:burn_msg' },
    ]);
  }

  // If specific tactical actions were extracted from the agent run, map them
  if (tacticalActions && tacticalActions.length > 0) {
    const actionRow = tacticalActions.slice(0, 2).map((act, idx) => ({
      text: `▶️ ${act.slice(0, 24)}`,
      callback_data: `act:${idx}:${act.slice(0, 40)}`,
    }));
    keyboard.inline_keyboard.push(actionRow);
  }

  // Tactical utility shortcut row
  keyboard.inline_keyboard.push([
    { text: isIncognito ? '🕶️ Incognito (ON)' : '🕶️ Incognito', callback_data: 'cmd:incognito_toggle' },
    { text: '🇮🇳 NSE Radar', callback_data: 'cmd:nse' },
    { text: '📊 Briefing', callback_data: 'cmd:briefing' },
    { text: '📈 Quant', callback_data: 'cmd:quant' },
  ]);

  // Fast engine switch row
  keyboard.inline_keyboard.push([
    { text: '⚡ Groq 120B', callback_data: 'cmd:groq' },
    { text: '🧠 Gemini 3.7', callback_data: 'cmd:gemini' },
    { text: '🟢 Llama 3.3', callback_data: 'cmd:nim' },
  ]);

  return keyboard;
}

/**
 * Dispatches a text or transcribed directive to the J.A.R.V.I.S. Core Engine
 */
async function processDirective(
  chatId: number | string,
  rawText: string,
  base64Image?: string,
  replyToMessageId?: number,
  isVoiceInput = false,
  explicitDelegatedAgentId?: string,
  messageThreadId?: number
) {
  const typingPulse = setInterval(() => {
    gateway.sendTypingAction(chatId, messageThreadId).catch(() => {});
  }, 4000);
  await gateway.sendTypingAction(chatId, messageThreadId);

  try {
    // 1. Retrieve Recent Universal Chat History for Cross-Device Continuity
    const rawHistory = await getUniversalChatHistory(16);
    const contextMessages = rawHistory.map((h) => ({
      id: h.id,
      role: h.role,
      content: h.content,
      image: h.image,
    }));

    // Parse model/engine command override if supplied
    let requestedModel = 'gemini-3.7-flash';
    let requestedMode: any = 'auto';
    let cleanUserText = rawText.trim();
    let delegatedAgentId = explicitDelegatedAgentId;
    let delegatedProfile: AgentProfile | undefined = delegatedAgentId
      ? getSpecializedAgentProfile(delegatedAgentId)
      : undefined;

    if (cleanUserText === '/agents' || cleanUserText === '/subagents' || cleanUserText === '/team') {
      const keyboard = buildSubagentsKeyboard();
      await gateway.sendMessage(
        chatId,
        `🤖 **J.A.R.V.I.S. & F.R.I.D.A.Y. Specialized Subagents Matrix**\n\nCurated Top 10 High-ROI Autonomous Subagent profiles. Tap an agent below to inspect active tool suites and launch dedicated operations:\n\n_Or invoke directly via:_ \`/delegate <agent-id> <directive>\`\n_Example:_ \`/delegate security-auditor Check for secret leaks & OWASP compliance\``,
        { replyToMessageId, replyMarkup: keyboard }
      );
      return;
    } else if (
      cleanUserText.startsWith('/delegate') ||
      cleanUserText.startsWith('/subagent') ||
      cleanUserText.startsWith('/agent')
    ) {
      const match = cleanUserText.match(/^\/(?:delegate|subagent|agent)(?:\s+([^\s]+))?(?:\s+(.*))?$/i);
      const agentTarget = match?.[1]?.trim();
      const taskBody = match?.[2]?.trim();

      if (!agentTarget) {
        const keyboard = buildSubagentsKeyboard();
        await gateway.sendMessage(
          chatId,
          `🤖 **J.A.R.V.I.S. Subagents Matrix**\n\nPlease select an agent or specify an ID:\n\n_Syntax:_ \`/delegate <agent-id> <directive>\``,
          { replyToMessageId, replyMarkup: keyboard }
        );
        return;
      }

      const foundProfile = getSpecializedAgentProfile(agentTarget);
      if (foundProfile) {
        delegatedAgentId = foundProfile.id;
        delegatedProfile = foundProfile;
        cleanUserText = taskBody || `Please perform your specialized domain review as ${foundProfile.role}, Sir.`;
      } else {
        await gateway.sendMessage(
          chatId,
          `Sir, I could not find a subagent matching \`${agentTarget}\`. Tap below to view available subagent profiles:`,
          { replyToMessageId, replyMarkup: buildSubagentsKeyboard() }
        );
        return;
      }
    } else if (cleanUserText.startsWith('/groq')) {
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
    } else if (cleanUserText.startsWith('/image') || cleanUserText.startsWith('/draw') || cleanUserText.startsWith('/render')) {
      const promptText = cleanUserText.replace(/^\/(image|draw|render)\s*/i, '').trim();
      if (!promptText) {
        await gateway.sendMessage(
          chatId,
          `🎨 **F.R.I.D.A.Y. Visual Frame**, Sir.\n\nPlease supply a prompt: \`/image <description>\`\n\n_Examples:_\n• \`/image futuristic cybernetic arc reactor HUD\`\n• \`/image technical blueprint of agent swarm architecture\`\n• \`/image 16:9 panoramic neon cyberpunk city\``,
          { replyToMessageId }
        );
        return;
      }
      cleanUserText = `Friday, synthesize an image using the generate_image tool with prompt: "${promptText}". Display the visual artifact for Sir.`;
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
    } else if (cleanUserText.startsWith('/persona')) {
      const personaArgs = cleanUserText.replace(/^\/persona\s*/i, '').trim();
      if (personaArgs === 'reset') {
        const config = await updatePersonaConfig(DEFAULT_PERSONA_CONFIG);
        await gateway.sendMessage(
          chatId,
          `⚡ **Persona Reset to Sovereign Defaults, Sir.**\n\n- **Tone**: \`${config.tone}\`\n- **Verbosity**: \`${config.verbosity}\`\n- **Sparring**: \`${config.sparringLevel}\`\n- **Anti-Generic Bot**: \`${config.banGenericListicles}\``,
          { replyToMessageId }
        );
        return;
      } else if (personaArgs.startsWith('tone ')) {
        const toneVal = personaArgs.replace(/^tone\s+/i, '').trim() as PersonaTone;
        const config = await updatePersonaConfig({ tone: toneVal });
        await gateway.sendMessage(
          chatId,
          `🎭 **Persona Tone Updated:** \`${config.tone}\`\nActive Sparring: \`${config.sparringLevel}\` | Verbosity: \`${config.verbosity}\``,
          { replyToMessageId }
        );
        return;
      } else if (personaArgs.startsWith('verbosity ')) {
        const verbVal = personaArgs.replace(/^verbosity\s+/i, '').trim() as VerbosityLevel;
        const config = await updatePersonaConfig({ verbosity: verbVal });
        await gateway.sendMessage(
          chatId,
          `📏 **Verbosity Updated:** \`${config.verbosity}\`\nActive Tone: \`${config.tone}\``,
          { replyToMessageId }
        );
        return;
      } else if (personaArgs.startsWith('sparring ') || personaArgs.startsWith('spar ')) {
        const sparVal = personaArgs.replace(/^spar(ring)?\s+/i, '').trim() as SparringIntensity;
        const config = await updatePersonaConfig({ sparringLevel: sparVal });
        await gateway.sendMessage(
          chatId,
          `🥊 **Sparring Level Updated:** \`${config.sparringLevel}\`\nActive Tone: \`${config.tone}\``,
          { replyToMessageId }
        );
        return;
      } else if (personaArgs === '' || personaArgs === 'status') {
        const config = await getPersonaConfig();
        const customRulesStr = config.customDirectives.length > 0
          ? `\n\n**Custom Directives:**\n${config.customDirectives.map((d, i) => `${i + 1}. _${d}_`).join('\n')}`
          : '';
        const keyboard: TelegramInlineKeyboardMarkup = {
          inline_keyboard: [
            [
              { text: '🥊 Max Sparring', callback_data: 'persona:sparring:maximum' },
              { text: '⚡ Ultra-Concise', callback_data: 'persona:verbosity:ultra-concise' },
            ],
            [
              { text: '🛡️ Staff Engineer', callback_data: 'persona:tone:staff-engineer' },
              { text: '👔 British Butler', callback_data: 'persona:tone:british-butler' },
            ],
            [
              { text: '🔄 Reset Defaults', callback_data: 'persona:reset' },
            ],
          ],
        };
        await gateway.sendMessage(
          chatId,
          `🎭 **J.A.R.V.I.S. / F.R.I.D.A.Y. Persona Matrix**\n\n- **Active Tone**: \`${config.tone}\`\n- **Verbosity**: \`${config.verbosity}\`\n- **Sparring Level**: \`${config.sparringLevel}\`\n- **Anti-Generic Bot**: \`${config.banGenericListicles ? 'ENFORCED' : 'OFF'}\`\n- **Strict Deference**: \`${config.strictDeference ? 'Sir / British' : 'Standard'}\`${customRulesStr}\n\n_Tap below or use \`/persona tone [name]\` to tune dynamically:_`,
          { replyToMessageId, replyMarkup: keyboard }
        );
        return;
      }
    } else if (cleanUserText.startsWith('/voice')) {
      const voiceArgs = cleanUserText.replace(/^\/voice\s*/i, '').trim();
      const { synthesizeMovieVoice } = await import('../lib/jarvis/tts');

      if (voiceArgs.toLowerCase().startsWith('friday')) {
        const textToSpeak = voiceArgs.replace(/^friday\s*/i, '').trim() ||
          'Boss, Mark 85 armor systems are fully armed and operational. Tactical radar scanning.';
        gateway.sendTypingAction(chatId).catch(() => {});
        const buf = await synthesizeMovieVoice(textToSpeak, 'FRIDAY');
        if (buf) {
          await gateway.sendVoice(chatId, buf, {
            replyToMessageId,
            caption: '🛡️ F.R.I.D.A.Y. (Kerry Condon — Irish AI)',
          });
        }
        return;
      } else if (voiceArgs.toLowerCase().startsWith('jarvis')) {
        const textToSpeak = voiceArgs.replace(/^jarvis\s*/i, '').trim() ||
          'Always at your service, Sir. All cloud runner systems are nominal.';
        gateway.sendTypingAction(chatId).catch(() => {});
        const buf = await synthesizeMovieVoice(textToSpeak, 'JARVIS');
        if (buf) {
          await gateway.sendVoice(chatId, buf, {
            replyToMessageId,
            caption: '⚡ J.A.R.V.I.S. (Paul Bettany — British Butler)',
          });
        }
        return;
      } else if (voiceArgs.toLowerCase().startsWith('khushi')) {
        const textToSpeak = voiceArgs.replace(/^khushi\s*/i, '').trim() ||
          'Namaste Sir, I am Khushi. I can help track your daily meals, habits, and expenses naturally.';
        gateway.sendTypingAction(chatId).catch(() => {});
        const buf = await synthesizeMovieVoice(textToSpeak, 'KHUSHI');
        if (buf) {
          await gateway.sendVoice(chatId, buf, {
            replyToMessageId,
            caption: '🌸 Khushi (Indic Conversational AI)',
          });
        }
        return;
      } else {
        const keyboard: TelegramInlineKeyboardMarkup = {
          inline_keyboard: [
            [
              { text: '🛡️ Friday (Kerry Condon - Irish)', callback_data: 'voice_demo:friday' },
              { text: '⚡ Jarvis (Paul Bettany - British)', callback_data: 'voice_demo:jarvis' },
            ],
            [
              { text: '🌸 Khushi (Indic Conversational)', callback_data: 'voice_demo:khushi' },
            ],
          ],
        };
        await gateway.sendMessage(
          chatId,
          `🎙️ **Movie-Fidelity Neural Speech Matrix (100% Free)**\n\n` +
          `Zero-cost cloud neural speech calibrated to match authentic movie personas:\n\n` +
          `• 🛡️ **F.R.I.D.A.Y.**: Kerry Condon's Irish AI cadence from Avengers & MCU.\n` +
          `• ⚡ **J.A.R.V.I.S.**: Paul Bettany's refined British baritone from Iron Man.\n` +
          `• 🌸 **Khushi**: Indic conversational voice for daily lifestyle & habits.\n\n` +
          `_Tap below to hear sample dispatches, or send any voice note on Telegram to converse hands-free!_\n` +
          `_Syntax:_ \`/voice friday [text]\` or \`/voice jarvis [text]\``,
          { replyToMessageId, replyMarkup: keyboard }
        );
        return;
      }
    } else if (
      cleanUserText === '/evolve' ||
      cleanUserText === '/upgrade' ||
      cleanUserText.toLowerCase() === 'evolve' ||
      cleanUserText.toLowerCase() === 'upgrade friday' ||
      cleanUserText.toLowerCase() === 'evolve friday' ||
      cleanUserText.toLowerCase() === 'self evolve'
    ) {
      gateway.sendTypingAction(chatId).catch(() => {});
      const { runAutonomousEvolutionCycle } = await import('../lib/jarvis/evolution-sentry');
      const res = await runAutonomousEvolutionCycle({ force: true });
      if (!res.success) {
        await gateway.sendMessage(chatId, `Sir, autonomous evolution cycle encountered an error: ${res.error}`, { replyToMessageId });
      }
      return;
    } else if (
      cleanUserText === '/monetization' ||
      cleanUserText === '/revenue' ||
      cleanUserText === '/bounties' ||
      cleanUserText === '/deals' ||
      cleanUserText.toLowerCase() === 'monetization' ||
      cleanUserText.toLowerCase() === 'bounties'
    ) {
      gateway.sendTypingAction(chatId).catch(() => {});
      const { runMonetizationScan, dispatchMonetizationReportToTelegram } = await import('../lib/jarvis/monetization_cron');
      const report = await runMonetizationScan();
      await dispatchMonetizationReportToTelegram(report);
      return;
    } else if (
      cleanUserText === '/briefing' ||
      cleanUserText === '/news' ||
      cleanUserText === '/tech' ||
      cleanUserText === '/executive' ||
      cleanUserText.toLowerCase() === 'briefing' ||
      cleanUserText.toLowerCase() === 'tech news' ||
      cleanUserText.toLowerCase() === 'morning briefing'
    ) {
      gateway.sendTypingAction(chatId).catch(() => {});
      const { runExecutiveAiTechNewsBriefing } = await import('../lib/jarvis/ai-tech-briefing');
      await runExecutiveAiTechNewsBriefing();
      return;
    } else if (
      cleanUserText === '/nse' ||
      cleanUserText === '/market' ||
      cleanUserText === '/nifty' ||
      cleanUserText.startsWith('/nse ') ||
      cleanUserText.startsWith('/stock ') ||
      cleanUserText.toLowerCase() === 'nse' ||
      cleanUserText.toLowerCase() === 'nifty' ||
      cleanUserText.toLowerCase() === 'indian market'
    ) {
      gateway.sendTypingAction(chatId).catch(() => {});
      const arg = cleanUserText.replace(/^\/(nse|market|nifty|stock)\s*/i, '').trim();

      if (arg && !['scan', 'all', 'radar'].includes(arg.toLowerCase())) {
        // Individual Stock Inspection
        const { analyzeNseStock } = await import('../lib/jarvis/nse-macro-radar');
        const analysis = await analyzeNseStock(arg);

        const changeSign = analysis.change24hPct >= 0 ? '+' : '';
        const trendIcon = analysis.trend === 'UPTREND' ? '🟢' : analysis.trend === 'DOWNTREND' ? '🔴' : '🟡';
        const setup = analysis.tacticalSetup;

        let msg = `🇮🇳 **[NSE EQUITY RADAR: ${analysis.companyName}]**\n\n` +
          `• **Symbol**: \`${analysis.symbol}\` | Sector: \`${analysis.sector}\`\n` +
          `• **Current Price**: \`₹${analysis.currentPrice.toLocaleString('en-IN')}\` (\`${changeSign}${analysis.change24hPct.toFixed(2)}%\`)\n` +
          `• **Trend**: ${trendIcon} \`${analysis.trend}\` | Macro Bias: \`${analysis.macroBias}\`\n` +
          `• **Technicals**: RSI(14)=\`${analysis.rsi14.toFixed(1)}\` | EMA20=\`₹${analysis.ema20.toFixed(1)}\` | EMA50=\`₹${analysis.ema50.toFixed(1)}\`\n\n`;

        if (setup) {
          msg += `🎯 **Tactical Setup**: *${setup.action}* (\`${setup.conviction} Conviction\`)\n` +
            `• **Entry Zone**: \`${setup.entryRange}\`\n` +
            `• **Target**: \`₹${setup.targetPrice}\` | **Stop-Loss**: \`₹${setup.stopLossPrice}\` (R:R \`1:${setup.riskRewardRatio}\`)\n` +
            `• **Horizon**: \`${setup.timeHorizon}\`\n` +
            `• **Thesis**: _${setup.thesis}_\n\n`;
        } else {
          msg += `_No high-conviction breakout or mean-reversion setup detected at this level._\n\n`;
        }

        msg += `_Execute manually on Zerodha Kite / Groww / AngelOne._`;

        const kb: TelegramInlineKeyboardMarkup = {
          inline_keyboard: [
            [
              { text: '🇮🇳 Full NSE Radar', callback_data: 'cmd:nse' },
              { text: '📈 Quant Sentry', callback_data: 'cmd:quant' },
            ],
          ],
        };

        await gateway.sendMessage(chatId, msg, { replyToMessageId, replyMarkup: kb });
        return;
      }

      // Full Market Scan
      const { scanIndianMarketCatalysts } = await import('../lib/jarvis/nse-macro-radar');
      const card = await scanIndianMarketCatalysts();

      let msg = `🇮🇳 **[F.R.I.D.A.Y. — INDIAN MARKET MACRO RADAR]**\n\n`;
      msg += `🌐 **Catalyst**: ${card.headline}\n\n`;
      msg += `🧠 **Transmission**: ${card.transmissionMechanism}\n\n`;
      msg += `📈 **Favored**: ${card.favoredSectors.join(', ')}\n`;
      msg += `📉 **Pressured**: ${card.pressuredSectors.join(', ')}\n\n`;
      msg += `📊 **Nifty 50 Outlook**: **${card.niftyOutlook.bias}**\n`;
      msg += `• Support: \`${card.niftyOutlook.supportZone}\` | Resistance: \`${card.niftyOutlook.resistanceZone}\`\n`;
      msg += `• _${card.niftyOutlook.rationale}_\n\n`;
      msg += `🎯 **TOP TACTICAL SETUPS (MANUAL EXECUTION)**:\n\n`;

      const kb: TelegramInlineKeyboardMarkup = { inline_keyboard: [] };

      for (let idx = 0; idx < card.actionablePicks.length; idx++) {
        const pick = card.actionablePicks[idx];
        const s = pick.tacticalSetup;
        if (!s) continue;
        msg += `*${idx + 1}. ${pick.companyName} (\`${pick.symbol}\`)*\n`;
        msg += `• Action: *${s.action}* | Current: *₹${pick.currentPrice}*\n`;
        msg += `• Entry Zone: \`${s.entryRange}\`\n`;
        msg += `• Target: *₹${s.targetPrice}* | Stop-Loss: \`₹${s.stopLossPrice}\` (R:R 1:${s.riskRewardRatio})\n`;
        msg += `• Horizon: _${s.timeHorizon}_ | Conviction: *${s.conviction}*\n`;
        msg += `• _${s.thesis}_\n\n`;

        kb.inline_keyboard.push([
          { text: `🔍 Inspect ${pick.symbol}`, callback_data: `nse_inspect:${pick.symbol}` },
        ]);
      }

      msg += `_Execute orders manually on Zerodha Kite / Groww / AngelOne._`;

      kb.inline_keyboard.push([
        { text: '🔄 Refresh NSE Radar', callback_data: 'cmd:nse' },
        { text: '📈 Global Quant', callback_data: 'cmd:quant' },
      ]);

      await gateway.sendMessage(chatId, msg, { replyToMessageId, replyMarkup: kb });
      return;
    } else if (cleanUserText === '/trade' || cleanUserText === '/quant' || cleanUserText.toLowerCase() === 'quant' || cleanUserText.toLowerCase() === 'portfolio') {
      const { evaluateOpenPositions, RISK_CONFIG } = await import('../lib/jarvis/quant-engine');
      const evalRes = await evaluateOpenPositions();
      const p = evalRes.portfolio;

      const pnlSign = p.unrealizedPnl >= 0 ? '+' : '';
      const realSign = p.realizedPnl >= 0 ? '+' : '';
      const statusIcon = p.isHalted ? '🔴 HALTED' : '🟢 ACTIVE SENTRY';

      let positionsStr = '_No open positions currently._';
      if (p.openPositions.length > 0) {
        positionsStr = p.openPositions
          .map((pos) => {
            const dirIcon = pos.direction === 'LONG' ? '🟢' : '🔴';
            const posSign = pos.unrealizedPnl >= 0 ? '+' : '';
            return `• ${dirIcon} **${pos.symbol}** (${pos.direction}) — Size: \`${pos.quantity}\`\n  Entry: \`$${pos.entryPrice}\` | Current: \`$${pos.currentPrice}\`\n  PnL: \`${posSign}$${pos.unrealizedPnl} (${posSign}${pos.unrealizedPnlPct}%)\`\n  SL: \`$${pos.stopLoss}\` | TP: \`$${pos.takeProfit}\``;
          })
          .join('\n\n');
      }

      const keyboard: TelegramInlineKeyboardMarkup = {
        inline_keyboard: [
          [
            { text: '⚡ Run Alpha Scan', callback_data: 'cmd:quant_scan' },
            p.isHalted
              ? { text: '🟢 Resume Sentry', callback_data: 'cmd:quant_resume' }
              : { text: '🛑 Circuit Breaker Halt', callback_data: 'cmd:quant_halt' },
          ],
          [
            { text: '📊 Full Briefing', callback_data: 'cmd:briefing' },
            { text: '🔄 Refresh Portfolio', callback_data: 'cmd:quant' },
          ],
        ],
      };

      const msg = `📈 **J.A.R.V.I.S. Sovereign Quant Engine (Stage 5)**\n\n` +
        `• **Total Equity**: \`$${p.totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}\` USD\n` +
        `• **Cash Available**: \`$${p.cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}\` USD\n` +
        `• **Unrealized PnL**: \`${pnlSign}$${p.unrealizedPnl}\`\n` +
        `• **Realized PnL**: \`${realSign}$${p.realizedPnl}\` (${p.winCount}W / ${p.lossCount}L — Win Rate: \`${(p.winRate * 100).toFixed(1)}%\`)\n` +
        `• **Daily Drawdown**: \`${p.dailyDrawdownPct}%\` (Peak: \`$${p.dailyPeakEquity.toFixed(2)}\`)\n` +
        `• **Risk Sentry**: \`Max 0.75% Risk ($${(p.totalEquity * RISK_CONFIG.MAX_RISK_PER_TRADE_PCT).toFixed(0)}) / 5% Alloc ($${(p.totalEquity * RISK_CONFIG.MAX_ALLOCATION_PER_ASSET_PCT).toFixed(0)})\`\n` +
        `• **Engine State**: \`${statusIcon}\`${p.isHalted ? `\n_Reason: ${p.haltReason}_` : ''}\n\n` +
        `**Open Positions (${p.openPositions.length}/${RISK_CONFIG.MAX_CONCURRENT_POSITIONS}):**\n${positionsStr}`;

      await gateway.sendMessage(chatId, msg, { replyToMessageId, replyMarkup: keyboard });
      return;
    } else if (cleanUserText === '/scan' || cleanUserText.toLowerCase() === 'quant scan' || cleanUserText.toLowerCase() === 'scan market') {
      const { generateAlphaSignalsForUniverse } = await import('../lib/jarvis/quant-engine');
      gateway.sendTypingAction(chatId).catch(() => {});
      const signals = await generateAlphaSignalsForUniverse();

      if (signals.length === 0) {
        const keyboard: TelegramInlineKeyboardMarkup = {
          inline_keyboard: [
            [
              { text: '📈 Portfolio Status', callback_data: 'cmd:quant' },
              { text: '🔄 Re-scan', callback_data: 'cmd:quant_scan' },
            ],
          ],
        };
        await gateway.sendMessage(
          chatId,
          `📡 **Alpha Radar Sweep Complete**\n\nAll monitored assets (BTC, ETH, SOL, NVDA, AAPL, MSFT, SPY, QQQ) are currently oscillating within normal statistical bounds. No anomaly met the strict threshold (Z-Score > 2.0 or Volatility Squeeze) at this millisecond, Sir. Zero-ruin discipline maintained.`,
          { replyToMessageId, replyMarkup: keyboard }
        );
        return;
      }

      const keyboard: TelegramInlineKeyboardMarkup = { inline_keyboard: [] };
      let signalsStr = '';

      for (const sig of signals) {
        const dirIcon = sig.direction === 'LONG' ? '🟢 LONG' : '🔴 SHORT';
        signalsStr += `**${sig.symbol}** ➔ ${dirIcon} (\`${(sig.confidence * 100).toFixed(0)}% Confidence\`)\n` +
          `• Strategy: \`${sig.strategy}\`\n` +
          `• Entry: \`$${sig.entryPrice}\` | SL: \`$${sig.stopLoss}\` | TP: \`$${sig.takeProfit}\` (R:R \`${sig.riskRewardRatio}:1\`)\n` +
          `• Math: RSI=\`${sig.metrics.rsi14}\`, Z-Score=\`${sig.metrics.zScore}\`, Bandwidth=\`${sig.metrics.bollingerBandwidth}\`\n` +
          `• Thesis: _${sig.reasoning}_\n\n`;

        keyboard.inline_keyboard.push([
          {
            text: `⚡ Paper ${sig.direction} ${sig.symbol}`,
            callback_data: `trade_order:${sig.symbol}:${sig.direction}:${sig.strategy}`,
          },
        ]);
      }

      keyboard.inline_keyboard.push([
        { text: '📈 View Portfolio', callback_data: 'cmd:quant' },
        { text: '🔄 Re-scan', callback_data: 'cmd:quant_scan' },
      ]);

      await gateway.sendMessage(
        chatId,
        `🎯 **Alpha Signals Detected (${signals.length} Opportunities)**\n\n${signalsStr}_Tap below to execute a paper order under Zero-Ruin Risk Guardian rules:_`,
        { replyToMessageId, replyMarkup: keyboard }
      );
      return;
    } else if (cleanUserText === '/halt') {
      const { toggleEmergencyHalt } = await import('../lib/jarvis/quant-engine');
      const p = await toggleEmergencyHalt(true, 'Emergency /halt commanded by Sir via Telegram');
      await gateway.sendMessage(
        chatId,
        `🛑 **EMERGENCY CIRCUIT BREAKER ENGAGED, Sir.**\n\nAll automated trading has been halted immediately. Active positions are locked under sentry mode. No new capital will be committed until you issue \`/resume\`.\n\n- Current Equity: \`$${p.totalEquity.toFixed(2)}\`\n- Open Positions: \`${p.openPositions.length}\``,
        { replyToMessageId }
      );
      return;
    } else if (cleanUserText === '/resume') {
      const { toggleEmergencyHalt } = await import('../lib/jarvis/quant-engine');
      const p = await toggleEmergencyHalt(false);
      await gateway.sendMessage(
        chatId,
        `🟢 **Trading Sentry Resumed, Sir.**\n\nCircuit breaker disengaged. Automated quant scanning and risk evaluation are nominal.\n\n- Current Equity: \`$${p.totalEquity.toFixed(2)}\``,
        { replyToMessageId }
      );
      return;
    } else if (
      cleanUserText === '/snap' ||
      cleanUserText === '/screenshot' ||
      cleanUserText.toLowerCase() === 'snap screen' ||
      cleanUserText.toLowerCase() === 'take screenshot'
    ) {
      gateway.sendTypingAction(chatId).catch(() => {});
      const { listRegisteredSatellites, dispatchSatelliteCommand } = await import('../lib/jarvis/satellite');
      const satellites = await listRegisteredSatellites();
      const online = satellites.find((s) => s.status === 'ONLINE' && s.capabilities.includes('screenshot'));
      if (!online) {
        await gateway.sendMessage(
          chatId,
          `⚠️ **No online satellite with screenshot capability found.**\n\nEnsure your laptop node is running (\`scripts/start-symbiote.bat\`).`,
          { replyToMessageId }
        );
        return;
      }

      await gateway.sendMessage(chatId, `📸 Capturing live screen from \`${online.name}\`...`, { replyToMessageId });
      const res = await dispatchSatelliteCommand(online.id, 'ACTION', { action: 'SCREENSHOT', params: {} }, 25000, 'Sir/Telegram');
      if (res.success && res.output.startsWith('data:image/')) {
        const base64Data = res.output.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        await gateway.sendPhoto(chatId, buffer, {
          caption: `📸 **Workstation Visual Uplink**\n\n• Device: \`${online.name}\` (\`${online.id}\`)\n• Latency: \`${res.durationMs}ms\``,
          replyToMessageId,
        });
      } else {
        await gateway.sendMessage(chatId, `⚠️ **Snapshot Failed**: ${res.error || res.output}`, { replyToMessageId });
      }
      return;
    } else if (cleanUserText.startsWith('/speak ') || cleanUserText.startsWith('/say ')) {
      const textToSpeak = cleanUserText.replace(/^\/(?:speak|say)\s+/i, '').trim();
      const { listRegisteredSatellites, dispatchSatelliteCommand } = await import('../lib/jarvis/satellite');
      const satellites = await listRegisteredSatellites();
      const online = satellites.find((s) => s.status === 'ONLINE' && s.capabilities.includes('speak'));
      if (!online) {
        await gateway.sendMessage(
          chatId,
          `⚠️ **No online satellite with speaker capability found.**`,
          { replyToMessageId }
        );
        return;
      }

      const res = await dispatchSatelliteCommand(online.id, 'ACTION', { action: 'SPEAK', params: { text: textToSpeak } }, 15000, 'Sir/Telegram');
      if (res.success) {
        await gateway.sendMessage(chatId, `🔊 **Spoken aloud on \`${online.name}\`:**\n\n"${textToSpeak}"`, { replyToMessageId });
      } else {
        await gateway.sendMessage(chatId, `⚠️ **Speech Failed**: ${res.error}`, { replyToMessageId });
      }
      return;
    } else if (
      cleanUserText === '/satellites' ||
      cleanUserText === '/devices' ||
      cleanUserText === '/mesh' ||
      cleanUserText.toLowerCase() === 'satellites' ||
      cleanUserText.toLowerCase() === 'devices' ||
      cleanUserText.toLowerCase() === 'satellite mesh' ||
      cleanUserText.startsWith('/satellite ') ||
      cleanUserText.startsWith('/sat ')
    ) {
      gateway.sendTypingAction(chatId).catch(() => {});
      const { listRegisteredSatellites, dispatchSatelliteCommand } = await import('../lib/jarvis/satellite');

      // Direct device execution: /satellite <deviceId> <command>
      const directMatch = cleanUserText.match(/^\/(?:satellite|sat)\s+([^\s]+)\s+(.*)$/i);
      if (directMatch) {
        const targetId = directMatch[1].trim();
        const cmdToRun = directMatch[2].trim();

        const execRes = await dispatchSatelliteCommand(targetId, 'SHELL', { command: cmdToRun }, 25000, 'Sir/Telegram');
        if (!execRes.success) {
          await gateway.sendMessage(
            chatId,
            `⚠️ **Satellite Execution Failed / Timed Out**\n\n• **Target**: \`${targetId}\`\n• **Error**: _${execRes.error || 'Unknown error'}_\n• **Duration**: \`${execRes.durationMs}ms\``,
            { replyToMessageId }
          );
          return;
        }

        await gateway.sendMessage(
          chatId,
          `✅ **Satellite Directive Executed**\n\n• **Target**: \`${targetId}\`\n• **Exit Code**: \`${execRes.exitCode}\` (Duration: \`${execRes.durationMs}ms\`)\n\n\`\`\`\n${execRes.output || '(No stdout)'}\n\`\`\``,
          { replyToMessageId, parseMode: 'Markdown' }
        );
        return;
      }

      // Device list display
      const satellites = await listRegisteredSatellites();
      if (satellites.length === 0) {
        const kb: TelegramInlineKeyboardMarkup = {
          inline_keyboard: [
            [
              { text: '🔄 Refresh Mesh', callback_data: 'cmd:satellites' },
            ],
          ],
        };
        await gateway.sendMessage(
          chatId,
          `🛰️ **J.A.R.V.I.S. & F.R.I.D.A.Y. Sovereign Satellite Mesh**\n\n` +
          `No active satellite devices paired. Zero cloning or git pulling required!\n\n` +
          `**Connect any Mac, Linux, or PC in 1 line:**\n` +
          `\`curl -fsSL https://jarvis-iota-beige.vercel.app/satellite | bash\`\n\n` +
          `_Runs a self-updating 15KB background node that hot-reloads automatically whenever Friday evolves. Once connected, Friday gains live actuators to control hardware, run local terminal commands, launch apps, and trigger desktop notifications._`,
          { replyToMessageId, replyMarkup: kb }
        );
        return;
      }

      const kb: TelegramInlineKeyboardMarkup = { inline_keyboard: [] };
      let msg = `🛰️ **Sovereign Satellite Mesh (${satellites.length} Registered Devices)**\n\n`;

      for (const dev of satellites) {
        const statusIcon = dev.status === 'ONLINE' ? '🟢 ONLINE' : '🔴 OFFLINE';
        const battStr = dev.telemetry?.batteryPercent !== undefined ? ` | Battery: \`${dev.telemetry.batteryPercent}%\`` : '';
        const memStr = dev.telemetry?.freeMemMb !== undefined ? ` | Free RAM: \`${dev.telemetry.freeMemMb}MB\`` : '';

        msg += `**${dev.name}** (\`${dev.id}\`)\n` +
          `• Status: ${statusIcon}${battStr}\n` +
          `• Host: \`${dev.hostname}\` (${dev.platform}-${dev.arch})${memStr}\n` +
          `• Capabilities: _${dev.capabilities.join(', ')}_\n` +
          `• Last Seen: _${new Date(dev.lastSeen).toLocaleTimeString('en-GB')}_\n\n`;

        if (dev.status === 'ONLINE') {
          kb.inline_keyboard.push([
            { text: `⚡ Ping`, callback_data: `sat_ping:${dev.id}` },
            { text: `🔔 Alert`, callback_data: `sat_notify:${dev.id}` },
          ]);
          kb.inline_keyboard.push([
            { text: `📸 Snap Screen`, callback_data: `sat_snap:${dev.id}` },
            { text: `🔊 Speak Voice`, callback_data: `sat_speak:${dev.id}` },
          ]);
        }
      }

      kb.inline_keyboard.push([
        { text: '🔄 Refresh Satellites', callback_data: 'cmd:satellites' },
      ]);

      msg += `_Execute remotely via:_ \`/satellite <deviceId> <command>\``;
      await gateway.sendMessage(chatId, msg, { replyToMessageId, replyMarkup: kb });
      return;
    } else if (
      cleanUserText === '/call' ||
      cleanUserText === '/live' ||
      cleanUserText === '/voice' ||
      cleanUserText.toLowerCase() === 'call' ||
      cleanUserText.toLowerCase() === 'call friday' ||
      cleanUserText.toLowerCase() === 'call jarvis' ||
      cleanUserText.toLowerCase() === 'voice uplink' ||
      cleanUserText.toLowerCase() === 'live uplink'
    ) {
      const liveUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jarvis-iota-beige.vercel.app/live';
      const webAppUrl = liveUrl.endsWith('/live') ? liveUrl : `${liveUrl}/live`;
      const keyboard: TelegramInlineKeyboardMarkup = {
        inline_keyboard: [
          [
            {
              text: '📞 Launch Full-Duplex Voice Sheet',
              web_app: { url: webAppUrl },
            },
          ],
          [
            {
              text: '🌐 Open in Safari / Chrome',
              url: webAppUrl,
            },
          ],
        ],
      };
      // Bind native Telegram menu button for 1-tap quick access
      gateway.setChatMenuButton(chatId, webAppUrl, '📞 Call Friday').catch(() => {});

      await gateway.sendMessage(
        chatId,
        `📞 **F.R.I.D.A.Y. & J.A.R.V.I.S. Full-Duplex Voice Uplink Ready**\n\n- **Sub-300ms Reflex**: Groq US LPU and Gemini Multimodal Live.\n- **Continuous Hands-Free**: Zero button holding required.\n- **Instant Barge-In**: Speak naturally to interrupt at any millisecond.\n- **AirPods Optimized**: Full background audio stream.\n\n_Tap below to launch the voice sheet directly inside Telegram, Sir:_`,
        { replyToMessageId, replyMarkup: keyboard }
      );
      return;
    } else if (
      cleanUserText === '/bus' ||
      cleanUserText === '/telemetry' ||
      cleanUserText === '/state' ||
      cleanUserText === '/events' ||
      cleanUserText.toLowerCase() === 'state bus' ||
      cleanUserText.toLowerCase() === 'telemetry'
    ) {
      const { getRecentStateEvents } = await import('../lib/jarvis/state-bus');
      const recent = await getRecentStateEvents(8);

      let msg = `⚡ **DUAL-CITIZEN STATE BUS — REAL-TIME RADAR**\n\n`;
      if (recent.length === 0) {
        msg += `_Zero recent micro-events recorded on the bus stream. System is resting in idle synchronization._\n\n`;
      } else {
        msg += `_Streaming ${recent.length} recent system and agent micro-events:_\n\n`;
        for (const ev of recent) {
          const icon =
            ev.source === 'friday'
              ? '🛡️ FRIDAY'
              : ev.source === 'jarvis'
              ? '⚡ JARVIS'
              : ev.source === 'sentinel'
              ? '🛰️ SENTINEL'
              : '🌐 USER';
          const time = new Date(ev.timestamp).toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          });
          msg += `**[${time} IST] ${icon}**\n` +
                 `• **${ev.title}**\n`;
          if (ev.detail) {
            msg += `  _${ev.detail.length > 90 ? ev.detail.slice(0, 90) + '…' : ev.detail}_\n`;
          }
          msg += `\n`;
        }
      }

      msg += `_Master HUD:_ [Live PWA Dashboard](https://jarvis-iota-beige.vercel.app)`;

      const keyboard: TelegramInlineKeyboardMarkup = {
        inline_keyboard: [
          [
            { text: '🔄 Refresh State Bus', callback_data: 'cmd:state_bus' },
            { text: '🌐 Open Web HUD', url: 'https://jarvis-iota-beige.vercel.app' },
          ],
        ],
      };

      await gateway.sendMessage(chatId, msg, { replyToMessageId, replyMarkup: keyboard });
      return;
    } else if (
      cleanUserText === '/incognito' ||
      cleanUserText === '/stealth' ||
      cleanUserText === '/ghost' ||
      cleanUserText === '/private' ||
      cleanUserText.toLowerCase() === 'incognito' ||
      cleanUserText.toLowerCase() === 'stealth mode' ||
      cleanUserText.toLowerCase() === 'incognito mode'
    ) {
      const active = await isIncognitoActive(chatId);
      const newActive = !active;
      await setIncognitoActive(chatId, newActive);

      if (newActive) {
        const kb: TelegramInlineKeyboardMarkup = {
          inline_keyboard: [
            [
              { text: '🔓 Exit Incognito Mode', callback_data: 'cmd:incognito_exit' },
            ],
          ],
        };
        await gateway.sendMessage(
          chatId,
          `🕶️ **Incognito Stealth Mode Activated**\n\n• **Zero History**: Inbound and outbound messages are NOT saved to Redis or disk.\n• **Zero Memory**: Epistemic Sieve & Supermemory learning completely paused.\n• **Zero Telemetry Leaks**: Prompts and thoughts remain ephemeral.\n• **Full Model Power**: All reasoning and tool capabilities remain available.\n\n_Send directives normally. Send \`/incognito\` again or tap below to return to persistent mode._`,
          { replyToMessageId, replyMarkup: kb }
        );
      } else {
        await gateway.sendMessage(
          chatId,
          `🔓 **Incognito Mode Deactivated**\n\nStandard memory assimilation, continuous learning, and universal history logging are now active. All systems green.`,
          { replyToMessageId }
        );
      }
      return;
    }

    if (!cleanUserText && rawText) {
      cleanUserText = rawText;
    }

    // Check Single-Shot Incognito Prefix (/i <directive>, /incognito <directive>, incognito: <directive>)
    const isSingleShotIncognito =
      cleanUserText.startsWith('/i ') ||
      cleanUserText.startsWith('/incognito ') ||
      /^incognito:\s*/i.test(cleanUserText) ||
      /^\[incognito\]\s*/i.test(cleanUserText);

    if (isSingleShotIncognito) {
      cleanUserText = cleanUserText
        .replace(/^\/i\s+/, '')
        .replace(/^\/incognito\s+/, '')
        .replace(/^incognito:\s*/i, '')
        .replace(/^\[incognito\]\s*/i, '')
        .trim();
    }

    const isIncognito = isSingleShotIncognito || (await isIncognitoActive(chatId));

    // Append Current Message
    const userMsgRecord: ChatMessageRecord = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: isVoiceInput ? `🎙️ [Voice]: "${cleanUserText}"` : cleanUserText,
      image: base64Image,
      timestamp: new Date().toISOString(),
      source: 'jarvis',
      channel: 'telegram',
    };
    contextMessages.push({
      id: userMsgRecord.id,
      role: userMsgRecord.role,
      content: userMsgRecord.content,
      image: base64Image,
    });

    // 2. Invoke J.A.R.V.I.S. / F.R.I.D.A.Y. Agent
    const isFridayDirective = /friday/i.test(cleanUserText);
    const result = await runJarvisAgent(contextMessages, {
      model: requestedModel,
      orchestrationMode: requestedMode,
      specializedAgentId: delegatedAgentId,
      persona: isFridayDirective ? 'FRIDAY' : undefined,
      incognito: isIncognito,
      onProgress: async (stepText: string) => {
        gateway.sendTypingAction(chatId).catch(() => {});
        console.log(`[Telegram Worker] ${stepText}`);
      },
    });

    // 3. Save Both Records to Universal Storage (Bypassed if Incognito)
    const assistantMsgRecord: ChatMessageRecord = {
      id: `msg-${Date.now()}-a`,
      role: 'assistant',
      content: result.reply,
      vocalSummary: result.vocalSummary,
      tacticalActions: result.tacticalActions,
      toolCalls: result.toolCallsExecuted,
      internalThoughts: result.internalThoughts,
      telemetry: {
        ...result.telemetry,
        incognito: isIncognito,
      },
      timestamp: new Date().toISOString(),
      source: 'jarvis',
      channel: 'telegram',
    };

    if (!isIncognito) {
      await appendUniversalChatMessages([
        { ...userMsgRecord, source: 'jarvis', channel: 'telegram' },
        { ...assistantMsgRecord, source: 'jarvis', channel: 'telegram' },
      ]);
    } else {
      console.log(`[Telegram Worker] 🕶️ Incognito Mode: Bypassed universal chat history storage for Chat ${chatId}.`);
    }

    // 4. Format Output for Telegram (Automatic Persona Assignment Header)
    let responseText = '';

    if (isIncognito) {
      responseText += `🕶️ *[INCOGNITO MODE // ZERO FOOTPRINT]*\n\n`;
    }

    if (isVoiceInput) {
      responseText += `🎙️ *[Transcribed]*: _"${cleanUserText}"_\n\n`;
    }

    const isFriday = result.telemetry?.persona === 'FRIDAY';
    const personaHeader = isFriday ? '🛡️ **F.R.I.D.A.Y.**' : '⚡ **J.A.R.V.I.S.**';

    if (delegatedProfile) {
      responseText += `${personaHeader} ➔ *[Specialist: ${delegatedProfile.name}]*\n\n`;
    } else {
      responseText += `${personaHeader}\n\n`;
    }

    responseText += result.reply;

    // Append sleek Tool Execution Indicator if tools were executed
    if (result.toolCallsExecuted && result.toolCallsExecuted.length > 0) {
      const uniqueTools = Array.from(new Set(result.toolCallsExecuted.map((tc) => tc.name)));
      responseText += `\n\n⚙️ _Executed: ${uniqueTools.map((t) => `\`${t}\``).join(', ')}_`;
    }

    // Append Telemetry Badge (F.R.I.D.A.Y. vs J.A.R.V.I.S.)
    if (result.telemetry) {
      const engineName = result.telemetry.engineUsed || 'Vertex AI Gemini 3.8';
      const isFriday = result.telemetry.persona === 'FRIDAY';
      const badgePrefix = isFriday ? '🛡️ `[F.R.I.D.A.Y. APEX]' : '⚡ `[J.A.R.V.I.S. TACTICAL]';
      responseText += `\n\n${badgePrefix} ${engineName} // ${result.telemetry.latencyMs}ms\``;
    }

    const actionMarkup = buildActionKeyboard(result.tacticalActions, isIncognito);

    await gateway.sendMessage(chatId, responseText, {
      parseMode: 'Markdown',
      replyToMessageId,
      replyMarkup: actionMarkup,
      messageThreadId,
    });

    // 4B. Dispatch Native Photo Asset if Image Synthesis was executed
    try {
      const imgToolCalls = (result.toolCallsExecuted || []).filter(
        (tc) => tc.name === 'generate_image' && tc.result && tc.result.success !== false
      );

      for (const call of imgToolCalls) {
        const payload = call.result?.result || call.result;
        let photoBuffer: Buffer | null = null;
        if (payload?.filePath && fs.existsSync(payload.filePath)) {
          photoBuffer = fs.readFileSync(payload.filePath);
        } else if (payload?.base64Data) {
          const raw = payload.base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
          photoBuffer = Buffer.from(raw, 'base64');
        }

        if (photoBuffer && photoBuffer.length > 0) {
          const caption = `🛡️ **F.R.I.D.A.Y. Visual Frame**\n_${payload.prompt || 'Synthesized Asset'}_\n\n\`${payload.engineUsed || 'Cloud Diffusion'} // ${payload.aspectRatio || '1:1'}\``;
          await gateway.sendPhoto(chatId, photoBuffer, {
            caption,
            replyToMessageId,
            messageThreadId,
          });
        }
      }

      // Also detect if markdown image link in result.reply was written to /generated-images/
      if (imgToolCalls.length === 0 && result.reply.includes('/generated-images/')) {
        const match = result.reply.match(/!\[([^\]]*)\]\((\/generated-images\/[^)]+)\)/);
        if (match) {
          const [, alt, relUrl] = match;
          const fullPath = path.join(process.cwd(), 'public', relUrl.replace(/^\//, ''));
          if (fs.existsSync(fullPath)) {
            const buf = fs.readFileSync(fullPath);
            await gateway.sendPhoto(chatId, buf, {
              caption: `🛡️ **F.R.I.D.A.Y. Visual Frame**\n_${alt || 'Synthesized Asset'}_`,
              replyToMessageId,
              messageThreadId,
            });
          }
        }
      }
    } catch (photoErr: any) {
      console.warn('[Telegram Worker] Photo dispatch warning:', photoErr?.message);
    }

    // 5. Send Movie-Fidelity Neural Voice Note if triggered via Voice Input or explicit request
    const wantsVoiceResponse =
      isVoiceInput ||
      /\b(voice note|send audio|speak to me|say it in voice|read it aloud)\b/i.test(cleanUserText);

    if (wantsVoiceResponse) {
      try {
        const { synthesizeMovieVoice } = await import('../lib/jarvis/tts');
        const vocalContent = result.vocalSummary || result.reply.slice(0, 400);
        const voicePersona = result.telemetry?.persona === 'FRIDAY' ? 'FRIDAY' : 'JARVIS';
        const modulation = result.emotionSubtext?.voiceModulation;
        const voiceBuffer = await synthesizeMovieVoice(vocalContent, voicePersona, modulation);
        if (voiceBuffer) {
          const personaLabel = voicePersona === 'FRIDAY' ? '🛡️ F.R.I.D.A.Y.' : '⚡ J.A.R.V.I.S.';
          await gateway.sendVoice(chatId, voiceBuffer, {
            replyToMessageId,
            caption: `${personaLabel} Vocal Dispatch`,
            messageThreadId,
          });
        }
      } catch (voiceErr: any) {
        console.warn('[Telegram Gateway] Voice synthesis error:', voiceErr?.message);
      }
    }
  } catch (err: any) {
    console.error('[Telegram Gateway] Processing error:', err);
    await gateway.sendMessage(
      chatId,
      `Sir, a temporary cognitive latency occurred while processing your directive: ${err.message}. State and safeguards remain nominal.`,
      { replyToMessageId, messageThreadId }
    );
  } finally {
    clearInterval(typingPulse);
  }
}

/**
 * Master Incoming Message Router
 */
async function handleIncomingMessage(update: TelegramUpdate) {
  // -------------------------------------------------------------
  // 1. INLINE CALLBACK QUERY HANDLER (Button clicks)
  // -------------------------------------------------------------
  if (update.callback_query) {
    const cq = update.callback_query;
    const senderId = cq.from.id;
    const chatId = cq.message?.chat.id;

    if (!senderId || String(senderId) !== String(ALLOWED_USER_ID) || !chatId) {
      console.warn(`[GUARDIAN SENTRY] Discarded unauthorized callback query from: ${senderId}`);
      return;
    }

    await gateway.answerCallbackQuery(cq.id, '⚡ J.A.R.V.I.S. Executing...');
    console.log(`[Telegram Gateway] 🔘 Button Callback from Sir: "${cq.data}"`);

    let directiveText = '';
    if (cq.data.startsWith('guardian_approve:')) {
      const actionId = cq.data.replace(/^guardian_approve:/, '');
      const { executeGuardianApprovedAction } = await import('../lib/jarvis/security/guardian-barrier');
      const res = await executeGuardianApprovedAction(actionId);
      const icon = res.success ? '✅' : '⚠️';
      if (cq.message?.message_id) {
        await gateway.editMessageText(
          chatId,
          cq.message.message_id,
          `${icon} **[GUARDIAN ACTION EXECUTED BY SIR]**\n\n\`\`\`\n${res.output.slice(0, 1500)}\n\`\`\`\n_Actuated with Sovereign Clearance at ${new Date().toLocaleTimeString('en-GB')}_`
        );
      }
      return;
    } else if (cq.data.startsWith('guardian_abort:')) {
      const actionId = cq.data.replace(/^guardian_abort:/, '');
      const { abortGuardianAction } = await import('../lib/jarvis/security/guardian-barrier');
      await abortGuardianAction(actionId);
      if (cq.message?.message_id) {
        await gateway.editMessageText(
          chatId,
          cq.message.message_id,
          `❌ **[GUARDIAN ACTION ABORTED BY SIR]**\n\n_Directive was safely revoked. System remains protected._`
        );
      }
      return;
    } else if (cq.data === 'cmd:incognito_exit') {
      await setIncognitoActive(chatId, false);
      await gateway.sendMessage(
        chatId,
        `🔓 **Incognito Mode Deactivated**\n\nStandard shared history logging and continuous memory learning are now restored.`,
        { replyToMessageId: cq.message?.message_id }
      );
      return;
    } else if (cq.data === 'cmd:incognito_toggle') {
      const active = await isIncognitoActive(chatId);
      const newActive = !active;
      await setIncognitoActive(chatId, newActive);
      const statusText = newActive
        ? `🕶️ **Incognito Stealth Mode Activated**\n\n• Zero history saved to database\n• Zero memories assimilated\n• Ephemeral execution only.\n\n_Send /incognito again or use the buttons to exit._`
        : `🔓 **Incognito Mode Deactivated**\n\nStandard logging and learning restored.`;
      await gateway.sendMessage(chatId, statusText, { replyToMessageId: cq.message?.message_id });
      return;
    } else if (cq.data === 'cmd:burn_msg') {
      if (cq.message?.message_id) {
        await gateway.deleteMessage(chatId, cq.message.message_id);
      }
      return;
    } else if (cq.data === 'cmd:evolve') {
      await processDirective(chatId, '/evolve', undefined, cq.message?.message_id);
      return;
    } else if (cq.data === 'cmd:nse' || cq.data === 'cmd:nse_scan') {
      await processDirective(chatId, '/nse', undefined, cq.message?.message_id);
      return;
    } else if (cq.data.startsWith('nse_inspect:')) {
      const sym = cq.data.replace(/^nse_inspect:/, '');
      await processDirective(chatId, `/nse ${sym}`, undefined, cq.message?.message_id);
      return;
    } else if (cq.data === 'cmd:quant') {
      await processDirective(chatId, '/quant', undefined, cq.message?.message_id);
      return;
    } else if (cq.data === 'cmd:quant_scan') {
      await processDirective(chatId, '/scan', undefined, cq.message?.message_id);
      return;
    } else if (cq.data === 'cmd:quant_halt') {
      await processDirective(chatId, '/halt', undefined, cq.message?.message_id);
      return;
    } else if (cq.data === 'cmd:quant_resume') {
      await processDirective(chatId, '/resume', undefined, cq.message?.message_id);
      return;
    } else if (cq.data === 'cmd:satellites') {
      await processDirective(chatId, '/satellites', undefined, cq.message?.message_id);
      return;
    } else if (cq.data === 'cmd:state_bus') {
      await processDirective(chatId, '/bus', undefined, cq.message?.message_id);
      return;
    } else if (cq.data.startsWith('sat_ping:')) {
      const targetId = cq.data.replace(/^sat_ping:/, '');
      const { dispatchSatelliteCommand } = await import('../lib/jarvis/satellite');
      const res = await dispatchSatelliteCommand(targetId, 'SHELL', { command: 'echo "Ping latency test from Telegram: $(date)"' }, 15000);
      if (res.success) {
        await gateway.sendMessage(chatId, `📶 **Satellite Ping Return (${targetId})**:\n\`\`\`\n${res.output}\n\`\`\`\n_Round-trip: ${res.durationMs}ms_`, { replyToMessageId: cq.message?.message_id });
      } else {
        await gateway.sendMessage(chatId, `⚠️ **Satellite Ping Failed (${targetId})**: ${res.error}`, { replyToMessageId: cq.message?.message_id });
      }
      return;
    } else if (cq.data.startsWith('sat_notify:')) {
      const targetId = cq.data.replace(/^sat_notify:/, '');
      const { dispatchSatelliteCommand } = await import('../lib/jarvis/satellite');
      const res = await dispatchSatelliteCommand(targetId, 'ACTION', { action: 'NOTIFY', params: { title: 'J.A.R.V.I.S. Command', message: 'Sir dispatched a remote alert from Telegram.' } }, 15000);
      if (res.success) {
        await gateway.sendMessage(chatId, `🔔 **Desktop Alert Triggered on ${targetId}**\n\n_${res.output}_`, { replyToMessageId: cq.message?.message_id });
      } else {
        await gateway.sendMessage(chatId, `⚠️ **Failed to trigger alert on ${targetId}**: ${res.error}`, { replyToMessageId: cq.message?.message_id });
      }
      return;
    } else if (cq.data.startsWith('sat_snap:')) {
      const targetId = cq.data.replace(/^sat_snap:/, '');
      const { dispatchSatelliteCommand } = await import('../lib/jarvis/satellite');
      await gateway.sendMessage(chatId, `📸 Capturing screen from \`${targetId}\`...`, { replyToMessageId: cq.message?.message_id });
      const res = await dispatchSatelliteCommand(targetId, 'ACTION', { action: 'SCREENSHOT', params: {} }, 25000, 'Sir/Telegram');
      if (res.success && res.output.startsWith('data:image/')) {
        const base64Data = res.output.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        await gateway.sendPhoto(chatId, buffer, {
          caption: `📸 **Workstation Visual Uplink**\n\n• Target: \`${targetId}\`\n• Captured: \`${new Date().toLocaleTimeString('en-GB')}\`\n• Latency: \`${res.durationMs}ms\``,
          replyToMessageId: cq.message?.message_id,
        });
      } else {
        await gateway.sendMessage(chatId, `⚠️ **Snapshot Failed (${targetId})**: ${res.error || res.output}`, { replyToMessageId: cq.message?.message_id });
      }
      return;
    } else if (cq.data.startsWith('sat_speak:')) {
      const targetId = cq.data.replace(/^sat_speak:/, '');
      const { dispatchSatelliteCommand } = await import('../lib/jarvis/satellite');
      const res = await dispatchSatelliteCommand(targetId, 'ACTION', { action: 'SPEAK', params: { text: 'All systems nominal, Sir. Friday is online and operational.' } }, 15000, 'Sir/Telegram');
      if (res.success) {
        await gateway.sendMessage(chatId, `🔊 **Spoke on \`${targetId}\` speakers!**\n\n_${res.output}_`, { replyToMessageId: cq.message?.message_id });
      } else {
        await gateway.sendMessage(chatId, `⚠️ **Failed to speak on ${targetId}**: ${res.error}`, { replyToMessageId: cq.message?.message_id });
      }
      return;
    } else if (cq.data.startsWith('trade_order:')) {
      const [, sym, dir, strat] = cq.data.split(':');
      const { executePaperOrder } = await import('../lib/jarvis/quant-engine');
      const orderRes = await executePaperOrder({
        symbol: sym,
        direction: dir as any,
        strategy: strat as any,
      });

      if (!orderRes.success) {
        await gateway.sendMessage(
          chatId,
          `⚠️ **Order Execution Blocked by Risk Guardian**\n\nAsset: \`${sym}\` (${dir})\nReason: _${orderRes.error}_`,
          { replyToMessageId: cq.message?.message_id }
        );
        return;
      }

      const pos = orderRes.position!;
      const kb: TelegramInlineKeyboardMarkup = {
        inline_keyboard: [
          [
            { text: '📈 Inspect Portfolio', callback_data: 'cmd:quant' },
            { text: '⚡ Scan Universe', callback_data: 'cmd:quant_scan' },
          ],
        ],
      };

      await gateway.sendMessage(
        chatId,
        `✅ **Paper Order Filled & Monitored**\n\n• **Asset**: \`${pos.symbol}\` (${pos.direction})\n• **Quantity**: \`${pos.quantity}\` units\n• **Fill Price**: \`$${pos.entryPrice}\`\n• **Invested Capital**: \`$${pos.investedAmount}\` (capped <= 5.0% allocation)\n• **Stop-Loss**: \`$${pos.stopLoss}\`\n• **Take-Profit**: \`$${pos.takeProfit}\`\n• **Strategy**: \`${pos.strategy}\`\n\n_Autonomous Cloud Sentry is active. Any Stop-Loss or Take-Profit crossing will trigger immediate auto-closure and notification._`,
        { replyToMessageId: cq.message?.message_id, replyMarkup: kb }
      );
      return;
    } else if (cq.data === 'cmd:briefing') {
      directiveText = 'Give me an executive briefing on all active systems, tasks, and radar.';
    } else if (cq.data === 'cmd:tasks') {
      directiveText = 'List all active pending tasks and priorities.';
    } else if (cq.data === 'cmd:audit') {
      directiveText = 'Run a comprehensive security audit of our infrastructure and codebase.';
    } else if (cq.data === 'cmd:subagents' || cq.data === 'cmd:agents_menu') {
      const keyboard = buildSubagentsKeyboard();
      await gateway.sendMessage(
        chatId,
        `🤖 **J.A.R.V.I.S. & F.R.I.D.A.Y. Specialized Subagents Matrix**\n\nCurated Top 10 High-ROI Autonomous Subagent profiles. Tap an agent below to inspect active tool suites and launch dedicated operations:\n\n_Direct command:_ \`/delegate <agent-id> <directive>\``,
        { replyToMessageId: cq.message?.message_id, replyMarkup: keyboard }
      );
      return;
    } else if (cq.data.startsWith('subagent:')) {
      const agentId = cq.data.replace(/^subagent:/, '');
      const agent = getSpecializedAgentProfile(agentId);
      if (agent) {
        const kb: TelegramInlineKeyboardMarkup = {
          inline_keyboard: [
            [
              { text: `🚀 Run ${agent.role.slice(0, 18)} Task`, callback_data: `subagent_run:${agent.id}` },
            ],
            [
              { text: '🔙 Subagents Matrix', callback_data: 'cmd:subagents' },
              { text: '📊 Main Briefing', callback_data: 'cmd:briefing' },
            ],
          ],
        };
        await gateway.sendMessage(
          chatId,
          `🤖 **Specialized Agent Profile**\n\n**${agent.name}**\n- **Role**: \`${agent.role}\`\n- **Category**: \`${agent.category}\`\n- **Recommended Model**: \`${agent.recommendedModel}\`\n- **Tool Suite**: \`${agent.tools.join(', ')}\`\n\n**Mission & Standards:**\n_${agent.systemPrompt}_\n\n_To delegate a custom directive:_ \`/delegate ${agent.id} <your directive>\``,
          { replyToMessageId: cq.message?.message_id, replyMarkup: kb }
        );
        return;
      }
    } else if (cq.data.startsWith('subagent_run:')) {
      const agentId = cq.data.replace(/^subagent_run:/, '');
      const defaultTasks: Record<string, string> = {
        'security-auditor': 'Run a comprehensive security audit of our repository and infrastructure. Verify zero secret leaks and OWASP compliance.',
        'architecture-expert': 'Analyze the overall architecture, component topology, and module boundaries of J.A.R.V.I.S. Mark II.',
        'build-error-resolver': 'Run compiler verification (npx tsc --noEmit) and report any build or type check errors.',
        'nextjs-app-router-expert': 'Review Next.js App Router route handlers, server actions, and Edge compatibility in app/ directory.',
        'tdd-testing-engineer': 'Review test coverage and formulate TDD verification contracts for our agent tools and storage engines.',
        'performance-optimizer': 'Inspect infrastructure performance, memory consumption, cgroup limits, and VM health.',
        'database-architect': 'Inspect Upstash Redis universal storage, state keys, and memory persistence health.',
        'osint-threat-analyst': 'Run OSINT threat scan on external APIs and CVE radar for our dependencies.',
        'refactoring-specialist': 'Inspect codebase for dead code, circular dependencies, and gstack reuse opportunities.',
        'codeact-executor': 'Verify CodeAct step execution pipeline and tool execution harness status.',
      };
      const taskText = defaultTasks[agentId] || `Execute specialized operation as ${agentId}`;
      await processDirective(
        chatId,
        taskText,
        undefined,
        cq.message?.message_id,
        false,
        agentId,
        cq.message?.message_thread_id
      );
      return;
    } else if (cq.data === 'cmd:groq') {
      directiveText = '/groq Report status and confirm Groq LPU 120B reflex tier active.';
    } else if (cq.data === 'cmd:gemini') {
      directiveText = '/flash Report status and confirm Gemini 3.7 Strategic Tier active.';
    } else if (cq.data === 'cmd:nim') {
      directiveText = '/nim Report status and confirm NVIDIA NIM Llama 3.3 H100 tier active.';
    } else if (cq.data.startsWith('persona:')) {
      const parts = cq.data.split(':');
      if (parts[1] === 'reset') {
        const config = await updatePersonaConfig(DEFAULT_PERSONA_CONFIG);
        await gateway.sendMessage(chatId, `⚡ Persona reset to defaults: Tone=\`${config.tone}\`, Sparring=\`${config.sparringLevel}\`, Verbosity=\`${config.verbosity}\`.`);
      } else if (parts[1] === 'sparring' && parts[2]) {
        const config = await updatePersonaConfig({ sparringLevel: parts[2] as SparringIntensity });
        await gateway.sendMessage(chatId, `🥊 Sparring level updated to: \`${config.sparringLevel}\``);
      } else if (parts[1] === 'verbosity' && parts[2]) {
        const config = await updatePersonaConfig({ verbosity: parts[2] as VerbosityLevel });
        await gateway.sendMessage(chatId, `📏 Verbosity updated to: \`${config.verbosity}\``);
      } else if (parts[1] === 'tone' && parts[2]) {
        const config = await updatePersonaConfig({ tone: parts[2] as PersonaTone });
        await gateway.sendMessage(chatId, `🎭 Persona tone updated to: \`${config.tone}\``);
      }
      return;
    } else if (cq.data.startsWith('voice_demo:')) {
      const personaKey = cq.data.split(':')[1]?.toUpperCase() as any;
      const { synthesizeMovieVoice } = await import('../lib/jarvis/tts');
      let sampleText = '';
      let caption = '';
      if (personaKey === 'FRIDAY') {
        sampleText = 'Boss, Mark 85 armor systems are fully armed and online. Tactical radar scanning.';
        caption = '🛡️ F.R.I.D.A.Y. (Kerry Condon — Irish AI)';
      } else if (personaKey === 'KHUSHI') {
        sampleText = 'Namaste Sir! I am Khushi. I can help track your daily meals, habits, and expenses naturally.';
        caption = '🌸 Khushi (Indic Conversational AI)';
      } else {
        sampleText = 'Always at your service, Sir. Cloud telemetry nominal, awaiting your command.';
        caption = '⚡ J.A.R.V.I.S. (Paul Bettany — British Butler)';
      }
      const buf = await synthesizeMovieVoice(sampleText, personaKey);
      if (buf) {
        await gateway.sendVoice(chatId, buf, { caption });
      }
      return;
    } else if (cq.data.startsWith('act:')) {
      const parts = cq.data.split(':');
      directiveText = parts.slice(2).join(':') || parts[1] || 'Execute tactical action';
    } else {
      directiveText = cq.data;
    }

    await processDirective(
      chatId,
      directiveText,
      undefined,
      cq.message?.message_id,
      false,
      undefined,
      cq.message?.message_thread_id
    );
    return;
  }

  // -------------------------------------------------------------
  // 2. STANDARD MESSAGE HANDLER (Text, Photo, Voice, Audio)
  // -------------------------------------------------------------
  const msg = update.message;
  if (!msg) return;

  const senderId = msg.from?.id;
  const chatId = msg.chat.id;

  // GUARDIAN SENTRY (DIRECTIVE 01): Immutable cryptographic sender check
  if (!senderId || String(senderId) !== String(ALLOWED_USER_ID)) {
    console.warn(
      `[GUARDIAN SENTRY] 🚨 Unauthorized packet discarded from sender ID=${senderId}, Name=${msg.from?.first_name || 'anon'}`
    );
    return;
  }

  if (msg.chat.type !== 'private' && msg.chat.type !== 'supergroup' && msg.chat.type !== 'group') {
    console.warn(`[GUARDIAN SENTRY] 🚨 Rejected non-allowed chat type: ${msg.chat.type}`);
    return;
  }

  const hasPhoto = Boolean(msg.photo && msg.photo.length > 0);
  const hasImageDoc = Boolean(msg.document && msg.document.mime_type?.startsWith('image/'));
  const hasNonImageDoc = Boolean(msg.document && !msg.document.mime_type?.startsWith('image/'));
  const hasVoice = Boolean(msg.voice);
  const hasAudio = Boolean(msg.audio);

  let userText = (msg.text || msg.caption || '').trim();
  let isVoiceInput = false;

  // Handle Supergroup & Forum Topic Initialization
  if (msg.chat.type === 'supergroup' || msg.chat.type === 'group') {
    console.log(`[Telegram Gateway] 🏛️ Group/Supergroup event received from Sir (Chat ID: ${chatId}, Thread: ${msg.message_thread_id || 'general'}): "${userText}"`);

    // Only create/recreate topics on EXPLICIT command (e.g. /init_topics or /setup_topics)
    const isExplicitTopicSetup = /^\/(?:setup_topics|init_topics|create_topics)\b/i.test(userText);
    if (isExplicitTopicSetup) {
      await gateway.sendMessage(
        chatId,
        `🏛️ <b>Initializing J.A.R.V.I.S. Command Matrix Topics...</b>\nCreating dedicated operational rooms for Sir...`,
        { messageThreadId: msg.message_thread_id }
      );

      const topicsToCreate = [
        { name: '🌅 Daily Briefings', color: 16766590, key: 'BRIEFINGS' },
        { name: '📊 Market & NSE Radars', color: 9367192, key: 'MARKETS' },
        { name: '📰 AI Tech Intelligence', color: 7322096, key: 'AINEWS' },
        { name: '💰 Monetization Radar', color: 13338331, key: 'MONETIZATION' },
        { name: '🛡️ Defense & Geopolitics', color: 16478047, key: 'DEFENSE' },
      ];

      const createdTopics: Record<string, number> = {};
      for (const t of topicsToCreate) {
        const created = await gateway.createForumTopic(chatId, t.name, t.color);
        if (created) {
          createdTopics[t.key] = created.message_thread_id;
          console.log(`[Telegram Topics] Created topic "${t.name}" with thread_id: ${created.message_thread_id}`);
        }
      }

      // Persist configuration to data/telegram-topics.json and Upstash
      const topicConfig = {
        supergroupId: chatId,
        topics: createdTopics,
        configuredAt: new Date().toISOString(),
      };

      try {
        const topicsFilePath = path.join(process.cwd(), 'data', 'telegram-topics.json');
        fs.mkdirSync(path.dirname(topicsFilePath), { recursive: true });
        fs.writeFileSync(topicsFilePath, JSON.stringify(topicConfig, null, 2), 'utf-8');
      } catch (err: any) {
        console.warn('[Telegram Topics] Failed to save local topics config:', err.message);
      }

      try {
        const { getUniversalStorage } = await import('../lib/jarvis/storage');
        const storage = getUniversalStorage();
        await storage.execute('set', 'jarvis:telegram:supergroup_topics', JSON.stringify(topicConfig));
      } catch {}

      const count = Object.keys(createdTopics).length;
      await gateway.sendMessage(
        chatId,
        `✅ <b>J.A.R.V.I.S. Command Matrix Operational!</b>\n\n` +
        `Successfully initialized <b>${count} dedicated topic rooms</b>:\n` +
        `• 🌅 <b>Daily Briefings</b>\n` +
        `• 📊 <b>Market & NSE Radars</b>\n` +
        `• 📰 <b>AI Tech Intelligence</b>\n` +
        `• 💰 <b>Monetization Radar</b>\n` +
        `• 🛡️ <b>Defense & Geopolitics</b>\n\n` +
        `All autonomous cron streams will now deliver directly to their respective rooms. Your private 1-on-1 chat with Friday is now reserved exclusively for direct sparring.`,
        { messageThreadId: msg.message_thread_id }
      );
      return;
    }
  }

  // Handle Voice Memos & Audio Files
  if (hasVoice || hasAudio) {
    const fileId = msg.voice?.file_id || msg.audio?.file_id;
    if (fileId) {
      console.log(`[Telegram Gateway] 🎙️ Ingesting voice note from Sir (fileId: ${fileId.slice(0, 15)}...)...`);
      gateway.sendTypingAction(chatId).catch(() => {});

      const downloaded = await gateway.downloadFileBuffer(fileId);
      if (downloaded) {
        const transcript = await transcribeAudioBuffer(downloaded.buffer, downloaded.filePath, downloaded.mimeType);
        if (transcript.text) {
          userText = transcript.text;
          isVoiceInput = true;
          console.log(`[Telegram Gateway] 🎙️ Voice Transcribed in <200ms: "${userText}"`);
        } else {
          console.warn(`[Telegram Gateway] ⚠️ Transcription empty or failed: ${transcript.error}`);
          await gateway.sendMessage(
            chatId,
            `Sir, I received your voice note, but transcription was unable to decode the audio stream (${transcript.error || 'empty signal'}). Please retry.`,
            { replyToMessageId: msg.message_id }
          );
          return;
        }
      }
    }
  }

  // OMNI-SPONGE SECOND BRAIN: Automatic Document Ingestion (PDFs, Markdown, TXT, Code)
  if (hasNonImageDoc && msg.document) {
    gateway.sendTypingAction(chatId).catch(() => {});
    console.log(`[Omni-Sponge] 🧽 Document packet received from Sir: "${msg.document.file_name}" (${msg.document.mime_type}). Initiating assimilation...`);
    const downloaded = await gateway.downloadFileBuffer(msg.document.file_id);
    if (downloaded) {
      try {
        const { assimilateContent } = await import('../lib/jarvis/omni-sponge');
        await assimilateContent({
          type: 'DOCUMENT',
          fileBuffer: downloaded.buffer,
          fileName: msg.document.file_name || downloaded.filePath,
          mimeType: msg.document.mime_type || 'application/octet-stream',
          userContext: userText,
        });
        return; // Card already broadcasted to Telegram
      } catch (spongeErr: any) {
        console.warn('[Omni-Sponge] Document assimilation warning:', spongeErr);
      }
    }
  }

  // OMNI-SPONGE SECOND BRAIN: Autonomous URL Link & Forwarded Content Ingestion
  const urlMatch = userText.match(/https?:\/\/[^\s]+/i);
  const isForwarded = Boolean((msg as any).forward_date || (msg as any).forward_from || (msg as any).forward_from_chat);
  const isExplicitAssimilation =
    isForwarded ||
    /^(?:https?:\/\/[^\s]+)$/i.test(userText.trim()) ||
    /\b(assimilate|sponge|absorb|read this|learn from this|study this|take note|save this|ingest)\b/i.test(userText);

  if (urlMatch && isExplicitAssimilation) {
    gateway.sendTypingAction(chatId).catch(() => {});
    console.log(`[Omni-Sponge] 🧽 URL packet received from Sir: "${urlMatch[0]}". Initiating assimilation...`);
    try {
      const { assimilateContent } = await import('../lib/jarvis/omni-sponge');
      await assimilateContent({
        type: 'URL',
        sourceUrl: urlMatch[0],
        userContext: userText,
      });
      return; // Card already broadcasted to Telegram
    } catch (spongeErr: any) {
      console.warn('[Omni-Sponge] URL assimilation warning:', spongeErr);
    }
  }

  if (!userText && (hasPhoto || hasImageDoc)) {
    userText = 'Please analyze this screenshot/image, Sir.';
  }

  if (!userText && !hasPhoto && !hasImageDoc && !hasVoice && !hasAudio) return;

  // AgentShield Inbound Inspection
  const shield = sanitizeInboundText(userText);
  if (shield.threatDetected) {
    console.warn(`[AgentShield Gateway Sentry] 🛡️ Neutralized prompt injection pattern in incoming message:`, shield.flags);
    userText = shield.sanitized;
  }

  console.log(
    `[Telegram Gateway] 🛡️ Verified Sovereign Directive from Sir (ID: ${senderId}): "${userText.substring(0, 60)}..."${
      hasPhoto ? ' [PHOTO]' : ''
    }${isVoiceInput ? ' [VOICE]' : ''}`
  );

  // Download multimodal visual media if attached
  let base64Image: string | undefined = undefined;
  if (hasPhoto && msg.photo) {
    const largestPhoto = msg.photo[msg.photo.length - 1];
    const b64 = await gateway.downloadFileAsBase64(largestPhoto.file_id);
    if (b64) base64Image = b64;
  } else if (hasImageDoc && msg.document) {
    const b64 = await gateway.downloadFileAsBase64(msg.document.file_id, msg.document.mime_type);
    if (b64) base64Image = b64;
  }

  await processDirective(
    chatId,
    userText,
    base64Image,
    msg.message_id,
    isVoiceInput,
    undefined,
    msg.message_thread_id
  );
}

async function startTelegramGateway() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  J.A.R.V.I.S. MARK II — SOVEREIGN TELEGRAM UPLINK GATEWAY     ║');
  console.log('║  Host: antigravity-cloud-runner (GCP Compute Engine e2-micro) ║');
  console.log('║  Voice: Groq Whisper LPU (<200ms) + Gemini 3.7 Strategic      ║');
  console.log('║  Interactive: Inline Action Keyboards & Multi-Engine Mesh     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  if (!gateway.isConfigured()) {
    console.log('⚠️ [Telegram Gateway] TELEGRAM_BOT_TOKEN is not configured.');
    return;
  }

  const authorizedId = await gateway.getAuthorizedChatId();
  if (authorizedId) {
    console.log(`[Telegram Gateway] 🔒 Sovereign Channel Bound to Chat ID: ${authorizedId}`);
    const liveUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jarvis-iota-beige.vercel.app/live';
    const webAppUrl = liveUrl.endsWith('/live') ? liveUrl : `${liveUrl}/live`;
    gateway.setChatMenuButton(authorizedId, webAppUrl, '📞 Call Friday').catch(() => {});
  }

  // Register native Telegram autocomplete commands
  gateway.setMyCommands([
    { command: 'call', description: '📞 Launch Full-Duplex Voice Sheet (AirPods / TMA)' },
    { command: 'bus', description: '⚡ Real-time Dual-Citizen State Bus stream' },
    { command: 'friday', description: '🛡️ Apex Tactical Mind directive' },
    { command: 'image', description: '🎨 Visual Frame: Synthesize diagrams, mockups & blueprints' },
    { command: 'jarvis', description: '⚡ Tactical Chief of Staff & Butler' },
    { command: 'monetization', description: '💰 08:00 AM Revenue, Bounties & B2B Leads' },
    { command: 'nse', description: '🇮🇳 08:15 AM Indian Market (NSE/BSE) macro catalysts & setups' },
    { command: 'briefing', description: '🌅 09:00 AM Executive AI & Tech Briefing' },
    { command: 'evolve', description: '🧬 10:00 PM Autonomous Self-Evolution cycle' },
    { command: 'trade', description: '📈 Sovereign Quant Engine & Portfolio' },
    { command: 'agents', description: '🤖 Specialized Subagents Matrix' },
    { command: 'radar', description: '📡 Tactical radar sweep' },
    { command: 'voice', description: '🎙️ Movie Neural Speech (Kerry Condon & Paul Bettany)' },
    { command: 'persona', description: '🎭 Tune tone and sparring intensity' },
    { command: 'incognito', description: '🕶️ Toggle Stealth Mode (Zero trace, zero memories)' },
    { command: 'i', description: '🕶️ Single-shot stealth query (/i <prompt>)' },
    { command: 'status', description: '🩺 Cloud runner VM & infrastructure health' },
  ]).catch(() => {});

  console.log('[Telegram Gateway] 🚀 Long-polling active with Voice + Callback support. Ready for directives...');

  let offset: number | undefined = undefined;

  while (true) {
    try {
      const updates = await gateway.getUpdates(offset, 30);
      for (const update of updates) {
        offset = update.update_id + 1;
        try {
          await handleIncomingMessage(update);
        } catch (msgErr: any) {
          console.error('[Telegram Gateway] Error handling update:', msgErr?.message || msgErr);
        }
      }
    } catch (err: any) {
      console.warn('[Telegram Gateway] Loop warning:', err?.message || err);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

async function runSupervisor() {
  while (true) {
    try {
      await startTelegramGateway();
    } catch (fatalErr: any) {
      console.error('[Telegram Gateway Supervisor Recovery]:', fatalErr?.message || fatalErr);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

runSupervisor();

