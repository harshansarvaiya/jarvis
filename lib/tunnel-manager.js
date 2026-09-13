const fs = require('fs');
const path = require('path');

// Helper to load .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key] && val) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

let qrcode = null;
try {
  qrcode = require('qrcode-terminal');
} catch (e) {
  // Optional fallback if not yet installed
}

function saveActiveTunnel(url, provider) {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, 'active-tunnel.json'),
    JSON.stringify({ url, provider, activeAt: new Date().toISOString() }, null, 2)
  );
}

function printBanner(url, providerName) {
  console.log('\n\x1b[32m%s\x1b[0m', '========================================================================');
  console.log('\x1b[36m%s\x1b[0m', '           J.A.R.V.I.S. UBIQUITOUS WORLDWIDE UPLINK ACTIVE              ');
  console.log('\x1b[32m%s\x1b[0m', '========================================================================');
  console.log('\x1b[33m%s\x1b[0m', ` > PERMANENT SECURE HTTPS : ${url}`);
  console.log('\x1b[35m%s\x1b[0m', ' > GUARDIAN PASSCODE      : 1010 (Enter to unlock on remote phone)');
  console.log('\x1b[34m%s\x1b[0m', ` > UPLINK PROTOCOL        : ${providerName.toUpperCase()}`);
  console.log('\x1b[32m%s\x1b[0m', '------------------------------------------------------------------------');
  console.log('\x1b[36m%s\x1b[0m', ' > SCAN QR CODE WITH YOUR PHONE CAMERA TO CONNECT FROM ANYWHERE:');

  if (qrcode) {
    qrcode.generate(url, { small: true });
  }

  console.log('\x1b[32m%s\x1b[0m', '========================================================================\n');
}

async function startNgrok() {
  const authtoken = process.env.NGROK_AUTHTOKEN;
  const domain = process.env.NGROK_DOMAIN;

  if (!authtoken) {
    throw new Error('NGROK_AUTHTOKEN not configured');
  }

  console.log('\x1b[36m%s\x1b[0m', '>> Initiating J.A.R.V.I.S. Permanent Worldwide Quantum Uplink via Ngrok...');

  const ngrok = require('@ngrok/ngrok');
  const opts = {
    addr: 3000,
    authtoken: authtoken,
  };
  if (domain) {
    opts.domain = domain;
  }

  const listener = await ngrok.forward(opts);
  const tunnelUrl = listener.url();

  saveActiveTunnel(tunnelUrl, 'ngrok');
  printBanner(tunnelUrl, 'Ngrok Permanent Static Edge');

  process.on('SIGINT', async () => {
    try {
      await listener.close();
    } catch (e) {}
    process.exit(0);
  });
}

function startCloudflare() {
  const { spawn } = require('child_process');
  
  let executable = 'cloudflared';
  const candidates = [
    'cloudflared',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'cloudflared', 'cloudflared.exe'),
    path.join(process.env.ProgramFiles || '', 'cloudflared', 'cloudflared.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'cloudflared', 'cloudflared.exe'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      executable = c;
      break;
    }
  }

  console.log('\x1b[36m%s\x1b[0m', '>> Initiating J.A.R.V.I.S. Fallback Worldwide Tunnel via Cloudflare...');

  const tunnel = spawn(executable, ['tunnel', '--url', 'http://localhost:3000'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let tunnelUrl = null;
  const urlRegex = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/;

  function handleOutput(data) {
    const text = data.toString();
    if (!tunnelUrl) {
      const match = text.match(urlRegex);
      if (match) {
        tunnelUrl = match[0];
        saveActiveTunnel(tunnelUrl, 'cloudflare');
        printBanner(tunnelUrl, 'Cloudflare Ephemeral Edge');
      }
    }
  }

  tunnel.stdout.on('data', handleOutput);
  tunnel.stderr.on('data', handleOutput);

  tunnel.on('close', (code) => {
    console.log(`\x1b[31mCloudflare tunnel disconnected (exit code ${code})\x1b[0m`);
  });

  process.on('SIGINT', () => {
    tunnel.kill();
    process.exit(0);
  });
}

async function main() {
  if (process.env.NGROK_AUTHTOKEN) {
    try {
      await startNgrok();
      return;
    } catch (err) {
      console.warn('\x1b[33m%s\x1b[0m', `Ngrok uplink warning: ${err.message}. Attempting Cloudflare fallback...`);
    }
  }
  startCloudflare();
}

main();
