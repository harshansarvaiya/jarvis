/**
 * J.A.R.V.I.S. Mark II — Composio 500+ App Gateway Substrate
 * 
 * Implements lightweight zero-dependency REST client for Composio cloud.
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
  createdAt?: string;
}

export class ComposioGateway {
  private apiKey: string;
  private baseUrl = 'https://backend.composio.dev/api/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.COMPOSIO_API_KEY || '';
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 8);
  }

  private getHeaders(): Record<string, string> {
    return {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'JARVIS-Mark-II-Composio-Gateway',
    };
  }

  /**
   * Executes a specific Composio action (e.g. "LINEAR_CREATE_ISSUE", "NOTION_CREATE_PAGE", "SLACK_SEND_MESSAGE").
   */
  public async executeAction(
    actionName: string,
    params: Record<string, any> = {},
    entityId = 'default'
  ): Promise<ComposioActionExecutionResult> {
    const startTime = Date.now();
    if (!this.isConfigured()) {
      return {
        success: false,
        actionName,
        error: 'COMPOSIO_API_KEY is not configured in .env.local. Please provide your Composio API key to activate 500+ app connectors.',
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      const normalizedAction = actionName.toUpperCase().replace(/-/g, '_');
      const url = `${this.baseUrl}/actions/${encodeURIComponent(normalizedAction)}/execute`;

      const res = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          entityId,
          input: params,
        }),
        signal: AbortSignal.timeout(15000),
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          actionName: normalizedAction,
          error: data.message || data.error || `Composio action execution failed with HTTP ${res.status}`,
          latencyMs: Date.now() - startTime,
        };
      }

      return {
        success: data.successful !== false,
        actionName: normalizedAction,
        data: data.data || data.response_data || data,
        error: data.error,
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        actionName,
        error: err.message || 'Composio network timeout / connection failure',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Lists all active connected accounts (e.g. Linear, Slack, Notion) for the given user entity.
   */
  public async listConnectedAccounts(entityId = 'default'): Promise<{ success: boolean; accounts: ComposioConnectedAccount[]; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, accounts: [], error: 'COMPOSIO_API_KEY is not configured.' };
    }

    try {
      const url = `${this.baseUrl}/connectedAccounts?entityId=${encodeURIComponent(entityId)}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, accounts: [], error: `Failed to list accounts: HTTP ${res.status} (${errText.slice(0, 100)})` };
      }

      const data = await res.json();
      const rawAccounts = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);

      const accounts: ComposioConnectedAccount[] = rawAccounts.map((a: any) => ({
        id: a.id || a.connectionId,
        appName: a.appName || a.appUniqueId || a.integrationId || 'unknown',
        status: a.status === 'ACTIVE' ? 'ACTIVE' : 'INITIATED',
        createdAt: a.createdAt,
      }));

      return { success: true, accounts };
    } catch (err: any) {
      return { success: false, accounts: [], error: err.message };
    }
  }

  /**
   * Generates a managed OAuth authorization URL for Sir to connect a new app (e.g. "notion", "linear", "slack").
   */
  public async initiateConnection(
    appName: string,
    entityId = 'default',
    redirectUrl?: string
  ): Promise<{ success: boolean; connectionUrl?: string; connectionId?: string; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'COMPOSIO_API_KEY is not configured.' };
    }

    try {
      const url = `${this.baseUrl}/connectedAccounts`;
      const res = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          appName: appName.toLowerCase(),
          entityId,
          redirectUrl: redirectUrl || 'https://jarvis-iota-beige.vercel.app',
        }),
        signal: AbortSignal.timeout(8000),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || `Failed to initiate connection: HTTP ${res.status}` };
      }

      const connectionUrl = data.connectionUrl || data.redirectUrl || data.url;
      const connectionId = data.connectionId || data.id;

      return { success: true, connectionUrl, connectionId };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

export const globalComposioGateway = new ComposioGateway();
