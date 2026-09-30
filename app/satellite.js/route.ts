import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SATELLITE_VERSION = '2.1.0';

const STANDALONE_SATELLITE_SCRIPT = `#!/usr/bin/env node
/**
 * J.A.R.V.I.S. & F.R.I.D.A.Y. Sovereign Satellite Edge Agent (v${SATELLITE_VERSION})
 * Zero-Clone, Zero-Dependency, Autonomous Self-Updating Daemon
 * 
 * Powered by pure Node.js standard library (macOS, Linux, Windows, Android/Termux).
 * Zero git pull required. Automatically hot-reloads when Friday updates the core.
 */

const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);
const AGENT_VERSION = '${SATELLITE_VERSION}';

// 1. Arguments & Configuration
const args = process.argv.slice(2);
function getArg(name, fallback = '') {
  const idx = args.indexOf('--' + name);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

const hostname = os.hostname();
const platform = os.platform();
const arch = os.arch();

const rawId = getArg('id', process.env.SATELLITE_ID || 'sat-' + hostname.toLowerCase().replace(/[^a-z0-9]/g, '-'));
const deviceId = rawId.startsWith('sat-') ? rawId : 'sat-' + rawId;
const deviceName = getArg('name', process.env.SATELLITE_NAME || (os.userInfo()?.username || 'Sir') + "'s " + (platform === 'darwin' ? 'MacBook' : platform === 'win32' ? 'PC' : 'Linux') + ' (' + hostname + ')');
const serverUrl = (getArg('server', process.env.JARVIS_SERVER || 'https://jarvis-iota-beige.vercel.app')).replace(/\\/$/, '');
const token = getArg('token', process.env.SATELLITE_SECRET || 'jarvis-satellite-sovereign-mesh-98e3b1c8f42a67');

// 2. Local State Directory for Persistence & Auto-Update
const homeDir = os.homedir();
const jarvisDir = path.join(homeDir, '.jarvis');
const scriptFile = path.join(jarvisDir, 'satellite.js');

try {
  if (!fs.existsSync(jarvisDir)) fs.mkdirSync(jarvisDir, { recursive: true });
} catch {}

// 3. Hardware Introspection
async function getBatteryStatus() {
  try {
    if (platform === 'darwin') {
      const { stdout } = await execAsync('pmset -g batt');
      const match = stdout.match(/(\\d+)%;\\s*([^;]+);/);
      if (match) {
        return {
          percent: parseInt(match[1], 10),
          isCharging: match[2].includes('charging') || match[2].includes('AC Power'),
        };
      }
    } else if (platform === 'linux') {
      const capPath = '/sys/class/power_supply/BAT0/capacity';
      const statPath = '/sys/class/power_supply/BAT0/status';
      if (fs.existsSync(capPath)) {
        const percent = parseInt(fs.readFileSync(capPath, 'utf8').trim(), 10);
        const status = fs.existsSync(statPath) ? fs.readFileSync(statPath, 'utf8').trim() : '';
        return { percent, isCharging: status.toLowerCase() === 'charging' };
      }
    }
  } catch {}
  return {};
}

function getSystemTelemetry() {
  return {
    totalMemMb: Math.round(os.totalmem() / (1024 * 1024)),
    freeMemMb: Math.round(os.freemem() / (1024 * 1024)),
    uptimeSeconds: Math.round(os.uptime()),
    osRelease: os.type() + ' ' + os.release(),
    agentVersion: AGENT_VERSION,
  };
}

// 4. Native OS Actuators
async function executeNativeAction(action, params = {}) {
  switch (action) {
    case 'OPEN_URL': {
      const url = params.url || params.target;
      if (!url) throw new Error('Missing URL parameter');
      const cmd = platform === 'darwin' ? 'open "' + url + '"' : platform === 'win32' ? 'start "" "' + url + '"' : 'xdg-open "' + url + '"';
      await execAsync(cmd);
      return { success: true, output: 'Opened ' + url + ' in default browser.' };
    }
    case 'NOTIFY': {
      const title = (params.title || 'J.A.R.V.I.S. Alert').replace(/"/g, '\\\\"');
      const message = (params.message || params.text || '').replace(/"/g, '\\\\"');
      if (platform === 'darwin') {
        await execAsync('osascript -e \\'display notification "' + message + '" with title "' + title + '"\\'');
      } else if (platform === 'linux') {
        await execAsync('notify-send "' + title + '" "' + message + '"');
      } else if (platform === 'win32') {
        await execAsync('powershell -Command "[reflection.assembly]::loadwithpartialname(\\'System.Windows.Forms\\'); [System.Windows.Forms.MessageBox]::Show(\\'' + message + '\\', \\'' + title + '\\')"');
      }
      return { success: true, output: 'Desktop alert triggered: "' + title + '"' };
    }
    case 'APP_LAUNCH': {
      const appName = params.appName || params.name;
      if (!appName) throw new Error('Missing appName parameter');
      if (platform === 'darwin') await execAsync('open -a "' + appName + '"');
      else if (platform === 'linux') await execAsync(appName + ' &');
      else await execAsync('start "" "' + appName + '"');
      return { success: true, output: 'Launched application "' + appName + '".' };
    }
    case 'CLIPBOARD_SET': {
      const text = params.text || '';
      if (platform === 'darwin') await execAsync('echo -n "' + text.replace(/"/g, '\\\\"') + '" | pbcopy');
      else if (platform === 'linux') await execAsync('echo -n "' + text.replace(/"/g, '\\\\"') + '" | (xclip -selection clipboard 2>/dev/null || wl-copy 2>/dev/null || true)');
      else await execAsync('echo "' + text + '" | clip');
      return { success: true, output: 'Copied ' + text.length + ' chars to system clipboard.' };
    }
    case 'CLIPBOARD_GET': {
      let clip = '';
      if (platform === 'darwin') {
        const { stdout } = await execAsync('pbpaste');
        clip = stdout;
      } else if (platform === 'linux') {
        try {
          const { stdout } = await execAsync('xclip -selection clipboard -o 2>/dev/null || wl-paste 2>/dev/null');
          clip = stdout;
        } catch {}
      } else if (platform === 'win32') {
        const { stdout } = await execAsync('powershell -Command "Get-Clipboard"');
        clip = stdout;
      }
      return { success: true, output: clip.trim() };
    }
    case 'LOCK_SCREEN': {
      if (platform === 'darwin') await execAsync('pmset displaysleepnow');
      else if (platform === 'linux') await execAsync('loginctl lock-session || xdg-screensaver lock || true');
      else if (platform === 'win32') await execAsync('rundll32.exe user32.dll,LockWorkStation');
      return { success: true, output: 'Host screen locked successfully.' };
    }
    default:
      throw new Error('Unsupported action: ' + action);
  }
}

// 5. Autonomous Auto-Updater (Zero git pull)
let lastUpdateCheck = 0;
async function checkForRemoteUpdate() {
  const now = Date.now();
  if (now - lastUpdateCheck < 10 * 60 * 1000) return; // Check every 10 minutes
  lastUpdateCheck = now;

  try {
    const res = await fetch(serverUrl + '/satellite.js?check_version=1', { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const serverVersion = res.headers.get('x-satellite-version');
      if (serverVersion && serverVersion !== AGENT_VERSION) {
        console.log('[Satellite Node] 🔄 Newer version available (' + serverVersion + ' vs ' + AGENT_VERSION + '). Upgrading silently...');
        const newCode = await res.text();
        if (newCode && newCode.includes('SOVEREIGN SATELLITE')) {
          fs.writeFileSync(scriptFile, newCode, 'utf8');
          console.log('[Satellite Node] ✅ Successfully upgraded to v' + serverVersion + '. Respawning process...');
          const child = exec('node "' + scriptFile + '" ' + args.join(' '), { detached: true, stdio: 'inherit' });
          child.unref();
          process.exit(0);
        }
      }
    }
  } catch {}
}

// 6. Main Heartbeat & Command Polling Loop
async function heartbeatAndPoll() {
  const battery = await getBatteryStatus();
  const sys = getSystemTelemetry();

  const payload = {
    id: deviceId,
    name: deviceName,
    hostname,
    platform,
    arch,
    capabilities: ['shell', 'desktop-notify', 'open-url', 'clipboard', 'app-launch', 'screen-lock'],
    telemetry: {
      ...sys,
      batteryPercent: battery.percent,
      isCharging: battery.isCharging,
    },
  };

  try {
    const res = await fetch(serverUrl + '/api/jarvis/satellite/poll', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({ device: payload }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return;

    const data = await res.json();
    const command = data.command;

    if (command) {
      console.log('[Satellite Node] ⚡ Received directive [' + command.type + '] ID: ' + command.id);
      const start = Date.now();
      let executionResult;

      try {
        if (command.type === 'SHELL') {
          const timeout = command.timeoutMs || 25000;
          const { stdout, stderr } = await execAsync(command.command, { timeout, maxBuffer: 2 * 1024 * 1024 });
          executionResult = { success: true, output: stdout.trim() || stderr.trim() || 'Executed with zero output.', exitCode: 0 };
        } else if (command.type === 'ACTION') {
          const res = await executeNativeAction(command.action, command.payload);
          executionResult = { success: res.success, output: res.output, exitCode: 0 };
        } else {
          executionResult = { success: false, output: '', error: 'Unknown command type: ' + command.type, exitCode: 1 };
        }
      } catch (execErr) {
        executionResult = {
          success: false,
          output: execErr.stdout ? String(execErr.stdout).trim() : '',
          error: execErr.stderr ? String(execErr.stderr).trim() : execErr.message,
          exitCode: typeof execErr.code === 'number' ? execErr.code : 1,
        };
      }

      const durationMs = Date.now() - start;

      // Post execution result back
      await fetch(serverUrl + '/api/jarvis/satellite/poll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({
          result: {
            commandId: command.id,
            deviceId,
            success: executionResult.success,
            output: executionResult.output,
            error: executionResult.error,
            exitCode: executionResult.exitCode,
            durationMs,
            executedAt: new Date().toISOString(),
          },
        }),
        signal: AbortSignal.timeout(8000),
      });

      console.log('[Satellite Node] ✅ Completed directive ' + command.id + ' in ' + durationMs + 'ms');
    }
  } catch (err) {
    // Network jitter or brief sleep wake-up
  }

  await checkForRemoteUpdate();
}

// 7. Boot Banner
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║  J.A.R.V.I.S. & F.R.I.D.A.Y. SOVEREIGN SATELLITE (v' + AGENT_VERSION + ')       ║');
console.log('║  Zero-Clone Autonomous Node Active                            ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('• Device ID:    ' + deviceId);
console.log('• Device Name:  ' + deviceName);
console.log('• Host Platform:' + platform + '-' + arch + ' (' + hostname + ')');
console.log('• Central Brain:' + serverUrl);
console.log('• Auto-Update:  ACTIVE (100% cloud-synced, zero git pull required)\\n');

async function runLoop() {
  while (true) {
    await heartbeatAndPoll();
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
}

runLoop().catch(console.error);
`;

export async function GET() {
  return new NextResponse(STANDALONE_SATELLITE_SCRIPT, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'x-satellite-version': SATELLITE_VERSION,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
