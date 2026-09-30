import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const POWERSHELL_INSTALLER = `# ═════════════════════════════════════════════════════════════════
# J.A.R.V.I.S. & F.R.I.D.A.Y. Sovereign Satellite Windows PowerShell Installer
# Zero-Clone • Windows 10/11 Enterprise & Office Compatible
# ═════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

$serverUrl = if ($env:JARVIS_SERVER) { $env:JARVIS_SERVER } else { "https://jarvis-iota-beige.vercel.app" }
$installDir = Join-Path $HOME ".jarvis"
$scriptPath = Join-Path $installDir "satellite.js"

Write-Host "🛰️ Connecting to J.A.R.V.I.S. & F.R.I.D.A.Y. Sovereign Mesh (Windows)..." -ForegroundColor Cyan

# 1. Check for Node.js
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "❌ Node.js is required to run the satellite node on Windows." -ForegroundColor Red
    Write-Host "   Please download Node.js from https://nodejs.org or run: winget install OpenJS.NodeJS.LTS" -ForegroundColor Yellow
    exit 1
}

$nodeVer = & node -v
Write-Host "✓ Node.js detected: $nodeVer ($($nodeCmd.Source))" -ForegroundColor Green

# 2. Download Standalone Node Satellite Script
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

Write-Host "⬇️ Fetching latest zero-clone agent from $serverUrl/satellite.js..." -ForegroundColor Gray
Invoke-WebRequest -Uri "$serverUrl/satellite.js" -OutFile $scriptPath -UseBasicParsing

# 3. Launch Satellite Node
$deviceName = if ($env:SATELLITE_NAME) { $env:SATELLITE_NAME } else { "Office Workstation" }
Write-Host "🚀 Launching satellite agent as '$deviceName'..." -ForegroundColor Green

& node "$scriptPath" --name "$deviceName"
`;

export async function GET() {
  return new NextResponse(POWERSHELL_INSTALLER, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
