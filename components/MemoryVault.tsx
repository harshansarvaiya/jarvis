'use client';

import React, { useState } from 'react';
import { MemoryItem, MemoryCategory } from '@/lib/jarvis/memory';
import { Brain, Search, Sparkles, Shield, Bookmark, Lightbulb, Dna, Plus } from 'lucide-react';

interface MemoryVaultProps {
  memories: MemoryItem[];
  evolutionStage: number;
  onAddMemory: (category: MemoryCategory, content: string) => void;
}

export const MemoryVault: React.FC<MemoryVaultProps> = ({
  memories,
  evolutionStage,
  onAddMemory,
}) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCategory, setNewCategory] = useState<MemoryCategory>('PREFERENCE');
  const [newContent, setNewContent] = useState('');

  const filteredMemories = memories.filter((mem) => {
    const matchesCategory = activeCategory === 'ALL' || mem.category === activeCategory;
    const matchesSearch =
      mem.content.toLowerCase().includes(search.toLowerCase()) ||
      (mem.context && mem.context.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    onAddMemory(newCategory, newContent.trim());
    setNewContent('');
    setShowAddModal(false);
  };

  const getCategoryIcon = (category: MemoryCategory) => {
    switch (category) {
      case 'PRINCIPLE':
        return <Shield className="w-3.5 h-3.5 text-cyan-400" />;
      case 'PREFERENCE':
        return <Bookmark className="w-3.5 h-3.5 text-blue-400" />;
      case 'PROJECT':
        return <Brain className="w-3.5 h-3.5 text-amber-400" />;
      case 'DECISION':
        return <Sparkles className="w-3.5 h-3.5 text-emerald-400" />;
      case 'INSIGHT':
        return <Lightbulb className="w-3.5 h-3.5 text-yellow-400" />;
      case 'EVOLUTION':
        return <Dna className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  return (
    <div className="border border-cyan-500/20 bg-hud-glass rounded-xl p-4 shadow-xl flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20">
        <div className="flex items-center space-x-2">
          <Brain className="w-4 h-4 text-cyan-400" />
          <h3 className="font-mono text-sm font-bold tracking-wider text-cyan-300 uppercase">
            NEURAL MEMORY VAULT
          </h3>
          <span className="text-xs font-mono bg-purple-950/80 text-purple-300 px-2 py-0.5 rounded border border-purple-500/40">
            STAGE {evolutionStage}
          </span>
        </div>

        <button
          onClick={() => setShowAddModal(!showAddModal)}
          className="text-xs font-mono flex items-center space-x-1 px-2.5 py-1 rounded-md bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 text-purple-300 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>IMPRINT</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative my-3">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="text"
          placeholder="Semantic query through memories & principles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 bg-slate-900/80 text-xs font-mono text-slate-200 rounded-lg border border-slate-800 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* Category Badges */}
      <div className="flex flex-wrap gap-1 mb-3 text-[10px] font-mono">
        {['ALL', 'PRINCIPLE', 'PREFERENCE', 'PROJECT', 'DECISION', 'EVOLUTION'].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-2 py-0.5 rounded border transition-colors ${
              activeCategory === cat
                ? 'bg-cyan-900/80 border-cyan-400 text-cyan-200'
                : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Add Memory Modal / Accordion */}
      {showAddModal && (
        <form onSubmit={handleAddSubmit} className="mb-3 p-2.5 rounded-lg bg-slate-900/90 border border-purple-500/40">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-xs font-mono text-purple-300">CATEGORY:</span>
            {(['PRINCIPLE', 'PREFERENCE', 'PROJECT', 'DECISION', 'INSIGHT'] as MemoryCategory[]).map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setNewCategory(c)}
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                  newCategory === c
                    ? 'bg-purple-900 text-purple-200 border-purple-400'
                    : 'border-slate-800 text-slate-500'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <textarea
            placeholder="Record a principle, preference, or cognitive learning..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={2}
            className="w-full bg-slate-950 text-xs text-slate-100 rounded p-2 border border-slate-700 focus:outline-none focus:border-purple-400 font-mono mb-2"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="text-xs font-mono px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded"
            >
              IMPRINT TO VAULT
            </button>
          </div>
        </form>
      )}

      {/* Memory List */}
      <div className="space-y-2 overflow-y-auto max-h-[320px] pr-1">
        {filteredMemories.length === 0 ? (
          <div className="text-center py-8 text-xs font-mono text-slate-500">
            NO MEMORIES MATCH THIS CRITERIA
          </div>
        ) : (
          filteredMemories.map((mem) => (
            <div
              key={mem.id}
              className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800 hover:border-cyan-500/30 transition-all text-xs"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-1.5 font-mono text-[10px] text-slate-300">
                  {getCategoryIcon(mem.category)}
                  <span className="font-semibold text-cyan-400">{mem.category}</span>
                </div>
                <span className="text-[9px] font-mono text-slate-500">
                  CONFIDENCE {(mem.confidence * 100).toFixed(0)}%
                </span>
              </div>

              <p className="text-[11px] text-slate-200 leading-relaxed font-sans">
                {mem.content}
              </p>

              {mem.context && (
                <div className="mt-1 text-[9px] font-mono text-slate-500 truncate">
                  SRC: {mem.context}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
