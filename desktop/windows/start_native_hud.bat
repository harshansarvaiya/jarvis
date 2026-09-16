@echo off
title J.A.R.V.I.S. Native Windows HUD
cd /d "%~dp0"

echo Launching J.A.R.V.I.S. Native Windows HUD...
powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File "%~dp0jarvis-hud.ps1"
exit
