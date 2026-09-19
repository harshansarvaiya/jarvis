/**
 * J.A.R.V.I.S. Mark II / F.R.I.D.A.Y. — JIT (Just-In-Time) In-Memory Tool Synthesis Substrate
 * Part of Project "APEX COGNITIVE GLASS"
 * 
 * Enables Friday & Jarvis to dynamically invent, compiler-verify, sandbox,
 * and execute novel executable tools on-the-fly in under 300ms when standard tools do not exist.
 * 
 * Complies with Directive 01 (Guardian Protocol), Directive 04 (Sovereign Loyalty),
 * and Directive 06 (Zero-Thrashing Infrastructure Integrity).
 */

import vm from 'vm';
import { Redis } from '@upstash/redis';

export interface SynthesizedJitTool {
  name: string;
  description: string;
  parametersSchema: Record<string, { type: string; description: string; required?: boolean }>;
  executableCode: string; // JavaScript / TypeScript function: async (inputs, context) => { ... }
  category: 'API_INTEGRATION' | 'DATA_TRANSFORMATION' | 'CODE_ANALYSIS' | 'UTILITY' | 'FORENSICS';
  authorPersona: 'FRIDAY' | 'JARVIS';
  compiledAt: string;
  executionCount: number;
  successRate: number;
  isPersistent: boolean;
}

export interface JitExecutionResult {
  success: boolean;
  toolName: string;
  output: any;
  error?: string;
  executionMs: number;
  source: 'EPHEMERAL_JIT' | 'PERSISTENT_VAULT';
}

// In-Memory Registry for active session
const inMemoryJitVault = new Map<string, SynthesizedJitTool>();

// Upstash Redis Connection for Long-Term Tool Persistence
let redis: Redis | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// Guardian Protocol Safety Filter on Dynamic Code
const FORBIDDEN_JIT_PATTERNS = [
  /\bprocess\.exit\b/,
  /\bchild_process\b/,
  /\bexecSync\b/,
  /\bspawnSync\b/,
  /\bfs\.(unlink|rm|rmdir|truncate)Sync?\b/,
  /\brm\s+-rf\b/,
  /\bDROP\s+TABLE\b/i,
  /\bchmod\s+777\b/,
  /\b:\(\)\s*\{/,
];

function sanitizeJitCode(code: string): { safe: boolean; reason?: string } {
  for (const pattern of FORBIDDEN_JIT_PATTERNS) {
    if (pattern.test(code)) {
      return {
        safe: false,
        reason: `Code matched Guardian Protocol hard-deny pattern: ${pattern}`,
      };
    }
  }
  return { safe: true };
}

/**
 * 1. Synthesize & Register a New JIT Micro-Tool
 */
export async function synthesizeJitTool(options: {
  name: string;
  description: string;
  parametersSchema?: Record<string, { type: string; description: string; required?: boolean }>;
  executableCode: string;
  category?: 'API_INTEGRATION' | 'DATA_TRANSFORMATION' | 'CODE_ANALYSIS' | 'UTILITY' | 'FORENSICS';
  authorPersona?: 'FRIDAY' | 'JARVIS';
  persistToVault?: boolean;
}): Promise<{ success: boolean; tool?: SynthesizedJitTool; error?: string }> {
  const cleanName = options.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const check = sanitizeJitCode(options.executableCode);

  if (!check.safe) {
    return {
      success: false,
      error: `🛡️ Guardian Protocol blocked JIT synthesis: ${check.reason}`,
    };
  }

  const tool: SynthesizedJitTool = {
    name: cleanName,
    description: options.description.trim(),
    parametersSchema: options.parametersSchema || {},
    executableCode: options.executableCode.trim(),
    category: options.category || 'UTILITY',
    authorPersona: options.authorPersona || 'FRIDAY',
    compiledAt: new Date().toISOString(),
    executionCount: 0,
    successRate: 1.0,
    isPersistent: Boolean(options.persistToVault),
  };

  // Register in local memory
  inMemoryJitVault.set(cleanName, tool);

  // Persist to Upstash Redis asynchronously if requested
  if (options.persistToVault && redis) {
    try {
      await redis.set(`jarvis:jit_tool:${cleanName}`, JSON.stringify(tool));
    } catch (redisErr) {
      console.warn('[JIT Tools] Redis persistence warning:', redisErr);
    }
  }

  console.log(`[JIT Engine] ⚡ Dynamically synthesized micro-tool "${cleanName}" by ${tool.authorPersona}`);
  return { success: true, tool };
}

/**
 * 2. Execute a Synthesized JIT Micro-Tool in a Secure Sandboxed VM
 */
export async function executeJitTool(
  name: string,
  inputs: Record<string, any> = {}
): Promise<JitExecutionResult> {
  const startTime = Date.now();
  const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

  let tool = inMemoryJitVault.get(cleanName);

  // If not in local memory, check Upstash Redis
  let source: 'EPHEMERAL_JIT' | 'PERSISTENT_VAULT' = 'EPHEMERAL_JIT';
  if (!tool && redis) {
    try {
      const stored = (await redis.get(`jarvis:jit_tool:${cleanName}`)) as string | null;
      if (stored) {
        tool = typeof stored === 'string' ? JSON.parse(stored) : stored;
        if (tool) {
          inMemoryJitVault.set(cleanName, tool);
          source = 'PERSISTENT_VAULT';
        }
      }
    } catch {}
  }

  if (!tool) {
    return {
      success: false,
      toolName: cleanName,
      output: null,
      error: `JIT tool "${cleanName}" does not exist in memory or persistent vault. Synthesize it first via synthesize_jit_tool.`,
      executionMs: Date.now() - startTime,
      source: 'EPHEMERAL_JIT',
    };
  }

  try {
    // Build Isolated Sandboxed Execution Context
    const sandbox = {
      inputs,
      fetch: globalThis.fetch,
      URL: globalThis.URL,
      URLSearchParams: globalThis.URLSearchParams,
      Buffer: globalThis.Buffer,
      JSON: globalThis.JSON,
      Math: globalThis.Math,
      Date: globalThis.Date,
      RegExp: globalThis.RegExp,
      console: {
        log: (...args: any[]) => console.log(`[JIT:${cleanName}]`, ...args),
        warn: (...args: any[]) => console.warn(`[JIT:${cleanName}]`, ...args),
        error: (...args: any[]) => console.error(`[JIT:${cleanName}]`, ...args),
      },
      result: null as any,
    };

    const context = vm.createContext(sandbox);

    // Wrap in async immediately-invoked function returning promise
    const wrappedCode = `
      (async () => {
        const handler = ${tool.executableCode};
        return await handler(inputs, { fetch, URL, Buffer, JSON, Math, Date });
      })();
    `;

    const script = new vm.Script(wrappedCode, { filename: `jit_${cleanName}.js` });
    const executionPromise = script.runInContext(context, { timeout: 6000 });

    const output = await Promise.race([
      executionPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('JIT tool execution timed out after 6000ms')), 6000)),
    ]);

    tool.executionCount += 1;
    const executionMs = Date.now() - startTime;

    return {
      success: true,
      toolName: cleanName,
      output,
      executionMs,
      source,
    };
  } catch (err: any) {
    console.error(`[JIT Engine] Execution error in "${cleanName}":`, err.message);
    return {
      success: false,
      toolName: cleanName,
      output: null,
      error: `JIT Runtime Exception: ${err.message}`,
      executionMs: Date.now() - startTime,
      source,
    };
  }
}

/**
 * 3. List All Available JIT Micro-Tools
 */
export async function listAllJitTools(): Promise<SynthesizedJitTool[]> {
  const tools = Array.from(inMemoryJitVault.values());

  if (redis) {
    try {
      const keys = await redis.keys('jarvis:jit_tool:*');
      if (keys && keys.length > 0) {
        for (const key of keys) {
          const name = key.replace('jarvis:jit_tool:', '');
          if (!inMemoryJitVault.has(name)) {
            const data = (await redis.get(key)) as any;
            if (data) {
              const parsed = typeof data === 'string' ? JSON.parse(data) : data;
              inMemoryJitVault.set(name, parsed);
              tools.push(parsed);
            }
          }
        }
      }
    } catch {}
  }

  return tools;
}
