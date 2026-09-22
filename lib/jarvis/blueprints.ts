/**
 * J.A.R.V.I.S. Mark II — Portable Team Blueprints Engine
 * 
 * Implements OpenMausBot & BotMRR-inspired portable team definitions
 * using structured YAML frontmatter + Markdown playbooks.
 * 
 * Enables:
 * - One-click multi-agent squad deployment from Markdown files / URLs
 * - Declarative agent roles, model affinities, tool permissions, and routines
 * - Autonomous synchronization with Upstash Redis and Cloud Runner daemon
 * - 100% Western model enforcement (Directive 01) and zero VM thrashing (Directive 06)
 */

import * as yaml from 'yaml';
import { AgentProfile, registerDynamicAgentProfiles } from './agents-registry';
import { getUniversalStorage } from './storage';
import { addTask, Priority } from './memory';

export interface BlueprintRoutine {
  name: string;
  schedule: string; // Cron expression (e.g. "0 9 * * *")
  agentId: string;
  directive: string;
  enabled?: boolean;
}

export interface BlueprintChannel {
  name: string;
  topic?: string;
  allowedAgents?: string[];
}

export interface BlueprintAgent {
  id: string;
  name: string;
  role: string;
  category?: 'SECURITY' | 'ARCHITECTURE' | 'PERFORMANCE' | 'TESTING' | 'REFACTORING' | 'DATA';
  systemPrompt?: string;
  recommendedModel?: string;
  tools?: string[];
  icon?: string;
  description?: string;
}

export interface TeamBlueprint {
  name: string;
  version: string;
  description?: string;
  author?: string;
  coordinators?: {
    chiefOfStaff?: string;
    apexEngineer?: string;
  };
  agents: BlueprintAgent[];
  channels?: BlueprintChannel[];
  routines?: BlueprintRoutine[];
  playbookMarkdown: string;
}

export interface BlueprintApplyResult {
  success: boolean;
  blueprintName: string;
  agentsRegistered: number;
  routinesScheduled: number;
  channelsConfigured: number;
  summary: string;
  errors?: string[];
}

/**
 * Parses a raw Markdown file containing YAML frontmatter into a structured TeamBlueprint.
 */
export function parseTeamBlueprint(content: string): TeamBlueprint {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error('Invalid blueprint format: Missing YAML frontmatter delimited by "---".');
  }

  const rawYaml = match[1];
  const playbookMarkdown = match[2].trim();

  let parsed: any;
  try {
    parsed = yaml.parse(rawYaml);
  } catch (err: any) {
    throw new Error(`YAML Parsing Error in Blueprint frontmatter: ${err.message}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid Blueprint frontmatter: Root must be an object.');
  }

  if (!parsed.name && !parsed.team) {
    throw new Error('Invalid Blueprint: Missing required "name" or "team" field.');
  }

  const name: string = parsed.name || parsed.team;
  const version: string = parsed.version || '1.0.0';
  const description: string = parsed.description || parsed.summary || '';
  const author: string = parsed.author || 'Harshan Sarvaiya (Sir)';

  const coordinators = {
    chiefOfStaff: parsed.coordinators?.chiefOfStaff || parsed.coordinators?.chief_of_staff || 'jarvis',
    apexEngineer: parsed.coordinators?.apexEngineer || parsed.coordinators?.apex_engineer || 'friday',
  };

  const rawAgents = Array.isArray(parsed.agents) ? parsed.agents : [];
  const agents: BlueprintAgent[] = rawAgents.map((a: any, idx: number) => ({
    id: String(a.id || `agent-${idx + 1}`).toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
    name: a.name || a.role || `Specialist ${idx + 1}`,
    role: a.role || a.name || 'Autonomous Specialist',
    category: a.category || 'ARCHITECTURE',
    systemPrompt: a.systemPrompt || a.prompt || a.instructions || `You are ${a.name || a.role}, a specialized autonomous agent serving Sir.`,
    recommendedModel: a.recommendedModel || a.model || 'gemini-3.7-flash',
    tools: Array.isArray(a.tools) ? a.tools : ['read_workspace_file', 'grep_workspace', 'manage_task'],
    icon: a.icon || '🤖',
    description: a.description || a.role || '',
  }));

  const rawRoutines = Array.isArray(parsed.routines) ? parsed.routines : [];
  const routines: BlueprintRoutine[] = rawRoutines.map((r: any) => ({
    name: r.name || 'Autonomous Routine',
    schedule: r.schedule || r.cron || '0 9 * * *',
    agentId: r.agentId || r.agent || r.entrypoint || (agents[0]?.id || 'jarvis'),
    directive: r.directive || r.prompt || r.action || 'Execute daily operational sync.',
    enabled: r.enabled !== false,
  }));

  const rawChannels = Array.isArray(parsed.channels) ? parsed.channels : [];
  const channels: BlueprintChannel[] = rawChannels.map((c: any) => ({
    name: c.name || 'general',
    topic: c.topic || '',
    allowedAgents: Array.isArray(c.allowedAgents || c.agents) ? (c.allowedAgents || c.agents) : [],
  }));

  return {
    name,
    version,
    description,
    author,
    coordinators,
    agents,
    channels,
    routines,
    playbookMarkdown,
  };
}

/**
 * Serializes a TeamBlueprint object back into portable Markdown format with YAML frontmatter.
 */
export function exportTeamBlueprint(blueprint: TeamBlueprint): string {
  const frontmatterObj = {
    name: blueprint.name,
    version: blueprint.version,
    description: blueprint.description,
    author: blueprint.author,
    coordinators: blueprint.coordinators,
    agents: blueprint.agents,
    channels: blueprint.channels && blueprint.channels.length > 0 ? blueprint.channels : undefined,
    routines: blueprint.routines && blueprint.routines.length > 0 ? blueprint.routines : undefined,
  };

  const yamlStr = yaml.stringify(frontmatterObj, { indent: 2 }).trim();
  return `---\n${yamlStr}\n---\n\n${blueprint.playbookMarkdown}\n`;
}

/**
 * Fetches and parses a TeamBlueprint from a remote URL (GitHub raw, BotMRR, or HTTPS endpoint).
 */
export async function fetchBlueprintFromUrl(url: string): Promise<TeamBlueprint> {
  let targetUrl = url.trim();

  // Handle standard GitHub URLs by converting to raw content
  const ghMatch = targetUrl.match(/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/blob\/([^/]+)\/(.*)/i);
  if (ghMatch) {
    targetUrl = `https://raw.githubusercontent.com/${ghMatch[1]}/${ghMatch[2]}/${ghMatch[3]}/${ghMatch[4]}`;
  }

  const res = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'JARVIS-Mark-II-Blueprint-Engine',
      'Accept': 'text/plain,text/markdown,*/*',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch blueprint from URL: HTTP ${res.status} (${res.statusText})`);
  }

  const markdown = await res.text();
  return parseTeamBlueprint(markdown);
}

/**
 * Persists and applies a Team Blueprint into Upstash Redis & local state.
 */
export async function applyTeamBlueprint(blueprint: TeamBlueprint): Promise<BlueprintApplyResult> {
  const storage = getUniversalStorage();
  const errors: string[] = [];

  try {
    // 1. Store the Blueprint manifest
    const blueprintKey = `jarvis:blueprint:${blueprint.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;
    await storage.execute('set', blueprintKey, JSON.stringify(blueprint));

    // 2. Register dynamic agents in Redis
    const customAgentsKey = 'jarvis:custom_agents';
    const rawExisting = await storage.execute('get', customAgentsKey);
    let existingCustom: BlueprintAgent[] = [];
    if (rawExisting) {
      existingCustom = typeof rawExisting === 'string' ? JSON.parse(rawExisting) : rawExisting;
    }
    
    // Merge new agents by ID
    const mergedMap = new Map<string, BlueprintAgent>();
    for (const a of existingCustom) mergedMap.set(a.id, a);
    for (const a of blueprint.agents) mergedMap.set(a.id, a);
    
    const mergedList = Array.from(mergedMap.values());
    await storage.execute('set', customAgentsKey, JSON.stringify(mergedList));
    registerDynamicAgentProfiles(
      mergedList.map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        category: a.category || 'ARCHITECTURE',
        systemPrompt: a.systemPrompt || '',
        recommendedModel: a.recommendedModel || 'gemini-3.7-flash',
        tools: a.tools || ['read_workspace_file', 'grep_workspace', 'manage_task'],
      }))
    );

    // 3. Register routines as tactical radar tasks / reminders
    let routinesScheduled = 0;
    if (blueprint.routines && blueprint.routines.length > 0) {
      for (const r of blueprint.routines) {
        if (r.enabled !== false) {
          try {
            addTask({
              title: `[Blueprint: ${blueprint.name}] ${r.name}`,
              description: `Agent: @${r.agentId}\nDirective: ${r.directive}\nSchedule: ${r.schedule}`,
              priority: 'HIGH',
              status: 'PENDING',
              tags: ['blueprint', 'routine', blueprint.name.toLowerCase().replace(/\s+/g, '-')],
            });
            routinesScheduled++;
          } catch (taskErr: any) {
            errors.push(`Routine scheduling warning (${r.name}): ${taskErr.message}`);
          }
        }
      }
    }

    return {
      success: true,
      blueprintName: blueprint.name,
      agentsRegistered: blueprint.agents.length,
      routinesScheduled,
      channelsConfigured: blueprint.channels?.length || 0,
      summary: `Successfully deployed Team Blueprint "${blueprint.name}" (v${blueprint.version}) with ${blueprint.agents.length} agents and ${routinesScheduled} automated routines.`,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (err: any) {
    return {
      success: false,
      blueprintName: blueprint.name,
      agentsRegistered: 0,
      routinesScheduled: 0,
      channelsConfigured: 0,
      summary: `Failed to apply Team Blueprint: ${err.message}`,
      errors: [err.message],
    };
  }
}
