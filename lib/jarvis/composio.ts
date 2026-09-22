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
  private baseUrl = 'https://backend.composio.dev/api/v3';

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
   * Executes a specific Composio tool action (e.g. "LINEAR_CREATE_ISSUE", "NOTION_CREATE_PAGE", "SLACK_SEND_MESSAGE").
   */
  public async executeAction(
    actionName: string,
    params: Record<string, any> = {},
    connectedAccountId?: string
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
      const normalizedAction = actionName.toLowerCase().replace(/_/g, '-');
      const url = `${this.baseUrl}/tools/execute/${encodeURIComponent(normalizedAction)}`;

      const payload: Record<string, any> = {
        arguments: params,
      };
      if (connectedAccountId && connectedAccountId !== 'default') {
        payload.connected_account_id = connectedAccountId;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          actionName: normalizedAction,
          error: data.message || data.error?.message || `Composio action execution failed with HTTP ${res.status}`,
          latencyMs: Date.now() - startTime,
        };
      }

      return {
        success: data.successful !== false && !data.error,
        actionName: normalizedAction,
        data: data.data || data.response_data || data.result || data,
        error: data.error?.message || data.error,
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
   * Lists all active connected accounts (e.g. Linear, Slack, Notion) for the authenticated Composio account.
   */
  public async listConnectedAccounts(userFilter?: string): Promise<{ success: boolean; accounts: ComposioConnectedAccount[]; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, accounts: [], error: 'COMPOSIO_API_KEY is not configured.' };
    }

    try {
      let url = `${this.baseUrl}/connected_accounts`;
      if (userFilter) {
        url += `?user_ids=${encodeURIComponent(userFilter)}`;
      }

      const res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, accounts: [], error: `Failed to list accounts: HTTP ${res.status} (${errText.slice(0, 150)})` };
      }

      const data = await res.json();
      const rawAccounts = Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.connected_accounts)
        ? data.connected_accounts
        : Array.isArray(data)
        ? data
        : [];

      const accounts: ComposioConnectedAccount[] = rawAccounts.map((a: any) => ({
        id: a.id || a.connected_account_id || a.connectionId,
        appName: a.appName || a.app_unique_id || a.toolkit_slug || a.integrationId || 'unknown',
        status: a.status === 'ACTIVE' || a.status === 'ENABLED' ? 'ACTIVE' : 'INITIATED',
        createdAt: a.createdAt || a.created_at,
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
      const url = `${this.baseUrl}/connected_accounts/link`;
      const res = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          toolkit_slug: appName.toLowerCase(),
          user_id: entityId,
          callback_url: redirectUrl || 'https://jarvis-iota-beige.vercel.app',
        }),
        signal: AbortSignal.timeout(8000),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || data.error?.message || `Failed to initiate connection: HTTP ${res.status}` };
      }

      const connectionUrl = data.redirect_url || data.connectionUrl || data.url || data.link;
      const connectionId = data.connected_account_id || data.connectionId || data.id;

      return { success: true, connectionUrl, connectionId };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

export const globalComposioGateway = new ComposioGateway();
