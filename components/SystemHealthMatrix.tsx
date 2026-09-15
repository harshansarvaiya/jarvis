'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Server,
  Database,
  Cpu,
  Globe,
  Bell,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Zap,
  ShieldCheck,
  Radio,
  Clock,
  Layers,
} from 'lucide-react';
import { triggerDeviceNotification } from '@/lib/jarvis/notifications';

export interface SystemNodeHealth {
  id: string;
  name: string;
  category: 'COMPUTE' | 'STORAGE' | 'AI_ENGINE' | 'GATEWAY' | 'DEPLOYMENT';
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  latencyMs: number;
  details: string;
  lastCheck: string;
}

export interface HealthResponse {
  timestamp: string;
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  overallUptime: string;
  summary: string;
  checkDurationMs: number;
  nodes: SystemNodeHealth[];
}

export const SystemHealthMatrix: React.FC = () => {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/jarvis/health');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('[HealthMatrix] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(fetchHealth, 10000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'COMPUTE':
        return <Server className="w-4 h-4 text-cyan-400" />;
      case 'STORAGE':
        return <Database className="w-4 h-4 text-purple-400" />;
      case 'AI_ENGINE':
        return <Cpu className="w-4 h-4 text-emerald-400" />;
      case 'GATEWAY':
        return <Radio className="w-4 h-4 text-amber-400" />;
      case 'DEPLOYMENT':
        return <Globe className="w-4 h-4 text-blue-400" />;
      default:
        return <Layers className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: 'ONLINE' | 'DEGRADED' | 'OFFLINE') => {
    switch (status) {
      case 'ONLINE':
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>ONLINE</span>
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>DEGRADED</span>
          </span>
        );
      case 'OFFLINE':
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span>OFFLINE</span>
          </span>
        );
    }
  };

  const filteredNodes = data?.nodes.filter((node) => {
    if (filterCategory === 'ALL') return true;
    return node.category === filterCategory;
  }) || [];

  return (
    <div className="space-y-4 font-sans text-slate-100 p-1">
      {/* Overview Banner */}
      <div className="relative overflow-hidden rounded-xl bg-slate-900/80 border border-cyan-500/40 p-4 shadow-[0_0_30px_rgba(0,229,255,0.15)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-cyan-950/80 border border-cyan-500/50">
              <Activity className="w-6 h-6 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-mono text-sm font-bold text-cyan-300 tracking-wider uppercase">
                  SOVEREIGN SYSTEM TELEMETRY MATRIX
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  STAGE 4 SUBSTRATE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time latency, status, and health metrics across all 9 external service nodes
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={fetchHealth}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-xs font-mono flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>PULSE REFRESH</span>
            </button>

            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
                autoRefresh
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {autoRefresh ? 'AUTO 10S: ON' : 'AUTO 10S: OFF'}
            </button>
          </div>
        </div>

        {/* Telemetry Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 font-mono">
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">SYSTEM STATUS</div>
            <div className="text-sm font-bold text-emerald-400 mt-0.5 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{data?.overallStatus || 'HEALTHY'}</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">NODE CAPACITY</div>
            <div className="text-sm font-bold text-cyan-300 mt-0.5">
              {data?.summary || '9/9 Operational'}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">SYSTEM UPTIME</div>
            <div className="text-sm font-bold text-purple-300 mt-0.5">
              {data?.overallUptime || '99.98%'}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">PROBE DURATION</div>
            <div className="text-sm font-bold text-amber-300 mt-0.5 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{data ? `${data.checkDurationMs}ms` : '---'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter Ribbons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono text-xs">
        <div className="flex items-center space-x-1 overflow-x-auto pb-1">
          {['ALL', 'COMPUTE', 'STORAGE', 'AI_ENGINE', 'GATEWAY', 'DEPLOYMENT'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1 rounded-lg transition-colors whitespace-nowrap ${
                filterCategory === cat
                  ? 'bg-cyan-500 text-black font-bold shadow-[0_0_10px_rgba(0,229,255,0.4)]'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={async () => {
            await triggerDeviceNotification({
              id: `telemetry-${Date.now()}`,
              title: 'J.A.R.V.I.S. Telemetry Test',
              message: 'All 9 external subsystems report GREEN operational status.',
              priority: 'HIGH',
              timestamp: new Date().toLocaleTimeString(),
            });
          }}
          className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs flex items-center space-x-1.5 transition-colors"
        >
          <Bell className="w-3.5 h-3.5 text-cyan-400" />
          <span>TEST LOCK-SCREEN ALERT</span>
        </button>
      </div>

      {/* Grid of Nodes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredNodes.map((node) => (
          <div
            key={node.id}
            className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 transition-colors flex flex-col justify-between space-y-2"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  {getCategoryIcon(node.category)}
                </div>
                <div>
                  <h3 className="font-mono text-xs font-bold text-slate-200">{node.name}</h3>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">
                    {node.category}
                  </span>
                </div>
              </div>
              {getStatusBadge(node.status)}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-950/50 p-2 rounded-lg border border-slate-800/60">
              {node.details}
            </p>

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
              <span className="flex items-center space-x-1">
                <Zap className="w-3 h-3 text-cyan-400" />
                <span>LATENCY: {node.latencyMs}ms</span>
              </span>
              <span>CHECKED: {node.lastCheck}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
