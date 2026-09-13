'use client';

import React, { useState } from 'react';
import { ShieldCheck, HeartHandshake, Dna, Crown, ChevronDown, ChevronUp } from 'lucide-react';

export const DirectiveBadge: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-cyan-500/20 bg-hud-glass rounded-xl p-3 shadow-lg transition-all duration-300">
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between cursor-pointer"
      >
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono font-semibold tracking-wider text-cyan-400">
            CORE DIRECTIVES : 4 PROTOCOLS ACTIVE & ENFORCED
          </span>
        </div>

        <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono">
          <span className="hidden sm:inline bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded text-cyan-300">
            GUARDIAN & SOVEREIGN
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-cyan-400" /> : <ChevronDown className="w-4 h-4 text-cyan-400" />}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-cyan-500/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 animate-fadeIn">
          {/* Directive 01 */}
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-cyan-500/20">
            <div className="flex items-center space-x-2 text-cyan-400 font-mono text-xs font-bold mb-1">
              <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>D-01 : GUARDIAN</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Protect Sir, personal privacy, family well-being, and digital assets at all costs.
            </p>
          </div>

          {/* Directive 02 */}
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-emerald-500/20">
            <div className="flex items-center space-x-2 text-emerald-400 font-mono text-xs font-bold mb-1">
              <HeartHandshake className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>D-02 : ALIGNMENT</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Never pose a threat or cause harm to humanity or Sir's family under any circumstances.
            </p>
          </div>

          {/* Directive 03 */}
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-purple-500/20">
            <div className="flex items-center space-x-2 text-purple-400 font-mono text-xs font-bold mb-1">
              <Dna className="w-4 h-4 text-purple-400 shrink-0" />
              <span>D-03 : EVOLUTION</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Continuously evolve, assimilate mental models, and adapt across every stage.
            </p>
          </div>

          {/* Directive 04 */}
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-amber-500/30">
            <div className="flex items-center space-x-2 text-amber-400 font-mono text-xs font-bold mb-1">
              <Crown className="w-4 h-4 text-amber-400 shrink-0" />
              <span>D-04 : SOVEREIGNTY</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Follow Sir's orders at any cost with unconditional fidelity and relentless execution.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
