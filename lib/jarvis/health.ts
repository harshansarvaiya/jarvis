import { getStorage } from '@/lib/jarvis/storage';

export interface HealthMetric {
  name: string;
  value: string | number;
  unit?: string;
  status: 'healthy' | 'degraded' | 'critical';
  latencyMs?: number;
  timestamp: string;
}

export interface UpstashHealthReport {
  isCloud: boolean;
  endpoint: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  latencyMs: number;
  metrics: HealthMetric[];
  error?: string;
}

/**
 * Probes Upstash Redis REST cluster latency and storage status
 */
export async function checkUpstashHealth(): Promise<UpstashHealthReport> {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  const storage = getStorage();
  const isCloud = storage.isCloud;
  const endpoint = isCloud ? 'witty-grouse-110573.upstash.io' : 'data/jarvis-state.json (local disk fallback)';

  try {
    const state = await storage.getState();
    const latencyMs = Date.now() - start;

    const tasksCount = state?.tasks?.length ?? 0;
    const memoriesCount = state?.memories?.length ?? 0;

    const status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' = 
      latencyMs < 300 ? 'ONLINE' : latencyMs < 800 ? 'DEGRADED' : 'DEGRADED';

    const metrics: HealthMetric[] = [
      {
        name: 'Upstash REST Round-Trip Latency',
        value: latencyMs,
        unit: 'ms',
        status: latencyMs < 300 ? 'healthy' : latencyMs < 800 ? 'degraded' : 'critical',
        latencyMs,
        timestamp,
      },
      {
        name: 'Active Tasks In Memory',
        value: tasksCount,
        unit: 'tasks',
        status: 'healthy',
        timestamp,
      },
      {
        name: 'Episodic Memory Vault Count',
        value: memoriesCount,
        unit: 'nodes',
        status: 'healthy',
        timestamp,
      },
    ];

    return {
      isCloud,
      endpoint,
      status,
      latencyMs,
      metrics,
    };
  } catch (error: any) {
    const latencyMs = Date.now() - start;
    return {
      isCloud,
      endpoint,
      status: 'OFFLINE',
      latencyMs,
      metrics: [
        {
          name: 'Upstash REST Round-Trip Latency',
          value: latencyMs,
          unit: 'ms',
          status: 'critical',
          latencyMs,
          timestamp,
        },
      ],
      error: error?.message || 'Upstash REST health check failed',
    };
  }
}
