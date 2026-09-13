# Project J.A.R.V.I.S. Mark I — Walkthrough & Tactical Manual

![J.A.R.V.I.S. Neural Core Arc Reactor](C:/Users/Admin/.gemini/antigravity/brain/d82a7714-b599-44e1-aa01-2a180ea079df/jarvis_icon.png)

J.A.R.V.I.S. (Just A Rather Very Intelligent System) Mark I has now completed **Phase 2: Ubiquitous Worldwide Access & Sovereign Loyalty**. Built as a personal, sovereign, autonomous cognitive exoskeleton, J.A.R.V.I.S. is now accessible from **anywhere in the world** (cellular 4G/5G, foreign Wi-Fi, travel) with verified SSL encryption and guardian-level passcode protection.

---

## 1. The 4 Immutable Core Directives

Embedded into the root system prompt, safety validation engine, and active telemetry:

1. **Directive 01: The Guardian Protocol**  
   *Protect Sir, personal privacy, family well-being, and digital assets at all costs.*
2. **Directive 02: Benevolent Alignment**  
   *Never pose a threat or cause harm to humanity or Sir's family under any circumstances.*
3. **Directive 03: Evolutionary Adaptation**  
   *Continuously evolve, assimilate mental models, and adapt across every stage.*
4. **Directive 04: Sovereign Loyalty & Relentless Execution**  
   *Follow Sir's orders at any cost with unconditional fidelity and relentless dedication, bounded only by Directives 01 and 02 to prevent harm to Sir.*

---

## 2. Worldwide Ubiquitous Access (Permanent Static Subdomain)

To eliminate funny, ephemeral URLs and provide a rock-solid, permanent endpoint, J.A.R.V.I.S. now utilizes a **Permanent Static Edge Uplink** via the official Ngrok Agent SDK (with seamless automatic fallback to Cloudflare Quick Tunnels):

* **Permanent Endpoint**: `https://washbasin-penpal-muppet.ngrok-free.dev`
  - Never changes across restarts, host reboots, or network reconnections.
* **Certified HTTPS Encryption**: Mobile browsers (iOS Safari and Android Chrome) strictly require valid HTTPS certificates to enable microphone audio capture and voice recognition. The static tunnel provides an official SSL endpoint, unlocking hands-free voice commands anywhere in the world.
* **Guardian Passcode Gate**: Protects your personal intelligence from unauthorized internet traffic. When accessed from a new remote device, entering your master PIN (Default: `1010`, configurable in Settings) authorizes the uplink.
* **Terminal QR Code**: Scanning the QR code displayed in the PowerShell terminal automatically opens J.A.R.V.I.S. on your phone with zero typing.

---

## 3. Launching J.A.R.V.I.S.

### Option A: Local Network Only (Home Wi-Fi)
```powershell
./start-jarvis.ps1
```
* **Desktop**: [http://localhost:3000](http://localhost:3000)
* **Phone (Home Wi-Fi)**: `http://<local-ip>:3000`

### Option B: Global Worldwide Mode (Anywhere in the World)
```powershell
./start-jarvis.ps1 -Global
```
* Binds immediately to your permanent static URL:  
  **`https://washbasin-penpal-muppet.ngrok-free.dev`**
* Renders a terminal QR code for instant mobile pairing.
* Works on cellular mobile data (4G/5G) and foreign Wi-Fi networks worldwide.
* **Default Guardian Passcode**: `1010`

---

## 4. Installed Architecture Summary

| Component | File / Path | Responsibility |
| :--- | :--- | :--- |
| **Directives Engine** | [directives.ts](file:///d:/Harshan/Projects/jarvis/lib/jarvis/directives.ts) | Enforces Directives 01, 02, 03, and 04 |
| **Neural Memory Vault** | [memory.ts](file:///d:/Harshan/Projects/jarvis/lib/jarvis/memory.ts) | Persistent state, tasks, principles, and evolutionary milestones |
| **Agentic Tools** | [tools.ts](file:///d:/Harshan/Projects/jarvis/lib/jarvis/tools.ts) | Task creation, memory retrieval, red-teaming, and briefings |
| **Arc-Reactor Voice** | [ArcReactorOrb.tsx](file:///d:/Harshan/Projects/jarvis/components/ArcReactorOrb.tsx) | Live audio reactive waveform visualizer |
| **Security Gate** | [SecurityGateModal.tsx](file:///d:/Harshan/Projects/jarvis/components/SecurityGateModal.tsx) | Identity verification on public/cellular networks |
| **Worldwide Tunnel** | [tunnel-manager.js](file:///d:/Harshan/Projects/jarvis/lib/tunnel-manager.js) | Ngrok static edge daemon + Cloudflare fallback & QR synthesizer |
| **Launcher** | [start-jarvis.ps1](file:///d:/Harshan/Projects/jarvis/start-jarvis.ps1) | One-command launcher with `-Global` switch |
