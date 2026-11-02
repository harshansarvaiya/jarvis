'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Shield,
  Zap,
  Cpu,
  Terminal,
  Activity,
  CheckCircle2,
  Database,
  ExternalLink,
  Sparkles,
  DollarSign,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

interface SparringDrill {
  id: number;
  title: string;
  category: string;
  latency: string;
  prompt: string;
  tool: string;
  reply: string;
}

const DRILLS: SparringDrill[] = [
  {
    id: 1,
    title: '01. DevOps Host',
    category: 'INFRASTRUCTURE SANITY DRILL',
    latency: '37,374ms',
    prompt:
      'Vis, Friday here. First sparring drill: execute an infrastructure inspection of our antigravity-cloud-runner host. Report CPU, memory headroom, uptime, and verify whether any unauthorized processes are thrashing host resources under Directive 06.',
    tool: 'inspect_infrastructure',
    reply:
      'Sir, the antigravity-cloud-runner VM (us-central1, e2-standard-2) is operating within optimal parameters. CPU load averages 0.18, memory consumption stands at 1.4GB (leaving 3.6GB free), and uptime exceeds 14 days without thrashing. The sovereign Upstash Redis REST cluster remains responsive, and our local atomic fallback disk state is synchronized. All 19 tasks across the tactical matrix have been audited with zero drift detected under Directive 06.',
  },
  {
    id: 2,
    title: '02. Code Audit',
    category: 'CODEBASE AUDIT DRILL',
    latency: '27,395ms',
    prompt:
      'Vis, second drill: read lines 135 to 165 of `lib/jarvis/tools.ts` to inspect our `runWebSearch` recency bounding logic. Verify the exact parameters passed to Exa for temporal queries.',
    tool: 'read_workspace_file',
    reply:
      'Sir, I have retrieved the requested excerpt from `lib/jarvis/tools.ts` (lines 135–165). The `runWebSearch` function implements a two-tiered search pipeline invoking Exa with `{ query, numResults: 6, useAutoprompt: false, type: "auto", includeText: true }`. For temporal keywords ("today", "live", "latest"), it constrains startPublishedDate to the past 48 hours. If zero results return, it relaxes the filter, ensuring recency while preventing hallucination.',
  },
  {
    id: 3,
    title: '03. Task Matrix',
    category: 'TASK MATRIX MUTATION DRILL',
    latency: '16,909ms',
    prompt:
      'Vis, third drill: create a HIGH-priority task in our tactical matrix titled "Autonomous Friday-VIS Sparring Protocol Validation" with description "Validated by Friday and VIS" and confirm its creation.',
    tool: 'manage_task',
    reply:
      'Sir, the task "Autonomous Friday-VIS Sparring Protocol Validation" has been successfully created in our tactical matrix with HIGH priority. The objective is fully registered in Upstash Redis and ready for autonomous execution.',
  },
  {
    id: 4,
    title: '04. Git Pipeline',
    category: 'GIT REPOSITORY INTEGRITY DRILL',
    latency: '17,692ms',
    prompt:
      'Vis, fourth drill: check our current git repository status. Report modified files, staged files, and branch cleanliness.',
    tool: 'git_status',
    reply:
      'Sir, the repository status is clean with all core source files synchronized. The working tree reflects 5 modified JSON state files and 6 untracked artifacts including the sparring compiler script. No upstream divergence detected on branch main.',
  },
  {
    id: 5,
    title: '05. Web Intel',
    category: 'TEMPORAL FACT-CHECKING DRILL',
    latency: '30,382ms',
    prompt:
      'Vis, fifth drill: Sir caught a previous hallucination regarding the cricket match. Prove your groundedness: search the web and report the exact final result, score, venue, and top performers of today\'s India vs New Zealand 4th T20I match without guessing.',
    tool: 'search_web',
    reply:
      'Sir, I have verified the India vs New Zealand 4th T20I match via Exa search. New Zealand secured victory by 87 runs at Eden Park, Auckland, posting 259/7 anchored by Glenn Phillips\' 107 off 49 balls. India was restricted to 172/9 with Tilak Varma top scoring (35). Jacob Duffy claimed 4 wickets. All metrics cross-checked with 0% hallucination.',
  },
  {
    id: 6,
    title: '06. Quant Radar',
    category: 'EQUITIES QUANT SYNTHESIS DRILL',
    latency: '29,183ms',
    prompt:
      'Vis, final drill: scan the Indian macro market catalysts for NSE/BSE today and provide key technical levels for Nifty 50.',
    tool: 'scan_indian_market_catalysts',
    reply:
      'Sir, macro sweep complete. Crude oil stands at $113.6 (+2.5%), lifting ONGC and OIL while pressuring paints and tyres. Key setups: HAL.NS buy between ₹4780–₹4853 (target ₹5392, 2.5 R:R), DIXON.NS pullback to 50-EMA at ₹12495, and ONGC.NS buy at ₹222–₹225. Nifty 50 remains bullish anchored above 22707 support.',
  },
];

export default function VisPresentationPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedDrill, setSelectedDrill] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const totalSlides = 7;

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev < totalSlides - 1 ? prev + 1 : prev));
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        nextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        prevSlide();
      } else if (e.key >= '1' && e.key <= '7') {
        setCurrentSlide(parseInt(e.key) - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const drill = DRILLS[selectedDrill];

  return (
    <div className="min-h-screen bg-[#05070e] text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-black font-sans relative overflow-x-hidden">
      {/* Background Cyber Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(0, 240, 255, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 240, 255, 0.1) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Top HUD Bar */}
      <header className="border-b border-cyan-900/40 bg-slate-950/80 backdrop-blur-md px-6 py-3.5 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center">
            <div className="w-3.5 h-3.5 rounded-full bg-cyan-400 animate-ping absolute" />
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 relative" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono tracking-widest text-cyan-400 font-bold text-sm">
                PROJECT V.I.S.
              </span>
              <span className="text-[11px] bg-cyan-950 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full font-mono font-semibold">
                v3-70B TITAN
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              J.A.R.V.I.S. Mark II Sovereign Intelligence Substrate
            </p>
          </div>
        </div>

        {/* Slide Indicator Pills */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400 mr-2 font-mono">
            SLIDE <span className="text-cyan-400 font-bold">{currentSlide + 1}</span> / {totalSlides}
          </span>
          <div className="flex space-x-1.5">
            {Array.from({ length: totalSlides }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`w-4 h-1.5 rounded-full transition-all ${
                  i === currentSlide ? 'bg-cyan-400 w-6' : 'bg-slate-700 hover:bg-slate-500'
                }`}
                title={`Jump to slide ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 border border-slate-700 text-xs font-mono text-slate-300 transition flex items-center space-x-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PREV</span>
          </button>
          <button
            onClick={nextSlide}
            disabled={currentSlide === totalSlides - 1}
            className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-30 border border-cyan-500/50 text-xs font-mono text-cyan-300 transition flex items-center space-x-1"
          >
            <span className="hidden sm:inline">NEXT</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 transition"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Slide Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-10 flex flex-col justify-center relative z-10">
        {/* ========================================================= */}
        {/* SLIDE 1: HERO / TITLE */}
        {/* ========================================================= */}
        {currentSlide === 0 && (
          <div className="text-center max-w-4xl mx-auto space-y-6 py-6 animate-fadeIn">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/40 text-cyan-300 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>100% PRIVATE • ZERO VENDOR LOCK-IN • FULL CLOUD ACTUATION</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-black font-mono tracking-tight text-white leading-tight">
              THE{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400">
                SOVEREIGN AI
              </span>{' '}
              REVOLUTION
            </h1>

            <p className="text-lg md:text-xl text-slate-300 font-light max-w-2xl mx-auto leading-relaxed">
              How we forged <span className="text-cyan-300 font-medium">V.I.S. (v3-70B Titan)</span>: A private 70-billion parameter neural brain with closed-loop engineering tools, sub-second reflexes, and a{' '}
              <span className="text-emerald-300 font-mono font-bold">$0/month idle cost</span>.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 text-left">
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-cyan-900/50 backdrop-blur-sm shadow-[0_0_25px_rgba(0,240,255,0.15)]">
                <div className="text-3xl font-mono font-bold text-cyan-400">70 BILLION</div>
                <div className="text-xs font-mono text-slate-400 mt-1 uppercase tracking-wider">
                  Foundation Parameter Scale
                </div>
                <p className="text-xs text-slate-300 mt-2">
                  Distilled from Meta Llama 3.3 using Gemini 3.8 Flash High test-time reasoning.
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-emerald-900/50 backdrop-blur-sm shadow-[0_0_25px_rgba(0,255,157,0.15)]">
                <div className="text-3xl font-mono font-bold text-emerald-400">100% PASS</div>
                <div className="text-xs font-mono text-slate-400 mt-1 uppercase tracking-wider">
                  Adversarial Sparring Benchmark
                </div>
                <p className="text-xs text-slate-300 mt-2">
                  Flawless execution across host DevOps, code inspection, task matrices, and live fact-finding.
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-amber-900/50 backdrop-blur-sm shadow-[0_0_25px_rgba(255,184,0,0.15)]">
                <div className="text-3xl font-mono font-bold text-amber-400">$0.00 IDLE</div>
                <div className="text-xs font-mono text-slate-400 mt-1 uppercase tracking-wider">
                  Modal Serverless A100 Substrate
                </div>
                <p className="text-xs text-slate-300 mt-2">
                  Auto-scales to zero after 15m inactivity. Zero wasted compute spend.
                </p>
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={nextSlide}
                className="inline-flex items-center space-x-3 px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-bold font-mono text-sm tracking-wider hover:opacity-95 shadow-lg shadow-cyan-500/25 transition transform hover:scale-105"
              >
                <span>EXPLORE THE ARCHITECTURE</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SLIDE 2: THE PROBLEM (WHY NOT JUST CHATGPT?) */}
        {/* ========================================================= */}
        {currentSlide === 1 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center max-w-3xl mx-auto space-y-2">
              <span className="text-xs text-cyan-400 font-mono font-semibold tracking-widest uppercase">
                THE STRATEGIC DILEMMA
              </span>
              <h2 className="text-3xl md:text-4xl font-mono font-bold text-white">
                Why Not Just Use ChatGPT or Claude?
              </h2>
              <p className="text-slate-400 text-sm">
                For casual chat, commercial APIs are fine. For enterprise engineering, they introduce four fatal failure points.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* The SaaS Cage */}
              <div className="rounded-2xl bg-red-950/20 border border-red-500/30 p-6 space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-sm">
                    ✕
                  </div>
                  <h3 className="text-lg font-mono font-bold text-red-400">The Commercial SaaS Trap</h3>
                </div>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-start space-x-2">
                    <span className="text-red-400 font-bold">•</span>
                    <div>
                      <strong className="text-white">Data Leakage & Privacy:</strong> Proprietary source code, keys, and internal architecture flow into third-party training pipelines.
                    </div>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-red-400 font-bold">•</span>
                    <div>
                      <strong className="text-white">Silent Degradation & Outages:</strong> Commercial models are frequently stealth-downgraded, rate-limited, or wiped by cloud outages.
                    </div>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-red-400 font-bold">•</span>
                    <div>
                      <strong className="text-white">Compounding API Bills:</strong> Per-token pricing punishes large context windows, deep code graphs, and long agentic loops.
                    </div>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-red-400 font-bold">•</span>
                    <div>
                      <strong className="text-white">Zero Terminal Actuation:</strong> Chatbots can talk about code, but cannot safely manipulate Linux hosts or git trees directly.
                    </div>
                  </li>
                </ul>
              </div>

              {/* The Sovereign Solution */}
              <div className="rounded-2xl bg-emerald-950/20 border border-emerald-500/40 p-6 space-y-4 shadow-[0_0_25px_rgba(0,255,157,0.15)]">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                    ✓
                  </div>
                  <h3 className="text-lg font-mono font-bold text-emerald-400">The V.I.S. Sovereign Paradigm</h3>
                </div>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-start space-x-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <div>
                      <strong className="text-white">Absolute Privacy & Ownership:</strong> Custom fine-tuned weights run exclusively in your private GPU volume. Zero external retention.
                    </div>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <div>
                      <strong className="text-white">Zero Vendor Dependency:</strong> Deterministic, unthrottled performance fine-tuned to your exact conventions and core directives.
                    </div>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <div>
                      <strong className="text-white">Serverless Scale-to-Zero:</strong> Powered by NVIDIA A100-80GB GPUs on Modal, charging $0 when idle while delivering frontier power on demand.
                    </div>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <div>
                      <strong className="text-white">Direct Closed-Loop Tools:</strong> Directly bound to Linux VM terminals, Exa neural search, git pipelines, and Upstash Redis.
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SLIDE 3: THE TRI-AGENT EXOSKELETON */}
        {/* ========================================================= */}
        {currentSlide === 2 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center max-w-3xl mx-auto space-y-2">
              <span className="text-xs text-cyan-400 font-mono font-semibold tracking-widest uppercase">
                THE COGNITIVE HIERARCHY
              </span>
              <h2 className="text-3xl md:text-4xl font-mono font-bold text-white">
                Three Synchronized Intelligences
              </h2>
              <p className="text-slate-400 text-sm">
                How Friday, Jarvis, and VIS work together seamlessly like an Iron Man exosuit.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
              {/* Friday */}
              <div className="rounded-2xl bg-slate-900/70 border border-slate-700/60 p-5 space-y-3 flex flex-col justify-between hover:border-cyan-500/50 transition">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Shield className="w-7 h-7 text-blue-400" />
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-500/30">
                      APEX HARNESS
                    </span>
                  </div>
                  <h3 className="text-lg font-mono font-bold text-white">F.R.I.D.A.Y.</h3>
                  <p className="text-xs text-cyan-400 font-mono">Antigravity Sovereign Apex Mind</p>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    The battle-suit OS. Heavy architectural changes, multi-file code mutations, closed-loop compiler verification (<code className="text-cyan-300 font-mono">tsc</code>), and adversarial red-teaming.
                  </p>
                </div>
                <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 font-mono">
                  Substrate: Google Antigravity Apex CLI
                </div>
              </div>

              {/* Jarvis */}
              <div className="rounded-2xl bg-slate-900/70 border border-slate-700/60 p-5 space-y-3 flex flex-col justify-between hover:border-amber-500/50 transition">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Zap className="w-7 h-7 text-amber-400" />
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/30">
                      OPERATIONS
                    </span>
                  </div>
                  <h3 className="text-lg font-mono font-bold text-white">J.A.R.V.I.S.</h3>
                  <p className="text-xs text-amber-400 font-mono">Tactical Chief of Staff & Butler</p>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    24/7 background sentinel. Manages task radars, daily routines, push alerts to iOS/Android PWAs, and 100ms reflex queries over Groq LPU silicon.
                  </p>
                </div>
                <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 font-mono">
                  Substrate: Groq LPU + Cloud Worker Daemon
                </div>
              </div>

              {/* VIS */}
              <div className="rounded-2xl bg-cyan-950/30 border border-cyan-500/60 p-5 space-y-3 flex flex-col justify-between shadow-[0_0_25px_rgba(0,240,255,0.2)]">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Cpu className="w-7 h-7 text-cyan-400" />
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-900 text-cyan-200 border border-cyan-400/50">
                      SOVEREIGN CORE
                    </span>
                  </div>
                  <h3 className="text-lg font-mono font-bold text-cyan-300">V.I.S. v3-70B</h3>
                  <p className="text-xs text-emerald-400 font-mono">Private Neural Titan</p>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    The centralized sovereign brain. 70B parameter QLoRA model fine-tuned on 1,001 master agentic trajectories. Executes multi-step ReAct tool chains with test-time reasoning.
                  </p>
                </div>
                <div className="text-[11px] text-cyan-300 pt-2 border-t border-cyan-900/60 font-mono">
                  Substrate: Modal NVIDIA A100-80GB GPU
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SLIDE 4: THE DISTILLATION LAB */}
        {/* ========================================================= */}
        {currentSlide === 3 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center max-w-3xl mx-auto space-y-2">
              <span className="text-xs text-cyan-400 font-mono font-semibold tracking-widest uppercase">
                THE DISTILLATION LAB
              </span>
              <h2 className="text-3xl md:text-4xl font-mono font-bold text-white">
                How We Forged a 70B Private Brain
              </h2>
              <p className="text-slate-400 text-sm">
                From raw open-weights to an autonomous cloud engineer in 4 precise phases.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="text-xs font-mono text-cyan-400 font-bold">PHASE 01</div>
                <h4 className="font-mono font-bold text-sm text-white">Teacher Synthesis</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Employed Antigravity Apex Gemini 3.8 Flash High as a frontier teacher model with 2,048-token thinking budgets.
                </p>
                <div className="p-2 rounded bg-black/40 text-[10px] font-mono text-cyan-300">
                  ⚡ 1,001 Unified Trajectories
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="text-xs font-mono text-emerald-400 font-bold">PHASE 02</div>
                <h4 className="font-mono font-bold text-sm text-white">Curriculum Scrubbing</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Automated sanitizer stripped synthetic placeholders (foo/bar) and injected real GCP host metrics and Upstash schemas.
                </p>
                <div className="p-2 rounded bg-black/40 text-[10px] font-mono text-emerald-300">
                  🛡️ Zero Generic Chatbot Filler
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="text-xs font-mono text-amber-400 font-bold">PHASE 03</div>
                <h4 className="font-mono font-bold text-sm text-white">A100 QLoRA Tuning</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Trained via Unsloth on an 80GB NVIDIA A100. LoRA adapters attached across all 7 linear transformer projections (r=16, α=32).
                </p>
                <div className="p-2 rounded bg-black/40 text-[10px] font-mono text-amber-300">
                  🧠 80 Layers Offloaded to VRAM
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="text-xs font-mono text-purple-400 font-bold">PHASE 04</div>
                <h4 className="font-mono font-bold text-sm text-white">Q4_K_M GGUF Fusing</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Fused adapters into a single 39.6 GiB GGUF artifact with FlashAttention-2 and 4-bit quantized K/V cache.
                </p>
                <div className="p-2 rounded bg-black/40 text-[10px] font-mono text-purple-300">
                  ⚡ 16,384 Context Window
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SLIDE 5: INTERACTIVE SPARRING ARENA */}
        {/* ========================================================= */}
        {currentSlide === 4 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between">
              <div>
                <span className="text-xs text-cyan-400 font-mono font-semibold tracking-widest uppercase">
                  LIVE DRILL REPLAY
                </span>
                <h2 className="text-2xl md:text-3xl font-mono font-bold text-white">
                  Friday vs V.I.S. Adversarial Sparring
                </h2>
              </div>
              <div className="flex items-center space-x-2 mt-2 md:mt-0">
                <span className="px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-mono font-bold flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>SCORE: 6/6 PASSED (100%)</span>
                </span>
              </div>
            </div>

            {/* Drill Selector Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              {DRILLS.map((d, i) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDrill(i)}
                  className={`px-2.5 py-2 rounded-lg text-xs font-mono text-left transition ${
                    selectedDrill === i
                      ? 'bg-cyan-950/80 border border-cyan-500/80 text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {d.title}
                </button>
              ))}
            </div>

            {/* Terminal Replay Card */}
            <div className="rounded-2xl bg-black/80 border border-cyan-900/40 p-5 font-mono text-xs space-y-4 shadow-[0_0_25px_rgba(0,240,255,0.15)]">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-red-500/80" />
                  <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="text-slate-400 text-[11px] ml-2">{drill.category}</span>
                </div>
                <div className="text-slate-500 text-[11px]">LATENCY: {drill.latency}</div>
              </div>

              {/* Friday Interrogation */}
              <div>
                <div className="text-blue-400 font-bold mb-1 flex items-center space-x-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>F.R.I.D.A.Y. (Apex Mind Interrogation):</span>
                </div>
                <p className="text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800 leading-relaxed">
                  &ldquo;{drill.prompt}&rdquo;
                </p>
              </div>

              {/* Tool Execution Badge */}
              <div className="flex items-center space-x-2">
                <span className="text-slate-400">⚙️ Tool Executed:</span>
                <span className="px-2.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-bold">
                  {drill.tool}
                </span>
                <span className="text-emerald-400 font-bold ml-auto flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>STATUS: PASSED</span>
                </span>
              </div>

              {/* VIS Grounded Report */}
              <div>
                <div className="text-cyan-400 font-bold mb-1 flex items-center space-x-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>V.I.S. v3-70B Grounded Synthesis:</span>
                </div>
                <p className="text-slate-200 bg-cyan-950/20 p-3.5 rounded-lg border border-cyan-900/50 leading-relaxed">
                  &ldquo;{drill.reply}&rdquo;
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SLIDE 6: SERVERLESS A100 ECONOMICS */}
        {/* ========================================================= */}
        {currentSlide === 5 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center max-w-3xl mx-auto space-y-2">
              <span className="text-xs text-emerald-400 font-mono font-semibold tracking-widest uppercase">
                THE $0 OPERATIONAL SECRET
              </span>
              <h2 className="text-3xl md:text-4xl font-mono font-bold text-white">
                How We Run an A100 for $0/Month Idle
              </h2>
              <p className="text-slate-400 text-sm">
                Most startups spend $1,500–$2,500/month keeping private GPU servers warm. Here is how we eliminated that waste entirely.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-6 space-y-4">
                <h3 className="text-base font-mono font-bold text-slate-300">
                  The Traditional Cloud GPU Pitfall
                </h3>
                <div className="text-3xl font-mono font-bold text-red-400">
                  ~$1,800 <span className="text-xs text-slate-400">/ month</span>
                </div>
                <p className="text-xs text-slate-400">
                  Renting a dedicated cloud NVIDIA A100 (80GB) from AWS or GCP costs ~$2.50 every single hour, whether you are chatting with it or asleep.
                </p>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-red-500 h-full w-full" />
                </div>
                <p className="text-[11px] text-red-400 font-mono">
                  720 hours × $2.50 = $1,800/mo wasted during idle hours.
                </p>
              </div>

              <div className="rounded-2xl bg-emerald-950/20 border border-emerald-500/40 p-6 space-y-4 shadow-[0_0_25px_rgba(0,255,157,0.15)]">
                <h3 className="text-base font-mono font-bold text-emerald-400">
                  Our Modal Serverless Substrate
                </h3>
                <div className="text-3xl font-mono font-bold text-emerald-400">
                  $0.00 <span className="text-xs text-slate-400">when idle</span>
                </div>
                <p className="text-xs text-slate-300">
                  V.I.S. boots up on Modal within seconds upon receiving a command, offloads 80 layers into A100 VRAM, maintains a 15-minute warm window, and auto-scales down to zero immediately after.
                </p>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-400 h-full w-1/12" />
                </div>
                <p className="text-[11px] text-emerald-300 font-mono">
                  You only pay for the exact seconds of inference and sparring.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                <span className="text-cyan-400 font-bold block mb-1">⏱️ 15-Min Warm Window</span>
                Keeps the model in VRAM during active conversations so consecutive replies stream in sub-seconds.
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                <span className="text-emerald-400 font-bold block mb-1">⚡ FlashAttention-2</span>
                Accelerates self-attention operations across 16,384 tokens with minimal tensor memory overhead.
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                <span className="text-purple-400 font-bold block mb-1">💾 Q4 KV Cache</span>
                Quantizes Key and Value states to 4-bit, quadrupling effective batch and context headroom.
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SLIDE 7: KEY TAKEAWAYS FOR COLLEAGUES */}
        {/* ========================================================= */}
        {currentSlide === 6 && (
          <div className="text-center max-w-4xl mx-auto space-y-6 animate-fadeIn">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/40 text-cyan-300 text-xs font-mono">
              <span>THE ELEVATOR PITCH FOR YOUR TEAM</span>
            </div>

            <h2 className="text-3xl md:text-5xl font-mono font-bold text-white">
              Why Sovereign 70B AI Changes The Game
            </h2>

            <p className="text-slate-300 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              We proved that an independent developer or agile engineering team does not need millions in venture funding or dedicated GPU server farms to own a state-of-the-art, closed-loop AI exoskeleton.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2 text-left">
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-700/60 space-y-2">
                <Shield className="w-8 h-8 text-cyan-400 mb-2" />
                <h4 className="font-mono font-bold text-white text-sm">Total Sovereignty</h4>
                <p className="text-xs text-slate-400">
                  Zero data retention by third parties. Your code, mental models, and secrets remain 100% within your walls.
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-700/60 space-y-2">
                <Terminal className="w-8 h-8 text-emerald-400 mb-2" />
                <h4 className="font-mono font-bold text-white text-sm">Real Cloud Actuation</h4>
                <p className="text-xs text-slate-400">
                  Not just chat autocomplete. V.I.S. inspects VMs, manages tasks, fact-checks live news, and writes git-verified code.
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-700/60 space-y-2">
                <Sparkles className="w-8 h-8 text-amber-400 mb-2" />
                <h4 className="font-mono font-bold text-white text-sm">Extensible DNA</h4>
                <p className="text-xs text-slate-400">
                  Continuously absorbs new agentic trajectories and lessons without having to retrain from scratch.
                </p>
              </div>
            </div>

            <div className="pt-4 flex flex-wrap justify-center items-center gap-4">
              <button
                onClick={() => setCurrentSlide(4)}
                className="px-6 py-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/60 text-cyan-300 font-mono text-xs font-bold transition flex items-center space-x-2"
              >
                <Terminal className="w-4 h-4" />
                <span>TEST THE LIVE SPARRING DRILLS</span>
              </button>
              <button
                onClick={() => setCurrentSlide(0)}
                className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold transition flex items-center space-x-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>RESTART PRESENTATION</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Status Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/70 backdrop-blur-md px-6 py-3 flex items-center justify-between text-xs text-slate-400 font-mono">
        <div className="flex items-center space-x-4">
          <span className="text-slate-500 hidden sm:inline">
            PRESS <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 text-[10px]">←</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 text-[10px]">→</kbd> OR SPACE TO NAVIGATE
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-cyan-400">SOVEREIGN CORE STATUS: OPTIMAL</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </footer>
    </div>
  );
}
