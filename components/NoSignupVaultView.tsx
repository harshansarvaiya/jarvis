"use client";

import React, { useState, useEffect } from 'react';

interface Tool {
  id: string;
  name: string;
  description: string;
  url: string;
  category: string;
  tags: string[];
  github?: string;
  stars?: number;
}

interface DataSchema {
  categories: { id: string; name: string; icon: string; description: string; }[];
  tools: Tool[];
}

export default function NoSignupVaultView() {
  const [data, setData] = useState<DataSchema | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/no-signup-tools')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-cyan-400 font-mono text-sm animate-pulse">Loading No-Signup Intelligence Vault...</div>;
  }

  const categories = data?.categories || [];
  const tools = data?.tools || [];

  const filtered = tools.filter(t => {
    const matchesCat = selectedCategory === 'all' || t.category === selectedCategory;
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
                          t.description.toLowerCase().includes(search.toLowerCase()) ||
                          t.tags?.some(tag => tag.toLowerCase().includes(search.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100 font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/80 border border-cyan-500/30 p-6 rounded-2xl backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-cyan-400 flex items-center gap-2">
            <span>🛡️</span> No-Signup Intelligence Vault
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Ingested from FckSignups registry ({tools.length} open-source, client-side tools requiring zero registration).
          </p>
        </div>
        <input
          type="text"
          placeholder="Search tools, tags, primitives..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-slate-950 border border-slate-800 focus:border-cyan-500 px-4 py-2 rounded-xl text-sm w-full md:w-80 outline-none text-slate-200 placeholder-slate-500 transition-all"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
            selectedCategory === 'all'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/20'
              : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          All ({tools.length})
        </button>
        {categories.map(c => {
          const count = tools.filter(t => t.category === c.id).length;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                selectedCategory === c.id
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{c.icon}</span>
              <span>{c.name}</span>
              <span className="opacity-60 text-[10px]">({count})</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(tool => (
          <div key={tool.id} className="bg-slate-900/40 border border-slate-800 hover:border-cyan-500/40 p-5 rounded-2xl flex flex-col justify-between transition-all group">
            <div className="space-y-2">
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-semibold text-slate-200 group-hover:text-cyan-400 transition-colors">
                  {tool.name}
                </h3>
                {tool.stars && (
                  <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md font-mono">
                    ⭐ {tool.stars.toLocaleString()}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {tool.description}
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col gap-3">
              <div className="flex flex-wrap gap-1">
                {tool.tags?.slice(0, 3).map(tag => (
                  <span key={tag} className="text-[10px] bg-slate-950 border border-slate-800/80 text-cyan-300/80 px-2 py-0.5 rounded">
                    #{tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs pt-1">
                {tool.github && (
                  <a
                    href={tool.github}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
                  >
                    GitHub ↗
                  </a>
                )}
                <a
                  href={tool.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500 hover:text-slate-950 px-3 py-1.5 rounded-xl font-medium transition-all"
                >
                  Launch App ↗
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
