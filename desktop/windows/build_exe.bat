@echo off
title Build J.A.R.V.I.S. Standalone Windows Executable (.exe)
cd /d "%~dp0"

echo ===================================================
echo   Building J.A.R.V.I.S. Standalone Windows .exe
echo ===================================================
echo Installing PyInstaller and dependencies...
python -m pip install -r requirements.txt pyinstaller

echo Compiling jarvis-hud.exe...
pyinstaller --noconsole --onefile --name "jarvis-hud" main.py

echo.
echo Build complete! Executable is located at:
echo %~dp0dist\jarvis-hud.exe
pause
