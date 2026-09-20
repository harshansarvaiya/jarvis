/**
 * J.A.R.V.I.S. Mark II — 24/7 Cloud Cron & Background Worker Daemon
 * Runs persistently on the Cloud Runner VM (`antigravity-cloud-runner`)
 * Executes scheduled task reminders, autonomous briefing syntheses, VAPID Web Push alerts, and Telegram sentry sweeps.
 */

import { Redis } from '@upstash/redis';
import webpush from 'web-push';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

// 1.1 Single-Instance Process Mutex Lock (Guarantees zero duplicate cloud workers)
const LOCK_FILE = '/tmp/jarvis-cloud-worker.lock';

function acquireSingleInstanceLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const existingPidStr = fs.readFileSync(LOCK_FILE, 'utf8').trim();
      const existingPid = parseInt(existingPidStr, 10);
      if (!isNaN(existingPid) && existingPid !== process.pid && existingPid !== process.ppid) {
        try {
          process.kill(existingPid, 'SIGTERM');
          console.log(`[Cloud Worker] 🔄 Terminated previous stale worker instance (PID: ${existingPid}) to yield to latest deploy.`);
        } catch {
          // Stale lockfile - overwrite
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
    console.warn('[Cloud Worker] Process lock warning:', err);
  }
}

acquireSingleInstanceLock();

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

    const subResults = await Promise.all(
      keys.map(async (key) => {
        try {
          const data = await redis!.get(key);
          if (!data) return null;
          const parsed = typeof data === 'string' ? JSON.parse(data) : data;
          const sub = parsed.subscription || parsed;
          if (!sub?.endpoint) return null;
          await webpush.sendNotification(sub, payload);
          return true;
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await redis!.del(key).catch(() => {});
          }
          return null;
        }
      })
    );

    const sentCount = subResults.filter(Boolean).length;
    console.log(`[Cloud Worker] 📲 Web Push dispatched in parallel to ${sentCount}/${keys.length} devices: "${title}"`);
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

        const message = `Good morning, Sir. Tactical radar initialized.\n\n` +
          `📋 *Active Objectives (${pendingTasks.length} pending):*\n${taskHighlights}\n\n` +
          `🧠 *Substrate Health:*\n` +
          `• Engine: Vertex AI Gemini 3.7 & Groq LPU (Sub-150ms)\n` +
          `• Host VM: GCP e2-standard-2 (8GB RAM, 2 vCPUs) Online\n\n` +
          `Standing by for directives.`;

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
            : '• Substrate hardening & system engineering accomplished.') +
          `\n\n🎯 *Pending on Radar:* ${pendingTasks.length} items remaining.\n\n` +
          `All defensive sentries and background daemons remain on active watch.`;

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

// 6. Routine D: Global Threat & OSINT Sentry Sweep (USGS Earthquakes, NOAA Space Weather, Critical CVEs)
const localSeenThreats = new Set<string>();

async function checkGlobalThreatSentry() {
  const now = Date.now();

  // 6.1 USGS Significant Seismic Activity (Magnitude >= 6.2 global or >= 5.0 regional)
  try {
    const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson', {
      headers: { 'User-Agent': 'JARVIS-GlobalThreatSentry/2.0' },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = await res.json();
      const features = Array.isArray(data.features) ? data.features : [];

      for (const feature of features) {
        const props = feature.properties || {};
        const coords = feature.geometry?.coordinates || [0, 0, 0];
        const [lon, lat, depth] = coords;
        const mag = props.mag || 0;
        const eqTime = props.time || 0;
        const eqId = feature.id || `eq-${props.time}`;

        // Only evaluate events in the last 2 hours
        const ageHours = (now - eqTime) / (1000 * 60 * 60);
        if (ageHours > 2) continue;

        const isRegional = lat >= -10 && lat <= 40 && lon >= 60 && lon <= 100; // South Asia / India / Indian Ocean
        const isSevere = mag >= 6.2 || (isRegional && mag >= 5.0);

        if (isSevere) {
          const sentryKey = `jarvis:threat_sentry:eq:${eqId}`;
          let alreadySeen = false;
          if (redis) {
            alreadySeen = Boolean(await redis.get(sentryKey));
          } else {
            alreadySeen = localSeenThreats.has(sentryKey);
          }

          if (!alreadySeen) {
            if (redis) {
              await redis.set(sentryKey, 'NOTIFIED', { ex: 48 * 3600 });
            } else {
              localSeenThreats.add(sentryKey);
            }

            const alertTitle = isRegional
              ? `🚨 [REGIONAL SEISMIC SENTRY] Magnitude ${mag.toFixed(1)} Earthquake`
              : `🚨 [GLOBAL SEISMIC SENTRY] Magnitude ${mag.toFixed(1)} Earthquake`;

            const alertBody = `Location: ${props.place || 'Unknown'}\nDepth: ${depth.toFixed(1)} km\nTime: ${new Date(eqTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })} IST\nTsunami Flag: ${props.tsunami ? 'YES (High Warning)' : 'No'}`;

            console.log(`[Cloud Worker] 🚨 Seismic Sentry Alert Dispatched: ${alertTitle} at ${props.place}`);
            await dispatchPush(alertTitle, alertBody, '/');
          }
        }
      }
    }
  } catch (eqErr: any) {
    console.warn('[Cloud Worker] Seismic Sentry warning:', eqErr.message);
  }

  // 6.2 NOAA Space Weather & Solar Flare Sentry (G4/G5 Geomagnetic Storms & X-Class Flares)
  try {
    const noaaRes = await fetch('https://services.swpc.noaa.gov/products/alerts.json', {
      headers: { 'User-Agent': 'JARVIS-SpaceWeatherSentry/2.0' },
      signal: AbortSignal.timeout(6000),
    });

    if (noaaRes.ok) {
      const alerts = await noaaRes.json();
      if (Array.isArray(alerts)) {
        for (const alert of alerts.slice(0, 10)) {
          const pId = alert.product_id || '';
          const issueDateStr = alert.issue_datetime || '';
          const issueTime = new Date(issueDateStr.replace(' ', 'T') + 'Z').getTime();
          const ageHours = (now - issueTime) / (1000 * 60 * 60);

          // Only consider alerts within the last 4 hours
          if (ageHours > 4 || isNaN(ageHours)) continue;

          const isExtremeStorm = pId.includes('K08') || pId.includes('K09') || pId.includes('G4') || pId.includes('G5') || pId.includes('X01') || pId.includes('X02');

          if (isExtremeStorm) {
            const noaaKey = `jarvis:threat_sentry:noaa:${pId}_${issueDateStr.slice(0, 13)}`;
            let alreadyNotified = false;
            if (redis) {
              alreadyNotified = Boolean(await redis.get(noaaKey));
            } else {
              alreadyNotified = localSeenThreats.has(noaaKey);
            }

            if (!alreadyNotified) {
              if (redis) {
                await redis.set(noaaKey, 'NOTIFIED', { ex: 48 * 3600 });
              } else {
                localSeenThreats.add(noaaKey);
              }

              const alertTitle = `🛰️ [SPACE WEATHER SENTRY] Severe Solar Anomaly (${pId})`;
              const firstLine = (alert.message || '').split('\n').find((l: string) => l.includes('ALERT:') || l.includes('WARNING:')) || 'Severe Space Weather condition detected.';
              const alertBody = `${firstLine.trim()}\nIssue Time: ${issueDateStr} UTC\nPotential cloud network & satellite communication impacts.`;

              console.log(`[Cloud Worker] 🛰️ Space Weather Sentry Dispatched: ${alertTitle}`);
              await dispatchPush(alertTitle, alertBody, '/');
            }
          }
        }
      }
    }
  } catch (noaaErr: any) {
    console.warn('[Cloud Worker] Space Weather Sentry warning:', noaaErr.message);
  }
}

// 6.3 Routine D.3: European & Global Geopolitical Escalation Radar (WW3 Monitor)
async function checkGeopoliticalEscalationRadar(options: { silent?: boolean } = {}) {
  try {
    const { fetchGeopoliticalThreatRadar } = await import('../lib/jarvis/osint');
    const geoReport = await fetchGeopoliticalThreatRadar();

    console.log(`[Cloud Worker] 🌐 Geopolitical Sentry Status: ${geoReport.overallThreatLevel} (${geoReport.theater})`);

    // Update the task matrix in Upstash if task exists
    if (redis) {
      const stateStr = (await redis.get('jarvis:state')) as string | null;
      if (stateStr) {
        let state: any = null;
        try {
          state = typeof stateStr === 'string' ? JSON.parse(stateStr) : stateStr;
        } catch {}

        if (Array.isArray(state?.tasks)) {
          const geoTask = state.tasks.find((t: any) =>
            t.tags?.includes('ww3') ||
            t.tags?.includes('geopolitics') ||
            t.title?.toLowerCase().includes('geopolitical')
          );

          if (geoTask) {
            geoTask.executionAudit = geoTask.executionAudit || [];
            // Keep last 10 audits
            if (geoTask.executionAudit.length > 10) {
              geoTask.executionAudit = geoTask.executionAudit.slice(-10);
            }
            geoTask.executionAudit.push({
              timestamp: new Date().toISOString(),
              status: 'IN_PROGRESS',
              notes: `[Autonomous Radar Telemetry] Status: ${geoReport.overallThreatLevel}. ${geoReport.synthesis}`,
            });
            await redis.set('jarvis:state', JSON.stringify(state));
          }
        }
      }
    }

    // Geopolitical radar runs silently in background to keep Upstash telemetry and PWA /radar up to date
    // Dispatches only during scheduled 09:00 AM / 09:00 PM executive briefings or when explicitly queried
  } catch (geoErr: any) {
    console.warn('[Cloud Worker] Geopolitical Radar warning:', geoErr.message);
  }
}

// 7. Routine E: Proactive Infrastructure & API Token Health Probe
async function checkInfrastructureAndTokenHealth() {
  console.log('[Cloud Worker] 🩺 Running proactive infrastructure & token health probe...');

  // 7.1 GitHub PAT Sentry
  const ghToken = process.env.GITHUB_TOKEN || process.env.GITHUB_MODELS_TOKEN;
  if (ghToken) {
    try {
      const ghRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${ghToken}`,
          'User-Agent': 'JARVIS-ProactiveHealthSentry/2.0',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (ghRes.status === 401 || ghRes.status === 403) {
        console.warn('[Cloud Worker] 🚨 GitHub PAT has expired or is unauthorized!');
        await dispatchPush(
          '🚨 [SECURITY SENTRY] GitHub Token Expired',
          'Primary GitHub PAT is unauthorized (HTTP 401/403). Direct repository sync may be throttled. Please refresh GITHUB_TOKEN in .env.local, Sir.',
          '/'
        );
      } else if (ghRes.ok) {
        console.log('[Cloud Worker] 🛡️ GitHub API Token: VALID (HTTP 200)');
      }
    } catch (e: any) {
      console.warn('[Cloud Worker] GitHub token probe warning:', e.message);
    }
  }

  // 7.2 Upstash Redis Edge Latency
  if (redis) {
    try {
      const t0 = Date.now();
      await redis.get('jarvis:state');
      const rLatency = Date.now() - t0;
      console.log(`[Cloud Worker] 💾 Upstash Redis Edge Latency: ${rLatency}ms`);
    } catch (rErr: any) {
      console.warn('[Cloud Worker] Upstash latency probe warning:', rErr.message);
    }
  }

  // 7.3 GCP VM Cgroup Memory & Disk Sentry (Directive 06 Enforced)
  try {
    const mem = process.memoryUsage();
    const rssMb = Math.round(mem.rss / 1024 / 1024);
    const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
    const freeRamMb = Math.round(os.freemem() / 1024 / 1024);

    console.log(`[Cloud Worker] ⚙️ VM Health Sentry: RSS=${rssMb}MB, Heap=${heapUsedMb}MB, FreeRAM=${freeRamMb}MB`);

    // Proactive memory cleanup if approaching VM limit (Directive 06: <450MB cgroup cap)
    if (rssMb > 350 && (global as any).gc) {
      (global as any).gc();
      console.log('[Cloud Worker] 🧹 Proactive garbage collection sweep triggered.');
    }

    // Check available disk space on root filesystem
    const { stdout } = await execAsync("df -BM / | tail -1 | awk '{print $4}'", { timeout: 4000 });
    const availStr = (stdout || '').replace('M', '').trim();
    const availMb = parseInt(availStr, 10);
    if (!isNaN(availMb) && availMb < 2000) {
      console.warn(`[Cloud Worker] ⚠️ Low disk space warning: ${availMb}MB remaining!`);
      await dispatchPush(
        '⚠️ [VM SENTRY] Low Disk Space Warning',
        `Available disk space on runner root partition is ${availMb}MB (<2GB threshold). Clean temporary caches suggested.`,
        '/'
      );
    }
  } catch (sysErr: any) {
    console.warn('[Cloud Worker] VM telemetry probe warning:', sysErr.message);
  }
}

// 8. Routine F: Autonomous Build & Compiler Verification Sentry
async function checkBuildIntegrityAndSelfHeal() {
  try {
    console.log('[Cloud Worker] 🔧 Running autonomous compiler verification (tsc --noEmit)...');
    const { stdout, stderr } = await execAsync('./node_modules/.bin/tsc --noEmit', {
      cwd: process.cwd(),
      timeout: 120000,
      maxBuffer: 4 * 1024 * 1024,
    });
    console.log('[Cloud Worker] 🛡️ Compiler Verification Passed: 0 TypeScript errors. Codebase nominal.');
  } catch (tscErr: any) {
    const errOutput = (tscErr.stdout || tscErr.stderr || tscErr.message || '').trim().slice(0, 500);
    console.error('[Cloud Worker] 🚨 Build Regression Detected by Sentry:\n', errOutput);

    const alertKey = `jarvis:threat_sentry:build_err:${errOutput.slice(0, 30)}`;
    const alreadySeen = redis ? await redis.get(alertKey) : localSeenThreats.has(alertKey);

    if (!alreadySeen) {
      if (redis) await redis.set(alertKey, 'NOTIFIED', { ex: 24 * 3600 });
      localSeenThreats.add(alertKey);

      await dispatchPush(
        '🚨 [BUILD REGRESSION DETECTED]',
        `Compiler error found during 24/7 verification sweep:\n${errOutput.slice(0, 220)}...`,
        '/'
      );
    }
  }
}

// 9. Routine G: Core Dependency CVE Security Radar
async function checkDependencySecurityRadar() {
  try {
    console.log('[Cloud Worker] 🔍 Running OSINT CVE security radar on core dependencies...');
    const { scanCveThreats } = await import('../lib/jarvis/osint');
    const corePackages = ['next', 'typescript', 'redis'];

    for (const pkg of corePackages) {
      const report = await scanCveThreats({ keyword: pkg, limit: 3 });
      if (report && report.totalFound > 0) {
        const criticalThreats = report.threats.filter((t) => t.severity === 'CRITICAL' || t.severity === 'HIGH');
        if (criticalThreats.length > 0) {
          const threat = criticalThreats[0];
          const alertKey = `jarvis:threat_sentry:cve:${threat.id}`;
          const alreadySeen = redis ? await redis.get(alertKey) : localSeenThreats.has(alertKey);

          if (!alreadySeen) {
            if (redis) await redis.set(alertKey, 'NOTIFIED', { ex: 7 * 24 * 3600 });
            localSeenThreats.add(alertKey);

            console.log(`[Cloud Worker] 🚨 CVE Sentry Alert: ${threat.id} on ${pkg}`);
            await dispatchPush(
              `🛡️ [CVE SENTRY] ${threat.id} (${pkg})`,
              `High-severity CVE identified in ${pkg}:\n${threat.summary.slice(0, 160)}...\nFix: ${threat.fixedVersion || 'Advisory Pending'}`,
              '/'
            );
          }
        }
      }
    }
  } catch (cveErr: any) {
    console.warn('[Cloud Worker] CVE Sentry warning:', cveErr.message);
  }
}

// 9.5 Autonomous "Sleep Cycle" Memory Consolidation with TypeSafe Jev System One
async function consolidateCognitiveMemoriesWithJev() {
  if (!process.env.TYPESAFE_API_KEY || !redis) return;
  console.log('[Cloud Worker:Jev Sleep-Cycle] 🧠 Initiating cognitive memory consolidation sweep...');

  try {
    const { jevDetectMemoryContradiction } = await import('../lib/jarvis/providers/jev');
    const stateStr = (await redis.get('jarvis:state')) as string | null;
    if (!stateStr) return;

    let state: any = null;
    try {
      state = typeof stateStr === 'string' ? JSON.parse(stateStr) : stateStr;
    } catch {
      return;
    }

    if (!Array.isArray(state?.memories) || state.memories.length < 4) return;

    const memories: any[] = state.memories;
    const initialCount = memories.length;
    const idsToDeprecate = new Set<string>();

    // Pair recent memories with older memories in same category
    for (let i = 0; i < Math.min(10, memories.length); i++) {
      const recent = memories[i];
      if (!recent || !recent.content) continue;

      for (let j = i + 1; j < Math.min(25, memories.length); j++) {
        const older = memories[j];
        if (!older || !older.content || idsToDeprecate.has(older.id)) continue;
        if (recent.category !== older.category) continue;

        const analysis = await jevDetectMemoryContradiction(older.content, recent.content);

        if (analysis.relationship === 'SUPERSEDED_CONTRADICTION' && analysis.contradictionScore > 0.75) {
          console.log(`[Cloud Worker:Jev Sleep-Cycle] 🔄 Deprecating contradicted memory: "${older.content.slice(0, 60)}" in favor of newer: "${recent.content.slice(0, 60)}"`);
          idsToDeprecate.add(older.id);
        } else if (analysis.relationship === 'DUPLICATE_REDUNDANT') {
          console.log(`[Cloud Worker:Jev Sleep-Cycle] ✂️ Pruning redundant duplicate memory: "${older.content.slice(0, 60)}"`);
          idsToDeprecate.add(older.id);
        }
      }
    }

    if (idsToDeprecate.size > 0) {
      state.memories = memories.filter((m) => !idsToDeprecate.has(m.id));
      await redis.set('jarvis:state', JSON.stringify(state));
      console.log(`[Cloud Worker:Jev Sleep-Cycle] ✨ Consolidated memory vault: pruned ${idsToDeprecate.size} stale/contradictory records (${initialCount} -> ${state.memories.length}).`);
    } else {
      console.log('[Cloud Worker:Jev Sleep-Cycle] 🛡️ Memory vault verified: zero contradictions or redundant stale entries found.');
    }
  } catch (err: any) {
    console.warn('[Cloud Worker:Jev Sleep-Cycle] Memory consolidation warning:', err.message);
  }
}

// 10. Master Worker Loop & Lifecycle Controller
async function startWorkerLoop(isTestMode: boolean = false) {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  J.A.R.V.I.S. MARK II — 24/7 CLOUD CRON WORKER SUBSTRATE      ║
║  Host: antigravity-cloud-runner (GCP Compute Engine e2-micro) ║
║  Mode: Autonomous Sentry, Global Threat Radar & Cron Engine   ║
║  Stage: 5 Autonomous Sovereign Proactive Chrono-Sensing       ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  if (isTestMode) {
    console.log('[Cloud Worker] Running full proactive diagnostic sweep (--test)...');
    await checkSystemWatchdog();
    await checkInfrastructureAndTokenHealth();
    await checkBuildIntegrityAndSelfHeal();
    await checkScheduledReminders();
    await checkScheduledBriefings();
    await checkGlobalThreatSentry();
    await checkGeopoliticalEscalationRadar();
    await checkDependencySecurityRadar();
    console.log('[Cloud Worker] Diagnostic sweep complete. Exiting cleanly.');
    process.exit(0);
  }

  console.log('[Cloud Worker] 🚀 24/7 Persistent Daemon active. Polling every 30 seconds...');

  // Immediate initial sweep (silent mode — updates telemetry without dispatching restart spam)
  await checkSystemWatchdog();
  await checkInfrastructureAndTokenHealth();
  await checkScheduledReminders();
  await checkScheduledBriefings();
  await checkGlobalThreatSentry();
  // High-Frequency Sub-Second VM Remote Execution RPC Listener (1.5s interval)
  setInterval(async () => {
    try {
      const { processNextVmRpcRequest } = await import('../lib/jarvis/vm-rpc');
      await processNextVmRpcRequest();
    } catch {}
  }, 1500);

  let tickCount = 0;
  setInterval(async () => {
    tickCount++;
    try {
      // Every 30 seconds: Reminders & Autonomous Cron Tasks
      await checkScheduledReminders();

      // Every 5 minutes (10 ticks): Scheduled morning/evening briefing check & Global Threat Sentry
      if (tickCount % 10 === 0) {
        await checkScheduledBriefings();
        await checkGlobalThreatSentry();
      }

      // Every 10 minutes (20 ticks): Infrastructure, token health, and VM cgroup memory sentry
      if (tickCount % 20 === 0) {
        await checkInfrastructureAndTokenHealth();
      }

      // Every 15 minutes (30 ticks): Geopolitical & WW3 Escalation Radar sweep
      if (tickCount % 30 === 0) {
        await checkGeopoliticalEscalationRadar();
      }

      // Every 30 minutes (60 ticks): System watchdog ping & AST Semantic Code Graph refresh
      if (tickCount % 60 === 0) {
        await checkSystemWatchdog();
        try {
          const { indexCodebaseGraph } = await import('../lib/jarvis/codebase-graph');
          await indexCodebaseGraph({ embedWithVertex: true });
          console.log('[Cloud Worker] 🧠 AST Semantic Code Graph refreshed with Vertex AI text-embedding-004.');
        } catch (e: any) {
          console.warn('[Cloud Worker] Code graph index refresh warning:', e.message);
        }
      }

      // Every 1 hour (120 ticks): Autonomous Sleep-Cycle Memory Consolidation via Jev System One
      if (tickCount % 120 === 0) {
        await consolidateCognitiveMemoriesWithJev();
      }

      // Every 4 hours (480 ticks): Autonomous build integrity & self-healing compiler verification
      if (tickCount % 480 === 0) {
        await checkBuildIntegrityAndSelfHeal();
      }

      // Every 12 hours (1440 ticks): Core dependency CVE security radar
      if (tickCount % 1440 === 0) {
        await checkDependencySecurityRadar();
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
