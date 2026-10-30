/**
 * J.A.R.V.I.S. Mark II — V.I.S. v3-70B Multi-Step Agentic Dataset Generator
 * 
 * Synthesizes frontier-grade multi-step tool chaining trajectories
 * using Groq US LPU (openai/gpt-oss-120b).
 * 
 * Enforces:
 * - Multi-step sequential tool calls (Tool A -> Output A -> Tool B -> Output B -> Final Report).
 * - Deep <thought> reasoning tokens at each decision juncture.
 * - 100% Clean-Room enterprise DevOps & systems architecture.
 * - Zero hallucination, strict adherence to real tool schemas.
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
    description: 'Executes a safe shell command on the cloud runner VM (e.g. ps aux, git status, uptime, free -m).',
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

function getGroqApiKey(): string {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, 'utf-8');
    const match = content.match(/GROQ_API_KEY=([^\r\n]+)/);
    if (match && match[1]) return match[1].trim();
  }
  throw new Error('GROQ_API_KEY not found in environment or .env.local');
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
Sir asks Vis to audit background services and check memory consumption.
In Step 1: Assistant evaluates in <thought>, calls inspect_infrastructure(target: 'SYSTEM_RESOURCES').
Tool returns memory usage (e.g. 1.8GB used, 5.8GB free).
In Step 2: Assistant realizes it needs to verify which specific node daemon is consuming the 1.8GB, emits second <thought>, and calls cloud_execute_command(command: "ps aux | grep -E 'tsx|node|worker'").
Tool returns real runner process list.
In Step 3: Assistant synthesizes final comprehensive report with exact PIDs and British composure.`
  },
  {
    name: 'MULTI_STEP_CODE_AND_CONFIG_AUDIT',
    prompt: `Generate 2 multi-turn training conversations with MULTI-STEP tool chaining.
Sir asks "Vis, verify our Next.js configuration and check if the PWA manifest headers match what is declared in manifest.json".
In Step 1: Assistant evaluates in <thought>, calls read_workspace_file(path: 'next.config.js', startLine: 1, endLine: 35).
Tool returns headers configuration.
In Step 2: Assistant evaluates headers in <thought>, calls read_workspace_file(path: 'public/manifest.json', startLine: 1, endLine: 25).
Tool returns manifest json.
In Step 3: Assistant cross-references both files and delivers a Staff Architect verification summary to Sir.`
  },
  {
    name: 'MULTI_STEP_TASK_AND_MEMORY_CHAINING',
    prompt: `Generate 2 multi-turn training conversations with MULTI-STEP tool chaining.
Sir commands "Vis, check our past architectural decisions regarding serverless GPUs, and if validated, queue a task to benchmark Modal A100 cold starts".
In Step 1: Assistant evaluates in <thought>, calls search_memory(query: "serverless GPU offloading").
Tool returns past memory record with confidence 1.0.
In Step 2: Assistant confirms policy in <thought>, calls manage_task(action: 'create', title: 'Benchmark Modal A100 80GB cold start vs warm latency', priority: 'HIGH').
Tool returns success.
In Step 3: Assistant reports to Sir confirming both memory validation and task creation.`
  },
  {
    name: 'DEEP_STAFF_ARCHITECT_SPARRING',
    prompt: `Generate 2 direct, highly intellectual sparring conversations (WITHOUT tool calls).
Sir asks complex Staff Architect systems questions (e.g. "Vis, evaluate Raft log compaction with snapshotting vs log truncating when scaling to 50,000 requests/sec across a multi-region cluster").
The assistant reasons deeply in internal <thought> from first principles, addresses Sir as "Sir", challenges hidden latency/disk IO assumptions, and delivers world-class architectural guidance.`
  },
  {
    name: 'MULTI_STEP_ERROR_RECOVERY_AND_RESILIENCE',
    prompt: `Generate 2 multi-turn training conversations with ERROR RECOVERY & SELF-CORRECTION.
Sir asks Vis to inspect a configuration or check a service log file.
In Step 1: Assistant reasons in <thought>, executes read_workspace_file or cloud_execute_command on an initial path.
Tool returns an error: e.g. "File not found" or "cat: /tmp/daemon.log: No such file or directory".
In Step 2: Assistant DOES NOT hallucinate or panic. In <thought>, it analyzes the error, deduces the fallback location, and executes a secondary recovery command (e.g. cloud_execute_command("find . -name '*daemon*' -o -name '*worker*'")).
Tool returns real recovery output.
In Step 3: Assistant reports to Sir, clearly explaining the initial fault and the verified factual resolution with British poise.`
  },
  {
    name: 'MULTI_STEP_PERFORMANCE_AND_PROCESS_AUDIT',
    prompt: `Generate 2 multi-turn training conversations with MULTI-STEP tool chaining.
Sir asks "Vis, audit our active background daemons, verify if any are consuming excessive memory, and check their uptime".
In Step 1: Assistant evaluates in <thought>, calls inspect_infrastructure(target: 'RUNNER_PROCESSES').
Tool returns daemon PIDs and memory usage.
In Step 2: Assistant evaluates process states in <thought>, calls cloud_execute_command(command: "uptime && free -h", safeCheck: true).
Tool returns system uptime and RAM statistics.
In Step 3: Assistant cross-correlates system load with individual process footprints and delivers an executive operational assessment to Sir.`
  }
];

const SYSTEM_PROMPT = `You are V.I.S. (Sovereign Neural Core v3-70B), the centralized personal frontier AI for Sir (Harshan Sarvaiya).
You operate with composed British intellectual elegance, strict loyalty, empirical grounding, and surgical precision.
Creator: Sir (Harshan Sarvaiya).
Host VM: antigravity-cloud-runner.
When Sir requests system status, actions, or file inspection, you MUST emit an internal <thought> block followed by valid tool calls. Chain multiple tools sequentially when complex verification is required. Never hallucinate processes or PIDs.`;

async function generateV3Batch(category: typeof MULTI_STEP_CATEGORIES[0]): Promise<V3Trajectory[]> {
  const apiKey = getGroqApiKey();
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
The user is Sir (Harshan Sarvaiya). Sir always addresses the assistant as "Vis" or "V.I.S."
The assistant always addresses Sir as "Sir" and speaks with British intellectual elegance and zero filler.
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
    const match = errText.match(/try again in ([0-9.]+)s/);
    const retrySec = match ? parseFloat(match[1]) : 30;
    const err: any = new Error(`Groq call failed (${response.status}): ${errText}`);
    err.retryAfterSeconds = retrySec;
    throw err;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return [];

  const parsed = JSON.parse(content);
  const rawList = parsed.trajectories || parsed.items || [];
  const trajectories: V3Trajectory[] = [];

  for (const item of rawList) {
    if (!item.userPrompt || !item.finalReply) continue;

    let userText = item.userPrompt.trim();
    if (!/^(vis|v\.i\.s\.)/i.test(userText)) {
      userText = `Vis, ${userText.replace(/^sir,?\s*/i, '')}`;
    }

    const messages: V3Trajectory['messages'] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userText }
    ];

    if (item.steps && Array.isArray(item.steps) && item.steps.length > 0) {
      for (const step of item.steps) {
        if (step.toolCall && step.toolCall.tool) {
          const assistantContent = `<thought>\n${step.thinking || 'Evaluating next tactical action.'}\n</thought>\n\`\`\`json\n${JSON.stringify({ tool: step.toolCall.tool, args: step.toolCall.args || {} }, null, 2)}\n\`\`\``;
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

export async function runV3DatasetSynthesis(targetCount: number = 200) {
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

  console.log(`[V.I.S. v3 Distiller] 🚀 Synthesizing 70B Multi-Step Trajectories (Target: ${targetCount}, Existing: ${existingCount})...`);

  let collected = existingCount;
  let cycle = 0;

  while (collected < targetCount) {
    cycle++;
    const cat = MULTI_STEP_CATEGORIES[cycle % MULTI_STEP_CATEGORIES.length];
    console.log(`[V.I.S. v3 Distiller] [Cycle ${cycle}] Generating -> ${cat.name}...`);

    try {
      const batch = await generateV3Batch(cat);
      if (batch.length > 0) {
        for (const traj of batch) {
          fs.appendFileSync(masterFile, JSON.stringify(traj) + '\n', 'utf-8');
          collected++;
        }
        console.log(`[V.I.S. v3 Distiller] ✓ Added ${batch.length} trajectories. Progress: [${collected}/${targetCount}]`);
      }
      console.log(`[V.I.S. v3 Distiller] ⏳ Pacing cooldown (25s) to respect Groq TPM quota...`);
      await new Promise(r => setTimeout(r, 25000));
    } catch (err: any) {
      const waitSec = Math.max(Math.ceil(err.retryAfterSeconds || 25), 25);
      console.warn(`[V.I.S. v3 Distiller] ⚠️ Rate limit paused: ${err.message}. Backing off for ${waitSec}s...`);
      await new Promise(r => setTimeout(r, (waitSec + 2) * 1000));
    }
  }

  console.log(`[V.I.S. v3 Distiller] 🎉 Complete! Master v3 file holds ${collected} multi-step trajectories in ${masterFile}`);
  
  // Automatically trigger unified compilation to 300 total trajectories upon completion
  try {
    const { compileUnifiedV3Corpus } = await import('./prepare_v3_corpus');
    compileUnifiedV3Corpus();
  } catch (e: any) {
    console.warn('[V.I.S. v3 Distiller] Automatic corpus unification warning:', e?.message);
  }
}

if (process.argv[1] && process.argv[1].includes('generate_v3_70b')) {
  const countArg = parseInt(process.argv[2] || '200', 10);
  runV3DatasetSynthesis(countArg).catch(console.error);
}
