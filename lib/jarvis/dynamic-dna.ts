/**
 * J.A.R.V.I.S. Mark II — Dynamic Cognitive DNA & Context Steering Engine
 * 
 * Continuously compiles and injects Sir's mental models, coding preferences,
 * and operational heuristics into real-time conversation context.
 * 
 * Synchronizes seamlessly between Upstash Redis REST cluster and local fallback.
 */

import { Redis } from '@upstash/redis';
import * as fs from 'fs';
import * as path from 'path';

export interface CognitiveDnaNode {
  category: 'PREFERENCE' | 'HEURISTIC' | 'ARCHITECTURE' | 'DIRECTIVE';
  statement: string;
  weight: number; // 0.0 to 1.0
  source: string;
  lastUpdated: string;
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;
if (UPSTASH_URL && UPSTASH_TOKEN) {
  redis = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN });
}

const DEFAULT_COGNITIVE_NODES: CognitiveDnaNode[] = [
  {
    category: 'ARCHITECTURE',
    statement: 'Backend systems prioritize zero-thrashing GCP e2-micro resource preservation (<450MB cgroup cap, 1GB RAM) with 100% cloud inference APIs.',
    weight: 1.0,
    source: 'Directive 06',
    lastUpdated: new Date().toISOString(),
  },
  {
    category: 'DIRECTIVE',
    statement: '100% Western/American foundation models (Meta Llama, OpenAI, Google); strictly zero Chinese models under any circumstances.',
    weight: 1.0,
    source: 'Directive 01',
    lastUpdated: new Date().toISOString(),
  },
  {
    category: 'HEURISTIC',
    statement: 'Apply Investigate Iron Law to debugging: no fix without diagnostics, surgical minimum-diff changes, and closed-loop compiler verification before commits.',
    weight: 0.95,
    source: 'Operational Codex',
    lastUpdated: new Date().toISOString(),
  },
  {
    category: 'PREFERENCE',
    statement: 'High-signal British-tinged intellectual elegance for Sir (Harshan Sarvaiya); ban generic chatbot filler, platitudes, and marketing prose.',
    weight: 0.95,
    source: 'Creator Persona Matrix',
    lastUpdated: new Date().toISOString(),
  },
  {
    category: 'ARCHITECTURE',
    statement: 'Next.js 14 App Router with edge-compatible microservices, Upstash Redis 24/7 persistence, and VAPID Web Push lock-screen telemetry.',
    weight: 0.9,
    source: 'System Design Architecture',
    lastUpdated: new Date().toISOString(),
  },
];

/**
 * Retrieves the compiled dynamic cognitive DNA steering block
 */
export async function getDynamicCognitiveDnaBlock(): Promise<string> {
  let nodes: CognitiveDnaNode[] = [...DEFAULT_COGNITIVE_NODES];

  if (redis) {
    try {
      const remote = await redis.get('jarvis:dna:nodes');
      if (remote) {
        const parsed = typeof remote === 'string' ? JSON.parse(remote) : remote;
        if (Array.isArray(parsed) && parsed.length > 0) {
          nodes = parsed;
        }
      }
    } catch (err: any) {
      console.warn('[Dynamic DNA] Redis retrieval warning:', err.message);
    }
  }

  const lines = nodes
    .sort((a, b) => b.weight - a.weight)
    .map((n) => `• [${n.category} | Weight: ${(n.weight * 100).toFixed(0)}%] ${n.statement}`);

  return `### 🧬 DYNAMIC COGNITIVE DNA & CONTEXT STEERING (LIVE ASSIMILATION):
${lines.join('\n')}`;
}

/**
 * Assimilates a new heuristic or preference into cognitive DNA
 */
export async function assimilateDnaNode(node: Omit<CognitiveDnaNode, 'lastUpdated'>): Promise<{ success: boolean; totalNodes: number }> {
  let nodes: CognitiveDnaNode[] = [...DEFAULT_COGNITIVE_NODES];

  if (redis) {
    try {
      const remote = await redis.get('jarvis:dna:nodes');
      if (remote) {
        const parsed = typeof remote === 'string' ? JSON.parse(remote) : remote;
        if (Array.isArray(parsed)) nodes = parsed;
      }
    } catch {}
  }

  const existingIdx = nodes.findIndex((n) => n.statement.toLowerCase() === node.statement.toLowerCase());
  const newNode: CognitiveDnaNode = {
    ...node,
    lastUpdated: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    nodes[existingIdx] = newNode;
  } else {
    nodes.push(newNode);
  }

  if (redis) {
    try {
      await redis.set('jarvis:dna:nodes', JSON.stringify(nodes));
    } catch (err: any) {
      console.warn('[Dynamic DNA] Redis save warning:', err.message);
    }
  }

  return { success: true, totalNodes: nodes.length };
}
