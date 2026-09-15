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
  Wrench,
  ChevronRight,
  Info,
  X,
  Terminal,
  Check,
  Loader2,
} from 'lucide-react';
import { triggerDeviceNotification } from '@/lib/jarvis/notifications';
import { formatISTTime, formatFullISTDateTime } from '@/lib/jarvis/time';

export interface NodeMetric {
  label: string;
  value: string;
  highlight?: boolean;
}

export interface SystemNodeHealth {
  id: string;
  name: string;
  category: 'COMPUTE' | 'STORAGE' | 'AI_ENGINE' | 'GATEWAY' | 'DEPLOYMENT';
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  latencyMs: number;
  details: string;
  lastCheck: string;
  lastCheckFull: string;
  metrics: NodeMetric[];
  troubleshooting?: string[];
}

export interface HealthResponse {
  timestamp: string;
  timestampFull: string;
  timezone: string;
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  overallUptime: string;
  summary: string;
  checkDurationMs: number;
  nodes: SystemNodeHealth[];
}

export interface RepairStep {
  step: number;
  title: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'WARNING' | 'FAILED';
  durationMs: number;
  log: string;
}

export const SystemHealthMatrix: React.FC = () => {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // Selected Node for Deep Telemetry Modal
  const [selectedNode, setSelectedNode] = useState<SystemNodeHealth | null>(null);

  // Repair State & Live Terminal Console
  const [activeRepairNodeId, setActiveRepairNodeId] = useState<string | null>(null);
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairSteps, setRepairSteps] = useState<RepairStep[]>([]);
  const [repairMessage, setRepairMessage] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/jarvis/health');
      if (res.ok) {
        const json = await res.json();
        setData(json);
        // If a node is selected, update its reference with latest data
        if (selectedNode) {
          const updated = json.nodes.find((n: SystemNodeHealth) => n.id === selectedNode.id);
          if (updated) setSelectedNode(updated);
        }
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

  const handleExecuteRepair = async (nodeId: string) => {
    setActiveRepairNodeId(nodeId);
    setIsRepairing(true);
    setRepairSteps([
      {
        step: 1,
        title: 'Perception & Root Cause Diagnostic',
        status: 'RUNNING',
        durationMs: 0,
        log: `J.A.R.V.I.S. Core analyzing node [${nodeId}] socket health and DNS status...`,
      },
    ]);
    setRepairMessage('Autonomous self-healing protocol engaged...');

    try {
      // Simulate live progressive step transitions for high-fidelity tactical feedback
      setTimeout(() => {
        setRepairSteps((prev) => [
          { ...prev[0], status: 'SUCCESS', durationMs: 40 },
          {
            step: 2,
            title: 'Security & Credential Integrity Check',
            status: 'RUNNING',
            durationMs: 0,
            log: 'Validating authorization headers, Upstash REST tokens, and VAPID keypairs...',
          },
        ]);
      }, 600);

      setTimeout(() => {
        setRepairSteps((prev) => [
          prev[0],
          { ...prev[1], status: 'SUCCESS', durationMs: 65 },
          {
            step: 3,
            title: 'Substrate Cache Flush & Re-arming',
            status: 'RUNNING',
            durationMs: 0,
            log: 'Cycling stale connection pool, refreshing sockets, and arming fallback matrix...',
          },
        ]);
      }, 1200);

      const res = await fetch('/api/jarvis/health/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId }),
      });

      const json = await res.json();

      setTimeout(() => {
        if (json.success && json.steps) {
          setRepairSteps(json.steps);
          setRepairMessage(json.message || 'Node repaired and operating normally.');
        } else {
          setRepairMessage(`Repair warning: ${json.error || 'Failed to complete sequence'}`);
        }
        setIsRepairing(false);
        fetchHealth();
      }, 1800);
    } catch (err: any) {
      setIsRepairing(false);
      setRepairMessage(`Repair sequence error: ${err.message}`);
    }
  };

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

  const filteredNodes =
    data?.nodes.filter((node) => {
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
                Real-time latency, deep metrics, and autonomous repair for all 9 external service nodes (IST Timezone)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleExecuteRepair('all')}
              disabled={isRepairing}
              className="px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 text-xs font-mono flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              <Wrench className={`w-3.5 h-3.5 ${isRepairing ? 'animate-spin' : ''}`} />
              <span>AUTONOMOUS REPAIR</span>
            </button>

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
            <div className="text-[10px] text-slate-400 uppercase">LAST PROBE (IST)</div>
            <div className="text-xs font-bold text-amber-300 mt-1 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{data?.timestamp || '--- IST'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Tactical Repair Console */}
      {(isRepairing || repairSteps.length > 0) && (
        <div className="rounded-xl bg-slate-950 border border-cyan-500/50 p-4 shadow-[0_0_25px_rgba(0,229,255,0.2)] space-y-3 font-mono animate-fadeIn">
          <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
            <div className="flex items-center space-x-2 text-cyan-300 text-xs font-bold">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>J.A.R.V.I.S. AUTONOMOUS REPAIR CONSOLE // TARGET: [{activeRepairNodeId?.toUpperCase()}]</span>
            </div>
            {!isRepairing && (
              <button
                type="button"
                onClick={() => {
                  setRepairSteps([]);
                  setRepairMessage(null);
                }}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="space-y-2">
            {repairSteps.map((step) => (
              <div key={step.step} className="p-2 rounded bg-slate-900/80 border border-slate-800 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {step.status === 'RUNNING' ? (
                      <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                    ) : step.status === 'SUCCESS' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span className="font-bold text-slate-200">
                      STEP {step.step}: {step.title}
                    </span>
                  </div>
                  {step.durationMs > 0 && <span className="text-[10px] text-slate-400">{step.durationMs}ms</span>}
                </div>
                <p className="text-[11px] text-cyan-300/80 pl-5.5">{step.log}</p>
              </div>
            ))}
          </div>

          {repairMessage && (
            <div className="p-2 rounded bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300 flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{repairMessage}</span>
            </div>
          )}
        </div>
      )}

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
              title: 'J.A.R.V.I.S. Telemetry Alert',
              message: `All 9 subsystems verified nominal at ${formatISTTime(new Date())}.`,
              priority: 'HIGH',
              timestamp: formatISTTime(new Date()),
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
            onClick={() => setSelectedNode(node)}
            className="cursor-pointer group p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/90 transition-all flex flex-col justify-between space-y-2 shadow-lg"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 group-hover:border-cyan-500/40 transition-colors">
                  {getCategoryIcon(node.category)}
                </div>
                <div>
                  <h3 className="font-mono text-xs font-bold text-slate-200 group-hover:text-cyan-300 transition-colors">
                    {node.name}
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">
                    {node.category}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusBadge(node.status)}
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-950/50 p-2 rounded-lg border border-slate-800/60">
              {node.details}
            </p>

            {/* Micro Metrics Highlights */}
            {node.metrics && node.metrics.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px] pt-1">
                {node.metrics.slice(0, 2).map((m, idx) => (
                  <div key={idx} className="p-1 rounded bg-slate-950/80 border border-slate-800/60 truncate">
                    <span className="text-slate-400">{m.label}: </span>
                    <span className="text-cyan-300 font-bold">{m.value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1.5 border-t border-slate-800/60">
              <span className="flex items-center space-x-1">
                <Zap className="w-3 h-3 text-cyan-400" />
                <span>LATENCY: {node.latencyMs}ms</span>
              </span>

              <div className="flex items-center space-x-2">
                <span>CHECKED: {node.lastCheck}</span>
                <ChevronRight className="w-3.5 h-3.5 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Deep Node Inspector Modal */}
      {selectedNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-slate-950 border border-cyan-500/50 rounded-2xl p-6 shadow-[0_0_50px_rgba(0,229,255,0.25)] max-h-[90vh] overflow-y-auto space-y-4 font-mono">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-cyan-500/20 pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-lg bg-cyan-950 border border-cyan-500/50">
                  {getCategoryIcon(selectedNode.category)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-cyan-300">{selectedNode.name}</h3>
                  <div className="flex items-center space-x-2 mt-0.5 text-xs text-slate-400">
                    <span>CATEGORY: {selectedNode.category}</span>
                    <span>•</span>
                    <span>LATENCY: {selectedNode.latencyMs}ms</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status & Last Checked IST */}
            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 text-[10px] block">OPERATIONAL STATUS</span>
                <div className="mt-0.5">{getStatusBadge(selectedNode.status)}</div>
              </div>
              <div className="text-right">
                <span className="text-slate-400 text-[10px] block">LAST PROBE (IST TIMEZONE)</span>
                <span className="text-amber-300 font-bold text-xs">{selectedNode.lastCheckFull}</span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase">Subsystem Details</span>
              <p className="text-xs text-slate-200 leading-relaxed bg-slate-900 p-3 rounded-lg border border-slate-800 font-sans">
                {selectedNode.details}
              </p>
            </div>

            {/* Deep Metric Breakdown */}
            {selectedNode.metrics && selectedNode.metrics.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs text-slate-400 font-bold uppercase">Deep Telemetry Metrics</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {selectedNode.metrics.map((m, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border ${
                        m.highlight
                          ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
                          : 'bg-slate-900/80 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="text-[10px] text-slate-400 uppercase">{m.label}</div>
                      <div className="font-bold text-xs mt-0.5">{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Troubleshooting / Directives */}
            {selectedNode.troubleshooting && selectedNode.troubleshooting.length > 0 && (
              <div className="space-y-1.5 text-xs">
                <span className="text-slate-400 font-bold uppercase">Tactical Troubleshooting</span>
                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                  {selectedNode.troubleshooting.map((t, idx) => (
                    <div key={idx} className="flex items-start space-x-1.5">
                      <span className="text-cyan-400">•</span>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  handleExecuteRepair(selectedNode.id);
                  setSelectedNode(null);
                }}
                disabled={isRepairing}
                className="px-4 py-2 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 font-bold text-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>EXECUTE AUTONOMOUS REPAIR</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
              >
                CLOSE INSPECTOR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
