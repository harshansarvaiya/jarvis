/**
 * J.A.R.V.I.S. Edge-Compatible MCP Multi-Server Client
 * "Project Hands": Standardized client interface for dispatching actions to MCP servers.
 * 
 * Fulfills architectural blueprint designed by J.A.R.V.I.S.:
 * "Prepared code for lib/jarvis/mcp-client.ts and app/api/mcp/route.ts."
 */

import {
  executeGitHubMCP,
  executeFileSystemMCP,
  executeCloudMCP,
  executeNetworkMCP,
  executeDatabaseMCP,
  executeExaMCP,
  executeVercelMCP,
  executeMemoryMCP,
  executeGoogleCalendarMCP,
  executeGoogleDriveMCP,
  executePlaywrightMCP,
  MCPExecutionResult,
} from './mcp';

export type MCPServerId =
  | 'github'
  | 'filesystem'
  | 'cloud'
  | 'network'
  | 'database'
  | 'exa'
  | 'vercel'
  | 'memory'
  | 'calendar'
  | 'drive'
  | 'playwright';

export interface MCPClientRequest {
  server: MCPServerId;
  action: string;
  params?: Record<string, any>;
}

export class JarvisMCPClient {
  private localBaseUrl: string;

  constructor(localBaseUrl = '') {
    this.localBaseUrl = localBaseUrl;
  }

  /**
   * Dispatches an action directly to the corresponding MCP engine.
   * If running in a remote/edge context where internal imports are preferred, executes directly.
   */
  async dispatch(req: MCPClientRequest): Promise<MCPExecutionResult> {
    const { server, action, params = {} } = req;

    switch (server) {
      case 'github':
        return await executeGitHubMCP(action as any, params);

      case 'filesystem':
        return await executeFileSystemMCP(action as any, params);

      case 'cloud':
        return await executeCloudMCP(action as any);

      case 'network': {
        const url = params.url;
        if (!url) throw new Error('Parameter "url" required for network action');
        return await executeNetworkMCP(url, params.method || 'GET', params.headers, params.body);
      }

      case 'database':
        return await executeDatabaseMCP(action as any, params);

      case 'exa':
        return await executeExaMCP(action as any, params);

      case 'vercel':
        return await executeVercelMCP(action as any, params);

      case 'memory':
        return await executeMemoryMCP(action as any, params);

      case 'calendar':
        return await executeGoogleCalendarMCP(action as any, params);

      case 'drive':
        return await executeGoogleDriveMCP(action as any, params);

      case 'playwright':
        return await executePlaywrightMCP(action as any, params);

      default:
        return {
          success: false,
          server,
          action,
          output: null,
          error: `Unknown MCP server: ${server}`,
        };
    }
  }

  /**
   * Dispatches an action over HTTP transport to /api/mcp endpoint.
   */
  async dispatchOverHttp(req: MCPClientRequest, token?: string): Promise<MCPExecutionResult> {
    const endpoint = `${this.localBaseUrl}/api/mcp`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(req),
    });

    return await res.json();
  }
}

export const mcpClient = new JarvisMCPClient();
