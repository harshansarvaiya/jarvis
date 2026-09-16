"""
J.A.R.V.I.S. Windows Desktop HUD — Sovereign Floating Command Palette
Designed with Cyberpunk HUD Dark Aesthetics (Cyan Glow & Carbon Surface).
"""

import threading
import tkinter as tk
import customtkinter as ctk
import pyperclip
from typing import Callable, Optional
from api_client import JarvisApiClient, load_config

# Set HUD Dark Theme
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("dark-blue")

# HUD Cyberpunk Color Palette
COLOR_BG = "#0a0e17"
COLOR_SURFACE = "#111927"
COLOR_SURFACE_LIGHT = "#1b2537"
COLOR_CYAN = "#00f0ff"
COLOR_CYAN_DIM = "#008899"
COLOR_TEXT = "#e2e8f0"
COLOR_TEXT_MUTED = "#8b949e"
COLOR_GREEN = "#00ff9d"
COLOR_BORDER = "#1f2d42"


class JarvisHudWindow(ctk.CTk):
    def __init__(self, on_hide_callback: Optional[Callable[[], None]] = None):
        super().__init__()
        self.config = load_config()
        self.api_client = JarvisApiClient(self.config)
        self.on_hide_callback = on_hide_callback
        self.is_processing = False

        # Configure Window Properties
        self.title("J.A.R.V.I.S. Command HUD")
        self.geometry(f"{self.config.get('window_width', 720)}x{self.config.get('window_height', 520)}")
        self.configure(fg_color=COLOR_BG)
        
        # Frameless, Always on Top, Centered
        self.overrideredirect(True)
        if self.config.get("always_on_top", True):
            self.attributes("-topmost", True)

        self._center_window()
        self._build_ui()
        self._bind_events()

    def _center_window(self):
        self.update_idletasks()
        width = self.config.get("window_width", 720)
        height = self.config.get("window_height", 520)
        x = (self.winfo_screenwidth() // 2) - (width // 2)
        y = (self.winfo_screenheight() // 3) - (height // 3)
        self.geometry(f"{width}x{height}+{x}+{y}")

    def _build_ui(self):
        # Outer Border Container (Glowing Cyan Edge)
        self.outer_frame = ctk.CTkFrame(
            self,
            fg_color=COLOR_BG,
            border_color=COLOR_CYAN_DIM,
            border_width=1,
            corner_radius=12,
        )
        self.outer_frame.pack(fill="both", expand=True, padx=2, pady=2)

        # 1. Header Bar (Status, Telemetry & Close)
        self.header = ctk.CTkFrame(self.outer_frame, fg_color="transparent", height=36)
        self.header.pack(fill="x", padx=16, pady=(12, 6))

        self.title_label = ctk.CTkLabel(
            self.header,
            text="⚡ J.A.R.V.I.S. MARK II  //  SOVEREIGN HUD",
            font=ctk.CTkFont(family="Segoe UI", size=12, weight="bold"),
            text_color=COLOR_CYAN,
        )
        self.title_label.pack(side="left")

        self.status_badge = ctk.CTkLabel(
            self.header,
            text="● ONLINE",
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            text_color=COLOR_GREEN,
        )
        self.status_badge.pack(side="left", padx=12)

        self.esc_hint = ctk.CTkLabel(
            self.header,
            text="[ESC] Hide  |  [ENTER] Execute",
            font=ctk.CTkFont(family="Segoe UI", size=10),
            text_color=COLOR_TEXT_MUTED,
        )
        self.esc_hint.pack(side="right")

        # 2. Main Command Input Box
        self.input_frame = ctk.CTkFrame(self.outer_frame, fg_color=COLOR_SURFACE, corner_radius=8)
        self.input_frame.pack(fill="x", padx=16, pady=6)

        self.prompt_entry = ctk.CTkEntry(
            self.input_frame,
            placeholder_text="Type directive, ask Friday, or query tactical radar...",
            font=ctk.CTkFont(family="Segoe UI", size=14),
            text_color=COLOR_TEXT,
            fg_color="transparent",
            border_width=0,
            height=44,
        )
        self.prompt_entry.pack(fill="x", padx=12, pady=4)

        # 3. Tactical Action Pills
        self.actions_frame = ctk.CTkFrame(self.outer_frame, fg_color="transparent")
        self.actions_frame.pack(fill="x", padx=16, pady=4)

        self._create_action_pill(self.actions_frame, "📊 Briefing", lambda: self.dispatch_preset("Give me an executive briefing on all active systems, tasks, and radar."))
        self._create_action_pill(self.actions_frame, "🎯 Radar", lambda: self.dispatch_preset("List all active radar tasks and priorities."))
        self._create_action_pill(self.actions_frame, "🛡️ Security Audit", lambda: self.dispatch_preset("Run a comprehensive security audit of our infrastructure and codebase."))
        self._create_action_pill(self.actions_frame, "⚡ Groq 120B", lambda: self.dispatch_preset("/groq Report reflex tier status."))
        self._create_action_pill(self.actions_frame, "📋 Analyze Clipboard", self.dispatch_clipboard)

        # 4. Output Display Area
        self.output_box = ctk.CTkTextbox(
            self.outer_frame,
            font=ctk.CTkFont(family="Consolas", size=12),
            text_color=COLOR_TEXT,
            fg_color=COLOR_SURFACE,
            border_color=COLOR_BORDER,
            border_width=1,
            corner_radius=8,
            wrap="word",
        )
        self.output_box.pack(fill="both", expand=True, padx=16, pady=8)
        self.output_box.insert("0.0", "J.A.R.V.I.S. Substrate Initialized.\nReady for sovereign directives, Sir.\n")

        # 5. Footer (Telemetry & Action Buttons)
        self.footer = ctk.CTkFrame(self.outer_frame, fg_color="transparent", height=32)
        self.footer.pack(fill="x", padx=16, pady=(4, 12))

        self.telemetry_label = ctk.CTkLabel(
            self.footer,
            text="Latency: 0ms  |  Engine: Standby",
            font=ctk.CTkFont(family="Segoe UI", size=10),
            text_color=COLOR_TEXT_MUTED,
        )
        self.telemetry_label.pack(side="left")

        self.copy_btn = ctk.CTkButton(
            self.footer,
            text="📋 Copy Output",
            width=90,
            height=24,
            font=ctk.CTkFont(family="Segoe UI", size=10, weight="bold"),
            fg_color=COLOR_SURFACE_LIGHT,
            hover_color=COLOR_BORDER,
            text_color=COLOR_TEXT,
            command=self.copy_output,
        )
        self.copy_btn.pack(side="right", padx=4)

    def _create_action_pill(self, parent, text: str, command: Callable[[], None]):
        btn = ctk.CTkButton(
            parent,
            text=text,
            width=105,
            height=26,
            font=ctk.CTkFont(family="Segoe UI", size=11),
            fg_color=COLOR_SURFACE,
            hover_color=COLOR_SURFACE_LIGHT,
            border_color=COLOR_BORDER,
            border_width=1,
            text_color=COLOR_CYAN,
            corner_radius=13,
            command=command,
        )
        btn.pack(side="left", padx=3)

    def _bind_events(self):
        self.prompt_entry.bind("<Return>", lambda e: self.on_submit())
        self.bind("<Escape>", lambda e: self.hide_hud())

        # Enable window dragging by clicking the header
        self.header.bind("<Button-1>", self._start_move)
        self.header.bind("<B1-Motion>", self._do_move)
        self.title_label.bind("<Button-1>", self._start_move)
        self.title_label.bind("<B1-Motion>", self._do_move)

    def _start_move(self, event):
        self._x = event.x
        self._y = event.y

    def _do_move(self, event):
        deltax = event.x - self._x
        deltay = event.y - self._y
        x = self.winfo_x() + deltax
        y = self.winfo_y() + deltay
        self.geometry(f"+{x}+{y}")

    def show_hud(self):
        self.deiconify()
        self.attributes("-topmost", True)
        self.prompt_entry.focus_set()

    def hide_hud(self):
        self.withdraw()
        if self.on_hide_callback:
            self.on_hide_callback()

    def on_submit(self):
        prompt = self.prompt_entry.get().strip()
        if not prompt or self.is_processing:
            return
        self.execute_prompt(prompt)

    def dispatch_preset(self, text: str):
        self.prompt_entry.delete(0, "end")
        self.prompt_entry.insert(0, text)
        self.execute_prompt(text)

    def dispatch_clipboard(self):
        try:
            clip = pyperclip.paste().strip()
            if clip:
                directive = f"Analyze this clipboard content / error:\n\n```\n{clip[:1500]}\n```"
                self.prompt_entry.delete(0, "end")
                self.prompt_entry.insert(0, "Analyze Clipboard Context")
                self.execute_prompt(directive)
            else:
                self.output_box.delete("0.0", "end")
                self.output_box.insert("0.0", "Clipboard is currently empty, Sir.")
        except Exception as e:
            self.output_box.insert("0.0", f"Clipboard error: {str(e)}")

    def execute_prompt(self, prompt: str):
        self.is_processing = True
        self.status_badge.configure(text="● THINKING...", text_color=COLOR_CYAN)
        self.output_box.delete("0.0", "end")
        self.output_box.insert("0.0", f"⚡ Executing directive: \"{prompt[:60]}...\"\nTransmitting to J.A.R.V.I.S. Core...\n\n")

        # Run API request in background thread to prevent UI lockup
        threading.Thread(target=self._worker_execute, args=(prompt,), daemon=True).start()

    def _worker_execute(self, prompt: str):
        result = self.api_client.send_directive(prompt)
        
        # Update UI on main thread
        self.after(0, self._render_result, result)

    def _render_result(self, result: dict):
        self.is_processing = False
        self.status_badge.configure(text="● ONLINE", text_color=COLOR_GREEN)

        reply = result.get("reply", "No response received.")
        telemetry = result.get("telemetry", {})
        latency = telemetry.get("latencyMs", 0) if telemetry else 0
        engine = telemetry.get("engineUsed", "Cloud Engine") if telemetry else "Cloud"

        self.output_box.delete("0.0", "end")
        self.output_box.insert("0.0", reply)

        self.telemetry_label.configure(text=f"Latency: {latency}ms  |  Engine: {engine}")

    def copy_output(self):
        text = self.output_box.get("0.0", "end").strip()
        if text:
            pyperclip.copy(text)
            self.copy_btn.configure(text="✅ Copied!")
            self.after(1500, lambda: self.copy_btn.configure(text="📋 Copy Output"))
