# J.A.R.V.I.S. Mark I — Autonomous Launch Script
param(
    [switch]$Global
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       J.A.R.V.I.S. // COGNITIVE EXOSKELETON MARK I      " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " DIRECTIVE 01: Guardian Protocol    - ACTIVE" -ForegroundColor Green
Write-Host " DIRECTIVE 02: Benevolent Alignment - ACTIVE" -ForegroundColor Green
Write-Host " DIRECTIVE 03: Evolutionary Adapt   - ACTIVE" -ForegroundColor Green
Write-Host " DIRECTIVE 04: Sovereign Loyalty    - ACTIVE" -ForegroundColor Yellow
Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray

# Ensure node and cloudflared paths are in session
$nodePath = "C:\Users\Wissen\AppData\Local\Programs\nodejs"
$cloudPath = "C:\Users\Wissen\AppData\Local\Programs\cloudflared"

if (Test-Path "$nodePath\node.exe") {
    if ($env:PATH -notlike "*$nodePath*") {
        $env:PATH = "$nodePath;$env:PATH"
    }
}
if (Test-Path "$cloudPath\cloudflared.exe") {
    if ($env:PATH -notlike "*$cloudPath*") {
        $env:PATH = "$cloudPath;$env:PATH"
    }
}

# Check Node runtime
try {
    $nodeVer = & node --version
    Write-Host "Runtime: Node.js $nodeVer online." -ForegroundColor Gray
} catch {
    Write-Host "Error: Node.js runtime not found." -ForegroundColor Red
    exit 1
}

# Install dependencies if missing
if (!(Test-Path "node_modules")) {
    Write-Host "Synthesizing project dependencies (npm install)..." -ForegroundColor Yellow
    & npm install
}

# Determine local IP for mobile access on home Wi-Fi
$localIp = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi*", "Ethernet*" -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike "169.254*" -and $_.IPAddress -notlike "127.*" } | Select-Object -First 1).IPAddress
if (!$localIp) { $localIp = "localhost" }

Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host " MISSION CONTROL LOCAL ACCESS:" -ForegroundColor Cyan
Write-Host " > Desktop: http://localhost:3000" -ForegroundColor White
Write-Host " > Local Phone (Wi-Fi): http://${localIp}:3000" -ForegroundColor White

if ($Global) {
    Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host " ENGAGING GLOBAL WORLDWIDE QUANTUM TUNNEL..." -ForegroundColor Yellow
    
    # Start the tunnel manager in the background
    $tunnelJob = Start-Job -ScriptBlock {
        param($dir, $np, $cp)
        $env:PATH = "$np;$cp;$env:PATH"
        Set-Location $dir
        node ./lib/tunnel-manager.js
    } -ArgumentList $PSScriptRoot, $nodePath, $cloudPath

    # Stream tunnel manager output until URL is displayed
    Start-Sleep -Seconds 3
    Receive-Job -Job $tunnelJob
} else {
    Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host " TIP: For remote phone access anywhere (outside home Wi-Fi):" -ForegroundColor Gray
    Write-Host "      Run: ./start-jarvis.ps1 -Global" -ForegroundColor Yellow
}

Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "Initiating Next.js Tactical Server..." -ForegroundColor Cyan

& npm run dev -- -H 0.0.0.0 -p 3000
