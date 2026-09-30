import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const INSTALLER_BASH_SCRIPT = `#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════
# J.A.R.V.I.S. & F.R.I.D.A.Y. Sovereign Satellite 1-Liner Installer
# Zero Git Clone • Auto-Updating Daemon • macOS, Linux, Termux
# ═════════════════════════════════════════════════════════════════

set -e

SERVER_URL="\${JARVIS_SERVER:-https://jarvis-iota-beige.vercel.app}"
TOKEN="\${SATELLITE_SECRET:-jarvis-satellite-sovereign-mesh-98e3b1c8f42a67}"
NAME="\${SATELLITE_NAME:-}"
INSTALL_DIR="\$HOME/.jarvis"
SCRIPT_PATH="\$INSTALL_DIR/satellite.js"

echo "🛰️  Connecting to J.A.R.V.I.S. & F.R.I.D.A.Y. Sovereign Mesh..."

# 1. Verify Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is required to run the edge satellite."
  echo "   Install Node.js via: https://nodejs.org or 'brew install node'"
  exit 1
fi

NODE_BIN="\$(command -v node)"
NODE_VER="\$(\$NODE_BIN -v)"
echo "✓ Node.js detected: \$NODE_VER (\$NODE_BIN)"

# 2. Download Latest Standalone Satellite Runtime
mkdir -p "\$INSTALL_DIR"
echo "⬇️  Fetching latest zero-clone agent from \$SERVER_URL/satellite.js..."
curl -fsSL "\$SERVER_URL/satellite.js" -o "\$SCRIPT_PATH"
chmod +x "\$SCRIPT_PATH"

# 3. macOS LaunchAgent Auto-Start Setup (Optional Background Daemon)
if [[ "\$(uname)" == "Darwin" ]] && [[ "\$1" == "--daemon" || "\$DAEMON" == "1" ]]; then
  PLIST_PATH="\$HOME/Library/LaunchAgents/com.jarvis.satellite.plist"
  mkdir -p "\$HOME/Library/LaunchAgents"
  cat <<EOF > "\$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.jarvis.satellite</string>
    <key>ProgramArguments</key>
    <array>
        <string>\$NODE_BIN</string>
        <string>\$SCRIPT_PATH</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>\$INSTALL_DIR/satellite.log</string>
    <key>StandardErrorPath</key>
    <string>\$INSTALL_DIR/satellite.err.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:\$HOME/.nvm/versions/node/\$NODE_VER/bin</string>
    </dict>
</dict>
</plist>
EOF
  launchctl unload "\$PLIST_PATH" 2>/dev/null || true
  launchctl load "\$PLIST_PATH"
  echo "✓ Installed and launched 24/7 background LaunchAgent daemon."
  echo "  Logs: tail -f \$INSTALL_DIR/satellite.log"
  exit 0
fi

# 4. Linux Systemd User Daemon Setup (Optional)
if [[ "\$(uname)" == "Linux" ]] && [[ "\$1" == "--daemon" || "\$DAEMON" == "1" ]]; then
  SYSTEMD_DIR="\$HOME/.config/systemd/user"
  mkdir -p "\$SYSTEMD_DIR"
  cat <<EOF > "\$SYSTEMD_DIR/jarvis-satellite.service"
[Unit]
Description=J.A.R.V.I.S. Sovereign Satellite Daemon
After=network.target

[Service]
Type=simple
ExecStart=\$NODE_BIN \$SCRIPT_PATH
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload 2>/dev/null || true
  systemctl --user enable --now jarvis-satellite.service 2>/dev/null || true
  echo "✓ Installed and activated systemd user daemon (jarvis-satellite.service)."
  exit 0
fi

# 5. Foreground Interactive Launch
EXTRA_ARGS=()
if [[ -n "\$NAME" ]]; then
  EXTRA_ARGS+=(--name "\$NAME")
fi

echo "🚀 Starting satellite agent..."
exec "\$NODE_BIN" "\$SCRIPT_PATH" "\${EXTRA_ARGS[@]}" "\$@"
`;

export async function GET() {
  return new NextResponse(INSTALLER_BASH_SCRIPT, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
