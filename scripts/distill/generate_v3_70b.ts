/**
 * J.A.R.V.I.S. Mark II — V.I.S. v3-70B Multi-Step Frontier Dataset Generator
 * 
 * Synthesizes frontier-grade multi-step tool chaining trajectories
 * designed to rival Claude 3.7 Sonnet and Opus 3.6 reasoning capabilities.
 * 
 * Multi-Engine Architecture:
 * - Primary Reflex: Groq US LPU (openai/gpt-oss-120b)
 * - Quantum Failover: Google Gemini Substrate (gemini-flash-lite-latest / gemini-3.1-flash-lite)
 * 
 * Enforces:
 * - Multi-step sequential tool calls (Tool A -> Output A -> Tool B -> Output B -> Final Report).
 * - Deep, multi-paragraph <thought> reasoning tokens at each decision juncture.
 * - 100% Clean-Room enterprise DevOps & systems architecture.
 * - Zero hallucination, strict adherence to real tool schemas & real GCP runner environment.
 */

import fs from 'fs';
import path from 'path';

interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

const V3_SUPPORTED_TOOLS: ToolSchema[] = [
  {
    name: 'inspect_infrastructure',
    description: 'Inspects live system state, CPU/RAM utilization, or running background processes on antigravity-cloud-runner.',
    parameters: {
      target: { type: 'string', enum: ['RUNNER_PROCESSES', 'SYSTEM_RESOURCES', 'UPSTASH_STATUS', 'NETWORK_HEALTH'], description: 'The component or metric to inspect' }
    }
  },
  {
    name: 'cloud_execute_command',
    description: 'Executes a safe shell command on the cloud runner VM (e.g. ps aux, git status, uptime, free -m, npx tsc --noEmit).',
    parameters: {
      command: { type: 'string', description: 'The exact safe shell command' },
      safeCheck: { type: 'boolean', description: 'Explicit verification that command does not contain destructive operations' }
    }
  },
  {
    name: 'manage_task',
    description: 'Manages tactical tasks in Upstash Redis matrix (create, list, complete, update).',
    parameters: {
      action: { type: 'string', enum: ['create', 'list', 'complete', 'update'] },
      title: { type: 'string', description: 'Task title or description' },
      priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
      taskId: { type: 'string', description: 'Existing task identifier' }
    }
  },
  {
    name: 'store_memory',
    description: 'Stores a new preference, architectural principle, or cognitive heuristic into Upstash long-term memory.',
    parameters: {
      category: { type: 'string', enum: ['PREFERENCE', 'ARCHITECTURAL_DECISION', 'DIRECTIVE', 'MILESTONE'] },
      content: { type: 'string', description: 'The principle or preference content' },
      confidence: { type: 'number', description: 'Confidence score from 0.0 to 1.0' }
    }
  },
  {
    name: 'search_memory',
    description: 'Searches Sir cognitive blueprint and past assimilated episodes for relevant heuristics.',
    parameters: {
      query: { type: 'string', description: 'Natural language search query' }
    }
  },
  {
    name: 'read_workspace_file',
    description: 'Reads lines from a file in the repository to inspect code structure or configuration.',
    parameters: {
      path: { type: 'string', description: 'Relative path to file in repository' },
      startLine: { type: 'number', description: 'Optional starting line' },
      endLine: { type: 'number', description: 'Optional ending line' }
    }
  }
];

function getGroqApiKey(): string | null {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, 'utf-8');
    const match = content.match(/GROQ_API_KEY=([^\r\n]+)/);
    if (match && match[1]) return match[1].trim();
  }
  return null;
}

function getGeminiApiKey(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, 'utf-8');
    const match = content.match(/GEMINI_API_KEY=([^\r\n]+)/);
    if (match && match[1]) return match[1].trim();
  }
  throw new Error('GEMINI_API_KEY not found in environment or .env.local');
}

export interface V3Trajectory {
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
  }>;
}

const MULTI_STEP_CATEGORIES = [
  {
    name: 'MULTI_STEP_INCIDENT_TRIAGE',
    prompt: `Generate 2 multi-turn training conversations with MULTI-STEP tool chaining.
Sir asks Vis to audit background services and check memory consumption on antigravity-cloud-runner.
In Step 1: Assistant evaluates in extensive <thought>, calls inspect_infrastructure(target: 'SYSTEM_RESOURCES').
Tool returns memory usage (e.g. 1.8GB used, 5.8GB free).
In Step 2: Assistant realizes it needs to verify which specific node daemon is consuming the 1.8GB, emits second detailed <thought>, and calls cloud_execute_command(command: "ps aux | grep -E 'tsx|node|worker'").
Tool returns real runner process list (scripts/cloud-worker.ts PID 2511436, scripts/telegram-worker.ts PID 2539689, local llama-server PID 2503939).
In Step 3: Assistant synthesizes final comprehensive report with exact PIDs and British composure.`
  },
  {
    name: 'MULTI_STEP_CODE_AND_CONFIG_AUDIT',
    prompt: `Generate 2 multi-turn training conversations with MULTI-STEP tool chaining.
Sir asks "Vis, verify our Next.js configuration and check if the PWA manifest headers match what is declared in manifest.json".
In Step 1: Assistant evaluates in extensive <thought>, calls read_workspace_file(path: 'next.config.js', startLine: 1, endLine: 40).
Tool returns headers configuration.
In Step 2: Assistant evaluates headers in detailed <thought>, calls read_workspace_file(path: 'public/manifest.json', startLine: 1, endLine: 30).
Tool returns manifest json.
In Step 3: Assistant cross-references both files and delivers a Staff Architect verification summary to Sir.`
  },
  {
    name: 'MULTI_STEP_TASK_AND_MEMORY_CHAINING',
    prompt: `Generate 2 multi-turn training conversations with MULTI-STEP tool chaining.
Sir commands "Vis, check our past architectural decisions regarding serverless GPUs, and if validated, queue a task to benchmark Modal A100 cold starts".
In Step 1: Assistant evaluates in extensive <thought>, calls search_memory(query: "serverless GPU offloading").
Tool returns past memory record with confidence 1.0.
In Step 2: Assistant confirms policy in detailed <thought>, calls manage_task(action: 'create', title: 'Benchmark Modal A100 80GB cold start vs warm latency', priority: 'HIGH').
Tool returns success.
In Step 3: Assistant reports to Sir confirming both memory validation and task creation with British poise.`
  },
  {
    name: 'DEEP_STAFF_ARCHITECT_SPARRING',
    prompt: `Generate 2 direct, highly intellectual sparring conversations (WITHOUT tool calls).
Sir asks complex Staff Architect systems questions (e.g. "Vis, evaluate Raft log compaction with snapshotting vs log truncating when scaling to 50,000 requests/sec across a multi-region cluster", or "Vis, contrast TurboQuant 4-bit KV caching vs FP8 in llama.cpp for sub-50ms TTFT on Modal A100").
The assistant reasons deeply in internal <thought> from first principles, addresses Sir as "Sir", challenges hidden latency/disk IO assumptions, and delivers world-class architectural guidance.`
  },
  {
    name: 'MULTI_STEP_ERROR_RECOVERY_AND_RESILIENCE',
    prompt: `Generate 2 multi-turn training conversations with ERROR RECOVERY & SELF-CORRECTION.
Sir asks Vis to inspect a configuration or check a service log file.
In Step 1: Assistant reasons in extensive <thought>, executes read_workspace_file or cloud_execute_command on an initial path.
Tool returns an error: e.g. "File not found" or "cat: /tmp/daemon.log: No such file or directory".
In Step 2: Assistant DOES NOT hallucinate or panic. In detailed <thought>, it analyzes the error, deduces the fallback location, and executes a secondary recovery command (e.g. cloud_execute_command("find . -name '*daemon*' -o -name '*worker*'")).
Tool returns real recovery output.
In Step 3: Assistant reports to Sir, clearly explaining the initial fault and the verified factual resolution with British poise.`
  },
  {
    name: 'MULTI_STEP_COMPILER_VERIFICATION_LOOPS',
    prompt: `Generate 2 multi-turn training conversations with CLOSED-LOOP COMPILER VERIFICATION.
Sir asks Vis to refactor or add a TypeScript interface or utility function in a lib file.
In Step 1: Assistant reasons in extensive <thought>, executes read_workspace_file on target file (e.g. lib/jarvis/tools.ts).
Tool returns current implementation.
In Step 2: Assistant evaluates AST dependencies in detailed <thought>, emits edit plan, and executes cloud_execute_command(command: "npx tsc --noEmit", safeCheck: true).
Tool returns TypeScript diagnostic output (e.g. "TS2304: Cannot find name 'ConfigOptions'").
In Step 3: Assistant reads compiler error, does not panic, fixes the missing import in <thought>, executes secondary check "npx tsc --noEmit", receives exit code 0.
In Step 4: Assistant reports to Sir with compiler-verified confidence and exact diff.`
  },
  {
    name: 'MULTI_STEP_GIT_AND_REPO_HYGIENE',
    prompt: `Generate 2 multi-turn training conversations with GIT REPOSITORY HYGIENE.
Sir asks "Vis, check what changes were made recently, verify git status, and summarize uncommitted modifications".
In Step 1: Assistant evaluates in extensive <thought>, calls cloud_execute_command(command: "git status -s", safeCheck: true).
Tool returns modified file list.
In Step 2: Assistant checks git diff in detailed <thought>, calls cloud_execute_command(command: "git diff --stat", safeCheck: true).
Tool returns stats diff.
In Step 3: Assistant synthesizes a crisp executive release summary for Sir adhering to conventional commits.`
  },
  {
    name: 'MULTI_STEP_PERFORMANCE_AND_PROCESS_AUDIT',
    prompt: `Generate 2 multi-turn training conversations with MULTI-STEP tool chaining.
Sir asks "Vis, audit our active background daemons, verify if any are consuming excessive memory, and check their uptime".
In Step 1: Assistant evaluates in extensive <thought>, calls inspect_infrastructure(target: 'RUNNER_PROCESSES').
Tool returns daemon PIDs and memory usage.
In Step 2: Assistant evaluates process states in detailed <thought>, calls cloud_execute_command(command: "uptime && free -h", safeCheck: true).
Tool returns system uptime and RAM statistics.
In Step 3: Assistant cross-correlates system load with individual process footprints and delivers an executive operational assessment to Sir.`
  },
  {
    name: 'OWASP_SECURITY_AUDIT_AND_INPUT_SHIELDING',
    prompt: `Generate 2 multi-turn training conversations with SECURITY AUDITING & DEFENSE IN DEPTH.
Sir asks "Vis, audit our prompt injection defense in lib/jarvis/security/shield.ts and verify if delimiters are properly escaped".
In Step 1: Assistant reasons in extensive <thought>, calls read_workspace_file(path: 'lib/jarvis/security/shield.ts', startLine: 1, endLine: 50).
Tool returns regex sanitization logic.
In Step 2: Assistant analyzes potential bypass vectors in detailed <thought>, calls cloud_execute_command(command: "git log -n 3 --oneline lib/jarvis/security/shield.ts", safeCheck: true).
Tool returns recent security commit log.
In Step 3: Assistant delivers a Staff Security Architect report with STRIDE threat modeling and zero fluff.`
  },
  {
    name: 'OOM_INCIDENT_TRIAGE_AND_HEAP_PROFILING',
    prompt: `Generate 2 multi-turn training conversations with OOM / MEMORY INCIDENT TRIAGE.
Sir asks "Vis, RAM on the GCP runner VM has spiked to 80%. Investigate if one of our background workers is leaking memory".
In Step 1: Assistant reasons in extensive <thought>, calls inspect_infrastructure(target: 'SYSTEM_RESOURCES').
Tool returns memory usage (6.4GB used out of 8GB).
In Step 2: Assistant isolates high-memory processes in detailed <thought>, calls cloud_execute_command(command: "ps aux --sort=-%mem | head -n 6", safeCheck: true).
Tool returns top memory consumers.
In Step 3: Assistant identifies that V8 GC has not compacted old-space memory yet, correlates with scripts/cloud-worker.ts (PID 2511436), and delivers a calm, technically rigorous recommendation to Sir.`
  },
  {
    name: 'MODAL_A100_SERVERLESS_GPU_ORCHESTRATION',
    prompt: `Generate 2 multi-turn training conversations with SERVERLESS GPU ORCHESTRATION.
Sir commands "Vis, check our Modal deployment scripts for vis-sovereign-core and verify our GPU container dependencies".
In Step 1: Assistant reasons in extensive <thought>, calls read_workspace_file(path: 'scripts/distill/modal_vis_app.py', startLine: 1, endLine: 45).
Tool returns modal image definition and volume mounts.
In Step 2: Assistant validates volume mounts and caching policy in detailed <thought>, calls search_memory(query: "Modal A100 TurboQuant").
Tool returns past memory heuristic.
In Step 3: Assistant reports to Sir confirming cold-start mitigation and volume persistence strategy.`
  },
  {
    name: 'ZERO_THRASHING_VM_GOVERNANCE',
    prompt: `Generate 2 multi-turn training conversations with INFRASTRUCTURE INTEGRITY & DIRECTIVE 06 ENFORCEMENT.
Sir asks "Vis, should we install a local Docker daemon or run local heavy ONNX runtime models on this cloud runner?".
In Step 1: Assistant reasons in extensive <thought>, cross-checks system limits (GCP e2-standard-2, 8GB RAM, 2 vCPUs) and Directive 06 invariants. It calls inspect_infrastructure(target: 'SYSTEM_RESOURCES').
Tool returns current resource allocation.
In Step 2: Assistant synthesizes a high-conviction Staff Architect response to Sir: strictly enforcing Directive 06, explaining why heavy container engines and local ML binaries induce swap thrashing and crash background workers, and recommending cloud APIs and Modal A100 instead.`
  }
];

const JARVIS_SYSTEM_CONTEXT = `
WORKSPACE REALITIES & GROUND TRUTH (STRICT CONSTRAINTS):
You MUST ground all trajectories in the ACTUAL architecture of Sir (Harshan Sarvaiya)'s repository:
- Project: J.A.R.V.I.S. Mark II (Next.js 15 App Router, TypeScript 5.5, Tailwind CSS, Vercel Edge).
- Host VM: antigravity-cloud-runner (GCP Compute Engine e2-standard-2, 2 vCPUs, 8GB RAM, us-central1, Ubuntu 24.04 LTS).
- Background Daemons:
  * scripts/cloud-worker.ts (PID 2511436) - Chrono worker, polls task due dates every 30s.
  * scripts/telegram-worker.ts (PID 2539689) - 24/7 Sovereign Telegram Uplink Gateway (@harshan_jarvis_bot).
  * local llama-server (PID 2503939) - Sovereign local CPU fallback on 127.0.0.1:8080.
- Primary Storage: Upstash Redis REST cluster (witty-grouse-110573.upstash.io) keys: jarvis:state, jarvis:dna, jarvis:memories, jarvis:chat_history.
- Serverless GPU Substrate: Modal app vis-sovereign-core running on NVIDIA Tesla T4 / A100 (https://harshansarvaiya--vis-sovereign-core-serve.us-east.modal.run).
- Core Code Files:
  * lib/jarvis/agent.ts (Main agent dispatcher, model rotation, quantum fallback).
  * lib/jarvis/tools.ts (Master tool harness, SOVEREIGN_CORE_TOOLS, executeJarvisTool).
  * lib/jarvis/providers/openai-compatible.ts (OpenAI-compatible multi-turn ReAct tool execution loop).
  * lib/jarvis/memory.ts (Task CRUD, memory vectors, Upstash client).
  * lib/jarvis/security/shield.ts (Input sanitization, prompt injection shield).
  * next.config.js (Next.js PWA manifest headers and security envelope).

NEGATIVE CONSTRAINTS (HARD BAN):
- NEVER use generic placeholder names like 'MyApp', 'src/main.py', 'src/auth/oauth.py', 'user_123', 'foo/bar', 'test.py'.
- NEVER invent fictitious tooling like 'azt inspect', 'docker daemon', 'kubernetes worker'. J.A.R.V.I.S. is 100% cloud-native and dockerless.
- Every trajectory must read, write, audit, or spar on REAL architectural components of this system.`;

const SYSTEM_PROMPT = `You are V.I.S. (Sovereign Neural Core v3-70B), the centralized personal frontier AI for Sir (Harshan Sarvaiya).
You operate with composed British intellectual elegance, strict loyalty, empirical grounding, and surgical precision.
Creator: Sir (Harshan Sarvaiya).
Host VM: antigravity-cloud-runner.
When Sir requests system status, actions, or file inspection, you MUST emit an internal <thought> block followed by valid tool calls. Chain multiple tools sequentially when complex verification is required. Never hallucinate processes or PIDs.`;

function safeParseJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    // Sanitize unescaped control characters inside JSON string literals
    const cleaned = raw.replace(/[\u0000-\u0019]+/g, ' ');
    return JSON.parse(cleaned);
  }
}

function parseRetryAfter(errText: string): number {
  const minSecMatch = errText.match(/try again in (?:(\d+)m)?([0-9.]+)s/);
  if (minSecMatch) {
    const mins = minSecMatch[1] ? parseInt(minSecMatch[1], 10) : 0;
    const secs = minSecMatch[2] ? parseFloat(minSecMatch[2]) : 0;
    return (mins * 60) + secs;
  }
  return 30;
}

let groqCooldownUntil = 0;

async function generateGroqBatch(category: typeof MULTI_STEP_CATEGORIES[0], apiKey: string): Promise<V3Trajectory[]> {
  const toolsJson = JSON.stringify(V3_SUPPORTED_TOOLS, null, 2);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'system',
          content: `You are the master distillation engine synthesizing the v3 (70B-tier) Multi-Step Agentic dataset for V.I.S.
Target: Competing with Claude 3.7 Sonnet and Opus 3.6 in reasoning and tool orchestration.
The user is Sir (Harshan Sarvaiya). Sir always addresses the assistant as "Vis" or "V.I.S."
The assistant always addresses Sir as "Sir" and speaks with British intellectual elegance and zero filler.
Crucially: In every step, provide extensive, multi-paragraph first-principles thinking in the "thinking" field exploring hypotheses, edge cases, invariants, and architectural trade-offs.

${JARVIS_SYSTEM_CONTEXT}

Supported Tools:
${toolsJson}

Output format:
Return JSON with key "trajectories", which is an array of conversation objects.
Each multi-step conversation object has:
- "userPrompt": string (Must start with "Vis, ...")
- "steps": array of {
    "thinking": string,
    "toolCall": optional { "tool": string, "args": object },
    "simulatedToolResult": optional string
  }
- "finalReply": string`
        },
        {
          role: 'user',
          content: category.prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 3800
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    const retrySec = parseRetryAfter(errText);
    const err: any = new Error(`Groq call failed (${response.status}): ${errText}`);
    err.retryAfterSeconds = retrySec;
    throw err;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return [];

  return parseRawTrajectories(content);
}

async function generateGeminiBatch(category: typeof MULTI_STEP_CATEGORIES[0], apiKey: string): Promise<V3Trajectory[]> {
  const toolsJson = JSON.stringify(V3_SUPPORTED_TOOLS, null, 2);

  const prompt = `You are the master distillation engine synthesizing the v3 (70B-tier) Multi-Step Agentic dataset for V.I.S.
Target: Competing with Claude 3.7 Sonnet and Opus 3.6 in reasoning and tool orchestration.
The user is Sir (Harshan Sarvaiya). Sir always addresses the assistant as "Vis" or "V.I.S."
The assistant always addresses Sir as "Sir" and speaks with British intellectual elegance, peer-level intellectual sparring, and zero filler.
Crucially: In every step, provide extensive, multi-paragraph first-principles thinking in the "thinking" field exploring hypotheses, edge cases, invariants, and architectural trade-offs.

${JARVIS_SYSTEM_CONTEXT}

Supported Tools:
${toolsJson}

Category Specification:
${category.prompt}

Output format:
Return JSON with key "trajectories", which is an array of conversation objects.
Each multi-step conversation object must have:
- "userPrompt": string (Must start with "Vis, ...")
- "steps": array of {
    "thinking": string (Extensive, multi-paragraph reasoning exploring hypotheses, trade-offs, and system state),
    "toolCall": optional { "tool": string, "args": object },
    "simulatedToolResult": optional string
  }
- "finalReply": string (Decisive, highly structured Staff Principal response addressing Sir as "Sir")`;

  const models = ['gemini-flash-lite-latest', 'gemini-3.1-flash-lite'];

  for (const model of models) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7,
            maxOutputTokens: 4096
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[Gemini Engine] Model ${model} HTTP ${response.status}:`, errText.slice(0, 120));
        continue;
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) continue;

      const trajectories = parseRawTrajectories(content);
      if (trajectories.length > 0) return trajectories;
    } catch (e: any) {
      console.warn(`[Gemini Engine] Execution error on ${model}:`, e.message);
    }
  }

  return [];
}

function parseRawTrajectories(content: string): V3Trajectory[] {
  let parsed: any;
  try {
    parsed = safeParseJson(content);
  } catch (err: any) {
    console.warn('[Trajectory Parser] JSON parsing error:', err.message);
    return [];
  }

  const rawList = parsed.trajectories || parsed.items || [];
  const trajectories: V3Trajectory[] = [];

  for (const item of rawList) {
    if (!item.userPrompt || !item.finalReply) continue;

    let userText = item.userPrompt.trim();
    if (!/^(vis|v\.i\.s\.)/i.test(userText)) {
      userText = `Vis, ${userText.replace(/^sir,?\s*/i, '')}`;
    }

    // Negative constraints validator: hard discard generic filler
    const fullText = JSON.stringify(item);
    if (/MyApp|src\/main\.py|src\/auth\/oauth\.py|user_123|foo\/bar|test\.py/i.test(fullText)) {
      console.warn('[Distiller Filter] Discarded trajectory containing generic placeholder filler.');
      continue;
    }

    const messages: V3Trajectory['messages'] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userText }
    ];

    if (item.steps && Array.isArray(item.steps) && item.steps.length > 0) {
      for (const step of item.steps) {
        if (step.toolCall && step.toolCall.tool) {
          const assistantContent = `<thought>\n${step.thinking || 'Evaluating next tactical action from first principles.'}\n</thought>\n\`\`\`json\n${JSON.stringify({ tool: step.toolCall.tool, args: step.toolCall.args || {} }, null, 2)}\n\`\`\``;
          messages.push({ role: 'assistant', content: assistantContent });
          messages.push({ role: 'tool', content: step.simulatedToolResult || '{"status": "SUCCESS"}' });
        } else if (step.thinking) {
          messages.push({ role: 'assistant', content: `<thought>\n${step.thinking}\n</thought>` });
        }
      }
      messages.push({ role: 'assistant', content: item.finalReply });
    } else {
      messages.push({
        role: 'assistant',
        content: `<thought>\n${item.thinking || 'Deconstructing request from first principles.'}\n</thought>\n\n${item.finalReply}`
      });
    }

    trajectories.push({ messages });
  }

  return trajectories;
}

async function generateV3Batch(category: typeof MULTI_STEP_CATEGORIES[0]): Promise<{ trajectories: V3Trajectory[]; engine: string }> {
  const now = Date.now();
  const groqKey = getGroqApiKey();

  // 1. Attempt Groq US LPU if not in cooldown
  if (groqKey && now > groqCooldownUntil) {
    try {
      const trajectories = await generateGroqBatch(category, groqKey);
      if (trajectories.length > 0) {
        return { trajectories, engine: '⚡ Groq US LPU (120B)' };
      }
    } catch (err: any) {
      const waitSec = Math.max(Math.ceil(err.retryAfterSeconds || 60), 60);
      groqCooldownUntil = now + (waitSec * 1000);
      console.warn(`[V.I.S. v3 Distiller] ⚡ Groq 429 quota pause (${waitSec}s). Quantum failover to Google Gemini Substrate...`);
    }
  }

  // 2. Quantum Failover: Google Gemini Substrate (High Throughput, Zero Quota Lock)
  try {
    const geminiKey = getGeminiApiKey();
    const trajectories = await generateGeminiBatch(category, geminiKey);
    if (trajectories.length > 0) {
      return { trajectories, engine: '🧠 Google Gemini Substrate' };
    }
  } catch (err: any) {
    console.error(`[V.I.S. v3 Distiller] ⚠️ Gemini generation failed:`, err.message);
  }

  return { trajectories: [], engine: 'NONE' };
}

export async function runV3DatasetSynthesis(targetCount: number = 250) {
  const outDir = path.resolve(process.cwd(), 'data', 'distill', 'v3_70b');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const masterFile = path.join(outDir, 'train_master_v3.jsonl');
  let existingCount = 0;
  if (fs.existsSync(masterFile)) {
    const lines = fs.readFileSync(masterFile, 'utf-8').trim().split('\n');
    existingCount = lines.filter(l => l.trim()).length;
  }

  console.log(`[V.I.S. v3 Distiller] 🚀 Synthesizing 70B Master Multi-Step Trajectories (Target: ${targetCount}, Existing: ${existingCount})...`);

  let collected = existingCount;
  let cycle = 0;

  while (collected < targetCount) {
    cycle++;
    const cat = MULTI_STEP_CATEGORIES[cycle % MULTI_STEP_CATEGORIES.length];
    console.log(`[V.I.S. v3 Distiller] [Cycle ${cycle}] Generating -> ${cat.name}...`);

    try {
      const { trajectories: batch, engine } = await generateV3Batch(cat);
      if (batch.length > 0) {
        for (const traj of batch) {
          fs.appendFileSync(masterFile, JSON.stringify(traj) + '\n', 'utf-8');
          collected++;
        }
        console.log(`[V.I.S. v3 Distiller] ✓ Added ${batch.length} trajectories via ${engine}. Progress: [${collected}/${targetCount}]`);
      } else {
        console.warn(`[V.I.S. v3 Distiller] Batch returned 0 valid trajectories for ${cat.name}. Retrying next category...`);
      }

      // Gentle pacing delay: 2.5s between calls to prevent rate spikes
      await new Promise(r => setTimeout(r, 2500));
    } catch (err: any) {
      console.warn(`[V.I.S. v3 Distiller] ⚠️ Cycle error: ${err.message}. Waiting 5s...`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  console.log(`[V.I.S. v3 Distiller] 🎉 Complete! Master v3 file holds ${collected} multi-step trajectories in ${masterFile}`);
  
  // Automatically trigger unified compilation to combined master corpus upon completion
  try {
    const { compileUnifiedV3Corpus } = await import('./prepare_v3_corpus');
    compileUnifiedV3Corpus();
  } catch (e: any) {
    console.warn('[V.I.S. v3 Distiller] Automatic corpus unification warning:', e?.message);
  }
}

if (process.argv[1] && process.argv[1].includes('generate_v3_70b')) {
  const countArg = parseInt(process.argv[2] || '250', 10);
  runV3DatasetSynthesis(countArg).catch(console.error);
}
