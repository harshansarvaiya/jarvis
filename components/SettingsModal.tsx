'use client';

import React, { useState, useEffect } from 'react';
import { X, Key, Cpu, Volume2, ShieldCheck, Check, Globe, Lock } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  ttsEnabled: boolean;
  onToggleTts: (enabled: boolean) => void;
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
}) => {
  const [localKey, setLocalKey] = useState(apiKey);
  const [masterPin, setMasterPin] = useState('1010');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setLocalKey(apiKey);
    const pin = localStorage.getItem('jarvis_master_pin') || '1010';
    setMasterPin(pin);
  }, [apiKey, isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveApiKey(localKey.trim());
    localStorage.setItem('jarvis_master_pin', masterPin.trim() || '1010');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-950 border border-cyan-500/40 rounded-2xl p-6 shadow-[0_0_50px_rgba(0,229,255,0.2)] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cyan-500/20 mb-5">
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-cyan-400 animate-pulse" />
            <h2 className="font-mono text-base font-bold text-cyan-300 tracking-wider">
              J.A.R.V.I.S. SYSTEM TELEMETRY & CONFIG
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* API Key Config */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-cyan-400 mb-1.5 flex items-center space-x-1.5">
              <Key className="w-3.5 h-3.5" />
              <span>GOOGLE GEMINI API KEY</span>
            </label>
            <div className="relative">
              <input
                type="password"
                placeholder="AIzaSy..."
                value={localKey}
                onChange={(e) => setLocalKey(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-400"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Encrypted locally in your browser. Powers real-time voice, vision, and tool actions.
            </p>
          </div>

          {/* Master Security Key (Guardian Protocol) */}
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-amber-400 flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>GUARDIAN MASTER SECRET (SERVER SENTRY)</span>
              </label>
            </div>
            <p className="text-[10px] text-slate-400">
              Validated on Vercel Edge. Configure <code className="text-amber-300 bg-black/40 px-1 py-0.5 rounded">JARVIS_MASTER_PIN</code> or <code className="text-amber-300 bg-black/40 px-1 py-0.5 rounded">JARVIS_MASTER_KEY</code> in Vercel Environment Variables for absolute protection.
            </p>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-xs font-mono text-cyan-400 mb-1.5">
              NEURAL ENGINE MODEL
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Sub-second reflex & voice' },
                { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: 'Deep synthesis & reasoning' },
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
                  <div className="text-xs font-bold">{m.name}</div>
                  <div className="text-[10px] text-slate-400">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Voice Synthesis (TTS) Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="flex items-center space-x-2">
              <Volume2 className="w-4 h-4 text-cyan-400" />
              <div>
                <div className="text-xs font-mono text-slate-200">VOCAL SYNTHESIS (VOICE OUT)</div>
                <div className="text-[10px] text-slate-400">J.A.R.V.I.S. vocalizes replies aloud</div>
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
