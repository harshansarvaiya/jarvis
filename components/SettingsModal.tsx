'use client';

import React, { useState, useEffect } from 'react';
import { X, Key, Cpu, Volume2, ShieldCheck, Check, Globe, Lock, Zap, Server, ExternalLink, Compass, Bell, BellRing, Trash2, AlertTriangle } from 'lucide-react';
import { triggerDeviceNotification } from '@/lib/jarvis/notifications';

export type OrchestrationMode = 'auto' | 'groq' | 'gemini' | 'manual';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  ttsEnabled: boolean;
  onToggleTts: (enabled: boolean) => void;
  groqApiKey?: string;
  onSaveGroqApiKey?: (key: string) => void;
  githubToken?: string;
  onSaveGithubToken?: (key: string) => void;
  orchestrationMode?: OrchestrationMode;
  onSelectOrchestrationMode?: (mode: OrchestrationMode) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveApiKey,
  selectedModel,
  onSelectModel,
  ttsEnabled,
  onToggleTts,
  groqApiKey = '',
  onSaveGroqApiKey,
  githubToken = '',
  onSaveGithubToken,
  orchestrationMode = 'auto',
  onSelectOrchestrationMode,
}) => {
  const [localKey, setLocalKey] = useState(apiKey);
  const [localGroqKey, setLocalGroqKey] = useState(groqApiKey);
  const [localGithubToken, setLocalGithubToken] = useState(githubToken);
  const [localOrchMode, setLocalOrchMode] = useState<OrchestrationMode>(orchestrationMode);
  const [masterPin, setMasterPin] = useState('1010');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [notifPerm, setNotifPerm] = useState<string>('default');
  const [wipeStatus, setWipeStatus] = useState<string | null>(null);
  const [isWiping, setIsWiping] = useState(false);
  const [confirmNuclear, setConfirmNuclear] = useState(false);

  useEffect(() => {
    setLocalKey(apiKey);
    const pin = localStorage.getItem('jarvis_master_pin') || '1010';
    setMasterPin(pin);
    setLocalGroqKey(localStorage.getItem('jarvis_groq_api_key') || groqApiKey || '');
    setLocalGithubToken(localStorage.getItem('jarvis_github_token') || githubToken || '');
    const savedMode = (localStorage.getItem('jarvis_orchestration_mode') as OrchestrationMode) || orchestrationMode || 'auto';
    setLocalOrchMode(savedMode);
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPerm(Notification.permission);
    }
  }, [apiKey, groqApiKey, githubToken, orchestrationMode, isOpen]);

  const handleExecuteWipe = async (mode: 'sensitive_only' | 'nuclear_all') => {
    setIsWiping(true);
    setWipeStatus(null);
    try {
      const res = await fetch('/api/jarvis/wipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (res.ok) {
        if (mode === 'nuclear_all') {
          localStorage.removeItem('jarvis_chat_history');
          localStorage.removeItem('jarvis_tasks_cache');
          localStorage.removeItem('jarvis_memories_cache');
          setWipeStatus('DEFCON 0 Nuclear Wipe Complete. Reloading...');
          setTimeout(() => window.location.reload(), 1500);
        } else {
          setWipeStatus(data.message || 'Directive 01 Sensitive Data Wipe Complete.');
          setTimeout(() => setWipeStatus(null), 4000);
        }
      } else {
        setWipeStatus(`Error: ${data.error || 'Failed to execute wipe'}`);
      }
    } catch (err: any) {
      setWipeStatus(`Error: ${err.message || 'Network error'}`);
    } finally {
      setIsWiping(false);
      setConfirmNuclear(false);
    }
  };

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveApiKey(localKey.trim());
    if (onSaveGroqApiKey) {
      onSaveGroqApiKey(localGroqKey.trim());
    } else {
      localStorage.setItem('jarvis_groq_api_key', localGroqKey.trim());
    }
    if (onSaveGithubToken) {
      onSaveGithubToken(localGithubToken.trim());
    } else {
      localStorage.setItem('jarvis_github_token', localGithubToken.trim());
    }
    if (onSelectOrchestrationMode) {
      onSelectOrchestrationMode(localOrchMode);
    }
    localStorage.setItem('jarvis_orchestration_mode', localOrchMode);
    localStorage.setItem('jarvis_master_pin', masterPin.trim() || '1010');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl bg-slate-950 border border-cyan-500/40 rounded-2xl p-6 shadow-[0_0_50px_rgba(0,229,255,0.2)] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cyan-500/20 mb-5">
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-cyan-400 animate-pulse" />
            <h2 className="font-mono text-base font-bold text-cyan-300 tracking-wider">
              J.A.R.V.I.S. MULTI-ENGINE TELEMETRY & CONFIG
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-5">
          {/* Section: Cognitive Orchestration Strategy */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-cyan-500/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 font-mono text-xs font-bold text-cyan-300">
                <Compass className="w-4 h-4 text-cyan-400" />
                <span>COGNITIVE ORCHESTRATION & DISPATCH MODE</span>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                EPISODIC RECALL ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  id: 'auto',
                  name: 'Autonomous Orchestrator',
                  desc: 'Auto-triage: Groq for reflex speed (100ms), Gemini for vision & strategy.',
                  badge: 'Recommended',
                },
                {
                  id: 'groq',
                  name: 'Reflex Priority (Groq)',
                  desc: 'Pins all operations to Groq US LPU for sub-second responses.',
                  badge: 'Sub-second',
                },
                {
                  id: 'gemini',
                  name: 'Deep Synthesis (Gemini)',
                  desc: 'Pins operations to Gemini 3.8 Flash for maximum context depth.',
                  badge: 'Deep Reasoning',
                },
                {
                  id: 'manual',
                  name: 'Manual Model Lock',
                  desc: 'Strictly use the single model pinned below.',
                  badge: 'Strict Lock',
                },
              ].map((om) => (
                <button
                  type="button"
                  key={om.id}
                  onClick={() => setLocalOrchMode(om.id as OrchestrationMode)}
                  className={`p-2 rounded-lg border text-left font-mono transition-all ${
                    localOrchMode === om.id
                      ? 'border-cyan-400 bg-cyan-950/70 text-cyan-200 shadow-[0_0_12px_rgba(0,229,255,0.25)]'
                      : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{om.name}</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-cyan-300">{om.badge}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 leading-tight">{om.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Section: Sovereign Independent Providers */}
          <div className="p-3.5 rounded-xl bg-slate-900/70 border border-cyan-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 font-mono text-xs font-bold text-cyan-300">
                <Server className="w-4 h-4 text-cyan-400" />
                <span>INDEPENDENT SOVEREIGN ENGINES (NON-GOOGLE)</span>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                DIRECTIVE 01 & 04 COMPLIANT
              </span>
            </div>

            {/* Groq Cloud Key */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-mono text-slate-300 flex items-center space-x-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>GROQ CLOUD API KEY (OPENAI GPT-OSS 120B / 20B)</span>
                </label>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-mono text-cyan-400 hover:underline flex items-center space-x-0.5"
                >
                  <span>Free Key</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <input
                type="password"
                placeholder="gsk_... (Or configure GROQ_API_KEY in Vercel)"
                value={localGroqKey}
                onChange={(e) => setLocalGroqKey(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Powers OpenAI GPT-OSS-120B on US custom LPU hardware with zero cost and ultra-fast generation (100–180ms).
              </p>
            </div>

            {/* GitHub Models Token */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-mono text-slate-300 flex items-center space-x-1">
                  <Key className="w-3 h-3 text-emerald-400" />
                  <span>GITHUB TOKEN (OPENAI GPT-4O / GPT-4O-MINI)</span>
                </label>
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-mono text-cyan-400 hover:underline flex items-center space-x-0.5"
                >
                  <span>Free Token</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <input
                type="password"
                placeholder="ghp_... (Or configure GITHUB_TOKEN in Vercel)"
                value={localGithubToken}
                onChange={(e) => setLocalGithubToken(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Saved for GitHub Models inference once Microsoft finishes the scheduled preview retirement brownout.
              </p>
            </div>
          </div>

          {/* Section: Google Gemini API Key */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono text-cyan-400 flex items-center space-x-1.5">
                <Key className="w-3.5 h-3.5" />
                <span>GOOGLE GEMINI API KEY (OPTIONAL OVERRIDE)</span>
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-mono text-cyan-400 hover:underline flex items-center space-x-0.5"
              >
                <span>Free Key</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <input
              type="password"
              placeholder="AIzaSy... (Inherited from Vercel GEMINI_API_KEY)"
              value={localKey}
              onChange={(e) => setLocalKey(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Loaded automatically from Vercel Environment Variable (<code className="text-cyan-400">GEMINI_API_KEY</code>). Leave empty to use server variable.
            </p>
          </div>

          {/* Master Security Key (Guardian Protocol) */}
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
            <label className="text-xs font-mono text-amber-400 flex items-center space-x-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>GUARDIAN MASTER SECRET (EDGE SENTRY)</span>
            </label>
            <input
              type="password"
              value={masterPin}
              onChange={(e) => setMasterPin(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-400"
            />
            <p className="text-[10px] text-slate-400">
              Validated on Edge. Also configurable via <code className="text-amber-300 bg-black/40 px-1 py-0.5 rounded">JARVIS_MASTER_PIN</code> in Vercel.
            </p>
          </div>

          {/* Model Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-mono text-cyan-400">
                ACTIVE NEURAL ENGINE SELECTION
              </label>
              <span className="text-[10px] font-mono text-emerald-400">
                Autonomous Quantum Failover Active
              </span>
            </div>

            {/* Sovereign Non-Google Models */}
            <div className="mb-2">
              <div className="text-[10px] font-mono uppercase text-slate-400 font-bold mb-1.5 flex items-center space-x-1">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Sovereign Fleet (OpenAI & Groq Silicon - Non-Google)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  {
                    id: 'openai/gpt-oss-120b',
                    name: 'OpenAI GPT-OSS 120B',
                    provider: 'Groq Cloud (US LPU)',
                    desc: 'Verified Live: 120B parameter reasoning & tool engine (0.1s latency)',
                  },
                  {
                    id: 'openai/gpt-oss-20b',
                    name: 'OpenAI GPT-OSS 20B',
                    provider: 'Groq Cloud (US LPU)',
                    desc: 'Verified Live: High-throughput reasoning & reflexes',
                  },
                  {
                    id: 'groq/compound',
                    name: 'Groq Compound System',
                    provider: 'Groq Cloud (US LPU)',
                    desc: 'Verified Live: Parallel agentic synthesis system',
                  },
                  {
                    id: 'gpt-4o',
                    name: 'OpenAI GPT-4o',
                    provider: 'GitHub Models (Azure)',
                    desc: 'Frontier omnimodel (Subject to GitHub preview brownout)',
                  },
                ].map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => onSelectModel(m.id)}
                    className={`p-2.5 rounded-lg border text-left font-mono transition-colors ${
                      selectedModel === m.id
                        ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200 shadow-[0_0_10px_rgba(0,229,255,0.2)]'
                        : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{m.name}</span>
                      <span className="text-[9px] text-cyan-400 bg-cyan-950/80 px-1 rounded">{m.provider}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Google Gemini Fleet */}
            <div>
              <div className="text-[10px] font-mono uppercase text-slate-400 font-bold mb-1.5 flex items-center space-x-1">
                <Cpu className="w-3 h-3 text-cyan-400" />
                <span>Google Gemini Fleet (Standard Ecosystem)</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', desc: 'Flagship 2026 Core' },
                  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', desc: 'Hybrid Thinking Core' },
                  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', desc: 'Scaled Production Core' },
                  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', desc: 'High-Throughput Multimodal' },
                  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Lite', desc: 'Reflex Reasoning' },
                  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', desc: 'Deep Synthesis' },
                ].map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => onSelectModel(m.id)}
                    className={`p-2 rounded-lg border text-left font-mono transition-colors ${
                      selectedModel === m.id
                        ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200 shadow-[0_0_10px_rgba(0,229,255,0.2)]'
                        : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{m.name}</div>
                    <div className="text-[9px] text-slate-400">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-slate-400 font-mono mt-2 bg-slate-900/60 p-2 rounded border border-slate-800">
              <strong className="text-cyan-300">Episodic History & Sovereign Failover:</strong> J.A.R.V.I.S. automatically extracts relevant prior conversations from Upstash Redis to inform every answer. If Gemini hits rate limits (HTTP 429), J.A.R.V.I.S. shifts to Groq instantly.
            </p>
          </div>

          {/* Voice Synthesis (TTS) Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="flex items-center space-x-2">
              <Volume2 className="w-4 h-4 text-cyan-400" />
              <div>
                <div className="text-xs font-mono text-slate-200">VOCAL SYNTHESIS (VOICE OUT)</div>
                <div className="text-[10px] text-slate-400">Cinematic mode: vocalizes crisp 1-2 sentence overview aloud</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onToggleTts(!ttsEnabled)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                ttsEnabled ? 'bg-cyan-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  ttsEnabled ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Push Notification Uplink */}
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BellRing className="w-4 h-4 text-cyan-400" />
                <div>
                  <div className="text-xs font-mono text-slate-200">TACTICAL PUSH NOTIFICATIONS</div>
                  <div className="text-[10px] text-slate-400">Receive proactive alerts, task reminders, and milestone notices</div>
                </div>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold ${
                notifPerm === 'granted'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                  : notifPerm === 'denied'
                  ? 'bg-red-950 text-red-300 border border-red-500/40'
                  : 'bg-amber-950 text-amber-300 border border-amber-500/40'
              }`}>
                {notifPerm === 'granted' ? 'ENABLED' : notifPerm === 'denied' ? 'BLOCKED' : 'PROMPT'}
              </span>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              {notifPerm !== 'granted' && (
                <button
                  type="button"
                  onClick={async () => {
                    if (typeof window !== 'undefined' && 'Notification' in window) {
                      const perm = await Notification.requestPermission();
                      setNotifPerm(perm);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-mono text-xs flex items-center space-x-1.5 transition-colors"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>ARM PERMISSIONS</span>
                </button>
              )}

              <button
                type="button"
                onClick={async () => {
                  await triggerDeviceNotification({
                    id: `test-${Date.now()}`,
                    title: 'J.A.R.V.I.S. Uplink Test',
                    message: 'Tactical push notification channel is active and verified, Sir.',
                    priority: 'HIGH',
                    timestamp: new Date().toLocaleTimeString(),
                  });
                }}
                className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-mono text-xs flex items-center space-x-1.5 transition-colors"
              >
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>TEST PUSH NOTIFICATION</span>
              </button>
            </div>
          </div>

          {/* Worldwide Access Telemetry Info */}
          <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/30 text-xs font-mono text-cyan-300">
            <div className="flex items-center space-x-2 font-bold mb-1">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>WORLDWIDE UBIQUITOUS UPLINK</span>
            </div>
            <p className="text-[10px] text-slate-300 leading-relaxed">
              Launch with <code className="text-cyan-400 bg-slate-900 px-1 py-0.5 rounded">./start-jarvis.ps1 -Global</code> to spin up an instant secure HTTPS tunnel for encrypted mobile voice anywhere in the world.
            </p>
          </div>

          {/* Directive 01 Guardian Data Protection & Emergency Wipe */}
          <div className="p-3.5 rounded-lg bg-red-950/20 border border-red-500/40 space-y-3 font-mono">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-red-400">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-xs font-bold tracking-wider">DIRECTIVE 01 GUARDIAN DATA PROTECTION</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-500/30">
                RAG VECTOR SANITIZER
              </span>
            </div>

            <p className="text-[10px] text-slate-300 leading-relaxed">
              Instantly purge sensitive vector knowledge chunks, credentials, tokens, and private API overrides from Upstash Redis and local disk while preserving core operational models.
            </p>

            {wipeStatus && (
              <div className="p-2 rounded bg-slate-900 border border-cyan-500/40 text-[11px] text-cyan-300">
                {wipeStatus}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isWiping}
                onClick={() => handleExecuteWipe('sensitive_only')}
                className="px-3 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-300 text-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isWiping ? 'SANITIZING...' : 'WIPE SENSITIVE DATA & CREDENTIALS'}</span>
              </button>

              {!confirmNuclear ? (
                <button
                  type="button"
                  disabled={isWiping}
                  onClick={() => setConfirmNuclear(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-red-950 border border-slate-700 text-slate-400 hover:text-red-300 text-xs transition-colors"
                >
                  DEFCON 0 NUCLEAR RESET
                </button>
              ) : (
                <div className="flex items-center space-x-2 bg-red-950/90 border border-red-500 p-1.5 rounded-lg">
                  <span className="text-[10px] text-red-200 font-bold">CONFIRM PURGE ALL?</span>
                  <button
                    type="button"
                    disabled={isWiping}
                    onClick={() => handleExecuteWipe('nuclear_all')}
                    className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-bold"
                  >
                    YES, PURGE ALL
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmNuclear(false)}
                    className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]"
                  >
                    CANCEL
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Core Directives Confirmation */}
          <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-xs font-mono text-emerald-300 flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">DIRECTIVES 01, 02, 03, 04 ENGAGED:</span>
              <p className="text-[10px] text-slate-300 mt-0.5">
                Guardian Protocol, Benevolent Alignment, Evolutionary Adaptation, and Sovereign Loyalty active.
              </p>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={async () => {
                try {
                  await fetch('/api/jarvis/auth/logout', { method: 'POST' });
                } catch {}
                localStorage.removeItem('jarvis_guardian_auth');
                localStorage.removeItem('jarvis_auth_token');
                window.location.reload();
              }}
              className="px-3 py-2 rounded-lg bg-red-950/60 border border-red-500/40 text-red-400 hover:bg-red-900/60 font-mono text-xs flex items-center space-x-1.5 transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>ENGAGE LOCKDOWN</span>
            </button>

            {savedSuccess ? (
              <span className="text-xs font-mono text-emerald-400 flex items-center space-x-1">
                <Check className="w-3.5 h-3.5" />
                <span>PARAMETERS SAVED</span>
              </span>
            ) : <span />}

            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs shadow-[0_0_15px_rgba(0,229,255,0.4)]"
            >
              SAVE TELEMETRY
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
