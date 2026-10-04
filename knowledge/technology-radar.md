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

---

## 5. Agent Scaffolding & Prompt Architecture

### 📜 [CL4R1T4S (elder-plinius/CL4R1T4S)](https://github.com/elder-plinius/CL4R1T4S)
* **Status:** `ASSIMILATED (Frontier SWE Scaffolding & Error-Recovery Heuristics)`
* **Evaluated:** 2026-10-04
* **Core Concept:** Open-source transparency repository archiving verbatim system prompts, tool schemas, and agentic loops from frontier models (OpenAI o1/GPT-4o, Claude 3.5 Sonnet) and autonomous SWE coding agents (Devin, Claude Code, Cursor, Windsurf, Manus).
* **Assimilated Heuristics:**
  - **Devin / Claude Code Closed-Loop Self-Correction:** When commands fail or return non-zero exit codes, formulate 2-3 explicit hypotheses before modifying code; never repeat failing executions without parameter mutations.
  - **Cursor Surgical Diffing:** Strict preference for minimal-diff edits over full-file overwrites to prevent regression and context window saturation.
  - **Anti-Hallucination Anchoring:** Mandatory verification of verbatim tool outputs before reporting action completion to Sir.

---

## 6. Multi-Model Racing & Adaptive Sampling

### ⚡ [G0DM0D3 (elder-plinius/G0DM0D3)](https://github.com/elder-plinius/G0DM0D3)
* **Status:** `EVALUATED / EXTRACTION IN PROGRESS (AutoTune Hyperparameters & Parallel Model Racing)`
* **Evaluated:** 2026-10-04
* **Core Concept:** Open-source, zero-dependency single-file (`index.html`) red-teaming interface and multi-model evaluation cockpit that queries 5 to 60 foundation models in parallel (OpenRouter, Venice, local Ollama/LM Studio) with real-time racing, composite response scoring, input perturbation ("Parseltongue"), and context-adaptive sampling ("AutoTune").
* **Extraction Vectors for J.A.R.V.I.S.:**
  - **AutoTune Sampling Engine:** Context-aware hyperparameter adaptation (temperature 0.1 for compiler/SWE diffs, 0.3 for log triage, 0.6 for strategic sparring) rather than static globals.
  - **Parallel Speculative Model Racing:** Expanding Groq LPU fast drafting into parallel speculative multi-engine execution, picking the highest-confidence token path.
  - **Directive 01 Safeguard:** 100% adherence to Western sovereign models (Meta Llama on US LPUs, Google Gemini, OpenAI); zero Chinese foundation models or unvetted jailbreak scripts in production pipelines.
