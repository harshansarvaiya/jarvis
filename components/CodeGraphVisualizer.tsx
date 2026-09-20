'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Brain,
  Search,
  RefreshCw,
  Layers,
  Code2,
  Box,
  FileCode,
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
  vx?: number;
  vy?: number;
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

export function CodeGraphVisualizer() {
  const [summary, setSummary] = useState<CodeGraphSummary | null>(null);
  const [symbols, setSymbols] = useState<GraphNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [traceData, setTraceData] = useState<DependencyTrace | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [reindexing, setReindexing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterKind, setFilterKind] = useState<string>('ALL');
  const [copied, setCopied] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
              return [
                ...data.results,
                ...prev.filter((s) => !matchedIds.has(s.id)),
              ];
            });
            if (data.results.length > 0 && !selectedNode) {
              handleSelectNode(data.results[0]);
            }
          }
        }
      } catch (err) {
        console.warn('[CodeGraphVisualizer] Search error:', err);
      }
    }, 300);

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
  const getNodeColor = (node: GraphNode): { bg: string; border: string; text: string; dot: string } => {
    const file = node.file.toLowerCase();
    if (file.includes('orchestrator') || file.includes('vertex') || file.includes('subagent') || file.includes('harness')) {
      return { bg: 'bg-purple-950/60', border: 'border-purple-500/50', text: 'text-purple-300', dot: '#a855f7' };
    }
    if (file.includes('tool') || file.includes('vm-rpc') || file.includes('codebase-graph')) {
      return { bg: 'bg-emerald-950/60', border: 'border-emerald-500/50', text: 'text-emerald-300', dot: '#10b981' };
    }
    if (file.includes('storage') || file.includes('memory') || file.includes('state')) {
      return { bg: 'bg-cyan-950/60', border: 'border-cyan-500/50', text: 'text-cyan-300', dot: '#06b6d4' };
    }
    if (file.startsWith('app/api')) {
      return { bg: 'bg-amber-950/60', border: 'border-amber-500/50', text: 'text-amber-300', dot: '#f59e0b' };
    }
    if (file.includes('directive') || file.includes('security') || file.includes('shield')) {
      return { bg: 'bg-rose-950/60', border: 'border-rose-500/50', text: 'text-rose-300', dot: '#f43f5e' };
    }
    return { bg: 'bg-slate-900/60', border: 'border-slate-700/50', text: 'text-slate-300', dot: '#64748b' };
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

  // 5. Canvas Interactive Graph Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const width = canvas.width;
    const height = canvas.height;

    // Place top hubs in circular orbit
    const hubs = summary?.topHubs || [];
    const nodeCoords = hubs.map((hub, idx) => {
      const angle = (idx / (hubs.length || 1)) * Math.PI * 2;
      const radius = Math.min(width, height) * 0.35;
      return {
        ...hub,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
      };
    });

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw faint cyber grid
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.04)';
      ctx.lineWidth = 1;
      const gridSize = 40;
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

      // Draw Central Core Node
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, 28, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 229, 255, 0.15)';
      ctx.fill();
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#00e5ff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('J.A.R.V.I.S. CORE', width / 2, height / 2 + 4);

      // Draw Hub Links & Nodes
      nodeCoords.forEach((node, i) => {
        // Link to center
        ctx.beginPath();
        ctx.moveTo(width / 2, height / 2);
        ctx.lineTo(node.x, node.y);
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Cross-hub interconnected meshes
        if (i > 0) {
          ctx.beginPath();
          ctx.moveTo(nodeCoords[i - 1].x, nodeCoords[i - 1].y);
          ctx.lineTo(node.x, node.y);
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.15)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Hub Node Halo
        const isSelected = selectedNode && selectedNode.file.includes(node.file);
        const radius = 18 + Math.min(node.importedCount, 12);

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? 'rgba(0, 229, 255, 0.35)' : 'rgba(15, 23, 42, 0.85)';
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#00e5ff' : '#64748b';
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.stroke();

        // Hub Label
        const shortName = node.file.split('/').pop() || node.file;
        ctx.fillStyle = isSelected ? '#38bdf8' : '#cbd5e1';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(shortName, node.x, node.y + radius + 12);
        ctx.fillStyle = '#64748b';
        ctx.font = '8px monospace';
        ctx.fillText(`${node.importedCount} deps`, node.x, node.y + radius + 22);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [summary, selectedNode]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950/80 backdrop-blur-md rounded-2xl border border-cyan-500/20 overflow-hidden shadow-2xl">
      {/* 1. Header Toolbar & Telemetry */}
      <div className="p-4 border-b border-cyan-500/20 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(0,229,255,0.3)]">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold font-mono text-cyan-300 uppercase tracking-wider">
                AST Semantic Code Graph Radar
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                Vertex 768-dim Vector Space
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              {summary ? (
                <>
                  <span className="text-cyan-400 font-semibold">{summary.totalSymbols}</span> Symbols across{' '}
                  <span className="text-cyan-400 font-semibold">{summary.totalFiles}</span> Files •{' '}
                  <span className="text-emerald-400 font-semibold">{summary.embeddingCoverage}</span> Vector Coverage
                </>
              ) : (
                'Synchronizing architectural knowledge graph...'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleReindex}
            disabled={reindexing}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/30 text-xs font-mono text-cyan-300 transition-all disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reindexing ? 'animate-spin text-cyan-400' : ''}`} />
            <span>{reindexing ? 'RE-INDEXING AST...' : 'REFRESH GRAPH'}</span>
          </button>
        </div>
      </div>

      {/* 2. Search & Kind Filters */}
      <div className="p-3 border-b border-cyan-500/10 bg-slate-950/50 flex flex-wrap items-center gap-2 shrink-0">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search code graph via natural language or symbol (e.g. 'circuit breaker', 'subagent', 'vm rpc')..."
            className="w-full bg-slate-900/80 border border-cyan-500/20 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 font-mono focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all"
          />
        </div>

        <div className="flex items-center space-x-1 font-mono text-[10px]">
          {['ALL', 'FUNCTION', 'INTERFACE', 'ROUTE', 'CLASS'].map((k) => (
            <button
              key={k}
              onClick={() => setFilterKind(k)}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterKind === k
                  ? 'bg-cyan-500 text-black font-bold shadow-[0_0_8px_rgba(0,229,255,0.4)]'
                  : 'bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Workspace: Canvas Topology + Node List + Inspector */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Column: Interactive Topology Canvas & Symbol List */}
        <div className="flex-1 flex flex-col min-h-0 border-r border-cyan-500/10">
          {/* Visual Topology Canvas */}
          <div className="h-60 lg:h-72 relative bg-slate-950/90 border-b border-cyan-500/10 overflow-hidden flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={700}
              height={300}
              className="w-full h-full object-contain"
            />
            <div className="absolute top-2 left-3 text-[10px] font-mono text-cyan-500/60 flex items-center space-x-1.5 pointer-events-none">
              <Layers className="w-3 h-3 text-cyan-400" />
              <span>ARCHITECTURAL TOPOLOGY MESH // ORBITAL HUBS</span>
            </div>
          </div>

          {/* Symbol Feed List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>INDEXED CODE SYMBOLS ({filteredSymbols.length})</span>
              <span>CLICK TO INSPECT SIGNATURE & CALLERS</span>
            </div>

            {filteredSymbols.slice(0, 100).map((sym) => {
              const color = getNodeColor(sym);
              const isSelected = selectedNode?.id === sym.id;

              return (
                <div
                  key={sym.id}
                  onClick={() => handleSelectNode(sym)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_12px_rgba(0,229,255,0.2)]'
                      : `${color.bg} ${color.border} hover:border-cyan-500/40`
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: color.dot }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-bold text-slate-200 truncate">
                          {sym.name}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-slate-400 uppercase">
                          {sym.kind}
                        </span>
                        {sym.score !== undefined && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                            Score: {sym.score}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-slate-400 truncate">
                        {sym.file}:{sym.line}
                      </p>
                    </div>
                  </div>

                  <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'text-cyan-400 translate-x-0.5' : 'text-slate-600'}`} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Node Inspector & Caller Tree Drawer */}
        <div className="w-full lg:w-96 flex flex-col min-h-0 bg-slate-900/40 p-4 space-y-4 overflow-y-auto custom-scrollbar">
          {selectedNode ? (
            <>
              {/* Selected Node Details */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-cyan-500/30 shadow-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 uppercase">
                    {selectedNode.kind}
                  </span>
                  <button
                    onClick={() => handleCopy(selectedNode.signature || selectedNode.name)}
                    className="text-slate-400 hover:text-cyan-300 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <h3 className="text-sm font-bold font-mono text-cyan-300 break-all">
                  {selectedNode.name}
                </h3>
                <p className="text-[11px] font-mono text-slate-400 break-all">
                  📁 {selectedNode.file}:{selectedNode.line}
                </p>

                {selectedNode.signature && (
                  <div className="mt-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto">
                    <pre>{selectedNode.signature}</pre>
                  </div>
                )}
              </div>

              {/* Dependency Trace & Callers */}
              {traceData && (
                <div className="space-y-3 font-mono text-xs">
                  {/* Inbound Callers */}
                  <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/20 space-y-1.5">
                    <div className="text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center justify-between">
                      <span>INBOUND CALLERS ({traceData.importedByCount})</span>
                      <ArrowRight className="w-3 h-3 text-purple-400" />
                    </div>
                    {traceData.importedBy.length > 0 ? (
                      <div className="space-y-1 mt-1">
                        {traceData.importedBy.map((caller, idx) => (
                          <div key={idx} className="text-[10px] text-slate-300 truncate bg-slate-950/60 p-1.5 rounded border border-slate-800">
                            {caller}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500">Root-level entry point or self-contained module.</p>
                    )}
                  </div>

                  {/* Outbound Imports */}
                  <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/20 space-y-1.5">
                    <div className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider flex items-center justify-between">
                      <span>OUTBOUND DEPENDENCIES ({traceData.importsCount})</span>
                      <ArrowRight className="w-3 h-3 text-cyan-400" />
                    </div>
                    {traceData.imports.length > 0 ? (
                      <div className="space-y-1 mt-1 max-h-40 overflow-y-auto">
                        {traceData.imports.map((dep, idx) => (
                          <div key={idx} className="text-[10px] text-slate-300 truncate bg-slate-950/60 p-1.5 rounded border border-slate-800">
                            {dep}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500">Zero external module imports.</p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 font-mono space-y-2">
              <Code2 className="w-8 h-8 text-cyan-500/30" />
              <p className="text-xs text-slate-400">Select any symbol or orbital hub to inspect AST signatures, callers, and dependencies.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
