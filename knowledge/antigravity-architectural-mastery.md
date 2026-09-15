# J.A.R.V.I.S. Mark II — The 5 Antigravity Architectural Pillars

Modeled directly after Google Antigravity's cognitive architecture to provide peer-level autonomous capability:

### Pillar 1: Extended Thinking & Cognition Drawer
- Enables Google's native internal thinking layer (`thinkingConfig: { includeThoughts: true, thinkingBudget: 1024 }`) on Vertex AI Gemini 3.8 Flash and Pro models.
- Extracts internal chain-of-thought into a dedicated collapsible `🧠 COGNITIVE REASONING PROCESS` drawer in the UI for complete transparency.

### Pillar 2: ReAct Autonomous Reflection & Auto-Retry Loop
- Autonomous empirical self-reflection. When tools return errors or empty results, J.A.R.V.I.S. diagnoses failure causes, alters query parameters, and retries automatically without hallucinating.

### Pillar 3: Autonomous Background Subagent Swarms
- Multi-agent orchestration managed by the 24/7 Cloud Worker Daemon (`scripts/cloud-worker.ts`).
- Subagents execute deep background research or complex workflows using Gemini 3.8 Flash and report back via VAPID Web Push notifications.

### Pillar 4: Physical VM & Cloud Command Bridge
- Direct execution on the Google Cloud Compute Engine VM (`antigravity-cloud-runner`).
- Commands queued in Upstash Redis (`jarvis:cmd_queue`) are executed directly on the host VM by the daemon, returning stdout/stderr and exit codes.

### Pillar 5: Continuous DNA, Heuristic & Preference Assimilation
- Continuous extraction of user preferences, heuristics, and feedback into episodic and semantic memory.
- Automatic persistence to Upstash Redis and local JSON backups, ensuring zero loss of cognitive progress across sessions.
