'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  ChevronLeft,
  Filter,
  X,
  Compass,
  Cpu,
  Database,
  Radio,
  Plus,
  Minus,
  RotateCcw,
  Info,
} from 'lucide-react';

export interface GraphNode {
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
  radius?: number;
  domain?: string;
}

export interface TopHub {
  file: string;
  importedCount: number;
  dependentCount: number;
}

export interface CodeGraphSummary {
  totalFiles: number;
  totalSymbols: number;
  symbolCounts: Record<string, number>;
  topHubs: TopHub[];
  lastIndexed: string;
  embeddingCoverage: string;
}

export interface DependencyTrace {
  symbol?: GraphNode;
  importedByCount: number;
  importedBy: string[];
  importsCount: number;
  imports: string[];
  siblingSymbols: string[];
}

interface CanvasNode {
  id: string;
  label: string;
  subLabel?: string;
  kind: string;
  domain: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  glowColor: string;
  isHub?: boolean;
  rawSymbol?: GraphNode;
  file?: string;
  callersCount?: number;
}

interface CanvasEdge {
  sourceId: string;
  targetId: string;
  color?: string;
}

const DOMAINS = [
  { id: 'ALL', label: 'All Domains', color: '#00e5ff' },
  { id: 'AI', label: 'AI Core & Mind', color: '#c084fc', pattern: ['agent', 'orchestrator', 'vertex', 'subagent', 'harness'] },
  { id: 'HANDS', label: 'VM & Hands', color: '#34d399', pattern: ['tool', 'vm-rpc', 'cloud-worker', 'codeact', 'codebase-graph'] },
  { id: 'STORAGE', label: 'State & Storage', color: '#38bdf8', pattern: ['storage', 'memory', 'state'] },
  { id: 'ROUTES', label: 'API Routes', color: '#fbbf24', pattern: ['app/api'] },
  { id: 'SECURITY', label: 'Security & Guardian', color: '#fb7185', pattern: ['directive', 'security', 'shield', 'auth', 'telegram'] },
  { id: 'UI', label: 'UI & Hooks', color: '#818cf8', pattern: ['components', 'hooks', 'app/page'] },
];

function getSymbolDomain(file: string): { id: string; label: string; color: string; glow: string } {
  const f = file.toLowerCase();
  if (f.includes('orchestrator') || f.includes('agent') || f.includes('vertex') || f.includes('subagent')) {
    return { id: 'AI', label: 'AI Core', color: '#c084fc', glow: 'rgba(192, 132, 252, 0.6)' };
  }
  if (f.includes('tool') || f.includes('vm') || f.includes('cloud-worker') || f.includes('codeact') || f.includes('codebase-graph')) {
    return { id: 'HANDS', label: 'VM & Hands', color: '#34d399', glow: 'rgba(52, 211, 153, 0.6)' };
  }
  if (f.includes('storage') || f.includes('memory') || f.includes('state')) {
    return { id: 'STORAGE', label: 'Storage & State', color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.6)' };
  }
  if (f.startsWith('app/api')) {
    return { id: 'ROUTES', label: 'API Routes', color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.6)' };
  }
  if (f.includes('directive') || f.includes('security') || f.includes('shield') || f.includes('auth') || f.includes('telegram')) {
    return { id: 'SECURITY', label: 'Security', color: '#fb7185', glow: 'rgba(251, 113, 133, 0.6)' };
  }
  return { id: 'UI', label: 'UI & Hooks', color: '#818cf8', glow: 'rgba(129, 140, 248, 0.5)' };
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
  const [domainFilter, setDomainFilter] = useState<string>('ALL');
  const [copied, setCopied] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(initialFullscreen);

  // Panels visibility
  const [showSymbolsDock, setShowSymbolsDock] = useState<boolean>(true);
  const [showInspectorDock, setShowInspectorDock] = useState<boolean>(true);

  // Canvas Viewport Transformation
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<CanvasNode | null>(null);

  // Canvas Refs & Simulation State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasNodesRef = useRef<CanvasNode[]>([]);
  const canvasEdgesRef = useRef<CanvasEdge[]>([]);
  const draggingNodeRef = useRef<CanvasNode | null>(null);
  const isPanningRef = useRef<boolean>(false);
  const startMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomRef = useRef<number>(1);

  // Sync refs with state
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // 1. Fetch Complete Code Graph Data
  const fetchGraphData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/jarvis/codegraph');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSummary(data.summary);
          const rawSyms = data.symbols || [];
          setSymbols(rawSyms);
          if (rawSyms.length > 0 && !selectedNode) {
            handleSelectNode(rawSyms[0]);
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

  // 2. Select Node and Trace AST Callers
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
    } catch (err) {
      console.warn('[CodeGraphVisualizer] Trace error:', err);
    }
  };

  // 3. Trigger Re-Indexing
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

  // 4. Instant Lexical + Semantic Search
  const filteredSymbols = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return symbols.filter((s) => {
      // Kind Filter
      if (filterKind !== 'ALL') {
        if (filterKind === 'FUNCTION' && !(s.kind === 'function' || s.kind === 'component')) return false;
        if (filterKind === 'INTERFACE' && s.kind !== 'interface') return false;
        if (filterKind === 'ROUTE' && s.kind !== 'route') return false;
        if (filterKind === 'CLASS' && s.kind !== 'class') return false;
        if (filterKind === 'TYPE' && s.kind !== 'type') return false;
      }

      // Domain Filter
      if (domainFilter !== 'ALL') {
        const domain = getSymbolDomain(s.file);
        if (domain.id !== domainFilter) return false;
      }

      // Query Filter (Instant Lexical Search)
      if (q) {
        const matchName = s.name.toLowerCase().includes(q);
        const matchFile = s.file.toLowerCase().includes(q);
        const matchSig = s.signature?.toLowerCase().includes(q);
        const matchDoc = s.doc?.toLowerCase().includes(q);
        if (!matchName && !matchFile && !matchSig && !matchDoc) return false;
      }

      return true;
    });
  }, [symbols, filterKind, domainFilter, searchQuery]);

  // Debounced Semantic Search to enrich scores from Vertex
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/jarvis/codegraph?query=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.results)) {
            const scoreMap = new Map<string, { score: number; reason: string }>(
              data.results.map((r: any) => [r.id, { score: r.score, reason: r.matchReason }])
            );
            setSymbols((prev) =>
              prev.map((s) => {
                const match = scoreMap.get(s.id);
                return match ? { ...s, score: match.score, matchReason: match.reason } : s;
              })
            );
          }
        }
      } catch (err) {
        console.warn('[CodeGraphVisualizer] Semantic search error:', err);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Copy helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 5. Build Dynamic Canvas Nodes and Edges
  useEffect(() => {
    const width = 1200;
    const height = 800;
    const centerX = width / 2;
    const centerY = height / 2;

    const nodes: CanvasNode[] = [];
    const edges: CanvasEdge[] = [];

    // Central Core Node
    nodes.push({
      id: 'core',
      label: 'J.A.R.V.I.S.',
      subLabel: 'APEX ENGINE',
      kind: 'core',
      domain: 'ALL',
      x: centerX,
      y: centerY,
      vx: 0,
      vy: 0,
      radius: 34,
      color: '#00e5ff',
      glowColor: 'rgba(0, 229, 255, 0.7)',
      isHub: true,
    });

    // Domain Hub Nodes placed in an orbit
    const activeDomains = DOMAINS.filter((d) => d.id !== 'ALL');
    const hubOrbitRadius = 200;

    activeDomains.forEach((d, idx) => {
      const angle = (idx / activeDomains.length) * Math.PI * 2 - Math.PI / 2;
      const hx = centerX + Math.cos(angle) * hubOrbitRadius;
      const hy = centerY + Math.sin(angle) * hubOrbitRadius;

      nodes.push({
        id: `domain-${d.id}`,
        label: d.label,
        kind: 'domain',
        domain: d.id,
        x: hx,
        y: hy,
        vx: 0,
        vy: 0,
        radius: 24,
        color: d.color,
        glowColor: `${d.color}99`,
        isHub: true,
      });

      edges.push({
        sourceId: 'core',
        targetId: `domain-${d.id}`,
        color: d.color,
      });
    });

    // Symbol Satellites (Render top/filtered symbols directly onto the graph)
    // If user is searching or has filtered, prioritize matching symbols
    const displaySymbols = filteredSymbols.slice(0, 75);

    displaySymbols.forEach((sym, sIdx) => {
      const domain = getSymbolDomain(sym.file);
      const parentHub = nodes.find((n) => n.id === `domain-${domain.id}`) || nodes[0];

      // Distribute in a satellite orbit around parent hub
      const satAngle = (sIdx * 1.37) % (Math.PI * 2);
      const satDist = 55 + ((sIdx * 7) % 85);
      const sx = parentHub.x + Math.cos(satAngle) * satDist;
      const sy = parentHub.y + Math.sin(satAngle) * satDist;

      nodes.push({
        id: sym.id,
        label: sym.name,
        subLabel: `${sym.file.split('/').pop()}:${sym.line}`,
        kind: sym.kind,
        domain: domain.id,
        x: sx,
        y: sy,
        vx: 0,
        vy: 0,
        radius: sym.exported ? 9 : 7,
        color: domain.color,
        glowColor: domain.glow,
        rawSymbol: sym,
        file: sym.file,
      });

      edges.push({
        sourceId: parentHub.id,
        targetId: sym.id,
        color: `${domain.color}40`,
      });
    });

    canvasNodesRef.current = nodes;
    canvasEdgesRef.current = edges;
  }, [filteredSymbols]);

  // 6. Interactive Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let pulseAngle = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent && parent.clientWidth > 0 && parent.clientHeight > 0) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      if (canvas.width === 0 || canvas.height === 0) {
        resize();
      }
      pulseAngle += 0.03;
      const width = canvas.width || 800;
      const height = canvas.height || 600;
      const currentPan = panRef.current;
      const currentZoom = zoomRef.current;

      ctx.clearRect(0, 0, width, height);

      // Save context for pan & zoom transformation
      ctx.save();
      ctx.translate(width / 2 + currentPan.x, height / 2 + currentPan.y);
      ctx.scale(currentZoom, currentZoom);
      ctx.translate(-600, -400); // 1200x800 coordinate center

      // 1. Draw glowing background cyber grid
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.04)';
      ctx.lineWidth = 1;
      const gridSize = 50;
      for (let x = -400; x < 1600; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, -400);
        ctx.lineTo(x, 1200);
        ctx.stroke();
      }
      for (let y = -400; y < 1200; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(-400, y);
        ctx.lineTo(1600, y);
        ctx.stroke();
      }

      const nodes = canvasNodesRef.current;
      const edges = canvasEdgesRef.current;
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));

      // 2. Draw Connection Edges with Animated Flow
      edges.forEach((edge) => {
        const src = nodeMap.get(edge.sourceId);
        const tgt = nodeMap.get(edge.targetId);
        if (!src || !tgt) return;

        const isHighlighted =
          selectedNode &&
          (src.rawSymbol?.id === selectedNode.id ||
            tgt.rawSymbol?.id === selectedNode.id ||
            src.label.includes(selectedNode.name) ||
            tgt.label.includes(selectedNode.name));

        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);

        if (isHighlighted) {
          ctx.strokeStyle = '#00e5ff';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = '#00e5ff';
          ctx.shadowBlur = 10;
        } else {
          ctx.strokeStyle = edge.color || 'rgba(0, 229, 255, 0.15)';
          ctx.lineWidth = 1;
          ctx.shadowBlur = 0;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw animated energy particle traveling along edge
        if (isHighlighted || (src.isHub && tgt.isHub)) {
          const t = (Math.sin(pulseAngle * 1.5 + src.x * 0.01) + 1) / 2;
          const px = src.x + (tgt.x - src.x) * t;
          const py = src.y + (tgt.y - src.y) * t;
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = '#00e5ff';
          ctx.fill();
        }
      });

      // 3. Draw Nodes
      nodes.forEach((node) => {
        const isSelected = selectedNode && node.rawSymbol?.id === selectedNode.id;
        const isHovered = hoveredNode && hoveredNode.id === node.id;
        const matchesSearch =
          searchQuery.trim() &&
          (node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            node.subLabel?.toLowerCase().includes(searchQuery.toLowerCase()));

        let radius = node.radius;
        if (node.isHub) {
          radius += Math.sin(pulseAngle) * 1.5;
        }
        if (isSelected) radius += 4;
        if (isHovered) radius += 3;

        // Outer Glow Ring
        if (node.isHub || isSelected || matchesSearch) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + (isSelected ? 10 : 6), 0, Math.PI * 2);
          ctx.fillStyle = isSelected
            ? 'rgba(0, 229, 255, 0.35)'
            : matchesSearch
            ? 'rgba(251, 191, 36, 0.35)'
            : node.glowColor;
          ctx.fill();
        }

        // Base Circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#0f172a' : isHovered ? '#1e293b' : 'rgba(15, 23, 42, 0.95)';
        ctx.fill();

        ctx.strokeStyle = isSelected ? '#00e5ff' : matchesSearch ? '#fbbf24' : node.color;
        ctx.lineWidth = isSelected ? 3 : node.isHub ? 2.5 : 1.5;
        ctx.shadowColor = isSelected ? '#00e5ff' : node.color;
        ctx.shadowBlur = isSelected ? 16 : isHovered ? 12 : 6;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Node Label
        ctx.textAlign = 'center';
        if (node.isHub) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px monospace';
          ctx.fillText(node.label, node.x, node.y - 1);
          if (node.subLabel) {
            ctx.fillStyle = node.color;
            ctx.font = '8px monospace';
            ctx.fillText(node.subLabel, node.x, node.y + 11);
          }
        } else {
          // Symbol Node
          if (isSelected || isHovered || matchesSearch || currentZoom > 1.3) {
            ctx.fillStyle = isSelected ? '#00e5ff' : matchesSearch ? '#fbbf24' : '#e2e8f0';
            ctx.font = isSelected ? 'bold 10px monospace' : '9px monospace';
            ctx.fillText(node.label, node.x, node.y + radius + 11);
          }
        }
      });

      ctx.restore();

      // 4. Draw Floating HUD Tooltip if a node is hovered
      if (hoveredNode) {
        const hx = width / 2 + currentPan.x + (hoveredNode.x - 600) * currentZoom;
        const hy = height / 2 + currentPan.y + (hoveredNode.y - 400) * currentZoom;

        ctx.save();
        ctx.translate(hx, hy - 40);

        const tipText = hoveredNode.label;
        const subText = hoveredNode.subLabel || hoveredNode.kind.toUpperCase();
        ctx.font = 'bold 11px monospace';
        const tw1 = ctx.measureText(tipText).width;
        ctx.font = '9px monospace';
        const tw2 = ctx.measureText(subText).width;
        const boxWidth = Math.max(tw1, tw2) + 24;
        const boxHeight = 36;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = hoveredNode.color;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = hoveredNode.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(-boxWidth / 2, -boxHeight, boxWidth, boxHeight, 8);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(tipText, 0, -boxHeight + 14);

        ctx.fillStyle = hoveredNode.color;
        ctx.font = '9px monospace';
        ctx.fillText(subText, 0, -boxHeight + 27);

        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [hoveredNode, selectedNode, searchQuery]);

  // 7. Canvas Mouse Event Handlers (Click, Drag, Pan, Zoom)
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, clientX: 0, clientY: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Invert pan & zoom transformation
    const width = canvas.width;
    const height = canvas.height;
    const worldX = (clientX - (width / 2 + pan.x)) / zoom + 600;
    const worldY = (clientY - (height / 2 + pan.y)) / zoom + 400;

    return { x: worldX, y: worldY, clientX, clientY };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y, clientX, clientY } = getCanvasCoords(e);
    const nodes = canvasNodesRef.current;

    // Check if clicked on a node
    let hitNode: CanvasNode | null = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dist = Math.hypot(node.x - x, node.y - y);
      if (dist <= node.radius + 6) {
        hitNode = node;
        break;
      }
    }

    if (hitNode) {
      draggingNodeRef.current = hitNode;
      if (hitNode.rawSymbol) {
        handleSelectNode(hitNode.rawSymbol);
      } else if (hitNode.isHub && hitNode.domain !== 'ALL') {
        setDomainFilter(hitNode.domain);
      }
    } else {
      isPanningRef.current = true;
      startMouseRef.current = { x: clientX - pan.x, y: clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y, clientX, clientY } = getCanvasCoords(e);

    // 1. Dragging a node
    if (draggingNodeRef.current) {
      draggingNodeRef.current.x = x;
      draggingNodeRef.current.y = y;
      return;
    }

    // 2. Panning the canvas
    if (isPanningRef.current) {
      setPan({
        x: clientX - startMouseRef.current.x,
        y: clientY - startMouseRef.current.y,
      });
      return;
    }

    // 3. Hover Detection
    const nodes = canvasNodesRef.current;
    let found: CanvasNode | null = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dist = Math.hypot(node.x - x, node.y - y);
      if (dist <= node.radius + 6) {
        found = node;
        break;
      }
    }
    setHoveredNode(found);
  };

  const handleMouseUp = () => {
    draggingNodeRef.current = null;
    isPanningRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomDelta = e.deltaY * -0.0015;
    setZoom((prev) => Math.max(0.35, Math.min(2.5, prev + zoomDelta)));
  };

  const handleResetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setSearchQuery('');
    setDomainFilter('ALL');
    setFilterKind('ALL');
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-slate-950 text-slate-100 rounded-2xl border border-cyan-500/30 overflow-hidden shadow-2xl transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-0 z-50 rounded-none w-screen h-screen'
          : 'w-full h-full min-h-[640px]'
      }`}
    >
      {/* ========================================================================= */}
      {/* 1. TOP HEADER HUD BAR                                                     */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-cyan-500/20 gap-3 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(0,229,255,0.4)]">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold tracking-wider text-cyan-300">
                AST CODE GRAPH STUDIO
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                768-dim Vectors
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 flex items-center space-x-2">
              <span>{summary?.totalSymbols || symbols.length} Symbols</span>
              <span>•</span>
              <span>{summary?.totalFiles || 94} Source Files</span>
              <span>•</span>
              <span className="text-emerald-400">{summary?.embeddingCoverage || '100% Vectorized'}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSymbolsDock((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all flex items-center space-x-1.5 ${
              showSymbolsDock
                ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 shadow-[0_0_8px_rgba(0,229,255,0.3)]'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Symbol Matrix Panel"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Symbols ({filteredSymbols.length})</span>
          </button>

          <button
            onClick={() => setShowInspectorDock((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all flex items-center space-x-1.5 ${
              showInspectorDock
                ? 'bg-purple-950/80 border-purple-500 text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.3)]'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle AST Inspector Panel"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Inspector</span>
          </button>

          <button
            onClick={handleReindex}
            disabled={reindexing}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
            title="Re-Index AST Graph"
          >
            <RefreshCw className={`w-4 h-4 ${reindexing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          <button
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
            title={isFullscreen ? 'Restore View' : 'Maximize Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
              title="Close Visualizer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SEARCH & HIGH-TECH FILTER BAR                                          */}
      {/* ========================================================================= */}
      <div className="p-3 bg-slate-900/60 border-b border-cyan-500/20 space-y-2.5 shrink-0">
        {/* Instant Search Input */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-cyan-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search 560+ symbols, files, signatures (e.g. 'auth', 'agent', 'telegram', 'push', 'vmRpc')..."
            className="w-full bg-slate-950/90 border border-cyan-500/30 rounded-xl pl-9 pr-24 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(0,229,255,0.25)] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="absolute right-10 text-[10px] font-mono text-cyan-400/80 pointer-events-none">
            {filteredSymbols.length} / {symbols.length}
          </span>
        </div>

        {/* Kind and Domain Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
          {/* Kind Selectors */}
          <div className="flex items-center space-x-1 overflow-x-auto custom-scrollbar pb-0.5">
            {['ALL', 'FUNCTION', 'INTERFACE', 'ROUTE', 'CLASS', 'TYPE'].map((kind) => (
              <button
                key={kind}
                onClick={() => setFilterKind(kind)}
                className={`px-2 py-1 rounded-lg border transition-all ${
                  filterKind === kind
                    ? 'bg-cyan-500 text-black font-bold border-cyan-400 shadow-[0_0_8px_rgba(0,229,255,0.4)]'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {kind}
              </button>
            ))}
          </div>

          {/* Domain Selectors */}
          <div className="flex items-center space-x-1.5 overflow-x-auto custom-scrollbar pb-0.5">
            {DOMAINS.map((dom) => (
              <button
                key={dom.id}
                onClick={() => setDomainFilter(dom.id)}
                className={`px-2 py-1 rounded-lg border transition-all flex items-center space-x-1.5 ${
                  domainFilter === dom.id
                    ? 'bg-slate-900 border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(0,229,255,0.3)]'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dom.color }} />
                <span>{dom.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN WORKSPACE (3-COLUMN DOCKABLE BATTLESTATION)                      */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 relative overflow-hidden">
        {/* Left Column: Symbol Matrix Feed (Collapsible) */}
        {showSymbolsDock && (
          <div className="w-full md:w-72 lg:w-80 flex flex-col min-h-0 bg-slate-950/95 border-b md:border-b-0 md:border-r border-cyan-500/20 shrink-0 z-10 transition-all">
            <div className="p-2.5 bg-slate-900/80 border-b border-cyan-500/10 flex items-center justify-between text-[11px] font-mono text-slate-300">
              <span className="font-bold flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>SYMBOL INVENTORY ({filteredSymbols.length})</span>
              </span>
              <button
                onClick={() => setShowSymbolsDock(false)}
                className="text-slate-500 hover:text-slate-300 p-0.5"
                title="Collapse Symbols Panel"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
              {filteredSymbols.length === 0 ? (
                <div className="text-center p-6 font-mono text-xs text-slate-500">
                  Zero symbols match query.
                </div>
              ) : (
                filteredSymbols.map((sym) => {
                  const domain = getSymbolDomain(sym.file);
                  const isSelected = selectedNode?.id === sym.id;

                  return (
                    <div
                      key={sym.id}
                      onClick={() => handleSelectNode(sym)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-cyan-950/90 border-cyan-400 shadow-[0_0_12px_rgba(0,229,255,0.3)]'
                          : 'bg-slate-900/60 border-slate-800 hover:border-cyan-500/40'
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: domain.color }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[11px] font-mono font-bold text-slate-200 truncate">
                              {sym.name}
                            </span>
                            <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-slate-950 border border-slate-700 text-slate-400 uppercase">
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
                      <ChevronRight
                        className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                          isSelected ? 'text-cyan-400 translate-x-0.5' : 'text-slate-600'
                        }`}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Center: Interactive Canvas Visualizer */}
        <div className="flex-1 min-h-[360px] relative bg-slate-950 flex flex-col overflow-hidden">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            className="w-full h-full cursor-grab active:cursor-grabbing"
          />

          {/* Floating Canvas Controls HUD */}
          <div className="absolute top-3 right-3 flex items-center space-x-1.5 bg-slate-900/80 backdrop-blur-md border border-cyan-500/30 p-1.5 rounded-xl shadow-xl font-mono text-xs">
            <button
              onClick={() => setZoom((prev) => Math.min(2.5, prev + 0.2))}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-cyan-400 transition-colors"
              title="Zoom In"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom((prev) => Math.max(0.35, prev - 0.2))}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-cyan-400 transition-colors"
              title="Zoom Out"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetView}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-cyan-400 transition-colors"
              title="Reset View / Center"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <div className="h-4 w-px bg-slate-700 mx-1" />
            <span className="text-[10px] text-cyan-400 px-1 font-bold">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Bottom Interactive Navigation Hint */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
            <div className="text-[10px] font-mono text-cyan-400/80 bg-slate-900/90 backdrop-blur border border-cyan-500/30 px-3 py-1 rounded-full shadow-lg pointer-events-auto flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>🖱️ Drag nodes to reposition • Drag empty canvas to pan • Scroll to zoom • Click node to inspect AST</span>
            </div>
          </div>
        </div>

        {/* Right Column: Deep AST & Caller Inspector (Collapsible) */}
        {showInspectorDock && (
          <div className="w-full md:w-80 lg:w-96 flex flex-col min-h-0 bg-slate-950/95 border-t md:border-t-0 md:border-l border-cyan-500/20 shrink-0 z-10">
            <div className="p-2.5 bg-slate-900/80 border-b border-cyan-500/10 flex items-center justify-between text-[11px] font-mono text-slate-300">
              <span className="font-bold flex items-center space-x-1.5">
                <Code2 className="w-3.5 h-3.5 text-purple-400" />
                <span>AST INSPECTOR</span>
              </span>
              <button
                onClick={() => setShowInspectorDock(false)}
                className="text-slate-500 hover:text-slate-300 p-0.5"
                title="Collapse Inspector Panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 custom-scrollbar">
              {selectedNode ? (
                <>
                  {/* Selected Node Details */}
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

                  {/* Dependency Trace & Callers */}
                  {traceData && (
                    <div className="space-y-2.5 font-mono text-[11px]">
                      {/* Inbound Callers */}
                      <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 space-y-1">
                        <div className="text-[9px] font-bold text-purple-300 uppercase tracking-wider flex items-center justify-between">
                          <span>INBOUND CALLERS ({traceData.importedByCount})</span>
                          <ArrowRight className="w-3 h-3 text-purple-400" />
                        </div>
                        {traceData.importedBy.length > 0 ? (
                          <div className="space-y-1 mt-1 max-h-36 overflow-y-auto custom-scrollbar">
                            {traceData.importedBy.map((caller, idx) => (
                              <div
                                key={idx}
                                className="text-[9px] text-slate-300 truncate bg-slate-950/70 p-1.5 rounded border border-slate-800"
                              >
                                {caller}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[9px] text-slate-500">Root entry point.</p>
                        )}
                      </div>

                      {/* Outbound Dependencies */}
                      <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 space-y-1">
                        <div className="text-[9px] font-bold text-cyan-300 uppercase tracking-wider flex items-center justify-between">
                          <span>OUTBOUND IMPORTS ({traceData.importsCount})</span>
                          <ArrowRight className="w-3 h-3 text-cyan-400" />
                        </div>
                        {traceData.imports.length > 0 ? (
                          <div className="space-y-1 mt-1 max-h-36 overflow-y-auto custom-scrollbar">
                            {traceData.imports.map((dep, idx) => (
                              <div
                                key={idx}
                                className="text-[9px] text-slate-300 truncate bg-slate-950/70 p-1.5 rounded border border-slate-800"
                              >
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
                  <p className="text-[10px] text-slate-400">
                    Click any symbol or orbital hub to inspect callers and dependencies.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
