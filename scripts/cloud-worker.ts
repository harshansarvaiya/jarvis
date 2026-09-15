/**
 * J.A.R.V.I.S. Mark II — 24/7 Cloud Cron & Background Worker Daemon
 * Runs persistently on the Cloud Runner VM (`antigravity-cloud-runner`)
 * Executes scheduled task reminders, VAPID Web Push alerts, and autonomous health sweeps.
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

// 2. Push Notification Dispatcher Helper
async function dispatchPush(title: string, body: string, actionUrl: string = '/') {
  if (!redis) {
    console.log(`[Cloud Worker] (Local Simulation) Notification: [${title}] ${body}`);
    return;
  }

  try {
    const keys = await redis.keys('jarvis:push_subs:*');
    if (!keys || keys.length === 0) {
      console.log(`[Cloud Worker] No active push subscriptions found in Redis for: "${title}"`);
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
    console.log(`[Cloud Worker] 📲 Push dispatched to ${sentCount}/${keys.length} devices: "${title}"`);

    // Dual-channel: Dispatch proactive alert to Sir's Telegram
    try {
      const { telegramGateway } = await import('../lib/jarvis/telegram');
      const authChatId = await telegramGateway.getAuthorizedChatId();
      if (authChatId) {
        await telegramGateway.sendMessage(
          authChatId,
          `🔔 *[J.A.R.V.I.S. PROACTIVE ALERT]*\n\n*${title}*\n${body}`,
          { parseMode: 'Markdown' }
        );
        console.log(`[Cloud Worker] 📱 Telegram proactive alert sent to chat ID: ${authChatId}`);
      }
    } catch {}
  } catch (err: any) {
    console.error('[Cloud Worker] Push dispatch error:', err.message);
  }
}

// 3. Routine A: Scheduled Reminders & Due Date Poller
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
      if (task.status === 'PENDING' && task.dueDate) {
        const dueTime = new Date(task.dueDate).getTime();
        // Trigger if due time has arrived (within 24h window to avoid stale spam)
        if (!isNaN(dueTime) && dueTime <= now && now - dueTime < 24 * 60 * 60 * 1000) {
          console.log(`[Cloud Worker] ⏰ Due task triggered: "${task.title}"`);
          
          await dispatchPush(
            task.title.startsWith('[NOTIFICATION REMINDER]') ? '⏰ J.A.R.V.I.S. Reminder' : '🎯 Objective Due',
            task.description || task.title,
            '/'
          );

          task.status = 'IN_PROGRESS';
          task.executionAudit = task.executionAudit || [];
          task.executionAudit.push({
            timestamp: new Date().toISOString(),
            status: 'IN_PROGRESS',
            notes: 'Triggered autonomously by Cloud Cron Worker.',
          });
          stateModified = true;
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

// 4. Routine B: Daily Morning Tactical Briefing (08:00 AM User Time)
async function checkMorningBriefing() {
  if (!redis) return;
  try {
    const now = new Date();
    // Check if current hour is 08:00 (or between 08:00 and 08:15)
    const currentHour = now.getUTCHours(); // UTC comparison or local
    const todayDateStr = now.toISOString().slice(0, 10);

    const lastBriefingDate = (await redis.get('jarvis:cron:last_briefing_date')) as string | null;
    if (lastBriefingDate === todayDateStr) {
      return; // Already sent today
    }

    // If morning window (e.g. 08:00 UTC)
    if (currentHour === 8) {
      const stateStr = (await redis.get('jarvis:state')) as string | null;
      let pendingCount = 0;
      let criticalCount = 0;

      if (stateStr) {
        try {
          const state = typeof stateStr === 'string' ? JSON.parse(stateStr) : stateStr;
          if (Array.isArray(state?.tasks)) {
            const pending = state.tasks.filter((t: any) => t.status !== 'COMPLETED');
            pendingCount = pending.length;
            criticalCount = pending.filter((t: any) => t.priority === 'CRITICAL').length;
          }
        } catch {}
      }

      const briefMsg = `Good morning, Sir. Tactical radar has ${pendingCount} active objectives (${criticalCount} critical). All core directives operational.`;
      
      console.log(`[Cloud Worker] 🌅 Dispatching Morning Briefing to Sir...`);
      await dispatchPush('🌅 J.A.R.V.I.S. Morning Briefing', briefMsg, '/');
      await redis.set('jarvis:cron:last_briefing_date', todayDateStr);
    }
  } catch (err: any) {
    console.warn('[Cloud Worker] Morning briefing check warning:', err.message);
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

// 6. Routine D: Autonomous Cron Queue Processor
async function processCronQueue() {
  if (!redis) return;
  try {
    const queueItemStr = (await redis.lpop('jarvis:cron_queue')) as string | null;
    if (!queueItemStr) return;

    let job: any = null;
    try {
      job = JSON.parse(queueItemStr);
    } catch {
      return;
    }

    console.log(`[Cloud Worker] ⚡ Processing background queue job: "${job.type || 'generic'}"`);

    if (job.type === 'custom_push' && job.title && job.message) {
      await dispatchPush(job.title, job.message, job.url || '/');
    }
  } catch (err: any) {
    console.warn('[Cloud Worker] Queue processing warning:', err.message);
  }
}

// 6B. Routine E: Autonomous Subagent Background Queue Processor (Pillar 3)
async function processSubagentQueue() {
  if (!redis) return;
  try {
    const taskStr = (await redis.lpop('jarvis:subagent_tasks')) as string | null;
    if (!taskStr) return;

    let subagentTask: any = null;
    try {
      subagentTask = JSON.parse(taskStr);
    } catch {
      return;
    }

    console.log(`[Cloud Worker] 🤖 Autonomous Subagent started: "${subagentTask.title}"`);
    const prompt = subagentTask.prompt || subagentTask.instructions || subagentTask.title;

    try {
      const { runJarvisAgent } = await import('../lib/jarvis/agent');
      const { addMemory } = await import('../lib/jarvis/memory');

      const result = await runJarvisAgent([
        {
          role: 'user',
          content: `[AUTONOMOUS SUBAGENT DIRECTIVE]: ${prompt}. Perform deep empirical research, execute tools as necessary, and compile an executive intelligence report with verified facts, pricing, and entity details.`,
        },
      ], {
        model: 'gemini-3.8-flash',
      });

      console.log(`[Cloud Worker] 🤖 Subagent "${subagentTask.title}" completed in ${result.telemetry.latencyMs}ms.`);

      // Store in Redis subagent reports
      await redis.lpush('jarvis:subagent_reports', JSON.stringify({
        id: subagentTask.id || Date.now().toString(),
        title: subagentTask.title,
        prompt,
        report: result.reply,
        vocalSummary: result.vocalSummary,
        toolCalls: result.toolCallsExecuted,
        timestamp: new Date().toISOString(),
      }));

      // Assimilate into persistent memory
      addMemory(
        'TACTICAL' as any,
        `Subagent Report [${subagentTask.title}]: ${result.vocalSummary || result.reply.slice(0, 250)}`,
        'Autonomous Cloud Subagent Execution'
      );

      // Push notification to Sir's devices
      await dispatchPush(
        `🤖 Subagent Done: ${subagentTask.title}`,
        result.vocalSummary || result.reply.slice(0, 180),
        '/'
      );
    } catch (agentErr: any) {
      console.error(`[Cloud Worker] Subagent execution failed:`, agentErr.message);
      await dispatchPush(
        `⚠️ Subagent Alert: ${subagentTask.title}`,
        `Execution encountered an issue: ${agentErr.message.slice(0, 100)}`,
        '/'
      );
    }
  } catch (err: any) {
    console.warn('[Cloud Worker] Subagent queue processing warning:', err.message);
  }
}

// 6C. Routine F: Autonomous Cloud Command Bridge Processor (Pillar 4)
async function processCommandQueue() {
  if (!redis) return;
  try {
    const cmdStr = (await redis.lpop('jarvis:command_queue')) as string | null;
    if (!cmdStr) return;

    let cmdJob: any = null;
    try {
      cmdJob = JSON.parse(cmdStr);
    } catch {
      return;
    }

    console.log(`[Cloud Worker] 💻 Executing cloud command on VM: "${cmdJob.command}"`);
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execPromise = promisify(exec);

    try {
      const { stdout, stderr } = await execPromise(cmdJob.command, {
        timeout: 20000,
        cwd: process.cwd(),
      });

      if (cmdJob.id) {
        await redis.set(`jarvis:command_results:${cmdJob.id}`, JSON.stringify({
          stdout: (stdout || '').slice(0, 4000),
          stderr: (stderr || '').slice(0, 1000),
          exitCode: 0,
          timestamp: new Date().toISOString(),
        }), { ex: 300 });
      }
    } catch (cmdErr: any) {
      if (cmdJob.id) {
        await redis.set(`jarvis:command_results:${cmdJob.id}`, JSON.stringify({
          stdout: (cmdErr.stdout || '').slice(0, 1000),
          stderr: (cmdErr.stderr || cmdErr.message).slice(0, 2000),
          exitCode: cmdErr.code || 1,
          timestamp: new Date().toISOString(),
        }), { ex: 300 });
      }
    }
  } catch (err: any) {
    console.warn('[Cloud Worker] Command queue warning:', err.message);
  }
}

// 7. Master Worker Loop & Lifecycle Controller
async function startWorkerLoop(isTestMode: boolean = false) {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  J.A.R.V.I.S. MARK II — 24/7 CLOUD CRON WORKER SUBSTRATE      ║
║  Host: antigravity-cloud-runner (GCP Compute Engine e2-micro) ║
║  Status: INITIALIZED // DIRECTIVE 04 SOVEREIGN LOYALTY ACTIVE ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  if (isTestMode) {
    console.log('[Cloud Worker] Running single diagnostic sweep (--test)...');
    await checkSystemWatchdog();
    await checkScheduledReminders();
    await checkMorningBriefing();
    await processCronQueue();
    console.log('[Cloud Worker] Diagnostic sweep complete. Exiting cleanly.');
    process.exit(0);
  }

  console.log('[Cloud Worker] 🚀 24/7 Persistent Daemon active. Polling every 30 seconds...');

  // Initial immediate sweep
  await checkSystemWatchdog();
  await checkScheduledReminders();
  await checkMorningBriefing();

  let tickCount = 0;
  setInterval(async () => {
    tickCount++;
    try {
      // Every 30 seconds: Reminders, subagent tasks, cron queue, and cloud commands
      await checkScheduledReminders();
      await processSubagentQueue();
      await processCommandQueue();
      await processCronQueue();

      // Every 10 minutes (20 ticks): Morning briefing check
      if (tickCount % 20 === 0) {
        await checkMorningBriefing();
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

// Handle termination signals gracefully
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
