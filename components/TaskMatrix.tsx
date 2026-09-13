'use client';

import React, { useState } from 'react';
import { Task, Priority } from '@/lib/jarvis/memory';
import { CheckCircle2, Circle, Clock, Plus, Trash2, Tag, AlertTriangle } from 'lucide-react';

interface TaskMatrixProps {
  tasks: Task[];
  onToggleTask: (taskId: string, currentStatus: string) => void;
  onDeleteTask: (taskId: string) => void;
  onAddTask: (title: string, priority: Priority) => void;
}

export const TaskMatrix: React.FC<TaskMatrixProps> = ({
  tasks,
  onToggleTask,
  onDeleteTask,
  onAddTask,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ACTIVE');
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('HIGH');
  const [showAddForm, setShowAddForm] = useState(false);

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'ACTIVE') return t.status !== 'COMPLETED';
    if (filter === 'COMPLETED') return t.status === 'COMPLETED';
    return true;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddTask(newTitle.trim(), newPriority);
    setNewTitle('');
    setShowAddForm(false);
  };

  const getPriorityBadge = (priority: Priority) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-950/80 text-red-400 border-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.3)]';
      case 'HIGH':
        return 'bg-amber-950/80 text-amber-400 border-amber-500/50';
      case 'MEDIUM':
        return 'bg-cyan-950/80 text-cyan-400 border-cyan-500/50';
      case 'LOW':
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="border border-cyan-500/20 bg-hud-glass rounded-xl p-4 shadow-xl flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          <h3 className="font-mono text-sm font-bold tracking-wider text-cyan-300 uppercase">
            TACTICAL MATRIX : OBJECTIVES
          </h3>
          <span className="text-xs font-mono bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">
            {tasks.filter((t) => t.status !== 'COMPLETED').length} ACTIVE
          </span>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-xs font-mono flex items-center space-x-1 px-2.5 py-1 rounded-md bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>NEW</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 my-3 text-xs font-mono">
        {(['ACTIVE', 'ALL', 'COMPLETED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-2.5 py-1 rounded transition-colors ${
              filter === tab
                ? 'bg-cyan-500 text-black font-semibold shadow-[0_0_10px_rgba(0,229,255,0.4)]'
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/50 border border-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Quick Add Form */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="mb-3 p-2.5 rounded-lg bg-slate-900/80 border border-cyan-500/30">
          <input
            type="text"
            placeholder="Direct objective or task title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full bg-slate-950 text-sm text-slate-100 rounded px-2.5 py-1.5 border border-slate-700 focus:outline-none focus:border-cyan-400 mb-2 font-mono"
            autoFocus
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <span className="text-xs font-mono text-slate-400 mr-1">PRIORITY:</span>
              {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as Priority[]).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setNewPriority(p)}
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                    newPriority === p
                      ? getPriorityBadge(p)
                      : 'border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              type="submit"
              className="text-xs font-mono px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded"
            >
              COMMIT
            </button>
          </div>
        </form>
      )}

      {/* Task List */}
      <div className="space-y-2 overflow-y-auto max-h-[340px] pr-1">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-xs font-mono text-slate-500">
            RADAR CLEAR — NO OBJECTIVES IN THIS SECTOR
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isCompleted = task.status === 'COMPLETED';
            return (
              <div
                key={task.id}
                className={`group p-3 rounded-lg border transition-all duration-200 flex items-start justify-between space-x-3 ${
                  isCompleted
                    ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                    : 'bg-slate-900/60 border-slate-800 hover:border-cyan-500/40 hover:bg-slate-900/90'
                }`}
              >
                <button
                  onClick={() => onToggleTask(task.id, task.status)}
                  className="mt-0.5 shrink-0 text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-500 hover:text-cyan-400" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${getPriorityBadge(
                        task.priority
                      )}`}
                    >
                      {task.priority}
                    </span>
                    <span
                      className={`text-xs font-medium truncate ${
                        isCompleted ? 'line-through text-slate-400' : 'text-slate-100'
                      }`}
                    >
                      {task.title}
                    </span>
                  </div>

                  {task.description && (
                    <p className="text-[11px] text-slate-400 leading-snug line-clamp-2 mb-1.5">
                      {task.description}
                    </p>
                  )}

                  {task.tags && task.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {task.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[9px] font-mono text-cyan-400/70 bg-cyan-950/40 border border-cyan-500/20 px-1 rounded flex items-center space-x-0.5"
                        >
                          <Tag className="w-2.5 h-2.5 inline" />
                          <span>{tag}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onDeleteTask(task.id)}
                  aria-label="Delete objective"
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
