"""
J.A.R.V.I.S. Windows Desktop HUD — Sovereign Background Sentinel Entrypoint
Provides:
1. Global system-wide hotkeys (Ctrl+Space to toggle HUD, Ctrl+Shift+F for Friday Clipboard Fix)
2. Background System Tray Icon & Menu
3. Standalone, zero-dependency execution
"""

import sys
import os
import threading
import keyboard
import pystray
from PIL import Image, ImageDraw
from hud_window import JarvisHudWindow
from api_client import load_config


def create_tray_icon_image():
    """Generates a dynamic 64x64 J.A.R.V.I.S. Cyberpunk Tray Icon in memory"""
    img = Image.new("RGBA", (64, 64), color=(0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Outer Glowing Cyan Ring (Arc Reactor aesthetic)
    draw.ellipse([4, 4, 60, 60], outline="#00f0ff", width=4)
    # Inner Solid Cyan Core
    draw.ellipse([20, 20, 44, 44], fill="#00f0ff")
    return img


class JarvisDesktopApp:
    def __init__(self):
        self.config = load_config()
        self.hud = JarvisHudWindow(on_hide_callback=self.on_hud_hide)
        self.is_visible = True

        # Setup System Tray
        self.tray_icon = None
        self._setup_tray()

        # Register Global System-wide Hotkeys
        self._setup_hotkeys()

    def _setup_hotkeys(self):
        main_hotkey = self.config.get("global_hotkey", "ctrl+space")
        friday_hotkey = self.config.get("friday_hotkey", "ctrl+shift+f")

        try:
            keyboard.add_hotkey(main_hotkey, self.toggle_hud)
            keyboard.add_hotkey(friday_hotkey, self.quick_friday_fix)
            print(f"[J.A.R.V.I.S. Desktop] 🚀 Global hotkey locked: [{main_hotkey}] (HUD)")
            print(f"[J.A.R.V.I.S. Desktop] 🛡️ Friday quick-fix hotkey locked: [{friday_hotkey}]")
        except Exception as e:
            print(f"[J.A.R.V.I.S. Desktop] ⚠️ Global hotkey registration warning: {e}")

    def _setup_tray(self):
        icon_img = create_tray_icon_image()
        menu = pystray.Menu(
            pystray.MenuItem("⚡ Open Command HUD", self.show_hud, default=True),
            pystray.MenuItem("📊 Executive Briefing", lambda: self.dispatch_action("Give me an executive briefing.")),
            pystray.MenuItem("🎯 Task Radar", lambda: self.dispatch_action("List all active radar tasks.")),
            pystray.MenuItem("🛡️ Security Audit", lambda: self.dispatch_action("Run a security audit.")),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("❌ Exit J.A.R.V.I.S.", self.quit_app),
        )
        self.tray_icon = pystray.Icon("JARVIS", icon_img, "J.A.R.V.I.S. Mark II", menu)
        threading.Thread(target=self.tray_icon.run, daemon=True).start()

    def toggle_hud(self):
        self.hud.after(0, self._do_toggle_hud)

    def _do_toggle_hud(self):
        if self.hud.winfo_viewable():
            self.hud.hide_hud()
            self.is_visible = False
        else:
            self.hud.show_hud()
            self.is_visible = True

    def show_hud(self):
        self.hud.after(0, self.hud.show_hud)
        self.is_visible = True

    def on_hud_hide(self):
        self.is_visible = False

    def quick_friday_fix(self):
        self.hud.after(0, self._do_quick_friday_fix)

    def _do_quick_friday_fix(self):
        self.hud.show_hud()
        self.hud.dispatch_clipboard()

    def dispatch_action(self, prompt: str):
        self.hud.after(0, lambda: self._do_dispatch(prompt))

    def _do_dispatch(self, prompt: str):
        self.hud.show_hud()
        self.hud.dispatch_preset(prompt)

    def quit_app(self):
        if self.tray_icon:
            self.tray_icon.stop()
        self.hud.after(0, self.hud.destroy)
        sys.exit(0)

    def run(self):
        print("╔═══════════════════════════════════════════════════════════════╗")
        print("║  J.A.R.V.I.S. MARK II — WINDOWS SOVEREIGN DESKTOP HUD        ║")
        print("║  Mode: Native Global Hotkey (Ctrl+Space) & Tray Sentinel     ║")
        print("╚═══════════════════════════════════════════════════════════════╝\n")
        self.hud.mainloop()


if __name__ == "__main__":
    app = JarvisDesktopApp()
    app.run()
