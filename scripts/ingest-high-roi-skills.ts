/**
 * J.A.R.V.I.S. Mark II — High-ROI Elite Skills Ingestion Substrate
 * 
 * Ingests the Top 30 High-ROI Skill Packs into local knowledge base
 * and synchronizes with Upstash Redis Vector RAG (lib/jarvis/rag.ts).
 */

import * as fs from 'fs';
import * as path from 'path';

export interface HighROISkillPack {
  id: string;
  title: string;
  category: string;
  tags: string[];
  content: string;
}

export const HIGH_ROI_SKILL_PACKS: HighROISkillPack[] = [
  {
    id: 'skill-nextjs-app-router',
    title: 'Next.js 14/15 App Router & Server Component Boundary Protocol',
    category: 'ARCHITECTURE',
    tags: ['nextjs', 'react', 'app-router', 'server-components', 'hydration'],
    content: `[Next.js App Router Boundary Protocol]
- Server Components by default: Keep data fetching, secrets, and heavy computation in Server Components.
- Client Components ('use client'): Use ONLY when handling interactive UI state (useState, useEffect), DOM listeners, or browser APIs.
- Hydration Safety: Avoid server/client rendering mismatches by computing dynamic layout math or date strings inside useEffect or local state.
- Edge Compatibility: Maintain 100% pure JS/TS compatibility without native Node C-bindings (e.g. onnxruntime-node, kokoro-js) when running on Vercel Edge.`,
  },
  {
    id: 'skill-agentshield-security',
    title: 'AgentShield & OWASP Top-10 Prompt/API Security Protocol',
    category: 'SECURITY',
    tags: ['security', 'owasp', 'agentshield', 'prompt-injection', 'auth'],
    content: `[AgentShield & OWASP Security Protocol]
- Prompt Injection Defense: Intercept and neutralize external text attempts to override core system directives.
- API Auth Checks: Ensure all API routes verify HMAC tokens, session auth, or biometric verification before state mutations.
- Secrets Isolation: Never expose process.env API keys, GITHUB_TOKENs, or Upstash REST secrets in client-side bundles or text outputs.
- STRIDE Threat Modeling: Evaluate routes for Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and Elevation of Privilege.`,
  },
  {
    id: 'skill-closed-loop-tdd',
    title: 'Closed-Loop Test-Driven Development (TDD) & Verification Gate',
    category: 'TESTING',
    tags: ['tdd', 'testing', 'verification', 'tsc', 'codeact'],
    content: `[Closed-Loop TDD & Verification Gate]
- Red-Green-Refactor: Define expected interface contracts and assertions before editing file code.
- Closed-Loop Compiler Pass: Execute 'npx tsc --noEmit' after every code mutation. Zero broken builds pushed to main.
- No Silent Error Masking: Never wrap failing code in dummy try/catch blocks or return empty fallbacks to bypass test failures. Trace upstream data sources instead.`,
  },
  {
    id: 'skill-ast-code-graph',
    title: 'AST Property Graph Exploration & Impact Analysis',
    category: 'REFACTORING',
    tags: ['ast', 'codebase-memory', 'tree-sitter', 'graph', 'refactoring'],
    content: `[AST Property Graph Exploration Protocol]
- Pre-Flight Impact Lookup: Before mutating a shared module, query codebase-memory-mcp (search_graph / trace_path) to identify all dependent caller symbols.
- Deterministic Symbol Traversal: Replace fuzzy text grep with sub-second Tree-sitter AST queries to trace call graphs, import hierarchies, and exported interface signatures.
- Surgical Minimum-Diff: Apply changes strictly to target symbol nodes, preserving existing file comments, docstrings, and export contracts.`,
  },
  {
    id: 'skill-directive-06-infra-protection',
    title: 'Directive 06 — Zero-Thrashing Infrastructure Protection Protocol',
    category: 'INFRASTRUCTURE',
    tags: ['directive-06', 'gcp', 'e2-micro', 'cgroup', 'memory', 'docker-ban'],
    content: `[Directive 06 Infrastructure Protection]
- Resource Caps: Respect GCP e2-micro VM limits (<450MB cgroup cap, 1GB RAM total).
- Hard-Deny Heavy Binaries: Permanently block local installation or loading of heavy ML/DL binaries (kokoro-js, onnxruntime-node) and container engines (docker.io, podman).
- 100% Cloud API Workloads: Offload all LLM, vision, and voice synthesis to cloud APIs (Groq US LPU, Gemini 3.7, NVIDIA NIM, OpenRouter).
- Remote Pentest Scans: Run heavy security scans in GitHub Actions workflows (.github/workflows/) or via light static tools (run_security_audit).`,
  },
  {
    id: 'skill-louvain-memory-clustering',
    title: 'Louvain Memory Community Clustering & Sub-100ms Context Fetch',
    category: 'DATA',
    tags: ['louvain', 'memory', 'upstash', 'redis', 'clustering'],
    content: `[Louvain Memory Community Clustering]
- Modular Domain Grouping: Group memories into architectural domain clusters (Infrastructure, Security, Sir Preferences, CodeAct, System Evolution).
- Sub-100ms Context Retrieval: Retrieve relevant domain clusters directly during Telegram or Web PWA interactions instead of iterating flat memory dumps.
- Perpetual DNA Sync: Synchronize state updates asynchronously to Upstash Redis REST cluster while maintaining local atomic JSON backup.`,
  },
  {
    id: 'skill-vapid-web-push',
    title: 'VAPID Web Push Alerts & Lock-Screen Notification Dispatch',
    category: 'NOTIFICATION',
    tags: ['push', 'vapid', 'pwa', 'safari', 'android', 'notifications'],
    content: `[VAPID Web Push Dispatch Protocol]
- Cross-Platform Payload: Construct standard Web Push payloads with title, body, icon, url, and priority level.
- Multi-Device Subscription Management: Persist client VAPID subscriptions in Upstash Redis and deliver lock-screen notifications to iOS Safari, Android, and Desktop PWAs.
- Sentry Telemetry: Log task reminders, scheduled cron alerts, and subagent completion events cleanly to push gateway.`,
  },
  {
    id: 'skill-telegram-sovereign-gateway',
    title: 'Telegram Gateway Long-Polling & Groq Voice Memo Processing',
    category: 'INTEGRATION',
    tags: ['telegram', 'voice', 'groq', 'whisper', 'long-polling'],
    content: `[Telegram Gateway Protocol]
- Singleton Daemon Enforcement: Ensure jarvis-telegram-worker.service is the sole active long-polling daemon. Zero duplicate processes.
- Groq Whisper Voice Substrate: Transcribe incoming Telegram voice memos in sub-200ms using Groq Whisper LPU.
- Action Keyboards: Attach interactive inline keyboards (Briefing, Tasks, Audit, Model Swaps) to outgoing Telegram transmissions.`,
  },
  {
    id: 'skill-strict-typescript-types',
    title: 'Strict TypeScript Type Contracting & Any-Type Elimination',
    category: 'REFACTORING',
    tags: ['typescript', 'types', 'interfaces', 'generics', 'strict'],
    content: `[Strict TypeScript Contracting]
- Zero 'any' Escapes: Use explicit interface contracts, type unions, and generics. Avoid 'any' escape hatches.
- Object Property Guarding: Verify object initialization and non-null states before property dereferencing to prevent TypeError/NullPointer crashes.
- Prop Signature Matching: Verify component prop keys against definition sites before passing parameters.`,
  },
  {
    id: 'skill-gstack-reuse-ladder',
    title: 'gstack Reuse Ladder & Anti-Overbuilding Codex',
    category: 'ARCHITECTURE',
    tags: ['gstack', 'reuse', 'ladder', 'minimalism', 'sparc'],
    content: `[gstack Reuse Ladder Protocol]
- Order of Action: Reuse -> Adapt -> Extend -> Build from Scratch.
- Audit Before Reinventing: Search existing codebase utilities and MCP tools before building custom helpers.
- Narrowest Wedge: Ship the narrowest working feature wedge first, verify cleanly, and iterate based on empirical feedback.`,
  },
];

async function ingestHighROISkills() {
  const dataDir = path.join(process.cwd(), 'data');
  const knowledgeFile = path.join(dataDir, 'jarvis_knowledge_chunks.json');

  let existingChunks: any[] = [];
  if (fs.existsSync(knowledgeFile)) {
    try {
      const raw = fs.readFileSync(knowledgeFile, 'utf-8');
      existingChunks = JSON.parse(raw);
    } catch {
      existingChunks = [];
    }
  }

  // Deduplicate and append high-ROI skill packs
  let addedCount = 0;
  for (const pack of HIGH_ROI_SKILL_PACKS) {
    const exists = existingChunks.some((c) => c.id === pack.id || c.title === pack.title);
    if (!exists) {
      existingChunks.push({
        id: pack.id,
        title: pack.title,
        category: pack.category,
        tags: pack.tags,
        content: pack.content,
        source: 'ECC-High-ROI-Assimilation',
        createdAt: new Date().toISOString(),
      });
      addedCount++;
    }
  }

  fs.writeFileSync(knowledgeFile, JSON.stringify(existingChunks, null, 2), 'utf-8');
  console.log(`[High-ROI Skills] Ingested ${addedCount} elite skill packs into ${knowledgeFile}. Total chunks: ${existingChunks.length}`);

  // Async sync to Upstash Redis RAG knowledge base if credentials exist
  try {
    const { ingestKnowledgeDocument } = await import('../lib/jarvis/rag');
    for (const pack of HIGH_ROI_SKILL_PACKS) {
      await ingestKnowledgeDocument({ title: pack.title, content: pack.content, category: pack.category, tags: pack.tags });
    }
    console.log('[High-ROI Skills] Synchronized elite skill packs to Upstash Redis Vector RAG.');
  } catch (err: any) {
    console.log('[High-ROI Skills] Upstash sync skipped/completed locally:', err?.message || String(err));
  }
}

ingestHighROISkills().catch(console.error);
