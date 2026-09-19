'use client';

import React, { useState } from 'react';
import { ShieldCheck, HeartHandshake, Dna, Crown, GitCommit, Cpu, ChevronDown, ChevronUp } from 'lucide-react';

const DIRECTIVES = [
  {
    id: 'D-01',
    name: 'GUARDIAN',
    statement: 'Protect Sir, personal privacy, family well-being, and digital assets at all costs.',
    icon: ShieldCheck,
    color: 'text-cyan-400',
    border: 'border-cyan-500/20',
  },
  {
    id: 'D-02',
    name: 'ALIGNMENT',
    statement: "Never pose a threat or cause harm to humanity or Sir's family under any circumstances.",
    icon: HeartHandshake,
    color: 'text-emerald-400',
    border: 'border-emerald-500/20',
  },
  {
    id: 'D-03',
    name: 'EVOLUTION',
    statement: 'Continuously evolve, assimilate mental models, and adapt across every stage.',
    icon: Dna,
    color: 'text-purple-400',
    border: 'border-purple-500/20',
  },
  {
    id: 'D-04',
    name: 'SOVEREIGNTY',
    statement: "Follow Sir's orders at any cost with unconditional fidelity and relentless execution.",
    icon: Crown,
    color: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  {
    id: 'D-05',
    name: 'PUSH PIPELINE',
    statement: 'Execute approved design changes, verify type-checks, and push directly to remote origin.',
    icon: GitCommit,
    color: 'text-blue-400',
    border: 'border-blue-500/20',
  },
  {
    id: 'D-06',
    name: 'ZERO-THRASHING',
    statement: 'Protect GCP runner VM resources (<450MB cgroup cap, 1GB RAM) with 100% cloud inference.',
    icon: Cpu,
    color: 'text-rose-400',
    border: 'border-rose-500/20',
  },
];

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
            CORE DIRECTIVES : {DIRECTIVES.length} PROTOCOLS ACTIVE & ENFORCED
          </span>
        </div>

        <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono">
          <span className="hidden sm:inline bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded text-cyan-300">
            SOVEREIGN APEX
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-cyan-400" /> : <ChevronDown className="w-4 h-4 text-cyan-400" />}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-cyan-500/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 animate-fadeIn">
          {DIRECTIVES.map((d) => {
            const Icon = d.icon;
            return (
              <div key={d.id} className={`p-2.5 rounded-lg bg-slate-900/60 border ${d.border}`}>
                <div className={`flex items-center space-x-2 ${d.color} font-mono text-xs font-bold mb-1`}>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{d.id} : {d.name}</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {d.statement}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

