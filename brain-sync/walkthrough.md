# Project J.A.R.V.I.S. Mark I — Walkthrough & Tactical Manual

![J.A.R.V.I.S. Neural Core Arc Reactor](C:/Users/Wissen/.gemini/antigravity/brain/c29737e7-70ca-4166-b8d9-7f9606888424/jarvis_icon_1789321937017.jpg)

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

## 2. Worldwide Ubiquitous Access (Outside Home Wi-Fi)

To ensure J.A.R.V.I.S. is always by your side wherever you go, we implemented an automated **Zero-Config Cloudflare Ingress Tunnel**:

* **Certified HTTPS Encryption**: Mobile operating systems (iOS Safari and Android Chrome) strictly require valid HTTPS certificates to enable microphone audio capture and voice recognition. The tunnel provides a certified `https://*.trycloudflare.com` endpoint, unlocking hands-free voice commands anywhere in the world.
* **Guardian Passcode Gate**: Protects your personal intelligence from unauthorized internet traffic. When accessed from a new remote device, entering your master PIN (Default: `1010`, configurable in Settings) authorizes the uplink.
* **Terminal QR Code**: Scanning the QR code displayed in the PowerShell terminal automatically opens J.A.R.V.I.S. on your phone with zero typing.

---

## 3. Launching J.A.R.V.I.S.

### Option A: Local Network Only (Home Wi-Fi)
```powershell
./start-jarvis.ps1
```
* **Desktop**: [http://localhost:3000](http://localhost:3000)
* **Phone (Home Wi-Fi)**: `http://192.168.1.11:3000`

### Option B: Global Worldwide Mode (Anywhere in the World)
```powershell
./start-jarvis.ps1 -Global
```
* Generates an instant public HTTPS link (e.g. `https://xxx.trycloudflare.com`).
* Displays an ASCII QR code in the terminal.
* Works on cellular mobile data (4G/5G) and any remote Wi-Fi network.
* **Default Guardian Passcode**: `1010`

---

## 4. Installed Architecture Summary

| Component | File / Path | Responsibility |
| :--- | :--- | :--- |
| **Directives Engine** | [directives.ts](file:///c:/Users/Wissen/Documents/antigravity/magical-noether/lib/jarvis/directives.ts) | Enforces Directives 01, 02, 03, and 04 |
| **Neural Memory Vault** | [memory.ts](file:///c:/Users/Wissen/Documents/antigravity/magical-noether/lib/jarvis/memory.ts) | Persistent state, tasks, principles, and evolutionary milestones |
| **Agentic Tools** | [tools.ts](file:///c:/Users/Wissen/Documents/antigravity/magical-noether/lib/jarvis/tools.ts) | Task creation, memory retrieval, red-teaming, and briefings |
| **Arc-Reactor Voice** | [ArcReactorOrb.tsx](file:///c:/Users/Wissen/Documents/antigravity/magical-noether/components/ArcReactorOrb.tsx) | Live audio reactive waveform visualizer |
| **Security Gate** | [SecurityGateModal.tsx](file:///c:/Users/Wissen/Documents/antigravity/magical-noether/components/SecurityGateModal.tsx) | Identity verification on public/cellular networks |
| **Worldwide Tunnel** | [tunnel-manager.js](file:///c:/Users/Wissen/Documents/antigravity/magical-noether/lib/tunnel-manager.js) | Cloudflare Tunnel daemon + QR code synthesizer |
| **Launcher** | [start-jarvis.ps1](file:///c:/Users/Wissen/Documents/antigravity/magical-noether/start-jarvis.ps1) | One-command launcher with `-Global` switch |
