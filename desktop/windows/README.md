# J.A.R.V.I.S. Mark II — Sovereign Windows Desktop HUD

A lightweight, standalone, borderless floating command HUD and System Tray Sentinel for Windows.

---

## ⚡ Key Features

1. **Global Hotkey (`Ctrl + Space`)**:
   - Press `Ctrl + Space` anywhere in Windows (over VS Code, Windows Terminal, Chrome, etc.) to toggle the HUD.
   - Press `Escape` to instantly dismiss the HUD.
2. **Smart Clipboard & Error Fix (`Ctrl + Shift + F`)**:
   - Highlight any error or broken code on your screen and press `Ctrl + Shift + F`.
   - F.R.I.D.A.Y. automatically grabs the clipboard, runs deep cognitive analysis, and outputs the verified fix.
3. **Quick Action Pills**:
   - `[📊 Briefing]` — Instant executive radar overview.
   - `[🎯 Radar]` — Active tasks & priorities.
   - `[🛡️ Security Audit]` — Full system and infrastructure scan.
   - `[⚡ Groq 120B]` — Switch to 100ms reflex tier.
4. **Encrypted Transport**:
   - Pre-configured with your 256-bit encrypted Bearer Token (`sk_jarvis_mobile_sovereign_2026_apex`) over TLS 1.3.

---

## 🚀 How to Run on Windows (2 Steps)

### Option 1: 1-Click Launch (Recommended)
Double-click `start_hud.bat`.

### Option 2: Command Line
```powershell
cd desktop/windows
pip install -r requirements.txt
python main.py
```

### Option 3: Compile into a Standalone `.exe`
Double-click `build_exe.bat`.
The standalone binary will be created at `dist/jarvis-hud.exe` (can be pinned to Taskbar or Windows Startup folder).

---

## ⚙️ Configuration (`config.json`)

```json
{
  "api_url": "https://jarvis-iota-beige.vercel.app/api/jarvis/shortcut",
  "auth_token": "sk_jarvis_mobile_sovereign_2026_apex",
  "global_hotkey": "ctrl+space",
  "friday_hotkey": "ctrl+shift+f",
  "always_on_top": true
}
```
