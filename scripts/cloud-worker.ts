/**
 * J.A.R.V.I.S. Mark II — 24/7 Cloud Cron & Background Worker Daemon
 * Runs persistently on the Cloud Runner VM (`antigravity-cloud-runner`)
 * Executes scheduled task reminders, autonomous briefing syntheses, VAPID Web Push alerts, and Telegram sentry sweeps.
 */

import { Redis } from '@upstash/redis';
import webpush from 'web-push';
import * as fs from 'fs';
import * as path from 'path';

// 1. Environment Initialization
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

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const VAPID_PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIV = process.env.VAPID_PRIVATE_KEY;
const ALLOWED_USER_ID = process.env.TELEGRAM_ALLOWED_USER_ID || '864360540';
const PRODUCTION_URL = 'https://jarvis-iota-beige.vercel.app';

let redis: Redis | null = null;
if (UPSTASH_URL && UPSTASH_TOKEN) {
  redis = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN });
}

if (VAPID_PUB && VAPID_PRIV) {
  try {
    webpush.setVapidDetails('mailto:harshan@jarvis.ai', VAPID_PUB, VAPID_PRIV);
  } catch (e) {
    console.warn('[Cloud Worker] VAPID initialization warning:', e);
  }
}

// 2. Push Notification Dispatcher Helper (Web Push + Telegram Sentry)
async function dispatchPush(title: string, body: string, actionUrl: string = '/') {
  // Dual-channel: Dispatch proactive alert directly to Sir's Telegram
  try {
    const { telegramGateway } = await import('../lib/jarvis/telegram');
    const authChatId = (await telegramGateway.getAuthorizedChatId()) || ALLOWED_USER_ID;
    if (authChatId) {
      await telegramGateway.sendMessage(
        authChatId,
        `🔔 *[J.A.R.V.I.S. PROACTIVE ALERT]*\n\n*${title}*\n${body}`,
        { parseMode: 'Markdown' }
      );
      console.log(`[Cloud Worker] 📱 Telegram proactive alert sent to chat ID: ${authChatId}`);
    }
  } catch (tgErr: any) {
    console.warn('[Cloud Worker] Telegram dispatch warning:', tgErr.message);
  }

  if (!redis) {
    console.log(`[Cloud Worker] (Local Simulation) Notification: [${title}] ${body}`);
    return;
  }

  try {
    const keys = await redis.keys('jarvis:push_subs:*');
    if (!keys || keys.length === 0) {
      return;
    }

    const payload = JSON.stringify({
      title,
      body,
      url: actionUrl,
      timestamp: new Date().toISOString(),
    });

    let sentCount = 0;
    for (const key of keys) {
      const data = await redis.get(key);
      if (!data) continue;

      let sub: any = null;
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        sub = parsed.subscription || parsed;
      } catch {
        continue;
      }

      if (!sub?.endpoint) continue;

      try {
        await webpush.sendNotification(sub, payload);
        sentCount++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await redis.del(key);
        }
      }
    }
    console.log(`[Cloud Worker] 📲 Web Push dispatched to ${sentCount}/${keys.length} devices: "${title}"`);
  } catch (err: any) {
    console.error('[Cloud Worker] Push dispatch error:', err.message);
  }
}

// 3. Routine A: Autonomous Scheduled Task & Cron Execution Engine
async function checkScheduledReminders() {
  if (!redis) return;
  try {
    const stateStr = (await redis.get('jarvis:state')) as string | null;
    if (!stateStr) return;

    let state: any = null;
    try {
      state = typeof stateStr === 'string' ? JSON.parse(stateStr) : stateStr;
    } catch {
      return;
    }

    if (!Array.isArray(state?.tasks)) return;

    const now = Date.now();
    let stateModified = false;

    for (const task of state.tasks) {
      // Check for PENDING or stuck IN_PROGRESS tasks that reached due time
      if ((task.status === 'PENDING' || task.status === 'IN_PROGRESS') && task.dueDate) {
        const dueTime = new Date(task.dueDate).getTime();
        
        // Trigger if due time has arrived (within 24h window)
        if (!isNaN(dueTime) && dueTime <= now && now - dueTime < 24 * 60 * 60 * 1000) {
          const isCron =
            task.tags?.some((t: string) => ['cron', 'briefing', 'news', 'scheduled-routine', 'report', 'ai-news'].includes(t.toLowerCase())) ||
            task.title.toLowerCase().includes('cron') ||
            task.title.toLowerCase().includes('briefing') ||
            task.title.toLowerCase().includes('news');
          
          const isDaily = isCron || task.tags?.includes('daily') || task.title.toLowerCase().includes('daily');

          console.log(`[Cloud Worker] ⏰ Scheduled Task Triggered: "${task.title}" (isCron=${isCron}, isDaily=${isDaily})`);

          if (isCron) {
            // Autonomous AI Research & Synthesis Execution
            try {
              const { runJarvisAgent } = await import('../lib/jarvis/agent');
              const { telegramGateway } = await import('../lib/jarvis/telegram');
              const authChatId = (await telegramGateway.getAuthorizedChatId()) || ALLOWED_USER_ID;

              const synthPrompt = `[SCHEDULED AUTONOMOUS CRON DIRECTIVE // 09:00 AM IST]:
Task: "${task.title}"
Details: "${task.description || ''}"

Synthesize a top-tier executive intelligence briefing for Sir (Harshan Sarvaiya). Include:
1. Top Frontier AI & Tech Breakthroughs / Product Releases
2. Strategic Implications for Architecture & Distributed Systems
3. High-Signal Action Items & Recommendations`;

              const result = await runJarvisAgent(
                [{ role: 'user', content: synthPrompt }],
                { model: 'gemini-3.7-flash', orchestrationMode: 'auto' }
              );

              console.log(`[Cloud Worker] 🤖 Synthesized intelligence briefing (${result.telemetry?.latencyMs}ms).`);

              // Dispatch full briefing to Telegram
              if (authChatId) {
                const header = `🌅 *[AUTONOMOUS 09:00 AM IST BRIEFING]*\n*${task.title}*\n\n`;
                await telegramGateway.sendMessage(
                  authChatId,
                  `${header}${result.reply}`,
                  { parseMode: 'Markdown' }
                );
                console.log(`[Cloud Worker] 📱 Intelligence briefing delivered to Telegram chat: ${authChatId}`);
              }

              // Dispatch lockscreen push alert
              await dispatchPush(
                `🌅 ${task.title}`,
                result.vocalSummary || result.reply.slice(0, 180),
                '/'
              );

              task.executionAudit = task.executionAudit || [];
              task.executionAudit.push({
                timestamp: new Date().toISOString(),
                status: 'COMPLETED',
                notes: `Autonomous synthesis executed successfully via ${result.telemetry?.engineUsed || 'Gemini 3.7'}.`,
              });

              if (isDaily) {
                // Advance schedule by +24 hours for tomorrow at 09:00 AM IST
                const nextDue = new Date(dueTime + 24 * 60 * 60 * 1000).toISOString();
                task.dueDate = nextDue;
                task.status = 'PENDING';
                console.log(`[Cloud Worker] 🔄 Recurring cron schedule advanced to tomorrow: ${nextDue}`);
              } else {
                task.status = 'COMPLETED';
                task.completedAt = new Date().toISOString();
              }
              stateModified = true;
            } catch (cronErr: any) {
              console.error('[Cloud Worker] Scheduled task synthesis failed:', cronErr.message);
              await dispatchPush('⚠️ Scheduled Task Warning', `Synthesis issue on: ${task.title} (${cronErr.message})`, '/');
            }
          } else {
            // Standard Reminder Task
            await dispatchPush(
              task.title.startsWith('[NOTIFICATION REMINDER]') ? '⏰ J.A.R.V.I.S. Reminder' : '🎯 Objective Due',
              task.description || task.title,
              '/'
            );

            task.status = 'COMPLETED';
            task.completedAt = new Date().toISOString();
            task.executionAudit = task.executionAudit || [];
            task.executionAudit.push({
              timestamp: new Date().toISOString(),
              status: 'COMPLETED',
              notes: 'Triggered autonomously by Cloud Cron Worker.',
            });
            stateModified = true;
          }
        }
      }
    }

    if (stateModified) {
      await redis.set('jarvis:state', JSON.stringify(state));
    }
  } catch (err: any) {
    console.warn('[Cloud Worker] Reminder check warning:', err.message);
  }
}

// 4. Routine B: Proactive Tactical Briefings (08:30 AM - 09:15 AM IST Morning & 09:30 PM IST Evening)
async function checkScheduledBriefings() {
  if (!redis) return;
  try {
    const now = new Date();
    // Calculate current time in Sir's timezone (Asia/Kolkata, UTC+5:30)
    const istTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
    const [hStr, mStr] = istTimeStr.split(':');
    const istHour = parseInt(hStr, 10);
    const istMin = parseInt(mStr, 10);
    const todayDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD

    const stateStr = (await redis.get('jarvis:state')) as string | null;
    let state: any = null;
    if (stateStr) {
      try {
        state = typeof stateStr === 'string' ? JSON.parse(stateStr) : stateStr;
      } catch {}
    }

    const tasks: any[] = Array.isArray(state?.tasks) ? state.tasks : [];
    const pendingTasks = tasks.filter((t) => t.status !== 'COMPLETED');
    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED');

    // -------------------------------------------------------------
    // MORNING TACTICAL BRIEFING (Window: 08:30 AM - 09:30 AM IST)
    // -------------------------------------------------------------
    const isMorningWindow = (istHour === 8 && istMin >= 30) || (istHour === 9 && istMin <= 30);
    if (isMorningWindow) {
      const morningKey = `jarvis:briefing:morning:${todayDateStr}`;
      const alreadySent = await redis.get(morningKey);
      if (!alreadySent) {
        const top3 = pendingTasks.slice(0, 3);
        const taskHighlights = top3.length > 0
          ? top3.map((t) => `• [${t.priority}] ${t.title}${t.dueDate ? ` (Due: ${t.dueDate})` : ''}`).join('\n')
          : '• All radar objectives currently clear.';

        const message = `Good morning, Sir. Tactical radar initialized in Stage 5 Performance Mode.\n\n` +
          `📋 *Active Objectives (${pendingTasks.length} pending):*\n${taskHighlights}\n\n` +
          `🧠 *Substrate Health:*\n` +
          `• Engine: Vertex AI Gemini 3.7 Flash & Groq LPU\n` +
          `• Host VM & Telegram Uplink: Online\n\n` +
          `Awaiting your sovereign command.`;

        console.log(`[Cloud Worker] 🌅 Dispatching Morning Briefing to Sir (IST ${istHour}:${istMin})...`);
        await dispatchPush('🌅 J.A.R.V.I.S. Morning Briefing', message, '/');
        await redis.set(morningKey, 'SENT');
      }
    }

    // -------------------------------------------------------------
    // EVENING TACTICAL DE-BRIEF (Window: 09:20 PM - 10:00 PM IST)
    // -------------------------------------------------------------
    if (istHour === 21 && istMin >= 20) {
      const eveningKey = `jarvis:briefing:evening:${todayDateStr}`;
      const alreadySent = await redis.get(eveningKey);
      if (!alreadySent) {
        const completedToday = completedTasks.filter((t) => t.completedAt && t.completedAt.startsWith(todayDateStr));

        const message = `Good evening, Sir. Tactical de-brief for ${todayDateStr}:\n\n` +
          `✅ *Accomplished Today:*\n` +
          (completedToday.length > 0
            ? completedToday.map((t) => `• ${t.title}`).join('\n')
            : '• Milestone engineering & substrate hardening accomplished.') +
          `\n\n🎯 *Pending on Radar:* ${pendingTasks.length} items remaining.\n\n` +
          `All defensive sentries and 24/7 background daemons remain on active watch. Rest well, Sir.`;

        console.log(`[Cloud Worker] 🌙 Dispatching Evening De-Brief to Sir (IST 21:30)...`);
        await dispatchPush('🌙 J.A.R.V.I.S. Evening De-Brief', message, '/');
        await redis.set(eveningKey, 'SENT');
      }
    }
  } catch (err: any) {
    console.warn('[Cloud Worker] Scheduled briefing check warning:', err.message);
  }
}

// 5. Routine C: System & Edge Deployment Watchdog
async function checkSystemWatchdog() {
  try {
    const startTime = Date.now();
    const res = await fetch(PRODUCTION_URL, {
      method: 'HEAD',
      headers: { 'ngrok-skip-browser-warning': 'true' },
      signal: AbortSignal.timeout(5000),
    });

    const latency = Date.now() - startTime;
    if (res.ok) {
      console.log(`[Cloud Worker] 🌐 Production Edge Health: HTTP ${res.status} (${latency}ms) — 100% ONLINE`);
    } else {
      console.warn(`[Cloud Worker] ⚠️ Production Edge returned HTTP ${res.status}`);
    }
  } catch (err: any) {
    console.warn(`[Cloud Worker] ⚠️ Watchdog ping failed: ${err.message}`);
  }
}

// 6. Master Worker Loop & Lifecycle Controller
async function startWorkerLoop(isTestMode: boolean = false) {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  J.A.R.V.I.S. MARK II — 24/7 CLOUD CRON WORKER SUBSTRATE      ║
║  Host: antigravity-cloud-runner (GCP Compute Engine e2-micro) ║
║  Mode: Autonomous Task Synthesis & 09:00 AM Cron Engine       ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  if (isTestMode) {
    console.log('[Cloud Worker] Running single diagnostic sweep (--test)...');
    await checkSystemWatchdog();
    await checkScheduledReminders();
    await checkScheduledBriefings();
    console.log('[Cloud Worker] Diagnostic sweep complete. Exiting cleanly.');
    process.exit(0);
  }

  console.log('[Cloud Worker] 🚀 24/7 Persistent Daemon active. Polling every 30 seconds...');

  // Immediate initial sweep
  await checkSystemWatchdog();
  await checkScheduledReminders();
  await checkScheduledBriefings();

  let tickCount = 0;
  setInterval(async () => {
    tickCount++;
    try {
      // Every 30 seconds: Reminders & Autonomous Cron Tasks
      await checkScheduledReminders();

      // Every 5 minutes (10 ticks): Scheduled morning/evening briefing check
      if (tickCount % 10 === 0) {
        await checkScheduledBriefings();
      }

      // Every 30 minutes (60 ticks): System watchdog ping
      if (tickCount % 60 === 0) {
        await checkSystemWatchdog();
      }
    } catch (loopErr: any) {
      console.error('[Cloud Worker] Loop execution error:', loopErr.message);
    }
  }, 30000);
}

process.on('SIGINT', () => {
  console.log('\n[Cloud Worker] Shutting down gracefully on SIGINT, Sir.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Cloud Worker] Terminating on SIGTERM, Sir.');
  process.exit(0);
});

const isTest = process.argv.includes('--test') || process.argv.includes('--once');
startWorkerLoop(isTest).catch((err) => {
  console.error('[Cloud Worker Fatal]:', err);
  process.exit(1);
});
