@echo off
title J.A.R.V.I.S. Windows Desktop HUD
cd /d "%~dp0"

echo ===================================================
echo   J.A.R.V.I.S. MARK II -- WINDOWS SOVEREIGN HUD
echo ===================================================
echo Checking Python dependencies...
python -m pip install -r requirements.txt --quiet

echo Launching J.A.R.V.I.S. Desktop Sentinel...
start "" pythonw main.py
echo J.A.R.V.I.S. is running in your System Tray!
echo Press [Ctrl + Space] anywhere to invoke the HUD.
