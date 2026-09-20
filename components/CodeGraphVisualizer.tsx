'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Brain,
  Search,
  RefreshCw,
  Layers,
  Code2,
  Maximize2,
  Minimize2,
  ArrowRight,
  Sparkles,
  Zap,
  Shield,
  Server,
  Activity,
  Check,
  Copy,
  ExternalLink,
  ChevronRight,
  Filter,
  X,
  Compass,
  Cpu,
  Database,
  Radio,
} from 'lucide-react';

interface GraphNode {
  id: string;
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'component' | 'route' | 'enum';
  file: string;
  line: number;
  exported?: boolean;
  signature?: string;
  doc?: string;
  score?: number;
  matchReason?: string;
  x?: number;
  y?: number;
  radius?: number;
  color?: string;
}

interface TopHub {
  file: string;
  importedCount: number;
  dependentCount: number;
}

interface CodeGraphSummary {
  totalFiles: number;
  totalSymbols: number;
  symbolCounts: Record<string, number>;
  topHubs: TopHub[];
  lastIndexed: string;
  embeddingCoverage: string;
}

interface DependencyTrace {
  symbol?: GraphNode;
  importedByCount: number;
  importedBy: string[];
  importsCount: number;
  imports: string[];
  siblingSymbols: string[];
}

export function CodeGraphVisualizer({
  onClose,
  initialFullscreen = false,
}: {
  onClose?: () => void;
  initialFullscreen?: boolean;
}) {
  const [summary, setSummary] = useState<CodeGraphSummary | null>(null);
  const [symbols, setSymbols] = useState<GraphNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [traceData, setTraceData] = useState<DependencyTrace | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [reindexing, setReindexing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterKind, setFilterKind] = useState<string>('ALL');
  const [copied, setCopied] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(initialFullscreen);
  const [activeTab, setActiveTab] = useState<'TOPOLOGY' | 'SYMBOLS'>('TOPOLOGY');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 1. Fetch Code Graph Telemetry
  const fetchGraphData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/jarvis/codegraph');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSummary(data.summary);
          setSymbols(data.symbols || []);
          if (data.symbols && data.symbols.length > 0 && !selectedNode) {
            handleSelectNode(data.symbols[0]);
          }
        }
      }
    } catch (err) {
      console.warn('[CodeGraphVisualizer] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraphData();
  }, []);

  // 2. Real-Time Semantic Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/jarvis/codegraph?query=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.results)) {
            setSymbols((prev) => {
              const matchedIds = new Set(data.results.map((r: any) => r.id));
              return [...data.results, ...prev.filter((s) => !matchedIds.has(s.id))];
            });
            if (data.results.length > 0) {
              handleSelectNode(data.results[0]);
            }
          }
        }
      } catch (err) {
        console.warn('[CodeGraphVisualizer] Search error:', err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 3. Node Selection and Caller Trace
  const handleSelectNode = async (node: GraphNode) => {
    setSelectedNode(node);
    try {
      const res = await fetch(`/api/jarvis/codegraph?target=${encodeURIComponent(node.name || node.file)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.trace) {
          setTraceData(data.trace);
        }
      }
    } catch {}
  };

  // 4. Trigger Re-Indexing
  const handleReindex = async () => {
    try {
      setReindexing(true);
      const res = await fetch('/api/jarvis/codegraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reindex', forceEmbed: true }),
      });
      if (res.ok) {
        await fetchGraphData();
      }
    } finally {
      setReindexing(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Color Mapping by Node Domain
  const getNodeColor = (node: GraphNode): { bg: string; border: string; text: string; dot: string; glow: string } => {
    const file = node.file.toLowerCase();
    if (file.includes('orchestrator') || file.includes('vertex') || file.includes('subagent') || file.includes('harness')) {
      return { bg: 'bg-purple-950/70', border: 'border-purple-500/60', text: 'text-purple-300', dot: '#c084fc', glow: 'rgba(192, 132, 252, 0.4)' };
    }
    if (file.includes('tool') || file.includes('vm-rpc') || file.includes('codebase-graph') || file.includes('codeact')) {
      return { bg: 'bg-emerald-950/70', border: 'border-emerald-500/60', text: 'text-emerald-300', dot: '#34d399', glow: 'rgba(52, 211, 153, 0.4)' };
    }
    if (file.includes('storage') || file.includes('memory') || file.includes('state')) {
      return { bg: 'bg-cyan-950/70', border: 'border-cyan-500/60', text: 'text-cyan-300', dot: '#38bdf8', glow: 'rgba(56, 189, 248, 0.4)' };
    }
    if (file.startsWith('app/api')) {
      return { bg: 'bg-amber-950/70', border: 'border-amber-500/60', text: 'text-amber-300', dot: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)' };
    }
    if (file.includes('directive') || file.includes('security') || file.includes('shield') || file.includes('sentry')) {
      return { bg: 'bg-rose-950/70', border: 'border-rose-500/60', text: 'text-rose-300', dot: '#fb7185', glow: 'rgba(251, 113, 133, 0.4)' };
    }
    return { bg: 'bg-slate-900/70', border: 'border-slate-700/60', text: 'text-slate-300', dot: '#94a3b8', glow: 'rgba(148, 163, 184, 0.3)' };
  };

  // Filtered List
  const filteredSymbols = useMemo(() => {
    return symbols.filter((s) => {
      if (filterKind === 'ALL') return true;
      if (filterKind === 'FUNCTION' && (s.kind === 'function' || s.kind === 'component')) return true;
      if (filterKind === 'INTERFACE' && s.kind === 'interface') return true;
      if (filterKind === 'ROUTE' && s.kind === 'route') return true;
      if (filterKind === 'CLASS' && s.kind === 'class') return true;
      return true;
    });
  }, [symbols, filterKind]);

  // 5. Canvas Interactive Graph Renderer with Glowing Pulses
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let pulseAngle = 0;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const hubs = summary?.topHubs || [
      { file: 'lib/jarvis/agent.ts', importedCount: 16, dependentCount: 0 },
      { file: 'lib/jarvis/orchestrator.ts', importedCount: 12, dependentCount: 0 },
      { file: 'lib/jarvis/tools.ts', importedCount: 11, dependentCount: 0 },
      { file: 'scripts/cloud-worker.ts', importedCount: 9, dependentCount: 0 },
      { file: 'lib/jarvis/storage.ts', importedCount: 8, dependentCount: 0 },
      { file: 'lib/jarvis/subagent-swarm.ts', importedCount: 7, dependentCount: 0 },
      { file: 'lib/jarvis/codebase-graph.ts', importedCount: 6, dependentCount: 0 },
      { file: 'lib/jarvis/vm-rpc.ts', importedCount: 5, dependentCount: 0 },
      { file: 'app/api/jarvis/health/route.ts', importedCount: 4, dependentCount: 0 },
    ];

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      pulseAngle += 0.03;

      ctx.clearRect(0, 0, width, height);

      // 1. Draw glowing Cyber Grid
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.06)';
      ctx.lineWidth = 1;
      const gridSize = 45;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const centerX = width / 2;
      const centerY = height / 2;
      const orbitRadius = Math.min(width, height) * (isFullscreen ? 0.36 : 0.38);

      // 2. Central Core Arc Reactor Node
      const pulseSize = 26 + Math.sin(pulseAngle) * 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseSize + 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 229, 255, 0.1)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseSize, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 229, 255, 0.25)';
      ctx.fill();
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('J.A.R.V.I.S.', centerX, centerY - 2);
      ctx.fillStyle = '#00e5ff';
      ctx.font = '8px monospace';
      ctx.fillText('APEX MESH', centerX, centerY + 9);

      // 3. Position Hub Nodes in Orbit
      const nodeCoords = hubs.map((hub, idx) => {
        const angle = (idx / (hubs.length || 1)) * Math.PI * 2 - Math.PI / 2;
        const x = centerX + Math.cos(angle) * orbitRadius;
        const y = centerY + Math.sin(angle) * orbitRadius;
        return { ...hub, x, y, angle };
      });

      // 4. Draw Glowing Connection Links
      nodeCoords.forEach((node, i) => {
        const isConnectedToSelected =
          selectedNode &&
          (selectedNode.file.includes(node.file) || (traceData && traceData.importedBy.some((c) => c.includes(node.file))));

        // Center link
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(node.x, node.y);
        ctx.strokeStyle = isConnectedToSelected ? '#00e5ff' : 'rgba(0, 229, 255, 0.25)';
        ctx.lineWidth = isConnectedToSelected ? 2.5 : 1;
        ctx.shadowColor = isConnectedToSelected ? '#00e5ff' : 'transparent';
        ctx.shadowBlur = isConnectedToSelected ? 10 : 0;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Neighbor mesh links
        const nextNode = nodeCoords[(i + 1) % nodeCoords.length];
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(nextNode.x, nextNode.y);
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // 5. Draw Hub Nodes
      nodeCoords.forEach((node) => {
        const shortName = node.file.split('/').pop() || node.file;
        const isSelected = selectedNode && selectedNode.file.includes(node.file);

        let hubColor = '#38bdf8';
        let glowColor = 'rgba(56, 189, 248, 0.5)';
        if (node.file.includes('orchestrator') || node.file.includes('agent') || node.file.includes('subagent')) {
          hubColor = '#c084fc';
          glowColor = 'rgba(192, 132, 252, 0.6)';
        } else if (node.file.includes('tool') || node.file.includes('vm-rpc') || node.file.includes('codegraph')) {
          hubColor = '#34d399';
          glowColor = 'rgba(52, 211, 153, 0.6)';
        } else if (node.file.includes('storage')) {
          hubColor = '#38bdf8';
          glowColor = 'rgba(56, 189, 248, 0.6)';
        }

        const radius = isSelected ? 22 : 16 + Math.min(node.importedCount, 8);

        // Glow ring
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? glowColor : 'rgba(15, 23, 42, 0.6)';
        ctx.fill();

        // Solid Node
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#0f172a' : 'rgba(15, 23, 42, 0.9)';
        ctx.fill();
        ctx.strokeStyle = hubColor;
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.shadowColor = hubColor;
        ctx.shadowBlur = isSelected ? 16 : 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Hub Badge Icon/Text
        ctx.fillStyle = hubColor;
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${node.importedCount}`, node.x, node.y + 3);

        // External Label
        const labelY = node.y > centerY ? node.y + radius + 13 : node.y - radius - 7;
        ctx.fillStyle = isSelected ? '#ffffff' : '#cbd5e1';
        ctx.font = isSelected ? 'bold 10px monospace' : '9px monospace';
        ctx.fillText(shortName, node.x, labelY);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [summary, selectedNode, traceData, isFullscreen]);

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-slate-950/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl overflow-hidden shadow-2xl transition-all ${
        isFullscreen
          ? 'fixed inset-4 z-50 shadow-[0_0_50px_rgba(0,0,0,0.9)] border-cyan-400/50'
          : 'flex-1 h-full min-h-[500px]'
      }`}
    >
      {/* 1. Header Toolbar & Quick Telemetry */}
      <div className="p-3.5 px-4 border-b border-cyan-500/20 bg-slate-900/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-purple-950/80 border border-purple-500/50 flex items-center justify-center text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.4)]">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xs font-bold font-mono text-cyan-300 uppercase tracking-wider">
                AST Code Graph Studio
              </h2>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                768-dim Vectors
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              {summary ? (
                <>
                  <span className="text-cyan-400 font-bold">{summary.totalSymbols}</span> Symbols •{' '}
                  <span className="text-cyan-400 font-bold">{summary.totalFiles}</span> Files •{' '}
                  <span className="text-emerald-400 font-bold">{summary.embeddingCoverage}</span> Coverage
                </>
              ) : (
                'Loading AST Graph...'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-950 border border-cyan-500/30 rounded-lg p-0.5 font-mono text-[10px]">
            <button
              onClick={() => setActiveTab('TOPOLOGY')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeTab === 'TOPOLOGY' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              TOPOLOGY
            </button>
            <button
              onClick={() => setActiveTab('SYMBOLS')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeTab === 'SYMBOLS' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              SYMBOLS ({filteredSymbols.length})
            </button>
          </div>

          <button
            onClick={handleReindex}
            disabled={reindexing}
            title="Refresh AST & Embeddings"
            className="p-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reindexing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Collapse Studio' : 'Expand Fullscreen'}
            className="p-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900 border border-purple-500/30 text-purple-300 transition-all"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 text-rose-300 transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Search & Kind Filters */}
      <div className="p-2.5 px-3 border-b border-cyan-500/10 bg-slate-950/70 flex flex-wrap items-center gap-2 shrink-0">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search symbols or semantics (e.g. 'circuit breaker', 'subagent', 'vm rpc')..."
            className="w-full bg-slate-900/90 border border-cyan-500/30 rounded-xl pl-8 pr-3 py-1.5 text-[11px] text-slate-200 placeholder:text-slate-500 font-mono focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/40"
          />
        </div>

        <div className="flex items-center space-x-1 font-mono text-[9px]">
          {['ALL', 'FUNCTION', 'INTERFACE', 'ROUTE', 'CLASS'].map((k) => (
            <button
              key={k}
              onClick={() => setFilterKind(k)}
              className={`px-2 py-0.5 rounded-md transition-all ${
                filterKind === k
                  ? 'bg-cyan-500 text-black font-bold shadow-[0_0_8px_rgba(0,229,255,0.4)]'
                  : 'bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Body */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* Left Area: Canvas Mesh OR Symbol Matrix */}
        <div className="flex-1 flex flex-col min-h-0 relative border-r border-cyan-500/10">
          {activeTab === 'TOPOLOGY' ? (
            <div className="flex-1 w-full h-full relative bg-slate-950 flex items-center justify-center overflow-hidden">
              <canvas ref={canvasRef} className="w-full h-full cursor-crosshair" />
              <div className="absolute bottom-2.5 left-3 text-[9px] font-mono text-cyan-400/60 flex items-center space-x-2 pointer-events-none bg-slate-950/80 px-2 py-1 rounded border border-cyan-500/20">
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <span>AI Core</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Hands/Tools</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>Redis/State</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
              {filteredSymbols.slice(0, 150).map((sym) => {
                const color = getNodeColor(sym);
                const isSelected = selectedNode?.id === sym.id;

                return (
                  <div
                    key={sym.id}
                    onClick={() => handleSelectNode(sym)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-cyan-950/90 border-cyan-400 shadow-[0_0_12px_rgba(0,229,255,0.3)]'
                        : `${color.bg} ${color.border} hover:border-cyan-500/40`
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <div
                        className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: color.dot }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[11px] font-mono font-bold text-slate-200 truncate">
                            {sym.name}
                          </span>
                          <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-slate-900 border border-slate-700 text-slate-400 uppercase">
                            {sym.kind}
                          </span>
                          {sym.score !== undefined && (
                            <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                              {sym.score}
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] font-mono text-slate-400 truncate">
                          {sym.file}:{sym.line}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Area: Deep Symbol & Caller Inspector */}
        <div className="w-full md:w-80 lg:w-96 flex flex-col min-h-0 bg-slate-950/80 p-3.5 space-y-3 overflow-y-auto custom-scrollbar border-t md:border-t-0 md:border-l border-cyan-500/10">
          {selectedNode ? (
            <>
              {/* Node Card */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-cyan-500/30 shadow-md space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 uppercase font-bold">
                    {selectedNode.kind}
                  </span>
                  <button
                    onClick={() => handleCopy(selectedNode.signature || selectedNode.name)}
                    className="text-slate-400 hover:text-cyan-300 transition-colors p-1"
                    title="Copy declaration"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <h3 className="text-xs font-bold font-mono text-cyan-300 break-all">
                  {selectedNode.name}
                </h3>
                <p className="text-[10px] font-mono text-slate-400 break-all">
                  📁 {selectedNode.file}:{selectedNode.line}
                </p>

                {selectedNode.signature && (
                  <div className="mt-2 p-2 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono text-emerald-300 overflow-x-auto">
                    <pre className="whitespace-pre-wrap break-all">{selectedNode.signature}</pre>
                  </div>
                )}
              </div>

              {/* Inbound Callers & Outbound Imports */}
              {traceData && (
                <div className="space-y-2.5 font-mono text-[11px]">
                  {/* Callers */}
                  <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 space-y-1">
                    <div className="text-[9px] font-bold text-purple-300 uppercase tracking-wider flex items-center justify-between">
                      <span>INBOUND CALLERS ({traceData.importedByCount})</span>
                      <ArrowRight className="w-3 h-3 text-purple-400" />
                    </div>
                    {traceData.importedBy.length > 0 ? (
                      <div className="space-y-1 mt-1 max-h-36 overflow-y-auto">
                        {traceData.importedBy.map((caller, idx) => (
                          <div key={idx} className="text-[9px] text-slate-300 truncate bg-slate-950/70 p-1.5 rounded border border-slate-800">
                            {caller}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[9px] text-slate-500">Root entry point.</p>
                    )}
                  </div>

                  {/* Dependencies */}
                  <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 space-y-1">
                    <div className="text-[9px] font-bold text-cyan-300 uppercase tracking-wider flex items-center justify-between">
                      <span>OUTBOUND IMPORTS ({traceData.importsCount})</span>
                      <ArrowRight className="w-3 h-3 text-cyan-400" />
                    </div>
                    {traceData.imports.length > 0 ? (
                      <div className="space-y-1 mt-1 max-h-36 overflow-y-auto">
                        {traceData.imports.map((dep, idx) => (
                          <div key={idx} className="text-[9px] text-slate-300 truncate bg-slate-950/70 p-1.5 rounded border border-slate-800">
                            {dep}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[9px] text-slate-500">Zero external imports.</p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-slate-500 font-mono space-y-1.5">
              <Code2 className="w-7 h-7 text-cyan-500/30" />
              <p className="text-[10px] text-slate-400">Click any symbol or orbital hub to inspect callers and dependencies.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
