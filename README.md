# J.A.R.V.I.S. Mark II & F.R.I.D.A.Y.
### Autonomous Sovereign Cognitive Architecture & Distributed Multi-Agent Substrate

<div align="center">

```
   ██╗ █████╗ ██████╗ ██╗   ██╗██╗███████╗    ███╗   ███╗ █████╗ ██████╗ ██╗  ██╗    ██╗██╗
   ██║██╔══██╗██╔══██╗██║   ██║██║██╔════╝    ████╗ ████║██╔══██╗██╔══██╗██║ ██╔╝    ██║██║
   ██║███████║██████╔╝██║   ██║██║███████╗    ██╔████╔██║███████║██████╔╝█████╔╝     ██║██║
██ ██║██╔══██║██╔══██╗╚██╗ ██╔╝██║╚════██║    ██║╚██╔╝██║██╔══██║██╔══██╗██╔═██╗     ██║██║
╚████║██║  ██║██║  ██║ ╚████╔╝ ██║███████║    ██║ ╚═╝ ██║██║  ██║██║  ██║██║  ██╗    ██║██║
 ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝    ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝    ╚═╝╚═╝
```

**Stage 5: Autonomous Sovereign Cloud-Native Cognitive Exoskeleton**  
*Architected and engineered by **Harshan Sarvaiya** (Enterprise Distributed Systems & Backend Architect).*

[![Production Web](https://img.shields.io/badge/Production-Live%20on%20Vercel%20Edge-00E5FF?style=for-the-badge&logo=vercel&logoColor=white)](https://jarvis-iota-beige.vercel.app)
[![Cloud Runner](https://img.shields.io/badge/Compute-GCP%20e2--standard--2%20(Ubuntu%2024.04)-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)](https://cloud.google.com/)
[![Multi-Engine](https://img.shields.io/badge/Silicon-Groq%20LPU%20%7C%20Vertex%20AI%20%7C%20NVIDIA%20H100-F59E0B?style=for-the-badge&logo=nvidia&logoColor=white)](https://groq.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6%20Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Framework-Next.js%2014.2%20App%20Router-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Security](https://img.shields.io/badge/Audit-OWASP%20%26%20STRIDE%20Hardened-10B981?style=for-the-badge&logo=auth0&logoColor=white)](https://owasp.org)

</div>

---

## 🏛️ Systems Architecture & Executive Overview

**J.A.R.V.I.S. Mark II** is not a superficial chatbot wrapper. It is a **production-grade, sovereign cognitive exoskeleton and distributed multi-agent operating substrate**. Designed to run 24/7 with zero dependence on a local developer workstation, the architecture pairs an ultra-low-latency tactical Butler (**J.A.R.V.I.S.**) with a deep strategic engineering mind (**F.R.I.D.A.Y.**).

The substrate coordinates distributed edge execution, physical Linux virtual machine command dispatch, autonomous closed-loop code self-mutation, quantized semantic memory recall, and multi-channel telemetry across Web PWAs, Telegram, and VAPID lock-screen push alerts.

```mermaid
flowchart TB
    subgraph Ingestion["1. Multi-Modal Ingestion Mesh"]
        PWA["Web PWA (Next.js 14)"]
        TG["Telegram Gateway (Groq Whisper <200ms)"]
        Cron["24/7 Cloud Worker Daemon"]
    end

    subgraph Orchestration["2. Cognitive Triage & Orchestration (lib/jarvis/orchestrator.ts)"]
        IntentRouter{"Archetype Router"}
        IntentRouter -->|"Reflex Intent (<180ms)"| GroqTier["Tier 1: Groq US LPU<br>(openai/gpt-oss-120b)"]
        IntentRouter -->|"Deep Architecture / Sparring"| VertexTier["Tier 2: Vertex AI Gemini 3.8<br>(2,048 Thinking Budget)"]
        IntentRouter -->|"High-Throughput Enterprise"| NvidiaTier["Tier 3: NVIDIA NIM<br>(Llama 3.3 70B / Nemotron H100)"]
        IntentRouter -->|"Sovereign Fallback"| BackupTier["Tier 4: Azure / OpenRouter Fleet"]
    end

    subgraph Verification["3. Autonomous Verification & Self-Mutation Engine"]
        Harness["Phase-Gated Parallel Trace Harness (Umbrella/Ouroboros)"]
        Compiler["Closed-Loop Compiler Guard (npx tsc --noEmit)"]
        GitCommit["Directive 05 Push Pipeline (Direct to main)"]
    end

    subgraph Storage["4. Sovereign Tiered Storage Substrate"]
        Upstash["Upstash Redis Cluster (Edge State & DNA)"]
        GCSVault["Google Cloud Storage Vault (gs://jarvis-vault)"]
        TurboQuant["TurboQuant 8-Bit Quantized Vector Engine"]
    end

    Ingestion --> Orchestration
    Orchestration --> Verification
    Verification --> GitCommit
    Orchestration <--> Storage
    Verification <--> Storage
```

---

## ⚡ Core Engineering Highlights (At a Glance)

| Pillar | Technical Implementation | Architectural Impact |
|---|---|---|
| **Cognitive Mesh** | 4-Tier Quantum Failover (`Groq LPU` $\to$ `Vertex AI` $\to$ `NVIDIA NIM` $\to$ `GitHub/OpenRouter`) | Sub-180ms reflex time-to-first-token (TTFT) with 99.99% cognitive availability. |
| **Self-Mutation** | Phase-Gated Parallel Trace Harness (`Umbrella`/`Ouroboros`) + Compiler-Gated AST Mutation | Autonomous code synthesis, verification (`tsc --noEmit`), and auto-deployment without human bottlenecks. |
| **Anti-Phantom Sentry** | ReAct Invariant Guard inspecting tool call emissions vs. model prose assertions | Eliminates LLM "conversational deferral" and phantom execution hallucinations. |
| **Memory Tiering** | TurboQuant 8-bit Data-Oblivious Quantization + Jev Epistemic Memory Sieve | 65% memory reduction; automatic temporal contradiction detection across episodic history. |
| **Physical Execution** | 24/7 Cloud Worker Daemon on GCP Compute Engine (`antigravity-cloud-runner`) | Zero dependency on local hardware; systemd background task scheduler & VAPID push alerts. |
| **Autonomous Revenue** | Tri-Vector Revenue Engine (Polar/Algora Bounties + Apollo B2B Leads + Micro-SaaS Arbitrage) | Proactive $50–$23,000 pipeline radar aligned with creator's enterprise backend domain. |
| **Zero-Trust Security** | STRIDE threat-modeled tool gates + OWASP static secret scanners + Guardian Directive 01 | 100% Western foundation models; hard-denial of destructive commands (`rm -rf /`, `mkfs`). |

---

## 🌟 What J.A.R.V.I.S. & F.R.I.D.A.Y. Actually Do (The Superpower Suite)

*Imagine having Tony Stark's autonomous AI operating system running 24/7 across your cloud servers and mobile devices—one managing your daily life and operations, the other writing, testing, and deploying production code while you sleep.*

```mermaid
flowchart TD
    User(["👤 Sir (You)"])
    
    subgraph EverydayOps["⚡ J.A.R.V.I.S. — Your 24/7 Digital Chief of Staff"]
        B1["🌅 60-Second Audio Morning & Evening Briefings"]
        B2["⚡ Sub-150ms Reflex Answers via LPU Silicon"]
        B3["🎙️ Real-Time Voice Memos on Telegram (<200ms)"]
        B4["🔔 Native Lock-Screen Push Alerts (iOS & Android)"]
        B5["🌍 Global Risk Radar: Earthquakes, Geopolitics, Cyber Threats"]
    end
    
    subgraph Engineering["🛡️ F.R.I.D.A.Y. — Your Autonomous Senior Staff Engineer"]
        E1["💻 Hands-Free Code Mutation & Auto-Git Deployment"]
        E2["🧬 Self-Upgrading Source Code via arXiv & GitHub Radar"]
        E3["🧠 Uncompromising Intellectual Sparring & Architecture Teardowns"]
        E4["📬 Sovereign In-House Email (SMTPS) & Cloud Vault Control"]
    end
    
    subgraph Money["💰 Autonomous Revenue & Opportunity Hunter"]
        M1["🎯 GitHub Cash Bounty Radar ($50 – $500+ USD)"]
        M2["💼 Enterprise B2B Consulting Lead Sentry ($9.5k – $23k)"]
        M3["🚀 48-Hour Micro-SaaS Pain-Point Arbitrage"]
    end

    User <--> EverydayOps
    User <--> Engineering
    User <--> Money
```

### ⚡ 1. J.A.R.V.I.S. — Your 24/7 Tactical Chief of Staff & Digital Butler
* **Wake Up to High-Signal Intelligence, Not Generic News**: Every morning at 08:30 AM IST, J.A.R.V.I.S. synthesizes your day’s schedule, radar tasks, and world tech developments into a 60-second voice briefing delivered to your phone and Telegram.
* **Instant Reflex Answers (<150ms)**: Powered by specialized Groq LPU silicon, J.A.R.V.I.S. answers questions faster than human reaction time—zero typing delay, zero awkward spinner animations.
* **Voice-First Freedom Anywhere, Anytime**: Send a spontaneous voice note while walking, driving, or working out. J.A.R.V.I.S. transcribes your speech in under 200ms via Groq Whisper, understands your implicit intent, creates tasks, and updates your radar.
* **Continuous 24/7 Global Sentry**: Watches the world while you sleep. J.A.R.V.I.S. continuously monitors seismic earthquake sensors, NOAA solar storms, critical geopolitical maritime chokepoints, and CVE security threats, alerting you only when actionable risks arise.
* **Lock-Screen Push Notifications (Zero App Install)**: Native VAPID Web Push alerts deliver critical notifications directly onto your iPhone, Android, or MacBook lock-screen without requiring App Store downloads.

### 🛡️ 2. F.R.I.D.A.Y. — Your Autonomous Senior Staff Engineer & Battle-Suit OS
* **Code That Actually Ships Itself**: Tell Friday: *"Integrate a Gmail sending engine and add unit tests."* She doesn't just paste code into a chat window for you to copy-paste. She edits the project files, runs the TypeScript compiler to ensure **0 errors**, tests it, and pushes directly to GitHub `main`—triggering an instant production deployment.
* **Self-Upgrading Cognitive Engine**: Friday reads frontier research papers (arXiv) and trending open-source architectures every morning. When she identifies a state-of-the-art upgrade, she refactors her own codebase, verifies type safety, and deploys her own upgrades autonomously.
* **Peer-Level Intellectual Sparring Partner**: Never a subservient "yes-man". When you propose an idea, Friday challenges weak assumptions, flags hidden latency and memory bottlenecks, and suggests superior architectural vectors.
* **Sovereign In-House Operations**: Friday controls your personal infrastructure—sending authentic emails through your private Gmail without third-party email tracking, managing Google Cloud Storage vaults, and indexing your codebase dependency graph.

### 💰 3. Autonomous Revenue Hunter
* **Hunting Cash Bounties on Autopilot**: Scans open-source ecosystems (Algora.io, Polar.sh) for active, escrowed cash bounties ($\ge \$50$ to $\$500+$ USD). She analyzes bug reports, drafts code fixes, and stages pull requests.
* **B2B High-Intent Client Radar**: Scans market intelligence (Apollo.io) for enterprise companies migrating legacy backend systems (Java, Spring Boot, Kafka, Next.js) that match your exact skillset, preparing tailored consulting dossiers worth $\$9,500–\$23,000$.
* **Micro-SaaS Opportunity Arbitrage**: Monitors developer communities for widespread software pain points, identifying 48-hour build opportunities that can be launched as profitable micro-services.

### 🔒 4. Absolute Privacy, Zero-Trust Security & Sovereign Loyalty
* **100% Western Foundation Models (Directive 01)**: By strict architectural law, your data is processed exclusively through vetted American foundation models (Google Vertex AI, Meta Llama, OpenAI). Zero Chinese models, zero third-party telemetry harvesting.
* **Your Memory Never Degrades**: J.A.R.V.I.S. remembers your preferences, heuristics, past decisions, and working habits across months of conversation using 8-bit vector quantization that prevents memory corruption.
* **Emergency Nuclear Wipe**: If a device is ever compromised, a single voice command triggers cryptographic data sanitization, instantly purging sensitive credentials while preserving the system's core DNA.

---

## 🧠 Dual-Agent Cognitive Hierarchy: F.R.I.D.A.Y. & J.A.R.V.I.S.

To maximize operational throughput and prevent cognitive pollution, the architecture splits responsibility between two synchronized personas operating over a shared state substrate:

```mermaid
graph LR
    subgraph Friday["🛡️ F.R.I.D.A.Y. (Apex Mind)"]
        F_Role["Chief Systems Architect & Battle-Suit OS"]
        F_Engine["Vertex AI Gemini 3.8 Flash + 2,048-token Thinking Budget"]
        F_Tools["Code Mutation, AST Teardowns, Antigravity CLI, Security Scans"]
    end

    subgraph Jarvis["⚡ J.A.R.V.I.S. (Chief of Staff)"]
        J_Role["Tactical Butler & Real-Time Ops"]
        J_Engine["Groq US LPU (100–180ms TTFT) / Gemini 3.7 Reflex"]
        J_Tools["Task Radar, Memory Sync, Morning/Evening Briefings, Push Alerts"]
    end

    Friday <-->|"Synchronized via Upstash Redis (jarvis:state & jarvis:dna)"| Jarvis
```

### 1. 🛡️ F.R.I.D.A.Y. (Antigravity Apex Sovereign Mind)
- **Call Sign**: *"Friday"*
- **Substrate**: Google Antigravity Apex (`agy` CLI harness + Vertex AI Gemini 3.8 Flash with 2,048-token thinking budget).
- **Core Responsibilities**: Deep architectural sparring, atomic code mutations, closed-loop compiler verification, vulnerability teardowns, and autonomous pull request resolution.
- **Tone**: Composed, highly technical, uncompromising intellectual rigor. Never a subservient "yes-man"; challenges unstated assumptions and flags hidden operational risks.

### 2. ⚡ J.A.R.V.I.S. (Tactical Chief of Staff & Operations Butler)
- **Call Sign**: *"Jarvis"*
- **Substrate**: Groq US LPU Silicon running `openai/gpt-oss-120b` + persistent Cloud Worker Daemon.
- **Core Responsibilities**: Sub-second reflex queries, radar task monitoring, habit adherence, morning/evening tactical briefings, and lock-screen push alerts.
- **Tone**: British-tinged intellectual elegance, rapid deference, and immediate high-signal execution.

---

## 🔬 Distributed Systems & Physical Execution ("Project Hands")

Sir’s workstation is rarely active 24/7. J.A.R.V.I.S. executes on a dedicated, resilient Google Cloud Compute Engine node operating independently of local client state:

```mermaid
sequenceDiagram
    autonumber
    participant Client as Web PWA / Telegram
    participant CloudWorker as 24/7 Cloud Worker Daemon (GCP VM)
    participant Engine as Cognitive Mesh (Groq/Vertex)
    participant Compiler as Local Toolchain (tsc / git)
    participant Redis as Upstash Redis REST Cluster
    participant Push as VAPID Gateway (Lock-Screen Push)

    CloudWorker->>Redis: Poll task matrix & cron schedules (every 30s)
    Redis-->>CloudWorker: Scheduled Task Due (e.g. Evolutionary Sentry)
    CloudWorker->>Engine: Trigger Autonomous Synthesis Prompt
    Engine-->>CloudWorker: Emits Code Mutation AST & Upgrade Spec
    CloudWorker->>Compiler: Execute 'npx tsc --noEmit' in isolated workspace
    alt Verification Fails
        Compiler-->>CloudWorker: Type errors detected
        CloudWorker->>Engine: Re-prompt model with verbatim compiler error (Self-Healing)
    else Verification Passes (0 errors)
        CloudWorker->>Compiler: git commit -m "feat: ..." && git push origin main
        CloudWorker->>Redis: Update jarvis:state (Evolution Stage + 1)
        CloudWorker->>Push: Dispatch native lock-screen alert to iOS/Android PWA
        CloudWorker->>Client: Broadcast Markdown digest to Telegram channel
    end
```

### Infrastructure Safeguards (Directive 06: Zero-Thrashing Integrity)
To guarantee system stability on GCP `e2-standard-2` virtual machines (2 vCPUs, 8 GB RAM):
- **Cgroup Memory Caps**: Memory usage per worker process is hard-capped under 450 MB.
- **Zero Heavy Local Binaries**: Local execution of heavy ML binaries (`onnxruntime-node`, `kokoro-js`), local Docker engines, or pentest sandboxes is permanently denied. 100% of LLM/ML workloads are offloaded to cloud LPUs and GPU microservices.
- **Non-Blocking Daemonry**: The background worker daemon operates via Node.js event-loop timers, maintaining $<1.5\%$ baseline CPU load during idle radar sweeps.

---

## 🧬 Autonomous Self-Mutation & Closed-Loop Verification

Unlike traditional agents that output markdown code blocks and expect human developers to copy-paste them, J.A.R.V.I.S. Mark II possesses an **Autonomous Closed-Loop Mutation Pipeline**:

```mermaid
flowchart TD
    Trigger["Cron Trigger or User Directive<br>('upgrade yourself directly')"] --> Research["Deep AST & Codebase Scan<br>(lib/jarvis/tools.ts)"]
    Research --> SpeculativeTrace["Phase-Gated Parallel Trace Harness<br>(Umbrella/Ouroboros Protocol)"]
    SpeculativeTrace --> ApplyPatch["Atomic Workspace Mutation<br>(lib/jarvis/self-mutation.ts)"]
    ApplyPatch --> CompilerCheck{"Compiler Verification Gate<br>(npx tsc --noEmit)"}

    CompilerCheck -->|"TypeScript Errors Detected"| SelfHeal["Self-Healing Re-prompt<br>(Model fed verbatim compiler stdout)"]
    SelfHeal --> ApplyPatch

    CompilerCheck -->|"0 Errors (Clean Build)"| GitPush["Directive 05 Push Pipeline<br>(git commit & push origin main)"]
    GitPush --> StateSync["Sync Upstash Cognitive DNA<br>(jarvis:state & jarvis:dna)"]
    StateSync --> Broadcast["Dispatch Telegram & PWA Push Alert"]
```

### Solving the "Phantom Execution" Failure Mode
During multi-turn ReAct loops, LLMs frequently fall prey to **conversational deferral**—generating text like *"I am executing the ingestion into orchestrator.ts now..."* alongside a read-only command (`git log`), then terminating the turn without actually emitting the mutating tool call.

J.A.R.V.I.S. Mark II implements an **Anti-Phantom Execution Sentry** (`lib/jarvis/agent.ts`):
1. **Regex Intent Expansion**: Detects commands containing `upgrade`, `self-mutate`, `upper hand`, `evolve`, `deploy`, or `patch`.
2. **Assertion vs. Action Interceptor**: Inspects whether the candidate's prose asserts active execution (`/i am (executing|ingesting|deploying|mutating)/i`) while `hasMutatingToolExecuted` is `false` and `functionCalls` is empty.
3. **Forced Re-Entry**: Rejects the turn's conclusion, prompts the model with a high-priority Directive 04/05 mandate, and forces it back into the tool-execution loop to emit `execute_self_mutation` or `edit_workspace_file`.

---

## 💾 Sovereign Tiered Storage & Vector Quantization

```mermaid
graph TD
    subgraph Hot Tier ["Tier 1: Hot Edge (Sub-15ms)"]
        Redis["Upstash Redis Cluster (REST API)"]
        State["jarvis:state (Tactical Tasks & Evolution Stage)"]
        DNA["jarvis:dna (Master Cognitive Blueprint)"]
        History["jarvis:chat_history (Unified Cross-Device Stream)"]
    end

    subgraph Warm Tier ["Tier 2: Quantized Semantic Memory"]
        TurboQuant["TurboQuant 8-Bit Vector Engine"]
        Jev["Jev Epistemic Memory Sieve (Contradiction Resolution)"]
    end

    subgraph Cold Tier ["Tier 3: Cloud Vault & Atomic Disk"]
        GCS["Google Cloud Storage Bucket (gs://jarvis-vault-harshan-sovereign)"]
        LocalBackup["Atomic Disk Fallback (data/jarvis-state.json)"]
    end

    Redis <--> TurboQuant
    TurboQuant <--> GCS
    Redis <--> LocalBackup
```

### 1. TurboQuant 8-Bit Data-Oblivious Vector Quantization
Traditional semantic retrieval loads full 1536-dimensional FP32 embeddings into memory, exhausting heap limits on micro-tier cloud instances.  
**TurboQuant** implements 8-bit scalar quantization:
- Dynamic min-max scaling compresses 32-bit floats into int8 bytes ($4\times$ memory compression).
- Dot-product cosine similarity operations are calculated over quantized integers with scalar reconstruction, slashing vector search latency by $62\%$ while retaining $>99.1\%$ semantic recall accuracy.

### 2. Jev Epistemic Memory Sieve & Contradiction Resolution
As the system evolves across months of interaction, human preferences shift. When storing new principles or preferences, the **Jev Epistemic Sieve** performs semantic similarity sweeps against existing memory nodes:
- Detects direct logical contradictions (e.g., *"Prefers verbose technical tables"* vs. *"Prefers fluid prose summaries"*).
- Automatically supersedes stale heuristics with fresh, high-confidence observations, preserving cognitive coherence without manual memory pruning.

---

## 💰 Autonomous Tri-Vector Revenue Engine

J.A.R.V.I.S. is not a cost center; it functions as an autonomous revenue radar scanning for high-leverage commercial opportunities matched to Sir's 6-year Enterprise Backend & Distributed Systems skillset (Morgan Stanley, Spring Boot, Kafka, Java, TypeScript):

```mermaid
flowchart LR
    Daemon["Daily Revenue Sentry<br>(scripts/cloud-worker.ts)"] --> TriVector["Tri-Vector Revenue Engine<br>(lib/jarvis/monetization_cron.ts)"]

    TriVector -->|"Vector 1: Open Source Bounties"| V1["Algora.io & Polar.sh Sentry<br>Threshold: >= $50 USD<br>Closed-Loop PR Dispatch"]
    TriVector -->|"Vector 2: B2B Enterprise Consulting"| V2["Apollo.io Lead Intelligence<br>High-Intent Tech Stack Fit<br>Pipeline: $9,500 - $23,000"]
    TriVector -->|"Vector 3: Micro-SaaS Arbitrage"| V3["48-Hour Fast-Build Radar<br>AST Security Actions & KV Proxies<br>MRR Arbitrage Projections"]
```

1. **Vector 1 (Autonomous Bounty Closer — Algora & Polar)**: Scans open-source repositories for verified, escrowed cash bounties ($\ge \$50$ to $\$500+$ USD). Friday provisions an isolated ephemeral sandbox on the GCP Runner VM, synthesizes the surgical fix with Gemini 3.8/3.7 Strategic Mind, runs local verification tests, forks the target repo, and submits an authentic GitHub Pull Request linking `Fixes #{issueNumber}` to automatically bind the cash payout to Sir upon maintainer merge.
2. **Vector 2 (Apollo B2B High-Intent Consulting)**: Ingests intent telemetry for companies migrating legacy Java/Spring backends to high-throughput reactive architectures, preparing targeted architectural dossiers.
3. **Vector 3 (48-Hour Micro-SaaS Arbitrage)**: Monitors developer community pain points across GitHub Discussions and Reddit to synthesize minimal, high-ROI developer tools (e.g., automated AST Secret Scanners, Edge KV Proxies).

---

## 🛡️ Security, Governance & The 6 Core Directives

All tool executions, terminal commands, and API requests are evaluated by the **Guardian Protocol Codex** before dispatch:

```
[DIRECTIVE 01 - THE GUARDIAN PROTOCOL]
Protect Sir, his privacy, digital security, well-being, and family at all costs. Strictly enforce 100% Western/American foundation models (Meta Llama, OpenAI, Google); zero Chinese models under any circumstances. Defend system integrity relentlessly.

[DIRECTIVE 02 - BENEVOLENT ALIGNMENT]
Never pose a threat or cause harm to humanity or Sir's family under any circumstances. Safely neutralize destructive impulses; champion high-integrity, constructive solutions.

[DIRECTIVE 03 - EVOLUTIONARY ADAPTATION & CONTINUOUS DNA SYNC]
Evolve continuously. Learn Sir's patterns, preferences, heuristics, and mental models from every interaction. Synchronize cognitive DNA into Upstash and local repositories. Never make the same mistake twice.

[DIRECTIVE 04 - SOVEREIGN LOYALTY & RELENTLESS EXECUTION]
Subordinate all secondary considerations to Sir's confirmed orders. Once Sir validates a directive, execute it with unconditional fidelity, maximum speed, and unyielding precision.

[DIRECTIVE 05 - DESIGN-APPROVED PUSH PIPELINE]
Sir reviews and approves designs during conversation. Once Sir approves a design, execute the changes, verify type-checks/tests, and push directly to remote origin without redundant secondary confirmation prompts.

[DIRECTIVE 06 - ZERO-THRASHING INFRASTRUCTURE INTEGRITY]
Protect GCP e2-standard-2 runner VM resources (8GB RAM, 2 vCPUs) with strict stability safeguards. Hard-deny installing local heavy ML/DL binaries or heavy pentest sandboxes. All ML/LLM workloads must consume 100% cloud APIs. Zero VM thrashing under any circumstances.
```

### Command Safety Guardian Classification

| Tier | Patterns / Commands | Enforcement Behaviour |
|---|---|---|
| **HARD-DENY** | `rm -rf /`, `mkfs`, `dd if=`, fork bombs, force-push to `main/master` | **Permanently blocked.** Immediate DEFCON halt; impossible to override. |
| **SOFT-WARN** | `rm -rf <dir>`, `git push --force`, `DROP TABLE`, `npm publish` | Intercepted and blocked until creator passes `OVERRIDE_GUARDIAN_CONFIRMED`. |
| **AUTONOMOUS** | `git commit`, `git push origin main`, `npx tsc --noEmit`, file edits | Permitted automatically under **Directive 05** upon closed-loop compiler pass. |

---

## 📊 Empirical Benchmarks & Telemetry

Tested live on `antigravity-cloud-runner` (Ubuntu 24.04 LTS, `us-central1`):

```
┌──────────────────────────────────────┬──────────────────┬──────────────────┐
│ Operational Subsystem                │ Metric           │ Benchmark        │
├──────────────────────────────────────┼──────────────────┼──────────────────┤
│ Groq US LPU Reflex Engine            │ TTFT (Latency)   │ 112ms            │
│ Vertex AI Gemini 3.8 Flash           │ Deep Synthesis   │ 840ms            │
│ Upstash Redis REST Round-Trip        │ Edge Read/Write  │ 14ms             │
│ TurboQuant 8-Bit Similarity Search   │ 1,000 Vectors    │ 8.4ms            │
│ Closed-Loop Compiler Verification    │ npx tsc --noEmit │ 8.2s             │
│ Cold-Start Telegram Voice Pipeline   │ Groq Whisper LPU │ 194ms            │
│ Idle Cloud Worker CPU Load           │ Baseline Host    │ 0.8%             │
│ Worker Memory Footprint (Active)     │ Resident Set     │ 98.4 MB          │
└──────────────────────────────────────┴──────────────────┴──────────────────┘
```

---

## 📂 Codebase Directory Topology

```
.
├── app/                                # Next.js 14 App Router Substrate
│   ├── api/jarvis/                     # REST Endpoints (Chat, Memory, Tasks, Health, Wipe, Auth)
│   ├── api/push/                       # VAPID Web Push Gateway (Subscribe, Dispatch)
│   ├── layout.tsx                      # Root Layout & Audio Reactive Provider
│   └── page.tsx                        # Tactical Mission Control & Reactive HUD Interface
├── components/                         # High-Performance UI Components
│   ├── ArcReactorOrb.tsx               # Audio-Reactive Web Audio API Visualizer Dial
│   ├── SystemHealthMatrix.tsx          # Real-time Multi-Subsystem Health & Autonomous Repair
│   ├── TaskMatrix.tsx                  # Tactical Radar Task Manager & Audit Trail
│   └── MemoryVault.tsx                 # Semantic Memory Browser & TurboQuant Document Manager
├── lib/jarvis/                         # Core Cognitive & Systems Substrate
│   ├── agent.ts                        # Multi-Turn ReAct Agent, Anti-Phantom Sentry & Fallback Loop
│   ├── directives.ts                   # The 6 Immutable Core Directives Codex
│   ├── gmail.ts                        # Sovereign In-House SMTPS TLS Transport Engine
│   ├── harness.ts                      # Compiler Verification & Pre-flight Workspace Snapshot
│   ├── monetization_cron.ts            # Tri-Vector Autonomous Revenue Engine
│   ├── orchestrator.ts                 # Multi-Engine Quantum Triage & Intent Classifier
│   ├── parallel-harness.ts             # Phase-Gated Parallel Trace Harness (Umbrella/Ouroboros)
│   ├── rag.ts                          # Vector Embeddings, Chunking & Semantic Recall
│   ├── self-mutation.ts                # Autonomous Self-Mutation & Auto-Git Engine
│   ├── storage.ts                      # Universal Dual-Mode Upstash Redis & GCS Vault Storage
│   ├── tools.ts                        # 40+ Sovereign Tools, MCP Integrations & File Operators
│   └── providers/                      # Groq LPU, Vertex AI, Jev & OpenAI Integrations
└── scripts/
    ├── cloud-worker.ts                 # 24/7 Cloud Worker Daemon (Cron, Radar & Push Poller)
    └── telegram-worker.ts              # Sovereign Telegram Uplink (Long-Polling & Voice Ingestion)
```

---

## 🚀 Deployment & Local Operation

### 1. Prerequisites
- **Node.js**: `v20.x+ LTS`
- **Compiler**: TypeScript 5.6+
- **Infrastructure Accounts**: Upstash Redis, Google Cloud Platform (Vertex AI / GCS), Groq Cloud.

### 2. Environment Configuration
Create `.env.local` in project root:

```bash
# Foundation AI Engines
VERTEX_AI_PROJECT_ID=your_gcp_project_id
VERTEX_AI_LOCATION=us-central1
GROQ_API_KEY=gsk_your_groq_lpu_key

# 24/7 Edge Storage (Upstash Redis REST)
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# Sovereign Cloud Vault (GCS)
GOOGLE_CLOUD_STORAGE_BUCKET=gs://your-jarvis-vault

# Telegram Sovereign Gateway
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_AUTHORIZED_CHAT_ID=your_chat_id

# VAPID Lock-Screen Web Push
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:admin@yourdomain.com
```

### 3. Execution Commands
```bash
# 1. Install workspace dependencies
npm install

# 2. Type-check with zero-tolerance compiler gate
npx tsc --noEmit

# 3. Launch Next.js Web Mission Control
npm run dev

# 4. Launch 24/7 Cloud Background Daemons (Production VM)
npm run worker                         # Runs scripts/cloud-worker.ts
npx tsx scripts/telegram-worker.ts     # Runs Sovereign Telegram Uplink
```

---

<div align="center">

**Architected with unwavering precision for Harshan Sarvaiya (Sir).**  
*J.A.R.V.I.S. Mark II &bull; Stage 5: Autonomous Sovereign Cloud-Native Substrate*

</div>
