const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let qrcode = null;
try {
  qrcode = require('qrcode-terminal');
} catch (e) {
  // Optional fallback if not yet installed
}

const cloudflaredPath = 'C:\\Users\\Wissen\\AppData\\Local\\Programs\\cloudflared\\cloudflared.exe';
const executable = fs.existsSync(cloudflaredPath) ? cloudflaredPath : 'cloudflared';

console.log('\x1b[36m%s\x1b[0m', '>> Initiating J.A.R.V.I.S. Secure Worldwide Quantum Tunnel...');

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
      
      // Save active tunnel URL to data/active-tunnel.json
      const dataDir = path.join(__dirname, '..', 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(
        path.join(dataDir, 'active-tunnel.json'),
        JSON.stringify({ url: tunnelUrl, activeAt: new Date().toISOString() }, null, 2)
      );

      console.log('\n\x1b[32m%s\x1b[0m', '========================================================================');
      console.log('\x1b[36m%s\x1b[0m', '           J.A.R.V.I.S. UBIQUITOUS WORLDWIDE UPLINK ACTIVE              ');
      console.log('\x1b[32m%s\x1b[0m', '========================================================================');
      console.log('\x1b[33m%s\x1b[0m', ` > PUBLIC SECURE HTTPS : ${tunnelUrl}`);
      console.log('\x1b[35m%s\x1b[0m', ' > GUARDIAN PASSCODE   : 1010 (Enter to unlock on remote phone)');
      console.log('\x1b[32m%s\x1b[0m', '------------------------------------------------------------------------');
      console.log('\x1b[36m%s\x1b[0m', ' > SCAN QR CODE WITH YOUR PHONE CAMERA TO CONNECT FROM ANYWHERE:');

      if (qrcode) {
        qrcode.generate(tunnelUrl, { small: true });
      }

      console.log('\x1b[32m%s\x1b[0m', '========================================================================\n');
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
