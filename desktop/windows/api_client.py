"""
J.A.R.V.I.S. Windows Desktop Client — Cryptographic API Transport
Communicates with the Cloud Substrate via Encrypted Bearer Headers.
Directive 01 & 04 Compliant.
"""

import json
import os
import requests
from typing import Dict, Any, Optional

DEFAULT_CONFIG = {
    "api_url": "https://jarvis-iota-beige.vercel.app/api/jarvis/shortcut",
    "auth_token": "sk_jarvis_mobile_sovereign_2026_apex",
    "global_hotkey": "ctrl+space",
    "friday_hotkey": "ctrl+shift+f",
    "auto_copy_clipboard": True,
}


def load_config() -> Dict[str, Any]:
    config_path = os.path.join(os.path.dirname(__file__), "config.json")
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                return {**DEFAULT_CONFIG, **json.load(f)}
        except Exception:
            pass
    return DEFAULT_CONFIG


class JarvisApiClient:
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or load_config()
        self.api_url = self.config.get("api_url", DEFAULT_CONFIG["api_url"])
        self.token = self.config.get("auth_token", DEFAULT_CONFIG["auth_token"])

    def send_directive(self, prompt: str, is_voice: bool = False) -> Dict[str, Any]:
        """
        Sends a directive to the J.A.R.V.I.S. Cloud Edge using encrypted Bearer headers.
        """
        if not prompt or not prompt.strip():
            return {
                "status": "error",
                "reply": "Empty prompt provided, Sir.",
                "spokenText": "Empty prompt provided.",
            }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.token}",
        }

        payload = {
            "prompt": prompt.strip(),
            "isVoice": is_voice,
        }

        try:
            res = requests.post(
                self.api_url,
                headers=headers,
                json=payload,
                timeout=30,
            )

            if res.status_code == 200:
                return res.json()
            elif res.status_code == 401:
                return {
                    "status": "error",
                    "reply": "🚨 [Directive 01 Security Alert]: Authentication failed. Invalid Bearer Token.",
                    "spokenText": "Authentication failed. Access denied.",
                }
            else:
                return {
                    "status": "error",
                    "reply": f"Cognitive bridge returned HTTP {res.status_code}: {res.text[:200]}",
                    "spokenText": "Error communicating with cloud core.",
                }
        except requests.exceptions.Timeout:
            return {
                "status": "error",
                "reply": "Cognitive latency timeout. The cloud runner is processing complex operations.",
                "spokenText": "Request timed out, Sir.",
            }
        except Exception as e:
            return {
                "status": "error",
                "reply": f"Network transmission error: {str(e)}",
                "spokenText": "Network error, Sir.",
            }
