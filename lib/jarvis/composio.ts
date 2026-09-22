/**
 * J.A.R.V.I.S. Mark II — Composio 500+ App Gateway Substrate
 * 
 * Native Model Context Protocol (MCP) & REST client for Composio Cloud.
 * Connects J.A.R.V.I.S. and F.R.I.D.A.Y. to Notion, Linear, Slack, Google Workspace,
 * Jira, GitHub, Discord, Stripe, etc., via managed OAuth session tokens.
 * 
 * Complies with:
 * - Directive 01 (Guardian Protocol & Secret Sentry)
 * - Directive 06 (Zero-Thrashing Infrastructure Integrity — 100% lightweight HTTP)
 */

export interface ComposioActionExecutionResult {
  success: boolean;
  actionName: string;
  data?: any;
  error?: string;
  latencyMs: number;
}

export interface ComposioConnectedAccount {
  id: string;
  appName: string;
  status: 'ACTIVE' | 'INITIATED' | 'EXPIRED';
  description?: string;
}

export class ComposioGateway {
  private explicitApiKey?: string;
  private mcpUrl = 'https://connect.composio.dev/mcp';
  private v3Url = 'https://backend.composio.dev/api/v3';

  constructor(apiKey?: string) {
    this.explicitApiKey = apiKey;
  }

  public getApiKey(): string {
    if (this.explicitApiKey) return this.explicitApiKey;
    if (process.env.COMPOSIO_API_KEY) return process.env.COMPOSIO_API_KEY;

    try {
      const fs = require('fs');
      const path = require('path');
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed.startsWith('COMPOSIO_API_KEY=')) {
            const val = trimmed.slice('COMPOSIO_API_KEY='.length).trim();
            if (val) return val;
          }
        }
      }
    } catch {}

    return '';
  }

  public isConfigured(): boolean {
    const key = this.getApiKey();
    return Boolean(key && key.length > 8);
  }

  private getMcpHeaders(): Record<string, string> {
    return {
      'x-consumer-api-key': this.getApiKey(),
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'User-Agent': 'JARVIS-Mark-II-Composio-Gateway',
    };
  }

  /**
   * Helper to parse SSE / JSON-RPC payload from Composio MCP endpoint.
   */
  private async parseMcpResponse(res: Response): Promise<any> {
    const text = await res.text();
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const json = JSON.parse(line.slice(6));
          if (json.error) {
            throw new Error(json.error.message || 'Composio MCP JSON-RPC error');
          }
          return json.result;
        } catch (e: any) {
          if (line.includes('"error"')) throw e;
        }
      }
    }

    try {
      const directJson = JSON.parse(text);
      if (directJson.error) {
        throw new Error(directJson.error.message || 'Composio MCP error');
      }
      return directJson.result || directJson;
    } catch {
      return { raw: text };
    }
  }

  /**
   * Executes a specific Composio tool action via live MCP (e.g. "LINEAR_CREATE_ISSUE", "NOTION_CREATE_PAGE", "SLACK_SEND_MESSAGE").
   */
  public async executeAction(
    actionName: string,
    params: Record<string, any> = {}
  ): Promise<ComposioActionExecutionResult> {
    const startTime = Date.now();
    if (!this.isConfigured()) {
      return {
        success: false,
        actionName,
        error: 'COMPOSIO_API_KEY is not configured. Please provide your Composio key to activate 500+ app connectors.',
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      const normalizedAction = actionName.toUpperCase().replace(/-/g, '_');

      const payload = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: normalizedAction,
          arguments: params,
        },
      };

      const res = await fetch(this.mcpUrl, {
        method: 'POST',
        headers: this.getMcpHeaders(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        const errText = await res.text();
        return {
          success: false,
          actionName: normalizedAction,
          error: `Composio execution failed with HTTP ${res.status}: ${errText.slice(0, 200)}`,
          latencyMs: Date.now() - startTime,
        };
      }

      const result = await this.parseMcpResponse(res);
      const isError = result?.isError === true;

      return {
        success: !isError,
        actionName: normalizedAction,
        data: result?.content || result,
        error: isError ? (typeof result?.content === 'string' ? result.content : JSON.stringify(result?.content)) : undefined,
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        actionName,
        error: err.message || 'Composio network timeout / execution failure',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Searches the entire 500+ Composio toolkit ecosystem for tools matching a query (e.g. "github", "notion", "email").
   */
  public async searchTools(query: string): Promise<{ success: boolean; tools: any[]; rawSummary?: string; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, tools: [], error: 'COMPOSIO_API_KEY is not configured.' };
    }

    try {
      const res = await this.executeAction('COMPOSIO_SEARCH_TOOLS', { query });
      if (!res.success) {
        return { success: false, tools: [], error: res.error };
      }

      const content = res.data;
      return {
        success: true,
        tools: Array.isArray(content) ? content : [],
        rawSummary: typeof content === 'string' ? content : JSON.stringify(content),
      };
    } catch (err: any) {
      return { success: false, tools: [], error: err.message };
    }
  }

  /**
   * Retrieves full parameter and execution schemas for a list of tool slugs on the fly.
   */
  public async getToolSchemas(toolSlugs: string[]): Promise<{ success: boolean; schemas?: any; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'COMPOSIO_API_KEY is not configured.' };
    }

    try {
      const res = await this.executeAction('COMPOSIO_GET_TOOL_SCHEMAS', { tool_slugs: toolSlugs });
      return {
        success: res.success,
        schemas: res.data,
        error: res.error,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Lists all primary tools and MCP capabilities active on the account.
   */
  public async listConnectedAccounts(): Promise<{ success: boolean; tools: any[]; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, tools: [], error: 'COMPOSIO_API_KEY is not configured.' };
    }

    try {
      const payload = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      };

      const res = await fetch(this.mcpUrl, {
        method: 'POST',
        headers: this.getMcpHeaders(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, tools: [], error: `Failed to list tools: HTTP ${res.status} (${errText.slice(0, 150)})` };
      }

      const result = await this.parseMcpResponse(res);
      const tools = result?.tools || [];

      return { success: true, tools };
    } catch (err: any) {
      return { success: false, tools: [], error: err.message };
    }
  }
}

export const globalComposioGateway = new ComposioGateway();
