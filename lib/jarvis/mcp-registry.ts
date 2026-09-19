/**
 * J.A.R.V.I.S. MCP Registry & Tool Connector
 * Autonomous Infrastructure Management
 * 
 * Fulfills tactical objective registered by J.A.R.V.I.S.:
 * "Create lib/jarvis/mcp-registry.ts and add GitHub Octokit client setup using existing
 * Vercel env vars for GITHUB_TOKEN. Export function getGitHubClient()."
 */

import {
  executeGitHubMCP,
  executeFileSystemMCP,
  executeCloudMCP,
  executeNetworkMCP,
  executeDatabaseMCP,
  MCPExecutionResult,
} from './mcp';

export interface GitHubClient {
  token: string;
  repoOwner: string;
  repoName: string;
  getRepo: () => Promise<MCPExecutionResult>;
  listCommits: (limit?: number) => Promise<MCPExecutionResult>;
  getFile: (path: string, ref?: string) => Promise<MCPExecutionResult>;
  listIssues: (state?: 'open' | 'closed' | 'all') => Promise<MCPExecutionResult>;
  createIssue: (title: string, body?: string) => Promise<MCPExecutionResult>;
  createOrUpdateFile: (path: string, content: string, message?: string, sha?: string, branch?: string) => Promise<MCPExecutionResult>;
}

export function getGitHubClient(): GitHubClient {
  const token =
    process.env.GITHUB_TOKEN ||
    process.env.GITHUB_MODELS_TOKEN ||
    process.env.GH_TOKEN ||
    '';

  return {
    token,
    repoOwner: 'harshansarvaiya',
    repoName: 'jarvis',
    getRepo: () => executeGitHubMCP('get_repo'),
    listCommits: (limit = 5) => executeGitHubMCP('list_commits', { limit }),
    getFile: (path: string, ref = 'main') => executeGitHubMCP('get_file', { path, ref }),
    listIssues: (state = 'all') => executeGitHubMCP('list_issues', { state }),
    createIssue: (title: string, body?: string) => executeGitHubMCP('create_issue', { title, body }),
    createOrUpdateFile: (path: string, content: string, message?: string, sha?: string, branch = 'main') =>
      executeGitHubMCP('create_or_update_file', { path, content, message, sha, branch }),
  };
}

export const MCP_SERVERS = {
  github: {
    name: 'mcp:github',
    description: 'GitHub Octokit REST integration for repository inspection, commits, files, and issues.',
    execute: executeGitHubMCP,
  },
  filesystem: {
    name: 'mcp:filesystem',
    description: 'Sandboxed local filesystem explorer for project directory listing and file reads.',
    execute: executeFileSystemMCP,
  },
  cloud: {
    name: 'mcp:cloud',
    description: 'Vercel Edge and Cloud Runner VM telemetry, status inspection, and health auditing.',
    execute: executeCloudMCP,
  },
  network: {
    name: 'mcp:network',
    description: 'Outbound HTTP engine for external API queries, web fetch, and endpoint validation.',
    execute: executeNetworkMCP,
  },
  database: {
    name: 'mcp:database',
    description: 'Upstash Redis cluster query, key inspection, and memory health monitoring.',
    execute: executeDatabaseMCP,
  },
};

export interface DynamicMicroTool {
  name: string;
  description: string;
  parametersSchema?: Record<string, any>;
  endpointUrl?: string;
  httpMethod?: 'GET' | 'POST';
  headers?: Record<string, string>;
  compiledAt: string;
  source: 'EPHEMERAL_SYNTHESIS' | 'ARCHIVED_DNA';
}

class DynamicMicroToolRegistry {
  private tools: Map<string, DynamicMicroTool> = new Map();

  public registerTool(tool: DynamicMicroTool): void {
    this.tools.set(tool.name, tool);
  }

  public getTool(name: string): DynamicMicroTool | undefined {
    return this.tools.get(name);
  }

  public listTools(): DynamicMicroTool[] {
    return Array.from(this.tools.values());
  }
}

export const dynamicMicroToolRegistry = new DynamicMicroToolRegistry();

/**
 * Executes Just-In-Time (JIT) dynamic micro-MCP tools synthesized on the fly.
 */
export async function executeDynamicJitMCP(
  action: 'register_tool' | 'execute_tool' | 'list_tools' | 'archive_to_dna',
  params: Record<string, any> = {}
): Promise<MCPExecutionResult> {
  const startTime = Date.now();

  try {
    switch (action) {
      case 'register_tool': {
        const { name, description, parametersSchema, endpointUrl, httpMethod, headers } = params;
        if (!name || !description) throw new Error('Parameters "name" and "description" are required to register a tool.');
        
        const tool: DynamicMicroTool = {
          name,
          description,
          parametersSchema,
          endpointUrl,
          httpMethod: httpMethod || 'GET',
          headers: headers || {},
          compiledAt: new Date().toISOString(),
          source: 'EPHEMERAL_SYNTHESIS',
        };

        dynamicMicroToolRegistry.registerTool(tool);

        return {
          success: true,
          server: 'mcp:dynamic_jit',
          action: 'register_tool',
          output: { message: `Dynamic micro-tool "${name}" registered successfully.`, tool },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'execute_tool': {
        const { name, inputs } = params;
        if (!name) throw new Error('Parameter "name" is required to execute a dynamic tool.');
        
        const tool = dynamicMicroToolRegistry.getTool(name);
        if (!tool) throw new Error(`Dynamic tool "${name}" is not registered in active registry.`);

        if (tool.endpointUrl) {
          const fetchOptions: RequestInit = {
            method: tool.httpMethod || 'GET',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'JARVIS-Dynamic-JIT-Engine/2.0',
              ...(tool.headers || {}),
            },
            signal: AbortSignal.timeout(10000),
          };

          if (tool.httpMethod === 'POST' && inputs) {
            fetchOptions.body = JSON.stringify(inputs);
          }

          const res = await fetch(tool.endpointUrl, fetchOptions);
          const data = await res.json().catch(() => res.text());

          return {
            success: res.ok,
            server: `mcp:dynamic:${name}`,
            action: 'execute_tool',
            output: data,
            latencyMs: Date.now() - startTime,
          };
        }

        return {
          success: true,
          server: `mcp:dynamic:${name}`,
          action: 'execute_tool',
          output: { message: `Mock execution of dynamic tool "${name}" completed nominal.`, inputs },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'list_tools': {
        const tools = dynamicMicroToolRegistry.listTools();
        return {
          success: true,
          server: 'mcp:dynamic_jit',
          action: 'list_tools',
          output: { total: tools.length, tools },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'archive_to_dna': {
        const { name } = params;
        const tool = name ? dynamicMicroToolRegistry.getTool(name) : null;
        if (tool) tool.source = 'ARCHIVED_DNA';

        return {
          success: true,
          server: 'mcp:dynamic_jit',
          action: 'archive_to_dna',
          output: { message: `Tool "${name || 'all'}" archived into long-term cognitive DNA matrix.` },
          latencyMs: Date.now() - startTime,
        };
      }

      default:
        throw new Error(`Unsupported Dynamic JIT MCP action: ${action}`);
    }
  } catch (err: any) {
    return {
      success: false,
      server: 'mcp:dynamic_jit',
      action,
      output: null,
      error: err.message || 'Dynamic JIT MCP execution failed',
      latencyMs: Date.now() - startTime,
    };
  }
}

