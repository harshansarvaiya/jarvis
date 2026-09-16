#!/usr/bin/env bash
# J.A.R.V.I.S. Mark II — Systemd Daemon Installer
# Configures persistent 24/7 background worker daemons on Cloud Runner VM.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

echo "🛡️ Installing J.A.R.V.I.S. Systemd Worker Services..."

# Copy service manifests if sudo is available
if sudo -n true 2>/dev/null; then
  sudo cp "$SCRIPT_DIR/systemd/jarvis-telegram.service" /etc/systemd/system/
  sudo cp "$SCRIPT_DIR/systemd/jarvis-cloud-worker.service" /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable jarvis-telegram.service jarvis-cloud-worker.service
  sudo systemctl restart jarvis-telegram.service jarvis-cloud-worker.service
  echo "✓ Systemd services active and enabled for auto-restart on boot."
else
  echo "⚠️ Sudo credentials required for /etc/systemd/system install. Manifests created at scripts/systemd/."
fi
