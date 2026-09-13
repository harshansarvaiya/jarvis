# J.A.R.V.I.S. Mark I — Autonomous Launch Script
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       J.A.R.V.I.S. // COGNITIVE EXOSKELETON MARK I      " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " DIRECTIVE 01: Guardian Protocol   - ACTIVE" -ForegroundColor Green
Write-Host " DIRECTIVE 02: Benevolent Alignment- ACTIVE" -ForegroundColor Green
Write-Host " DIRECTIVE 03: Evolutionary Adapt  - ACTIVE" -ForegroundColor Green
Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray

# Ensure node path is in session
$nodePath = "C:\Users\Wissen\AppData\Local\Programs\nodejs"
if (Test-Path "$nodePath\node.exe") {
    if ($env:PATH -notlike "*$nodePath*") {
        $env:PATH = "$nodePath;$env:PATH"
    }
}

# Check Node
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

# Determine local IP for mobile access
$localIp = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi*", "Ethernet*" -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike "169.254*" -and $_.IPAddress -notlike "127.*" } | Select-Object -First 1).IPAddress
if (!$localIp) { $localIp = "localhost" }

Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host " MISSION CONTROL ACCESS:" -ForegroundColor Cyan
Write-Host " > Desktop: http://localhost:3000" -ForegroundColor White
Write-Host " > Phone  : http://${localIp}:3000 (Connect on same Wi-Fi)" -ForegroundColor Yellow
Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "Initiating Next.js Tactical Server..." -ForegroundColor Cyan

& npm run dev -- -H 0.0.0.0 -p 3000
