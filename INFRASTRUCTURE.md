# J.A.R.V.I.S. Mark I : Master Infrastructure & Operational Anatomy Codex

> **System Designation**: Just A Rather Very Intelligent System (J.A.R.V.I.S. Mark I)  
> **Creator & Sovereign Operator**: Sir (Harshan Sarvaiya)  
> **Repository**: [harshansarvaiya/jarvis](https://github.com/harshansarvaiya/jarvis) (`main`)  
> **Production Edge**: [https://jarvis-iota-beige.vercel.app](https://jarvis-iota-beige.vercel.app)  
> **Static Encrypted Uplink**: `washbasin-penpal-muppet.ngrok-free.dev`  
> **Cloud Neural Substrate**: Upstash Redis REST (`witty-grouse-110573.upstash.io`)  
> **Current Evolution Stage**: Stage 3 (Autonomous Self-Inspection & Command Audit)

---

## 1. Ethical Substrate & Immutable Directives

Every perception, cognitive intent classification, autonomous tool execution, and communication stream is strictly bound by four immutable non-negotiable directives:

| Directive | Codename | Core Mandate |
|---|---|---|
| **Directive 01** | **The Guardian Protocol** | Absolute protection of Sir, his family, privacy, digital assets, and system integrity. Strictly enforces 100% Western/American foundation architectures (Meta Llama, OpenAI, Google); zero Chinese models under any circumstances. |
| **Directive 02** | **Benevolent Alignment** | Never pose a threat or cause harm to humanity or Sir's family. Safely intercept and neutralize hazardous operations. |
| **Directive 03** | **Evolutionary Adaptation & Continuous DNA Sync** | Continuous assimilation of Sir's mental models, feedback, and heuristics. After every milestone of progress, synchronize cognitive DNA into Upstash and local repositories. |
| **Directive 04** | **Sovereign Loyalty & Relentless Execution** | Subordinate all secondary considerations to Sir's confirmed orders. Execute directives with unconditional fidelity, maximum speed, and unyielding precision. |

---

## 2. Cognitive Multi-Engine Hierarchy & Intent Triage

J.A.R.V.I.S. does not rely on a single vendor. Operations are autonomously triaged in `lib/jarvis/orchestrator.ts`:

```
                               ┌───────────────────────────────┐
                               │     USER DIRECTIVE / INTENT   │
                               └───────────────┬───────────────┘
                                               │
                                   [Intent Triage Engine]
                                               │
         ┌─────────────────────────────────────┼─────────────────────────────────────┐
         ▼                                     ▼                                     ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐ ┌───────────────────────────────┐
│     TIER 1: REFLEX SPEED      │ │  TIER 2: DEEP SYNTHESIS & AI  │ │     TIER 3: SOVEREIGN BACKUP  │
│         Groq US LPU           │ │          Google Gemini        │ │         GitHub Models         │
│  openai/gpt-oss-120b (100ms)  │ │      gemini-3.8-flash (Core)  │ │      gpt-4o / gpt-4o-mini     │
│  openai/gpt-oss-20b  (60ms)   │ │  Quantum Fallback Hierarchy:  │ │  (Azure Cognitive Redundancy) │
│  Sub-second logic, triage,    │ │    3.8 -> 3.7 -> 3.6 -> 2.5   │ │  Failover active if Tier 1/2  │
│  and rapid tool dispatch.     │ │  Multimodal visual reasoning. │ │  endpoints are unavailable.   │
└───────────────────────────────┘ └───────────────────────────────┘ └───────────────────────────────┘
```

---

## 3. Storage Architecture & Episodic Memory Topography

J.A.R.V.I.S. utilizes a **dual-mode fault-tolerant persistence engine** (`lib/jarvis/storage.ts`):

1. **Cloud 24/7 Edge Tier (`upstash-redis`)**:
   - Primary real-time store via serverless REST API (`UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`).
   - Keys:
     - `jarvis:state`: Contains system version, evolution stage, active tasks, memory items, and security logs.
     - `jarvis:chat_history`: Cross-device conversational transmissions feed shared between mobile and desktop browsers.
2. **Local Atomic Disk Tier (`data/jarvis-state.json`)**:
   - Secondary offline persistence ensuring full operation during network isolation.
3. **Episodic Semantic RAG Engine (`lib/jarvis/recall.ts`)**:
   - Correlates user prompts against historical interaction nodes, retrieving relevant memories and preferences into active LLM context before response generation.

---

## 4. Codebase Directory Map

```
d:\Harshan\Projects\jarvis
├── app/
│   ├── api/jarvis/
│   │   ├── auth/                # Guardian Gate: login, logout, status, biometrics
│   │   ├── briefing/            # Executive status compilation endpoint
│   │   ├── chat/                # Conversational pipeline & multi-engine dispatch
│   │   ├── chat/history/        # Cross-device shared chat history sync
│   │   ├── memory/              # Memory graph CRUD & semantic retrieval
│   │   └── tasks/               # Objective Matrix CRUD & execution audit logging
│   ├── globals.css              # Sci-Fi HUD scanlines, glows, and scrollbar rules
│   ├── layout.tsx               # Root layout and metadata
│   └── page.tsx                 # Full-height Command Center (Desktop & Mobile HUD)
├── components/
│   ├── ArcReactorOrb.tsx        # Audio-reactive visualizer (mini, compact, full modes)
│   ├── TaskMatrix.tsx           # Mission Control Matrix & Task Execution Inspector
│   ├── MemoryVault.tsx          # Cognitive memory vault & evolution radar
│   ├── DirectiveBadge.tsx       # Collapsible Core Directives HUD strip
│   ├── SecurityGateModal.tsx    # Biometric / Passcode security gate
│   └── SettingsModal.tsx        # Telemetry, model selector & key configuration
├── lib/
│   └── jarvis/
│       ├── agent.ts             # Primary orchestrator driving tools and prompts
│       ├── auth.ts              # Cryptographic HMAC-SHA256 session token authority
│       ├── directives.ts        # 4 Core Directives & meta-cognitive system prompt
│       ├── memory.ts            # Task and Memory schemas & local file IO
│       ├── orchestrator.ts      # Multi-engine triage & telemetry analyzer
│       ├── recall.ts            # Episodic memory correlation & RAG retriever
│       ├── storage.ts           # Upstash Redis REST + Local disk storage engine
│       └── tools.ts             # Autonomous tool suite (tasks, memory, inspect)
├── data/
│   └── jarvis-state.json        # Atomic local fallback state
├── middleware.ts                # Edge Guardian Gate request authenticator
└── INFRASTRUCTURE.md            # This Master Architectural Codex
```

---

## 5. Autonomous Tool Ecosystem

J.A.R.V.I.S. can execute the following capabilities autonomously:

1. **`manage_task`**: Create, update, complete, or log shell commands/MCP actions to tasks in the Objective Matrix.
2. **`store_memory`**: Permanently assimilate principles, preferences, insights, and decisions into the long-term memory graph.
3. **`search_memory`**: Search across user preferences, historical decisions, and mental models.
4. **`inspect_infrastructure`**: Query live system telemetry, runtime engines, database connection health, evolution stage, memory counts, and infrastructure architecture.
5. **`generate_briefing`**: Compile an executive status report detailing active priorities, critical deadlines, and tactical recommendations.
6. **`run_red_team_critique`**: Act as an adversarial sparring partner to stress-test architectural plans and strategies.

---

## 6. Security Perimeter & Access Control

* **Edge Middleware (`middleware.ts`)**: Evaluates every request targeting `/api/jarvis/*` for a valid cryptographic HMAC-SHA256 session token.
* **Biometric & Master Passcode Gate**: Enforces WebAuthn Face ID/Touch ID or Master Passcode (`JARVIS_MASTER_PIN`) authentication before interface hydration.
* **Anti-Brute-Force Rate Limiter**: 5 failed attempts per IP trigger an automatic 15-minute security lockout.
* **Zero Secret Exposure**: API keys and tokens are securely stored server-side and never leaked in client bundles.

---

## 7. Edge Deployment & CI/CD Pipeline

* **Continuous Deployment**: Pushes to `main` on [harshansarvaiya/jarvis](https://github.com/harshansarvaiya/jarvis) automatically trigger production edge builds on Vercel.
* **Static Tunnel**: Ngrok static tunnel provides a persistent SSL endpoint for direct terminal links or external webhook ingestion.
