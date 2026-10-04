# J.A.R.V.I.S. Mark II — Technology Radar & External Substrate Catalog

This repository catalog tracks external frameworks, architectural patterns, and hardware-dependent runtimes evaluated by Sir (Harshan Sarvaiya) and F.R.I.D.A.Y. for potential assimilation.

---

## 1. Local Inference & Hardware Offloading

### 📌 [Strata (Niko1221/Strata)](https://github.com/Niko1221/Strata)
* **Status:** `BOOKMARKED / ON HOLD (Hardware Prerequisite Gate)`
* **Evaluated:** 2026-10-04
* **Core Concept:** Runs large ~125B parameter Mixture-of-Experts (MoE) models on mid-range gaming GPUs (RTX 4070/5070 12GB VRAM) by streaming active experts across PCIe from fast DDR5 system RAM with 2-bit/3-bit I-quantization (IQ2_XS / IQ3_S).
* **Hardware Gate:** Requires 32GB–64GB system RAM + 12GB+ GPU VRAM + 80GB SSD. (Currently exceeds cloud VM and laptop RAM capacity).
* **Directive 01 Caveat:** Default upstream uses Alibaba Qwen3.8. Any future workstation implementation must substitute Western foundation models (Meta Llama 3.3 70B or Mistral Mixtral 8x22B).

---

## 2. Agentic Systems & Operating Runtimes

### ⚡ [PhreshOS (PhreshOS/system)](https://github.com/PhreshOS/system)
* **Status:** `ASSIMILATED (Concept 1 — Dual-Citizen State Bus)`
* **Evaluated:** 2026-10-04
* **Assimilated Feature:** Real-time shared state bus connecting autonomous agent background executions to the user's Web HUD via SSE stream (`/api/jarvis/events`) and Telegram (`/bus`).

---

## 3. Reverse Engineering & Binary Inspection

### 🔬 [REA: Reverse Engineer Anything (morluto/rea)](https://github.com/morluto/rea)
* **Status:** `ASSIMILATED (Satellite Mesh Delegation)`
* **Evaluated:** 2026-10-04
* **Assimilated Feature:** Integrated into `scripts/satellite-node.ts` and `lib/jarvis/tools.ts` (`reverse_engineer_target`). Heavy Ghidra/Hopper decompilation is delegated to Sir's local workstation satellite to protect GCP Cloud VM stability under Directive 06.

---

## 4. Traffic Interception & API Synthesis

### 🧪 [Mimic (littledivy/mimic)](https://github.com/littledivy/mimic)
* **Status:** `ASSIMILATED (cURL / HAR Tool Synthesizer Pattern)`
* **Evaluated:** 2026-10-04
* **Core Concept:** Intercepts closed mobile (iOS via mitmproxy) and web app traffic (DevTools cURL / `.har` exports), extracts stable authentication bundles (tokens, cookies, session identifiers), and uses an LLM to auto-synthesize typed, callable API client libraries with automatic 401 retry healing.
* **Operational Integration:** Sir can paste "Copy as cURL" or drop a `.har` export into Friday's chat, and Friday directly forges a first-class tool in `lib/jarvis/tools.ts`, eliminating brittle DOM scrapers for closed consumer platforms. Mobile proxying delegated to local workstation satellite when full iOS MITM is required.
