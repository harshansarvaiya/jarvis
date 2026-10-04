/**
 * J.A.R.V.I.S. & F.R.I.D.A.Y. Edge Satellite Client Node
 * 
 * Run this on ANY device (MacBook, Linux desktop, Raspberry Pi, Windows, Android/Termux)
 * to connect it into the sovereign mesh and allow Friday to interact with local hardware.
 * 
 * Usage:
 *   npx tsx scripts/satellite-node.ts --name "Sir's MacBook" --id "macbook-pro"
 * 
 * Environment options (optional):
 *   JARVIS_SERVER=https://jarvis-iota-beige.vercel.app
 *   SATELLITE_SECRET=jarvis-satellite-sovereign-mesh-98e3b1c8f42a67
 */

import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// 1. Configuration & CLI Arguments
const args = process.argv.slice(2);
function getArg(name: string, fallback: string = ''): string {
  const index = args.indexOf(`--${name}`);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return fallback;
}

// Automatically derive device ID and readable name
const hostname = os.hostname();
const platform = os.platform();
const arch = os.arch();

const rawId = getArg('id', process.env.SATELLITE_ID || `sat-${hostname.toLowerCase().replace(/[^a-z0-9]/g, '-')}`);
const deviceId = rawId.startsWith('sat-') ? rawId : `sat-${rawId}`;
const deviceName = getArg('name', process.env.SATELLITE_NAME || `${os.userInfo()?.username || 'Sir'}'s ${platform === 'darwin' ? 'Mac' : platform === 'win32' ? 'PC' : 'Linux'} (${hostname})`);
const serverUrl = (process.env.JARVIS_SERVER || process.env.NEXT_PUBLIC_APP_URL || 'https://jarvis-iota-beige.vercel.app').replace(/\/$/, '');
const token = process.env.SATELLITE_SECRET || process.env.VM_RPC_SECRET || 'jarvis-satellite-sovereign-mesh-98e3b1c8f42a67';

// 2. Hardware Introspection
async function getBatteryStatus(): Promise<{ percent?: number; isCharging?: boolean }> {
  try {
    if (platform === 'darwin') {
      const { stdout } = await execAsync('pmset -g batt');
      const match = stdout.match(/(\d+)%;\s*([^;]+);/);
      if (match) {
        return {
          percent: parseInt(match[1], 10),
          isCharging: match[2].includes('charging') || match[2].includes('AC Power'),
        };
      }
    } else if (platform === 'linux') {
      const capacityPath = '/sys/class/power_supply/BAT0/capacity';
      const statusPath = '/sys/class/power_supply/BAT0/status';
      if (fs.existsSync(capacityPath)) {
        const capacity = parseInt(fs.readFileSync(capacityPath, 'utf8').trim(), 10);
        const status = fs.existsSync(statusPath) ? fs.readFileSync(statusPath, 'utf8').trim() : '';
        return {
          percent: capacity,
          isCharging: status.toLowerCase() === 'charging',
        };
      }
    }
  } catch {}
  return {};
}

function getSystemTelemetry() {
  const totalMem = Math.round(os.totalmem() / (1024 * 1024));
  const freeMem = Math.round(os.freemem() / (1024 * 1024));
  const cpus = os.cpus();
  const uptime = Math.round(os.uptime());

  return {
    totalMemMb: totalMem,
    freeMemMb: freeMem,
    uptimeSeconds: uptime,
    osRelease: `${os.type()} ${os.release()}`,
  };
}

// 3. Native OS Actuators
async function executeNativeAction(action: string, params: any = {}): Promise<{ output: string; success: boolean }> {
  switch (action) {
    case 'OPEN_URL': {
      const url = params.url || params.target;
      if (!url) throw new Error('Missing URL parameter');
      const cmd =
        platform === 'darwin' ? `open "${url}"` : platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`;
      await execAsync(cmd);
      return { success: true, output: `Opened ${url} in default browser.` };
    }

    case 'NOTIFY': {
      const title = (params.title || 'J.A.R.V.I.S. Alert').replace(/"/g, '\\"');
      const message = (params.message || params.text || '').replace(/"/g, '\\"');
      if (platform === 'darwin') {
        await execAsync(`osascript -e 'display notification "${message}" with title "${title}"'`);
      } else if (platform === 'linux') {
        await execAsync(`notify-send "${title}" "${message}"`);
      } else if (platform === 'win32') {
        const psCmd = `powershell -Command "[reflection.assembly]::loadwithpartialname('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('${message}', '${title}')"`;
        await execAsync(psCmd);
      }
      return { success: true, output: `Desktop notification triggered: "${title}"` };
    }

    case 'APP_LAUNCH': {
      const appName = params.appName || params.name;
      if (!appName) throw new Error('Missing appName parameter');
      if (platform === 'darwin') {
        await execAsync(`open -a "${appName}"`);
      } else if (platform === 'linux') {
        await execAsync(`${appName} &`);
      } else {
        await execAsync(`start "" "${appName}"`);
      }
      return { success: true, output: `Launched application "${appName}".` };
    }

    case 'CLIPBOARD_SET': {
      const text = params.text || '';
      if (platform === 'darwin') {
        await execAsync(`echo -n "${text.replace(/"/g, '\\"')}" | pbcopy`);
      } else if (platform === 'linux') {
        await execAsync(`echo -n "${text.replace(/"/g, '\\"')}" | (xclip -selection clipboard 2>/dev/null || wl-copy 2>/dev/null || true)`);
      } else {
        await execAsync(`echo "${text}" | clip`);
      }
      return { success: true, output: `Text copied to system clipboard (${text.length} chars).` };
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
      if (platform === 'darwin') {
        await execAsync('pmset displaysleepnow');
      } else if (platform === 'linux') {
        await execAsync('loginctl lock-session || xdg-screensaver lock || true');
      } else if (platform === 'win32') {
        await execAsync('rundll32.exe user32.dll,LockWorkStation');
      }
      return { success: true, output: 'Host screen locked successfully.' };
    }

    case 'SCREENSHOT': {
      let b64 = '';
      if (platform === 'win32') {
        const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$bmp.Dispose()
$graphics.Dispose()
[Convert]::ToBase64String($ms.ToArray())
`.trim();
        const { stdout } = await execAsync(`powershell -NoProfile -Command "${psScript.replace(/\n/g, '; ')}"`, {
          maxBuffer: 10 * 1024 * 1024,
        });
        b64 = stdout.trim();
      } else if (platform === 'darwin') {
        const tmpPath = path.join(os.tmpdir(), `sat-screen-${Date.now()}.jpg`);
        await execAsync(`screencapture -x -t jpg "${tmpPath}"`);
        if (fs.existsSync(tmpPath)) {
          b64 = fs.readFileSync(tmpPath, { encoding: 'base64' });
          fs.unlinkSync(tmpPath);
        }
      } else {
        const tmpPath = path.join(os.tmpdir(), `sat-screen-${Date.now()}.jpg`);
        await execAsync(`(scrot "${tmpPath}" 2>/dev/null || import -window root "${tmpPath}" 2>/dev/null || true)`);
        if (fs.existsSync(tmpPath)) {
          b64 = fs.readFileSync(tmpPath, { encoding: 'base64' });
          fs.unlinkSync(tmpPath);
        }
      }
      return {
        success: Boolean(b64),
        output: b64 ? `data:image/jpeg;base64,${b64}` : 'Failed to capture screenshot',
      };
    }

    case 'TYPE_TEXT': {
      const text = params.text || '';
      if (!text) throw new Error('Missing text parameter');
      // High-reliability simulated typing via clipboard paste
      if (platform === 'win32') {
        const escaped = text.replace(/"/g, '`"');
        const psCmd = `powershell -NoProfile -Command "Set-Clipboard -Value \\"${escaped}\\"; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`;
        await execAsync(psCmd);
      } else if (platform === 'darwin') {
        const escaped = text.replace(/"/g, '\\"');
        await execAsync(`echo -n "${escaped}" | pbcopy && osascript -e 'tell application "System Events" to keystroke "v" using command down'`);
      } else {
        const escaped = text.replace(/"/g, '\\"');
        await execAsync(`echo -n "${escaped}" | (xclip -selection clipboard 2>/dev/null || wl-copy 2>/dev/null || true) && (xdotool key --clearmodifiers ctrl+v 2>/dev/null || true)`);
      }
      return { success: true, output: `Pasted text into active window (${text.length} chars).` };
    }

    case 'KEYSTROKE': {
      const key = (params.key || '').trim().toUpperCase();
      if (!key) throw new Error('Missing key parameter');
      if (platform === 'win32') {
        // Map common key combos to SendKeys format
        let sendKey = key;
        if (key === 'ENTER') sendKey = '{ENTER}';
        else if (key === 'ESC' || key === 'ESCAPE') sendKey = '{ESC}';
        else if (key === 'TAB') sendKey = '{TAB}';
        else if (key === 'BACKSPACE') sendKey = '{BACKSPACE}';
        else if (key.startsWith('CTRL+')) sendKey = `^${key.replace('CTRL+', '').toLowerCase()}`;
        else if (key.startsWith('ALT+')) sendKey = `%{${key.replace('ALT+', '').toLowerCase()}}`;
        else if (key.startsWith('SHIFT+')) sendKey = `+${key.replace('SHIFT+', '').toLowerCase()}`;
        await execAsync(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${sendKey}')"`);
      } else if (platform === 'darwin') {
        if (key === 'ENTER') {
          await execAsync(`osascript -e 'tell application "System Events" to key code 36'`);
        } else if (key === 'ESC') {
          await execAsync(`osascript -e 'tell application "System Events" to key code 53'`);
        } else if (key.startsWith('CTRL+')) {
          const k = key.replace('CTRL+', '').toLowerCase();
          await execAsync(`osascript -e 'tell application "System Events" to keystroke "${k}" using control down'`);
        } else if (key.startsWith('CMD+')) {
          const k = key.replace('CMD+', '').toLowerCase();
          await execAsync(`osascript -e 'tell application "System Events" to keystroke "${k}" using command down'`);
        } else {
          await execAsync(`osascript -e 'tell application "System Events" to keystroke "${key.toLowerCase()}"'`);
        }
      } else {
        const xKey = key.toLowerCase();
        await execAsync(`xdotool key "${xKey}" 2>/dev/null || true`);
      }
      return { success: true, output: `Dispatched keystroke: [${key}]` };
    }

    case 'SPEAK': {
      const text = (params.text || params.message || 'Alert from Friday').replace(/"/g, '\\"');
      if (platform === 'win32') {
        await execAsync(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.Speak('${text}')"`);
      } else if (platform === 'darwin') {
        await execAsync(`say "${text}"`);
      } else {
        await execAsync(`spd-say "${text}" 2>/dev/null || espeak "${text}" 2>/dev/null || true`);
      }
      return { success: true, output: `Spoke through host audio: "${text}"` };
    }

    case 'REVERSE_ENGINEER': {
      const targetPath = params.target || params.path || '';
      const subAction = params.subAction || params.action || 'analyze';
      const extraArgs = params.args || '';

      if (!targetPath && subAction !== 'doctor') {
        throw new Error('Missing target path parameter for reverse engineering analysis');
      }

      const targetArg = targetPath ? `"${targetPath}"` : '';
      const cmd = `npx --yes rea-agents@latest ${subAction} ${targetArg} ${extraArgs} --json`;

      const timeout = params.timeoutMs || 180000;
      const { stdout, stderr } = await execAsync(cmd, {
        timeout,
        maxBuffer: 20 * 1024 * 1024,
      });

      return {
        success: true,
        output: stdout.trim() || stderr.trim() || 'REA reverse engineering analysis complete.',
      };
    }

    default:
      throw new Error(`Unsupported native action: ${action}`);
  }
}

// 4. Remote Gateway Communication Loop
async function heartbeatAndPoll() {
  const battery = await getBatteryStatus();
  const sys = getSystemTelemetry();

  const payload = {
    id: deviceId,
    name: deviceName,
    hostname,
    platform,
    arch,
    capabilities: [
      'shell',
      'desktop-notify',
      'open-url',
      'clipboard',
      'app-launch',
      'screen-lock',
      'screenshot',
      'keystroke',
      'speak',
      'reverse-engineer',
    ],
    telemetry: {
      ...sys,
      batteryPercent: battery.percent,
      isCharging: battery.isCharging,
    },
  };

  try {
    const res = await fetch(`${serverUrl}/api/jarvis/satellite/poll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        device: payload,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn(`[Satellite Node] Poll status ${res.status}: ${err}`);
      return;
    }

    const data = await res.json();
    const command = data.command;

    if (command) {
      console.log(`[Satellite Node] ⚡ Received directive [${command.type}] ID: ${command.id}`);
      const start = Date.now();
      let executionResult: { output: string; success: boolean; error?: string; exitCode?: number };

      try {
        if (command.type === 'SHELL') {
          const timeout = command.timeoutMs || 25000;
          const { stdout, stderr } = await execAsync(command.command, {
            timeout,
            maxBuffer: 2 * 1024 * 1024,
          });
          executionResult = {
            success: true,
            output: stdout.trim() || stderr.trim() || 'Executed with zero output.',
            exitCode: 0,
          };
        } else if (command.type === 'ACTION') {
          const res = await executeNativeAction(command.action, command.payload);
          executionResult = {
            success: res.success,
            output: res.output,
            exitCode: 0,
          };
        } else {
          executionResult = {
            success: false,
            output: '',
            error: `Unknown command type: ${command.type}`,
            exitCode: 1,
          };
        }
      } catch (execErr: any) {
        executionResult = {
          success: false,
          output: execErr.stdout ? String(execErr.stdout).trim() : '',
          error: execErr.stderr ? String(execErr.stderr).trim() : execErr.message,
          exitCode: typeof execErr.code === 'number' ? execErr.code : 1,
        };
      }

      const durationMs = Date.now() - start;

      // Post execution result back
      await fetch(`${serverUrl}/api/jarvis/satellite/poll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
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
        signal: AbortSignal.timeout(10000),
      });

      console.log(`[Satellite Node] ✅ Completed directive ${command.id} in ${durationMs}ms`);
    }
  } catch (err: any) {
    console.warn(`[Satellite Node] Connection warning (${serverUrl}): ${err.message}`);
  }
}

// 5. Node Banner & Startup
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║  J.A.R.V.I.S. & F.R.I.D.A.Y. SOVEREIGN SATELLITE NODE        ║');
console.log('║  Status: Autonomous Edge Actuator Mesh Active                 ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log(`• Device ID:    ${deviceId}`);
console.log(`• Device Name:  ${deviceName}`);
console.log(`• Hostname:     ${hostname} (${platform}-${arch})`);
console.log(`• Central Mesh: ${serverUrl}`);
console.log(`• Actuators:    Shell, Notifications, URLs, Clipboard, Apps, Screen Lock\n`);

async function runLoop() {
  while (true) {
    await heartbeatAndPoll();
    await new Promise((res) => setTimeout(res, 2500)); // Poll every 2.5 seconds
  }
}

runLoop().catch(console.error);
