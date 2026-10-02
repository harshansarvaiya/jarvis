@echo off
title J.A.R.V.I.S. & F.R.I.D.A.Y. - Software Symbiote Node
color 0B
cls

echo ===============================================================
echo     J.A.R.V.I.S. ^& F.R.I.D.A.Y. SOVEREIGN SOFTWARE SYMBIOTE
echo ===============================================================
echo  Phase Zero Link: Eyes, Ears, Keystrokes, and Host Actuation
echo  Connected Mesh: https://jarvis-iota-beige.vercel.app
echo ===============================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in your PATH.
    echo Please install Node.js (https://nodejs.org) to run the symbiote.
    pause
    exit /b 1
)

echo [*] Initializing Sovereign Satellite Mesh...
cd /d "%~dp0\.."

npx tsx scripts/satellite-node.ts --name "Sir's Workstation" --id "workstation-apex"

pause
