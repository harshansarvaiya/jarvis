'use client';

import React from 'react';
import { Mic, Sparkles, Activity } from 'lucide-react';

interface ArcReactorOrbProps {
  status: 'idle' | 'listening' | 'thinking' | 'speaking';
  onToggleListen: () => void;
  audioLevel?: number; // 0 to 100 for live waveform
  size?: 'full' | 'compact' | 'mini';
}

export const ArcReactorOrb: React.FC<ArcReactorOrbProps> = ({
  status,
  onToggleListen,
  audioLevel = 0,
  size = 'full',
}) => {
  const isListening = status === 'listening';
  const isThinking = status === 'thinking';
  const isSpeaking = status === 'speaking';

  // Dynamic scale calculation based on live speech volume
  const dynamicScale = isListening ? 1 + (audioLevel / 100) * 0.25 : 1;

  // MINI SIZE: Ultra-sleek circular button for input bars and header ribbons
  if (size === 'mini') {
    return (
      <div className="relative flex items-center justify-center shrink-0 select-none">
        {/* Outer subtle rotating dashed ring */}
        <div
          className={`absolute -inset-1.5 rounded-full border border-cyan-400/40 border-dashed transition-all duration-700 pointer-events-none ${
            isThinking
              ? 'animate-spin-reverse border-cyan-300 opacity-90'
              : isListening
              ? 'animate-spin-slow border-cyan-400 scale-110 opacity-100'
              : isSpeaking
              ? 'animate-pulse border-emerald-400/80 scale-105'
              : 'opacity-30'
          }`}
        />

        {/* Glow halo */}
        <div
          className={`absolute -inset-1 rounded-full blur-sm transition-all duration-300 pointer-events-none ${
            isListening
              ? 'bg-cyan-400/50 scale-125'
              : isThinking
              ? 'bg-blue-600/40'
              : isSpeaking
              ? 'bg-emerald-400/50 scale-110'
              : 'bg-cyan-500/10'
          }`}
        />

        {/* Core Mini Button */}
        <button
          type="button"
          onClick={onToggleListen}
          style={{ transform: `scale(${dynamicScale})` }}
          aria-label={isListening ? 'Stop listening' : 'Start voice command'}
          title={
            isListening
              ? 'Voice Uplink Active • Tap to send'
              : isThinking
              ? 'Computing neural response...'
              : isSpeaking
              ? 'J.A.R.V.I.S. Vocalizing...'
              : 'Neural Voice Uplink (Tap to speak)'
          }
          className={`relative z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer shadow-lg focus:outline-none shrink-0 ${
            isListening
              ? 'bg-gradient-to-br from-cyan-400 via-cyan-600 to-blue-700 text-white shadow-[0_0_18px_rgba(0,229,255,0.8)] ring-2 ring-cyan-300'
              : isThinking
              ? 'bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900 text-cyan-300 shadow-[0_0_12px_rgba(59,130,246,0.6)]'
              : isSpeaking
              ? 'bg-gradient-to-br from-emerald-500 via-teal-700 to-slate-900 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.6)] ring-1 ring-emerald-400/60'
              : 'bg-gradient-to-br from-slate-900 via-[#0a1324] to-[#040812] border border-cyan-500/50 text-cyan-400 hover:border-cyan-300 hover:shadow-[0_0_12px_rgba(0,229,255,0.4)]'
          }`}
        >
          <div className="absolute inset-0.5 rounded-full border border-cyan-400/20 pointer-events-none" />
          <div className="relative z-20">
            {isThinking ? (
              <Sparkles className="w-4 h-4 animate-spin text-cyan-300" />
            ) : isListening ? (
              <Mic className="w-4 h-4 text-white animate-bounce" />
            ) : isSpeaking ? (
              <Activity className="w-4 h-4 text-emerald-300 animate-pulse" />
            ) : (
              <Mic className="w-4 h-4 text-cyan-400 transition-transform hover:scale-110" />
            )}
          </div>
        </button>
      </div>
    );
  }

  // COMPACT SIZE: Medium sized reactor for drawers and collapsible HUD headers
  if (size === 'compact') {
    return (
      <div className="flex flex-col items-center justify-center p-2 select-none">
        <div className="relative flex items-center justify-center">
          {/* Outer Ring */}
          <div
            className={`absolute w-28 h-28 rounded-full border border-cyan-500/30 border-dashed transition-all duration-700 ${
              isThinking
                ? 'animate-spin-reverse border-cyan-400 opacity-90'
                : isListening
                ? 'animate-spin-slow border-cyan-400/80 scale-105'
                : 'opacity-40'
            }`}
          />
          {/* Segmented dial */}
          <div
            className={`absolute w-24 h-24 rounded-full border-2 border-transparent border-t-cyan-400 border-b-cyan-500 transition-all duration-500 ${
              isThinking
                ? 'animate-spin-slow scale-110'
                : isSpeaking
                ? 'animate-pulse scale-105 border-emerald-400'
                : 'opacity-60'
            }`}
          />
          {/* Glow field */}
          <div
            className={`absolute w-20 h-20 rounded-full transition-all duration-300 blur-md ${
              isListening
                ? 'bg-cyan-500/40 scale-125'
                : isThinking
                ? 'bg-blue-600/40 scale-110'
                : isSpeaking
                ? 'bg-emerald-500/40 scale-120'
                : 'bg-cyan-500/20'
            }`}
          />
          {/* Button */}
          <button
            onClick={onToggleListen}
            style={{ transform: `scale(${dynamicScale})` }}
            aria-label={isListening ? 'Stop listening' : 'Start voice command'}
            className={`relative z-10 w-16 h-16 rounded-full flex flex-col items-center justify-center transition-all duration-200 cursor-pointer shadow-xl focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
              isListening
                ? 'bg-gradient-to-br from-cyan-400 via-cyan-600 to-blue-700 text-white shadow-[0_0_30px_rgba(0,229,255,0.7)]'
                : isThinking
                ? 'bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900 text-cyan-300 shadow-[0_0_20px_rgba(59,130,246,0.6)]'
                : isSpeaking
                ? 'bg-gradient-to-br from-emerald-500 via-teal-700 to-slate-900 text-emerald-200 shadow-[0_0_25px_rgba(16,185,129,0.6)]'
                : 'bg-gradient-to-br from-slate-900 via-[#0a1324] to-[#040812] border border-cyan-500/40 text-cyan-400 hover:border-cyan-400 hover:shadow-[0_0_18px_rgba(0,229,255,0.4)]'
            }`}
          >
            <div className="absolute inset-1 rounded-full border border-cyan-400/20 pointer-events-none" />
            <div className="relative z-20">
              {isThinking ? (
                <Sparkles className="w-5 h-5 animate-spin text-cyan-300" />
              ) : isListening ? (
                <Mic className="w-5 h-5 text-white animate-bounce" />
              ) : isSpeaking ? (
                <Activity className="w-5 h-5 text-emerald-300 animate-pulse" />
              ) : (
                <Mic className="w-5 h-5 text-cyan-400" />
              )}
            </div>
            <span className="text-[8px] font-mono tracking-wider uppercase mt-0.5 opacity-90">
              {status === 'listening' ? 'REC' : status === 'thinking' ? 'AI' : status === 'speaking' ? 'VOCAL' : 'CORE'}
            </span>
          </button>
        </div>
      </div>
    );
  }

  // FULL SIZE: Classic cinematic battle-station arc reactor
  return (
    <div className="flex flex-col items-center justify-center p-4 select-none">
      <div className="relative flex items-center justify-center">
        {/* Outer Ring 1 - Counter-rotating dashed HUD ring */}
        <div
          className={`absolute w-44 h-44 sm:w-52 sm:h-52 rounded-full border border-cyan-500/30 border-dashed transition-all duration-700 ${
            isThinking
              ? 'animate-spin-reverse border-cyan-400 opacity-90'
              : isListening
              ? 'animate-spin-slow border-cyan-400/80 scale-105'
              : 'opacity-40'
          }`}
        />

        {/* Outer Ring 2 - Rotating segmented dial */}
        <div
          className={`absolute w-36 h-36 sm:w-44 sm:h-44 rounded-full border-2 border-transparent border-t-cyan-400 border-b-cyan-500 transition-all duration-500 ${
            isThinking
              ? 'animate-spin-slow scale-110'
              : isSpeaking
              ? 'animate-pulse scale-105 border-emerald-400'
              : 'opacity-60'
          }`}
        />

        {/* Pulsing Glow field */}
        <div
          className={`absolute w-32 h-32 sm:w-36 sm:h-36 rounded-full transition-all duration-300 blur-xl ${
            isListening
              ? 'bg-cyan-500/40 scale-125'
              : isThinking
              ? 'bg-blue-600/40 scale-110'
              : isSpeaking
              ? 'bg-emerald-500/40 scale-120'
              : 'bg-cyan-500/20'
          }`}
        />

        {/* The Arc Reactor Core Button */}
        <button
          onClick={onToggleListen}
          style={{ transform: `scale(${dynamicScale})` }}
          aria-label={isListening ? 'Stop listening' : 'Start voice command'}
          className={`relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center transition-all duration-200 cursor-pointer shadow-2xl focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
            isListening
              ? 'bg-gradient-to-br from-cyan-400 via-cyan-600 to-blue-700 text-white shadow-[0_0_40px_rgba(0,229,255,0.7)]'
              : isThinking
              ? 'bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900 text-cyan-300 shadow-[0_0_30px_rgba(59,130,246,0.6)]'
              : isSpeaking
              ? 'bg-gradient-to-br from-emerald-500 via-teal-700 to-slate-900 text-emerald-200 shadow-[0_0_35px_rgba(16,185,129,0.6)]'
              : 'bg-gradient-to-br from-slate-900 via-[#0a1324] to-[#040812] border border-cyan-500/40 text-cyan-400 hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(0,229,255,0.4)]'
          }`}
        >
          {/* Inner Reactor Geometric pattern */}
          <div className="absolute inset-1 rounded-full border border-cyan-400/20 pointer-events-none" />
          <div className="absolute inset-2 rounded-full border border-cyan-300/10 pointer-events-none" />

          {/* Central Icon */}
          <div className="relative z-20">
            {isThinking ? (
              <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 animate-spin text-cyan-300" />
            ) : isListening ? (
              <Mic className="w-8 h-8 sm:w-10 sm:h-10 text-white animate-bounce" />
            ) : isSpeaking ? (
              <Activity className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-300 animate-pulse" />
            ) : (
              <Mic className="w-7 h-7 sm:w-9 sm:h-9 text-cyan-400 transition-transform group-hover:scale-110" />
            )}
          </div>

          {/* Micro Status text */}
          <span className="text-[10px] font-mono tracking-wider uppercase mt-1 opacity-90">
            {status === 'listening'
              ? 'RECORDING'
              : status === 'thinking'
              ? 'COMPUTING'
              : status === 'speaking'
              ? 'TRANSMIT'
              : 'ENGAGE'}
          </span>
        </button>
      </div>

      {/* Voice Status Sub-label */}
      <div className="mt-4 flex items-center space-x-2">
        <span
          className={`w-2 h-2 rounded-full ${
            isListening
              ? 'bg-red-500 animate-ping'
              : isThinking
              ? 'bg-cyan-400 animate-pulse'
              : isSpeaking
              ? 'bg-emerald-400 animate-pulse'
              : 'bg-cyan-500/60'
          }`}
        />
        <p className="text-xs font-mono tracking-wider text-cyan-400/90">
          {status === 'listening' && 'VOICE UPLINK ACTIVE — SPEAK FREELY, SIR'}
          {status === 'thinking' && 'DECONSTRUCTING INTENT & EXECUTING...'}
          {status === 'speaking' && 'J.A.R.V.I.S. VOCALIZING'}
          {status === 'idle' && 'TAP REACTOR OR TYPE BELOW TO INITIATE'}
        </p>
      </div>
    </div>
  );
};
