#!/usr/bin/env bash
# J.A.R.V.I.S. & F.R.I.D.A.Y. - Software Symbiote Launcher (macOS / Linux)
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "==============================================================="
echo "    J.A.R.V.I.S. & F.R.I.D.A.Y. SOVEREIGN SOFTWARE SYMBIOTE    "
echo "==============================================================="
echo " Phase Zero Link: Eyes, Ears, Keystrokes, and Host Actuation   "
echo " Connected Mesh: https://jarvis-iota-beige.vercel.app          "
echo "==============================================================="

npx tsx scripts/satellite-node.ts --name "Sir's Workstation" --id "workstation-apex"
