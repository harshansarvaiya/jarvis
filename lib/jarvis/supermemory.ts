/**
 * Supermemory Cloud Integration Client (v4 API)
 * 
 * Provides temporal contradiction resolution, dynamic profile synthesis,
 * and persistent agent context via Supermemory's cloud REST endpoints.
 * Rated #1 on LongMemEval & LoCoMo benchmarks.
 * 
 * Complies with Directive 01 (Guardian Protocol) & Directive 06 (Zero-Thrashing).
 */

export interface SupermemoryConfig {
  apiKey?: string;
  baseUrl?: string;
  containerTag?: string;
}

export interface SupermemoryDocument {
  id?: string;
  content: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface SupermemorySearchResult {
  id: string;
  content: string;
  score?: number;
  metadata?: Record<string, any>;
  updatedAt?: string;
}

export interface SupermemoryProfile {
  static: string[];
  dynamic: string[];
}

export class SupermemoryClient {
  private explicitApiKey?: string;
  private explicitBaseUrl?: string;
  private defaultContainerTag: string;

  constructor(config?: SupermemoryConfig) {
    this.explicitApiKey = config?.apiKey;
    this.explicitBaseUrl = config?.baseUrl;
    this.defaultContainerTag = config?.containerTag || 'jarvis';
  }

  private getApiKey(): string | undefined {
    return this.explicitApiKey || process.env.SUPERMEMORY_API_KEY;
  }

  private getBaseUrl(): string {
    return (this.explicitBaseUrl || process.env.SUPERMEMORY_BASE_URL || 'https://api.supermemory.ai/v4').replace(/\/$/, '');
  }

  public isConfigured(): boolean {
    const key = this.getApiKey();
    return Boolean(key && key.trim().length > 0);
  }

  /**
   * Upsert a memory document into Supermemory Cloud (v4/memories).
   */
  public async addMemory(
    doc: SupermemoryDocument,
    containerTag?: string
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { success: false, error: 'SUPERMEMORY_API_KEY not configured' };
    }

    try {
      const res = await fetch(`${this.getBaseUrl()}/memories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          containerTag: containerTag || this.defaultContainerTag,
          memories: [
            {
              content: doc.content,
              metadata: doc.metadata || null,
            },
          ],
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        const errorText = await res.text();
        return { success: false, error: `Supermemory API HTTP ${res.status}: ${errorText}` };
      }

      const data = await res.json();
      const firstMemory = data.memories?.[0];
      return { success: true, id: firstMemory?.id || data.documentId };
    } catch (err: any) {
      return { success: false, error: err.message || 'Supermemory request failed' };
    }
  }

  /**
   * Search synthesized agent memories with temporal contradiction resolution (v4/search).
   */
  public async searchMemories(
    query: string,
    limit = 5,
    containerTag?: string
  ): Promise<SupermemorySearchResult[]> {
    const apiKey = this.getApiKey();
    if (!apiKey || !query.trim()) {
      return [];
    }

    try {
      const res = await fetch(`${this.getBaseUrl()}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          containerTag: containerTag || this.defaultContainerTag,
          q: query,
          limit,
        }),
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) return [];

      const data = await res.json();
      const results: any[] = Array.isArray(data.results) ? data.results : [];

      return results.map((r: any) => ({
        id: r.id || r.rootMemoryId || Math.random().toString(36).substring(2, 9),
        content: r.memory || r.content || '',
        score: r.similarity ?? r.score ?? 1.0,
        metadata: r.metadata || {},
        updatedAt: r.updatedAt,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Fetches the synthesized rolling user profile snapshot (~50ms) (v4/profile).
   */
  public async getProfile(containerTag?: string): Promise<SupermemoryProfile | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;

    try {
      const res = await fetch(`${this.getBaseUrl()}/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          containerTag: containerTag || this.defaultContainerTag,
        }),
        signal: AbortSignal.timeout(3000),
      });

      if (!res.ok) return null;

      const data = await res.json();
      return data.profile as SupermemoryProfile;
    } catch {
      return null;
    }
  }
}

export const supermemory = new SupermemoryClient();
