@echo off
title J.A.R.V.I.S. Native Windows HUD
cd /d "%~dp0"

echo Launching J.A.R.V.I.S. Native Windows HUD...
powershell.exe -STA -NoProfile -ExecutionPolicy Bypass -File "%~dp0jarvis-hud.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ===================================================
    echo  Execution encountered an issue. See details above.
    echo ===================================================
    pause
)
