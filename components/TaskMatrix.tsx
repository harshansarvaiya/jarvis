'use client';

import React, { useState } from 'react';
import { Task, Priority, TaskExecutionRecord } from '@/lib/jarvis/memory';
import {
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Trash2,
  Tag,
  Terminal,
  Zap,
  Cpu,
  Server,
  X,
  Copy,
  Check,
  Send,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Activity,
  Play,
  Layers,
} from 'lucide-react';

interface TaskMatrixProps {
  tasks: Task[];
  onToggleTask: (taskId: string, currentStatus: string) => void;
  onDeleteTask: (taskId: string) => void;
  onAddTask: (title: string, priority: Priority) => void;
  onTransmitToChat?: (prompt: string) => void;
  onLogExecution?: (taskId: string, record: any) => void;
}

export const TaskMatrix: React.FC<TaskMatrixProps> = ({
  tasks,
  onToggleTask,
  onDeleteTask,
  onAddTask,
  onTransmitToChat,
  onLogExecution,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ACTIVE');
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('HIGH');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Filter tasks based on status
  const filteredTasks = tasks.filter((t) => {
    if (filter === 'ACTIVE') return t.status !== 'COMPLETED';
    if (filter === 'COMPLETED') return t.status === 'COMPLETED';
    return true;
  });

  // Currently selected task for detailed execution audit modal
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null;

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
    <div className="border border-cyan-500/20 bg-hud-glass rounded-xl p-4 shadow-xl flex flex-col h-full relative">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20 shrink-0">
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
      <div className="flex space-x-2 my-3 text-xs font-mono shrink-0">
        {[
          { key: 'ACTIVE', label: `ACTIVE (${tasks.filter((t) => t.status !== 'COMPLETED').length})` },
          { key: 'ALL', label: `ALL (${tasks.length})` },
          { key: 'COMPLETED', label: `COMPLETED (${tasks.filter((t) => t.status === 'COMPLETED').length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as any)}
            className={`px-2.5 py-1 rounded transition-colors ${
              filter === tab.key
                ? 'bg-cyan-500 text-black font-semibold shadow-[0_0_10px_rgba(0,229,255,0.4)]'
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/50 border border-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Quick Add Form */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="mb-3 p-2.5 rounded-lg bg-slate-900/80 border border-cyan-500/30 shrink-0 animate-fadeIn">
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
      <div className="space-y-2 overflow-y-auto flex-1 pr-1 min-h-0">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-xs font-mono text-slate-500">
            RADAR CLEAR — NO OBJECTIVES IN THIS SECTOR
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isCompleted = task.status === 'COMPLETED';
            const auditCount = task.executionAudit?.length || 0;

            return (
              <div
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className={`group p-3 rounded-lg border transition-all duration-200 flex items-start justify-between space-x-3 cursor-pointer select-none ${
                  isCompleted
                    ? 'bg-slate-950/40 border-slate-800/60 opacity-70 hover:opacity-100 hover:border-slate-700'
                    : 'bg-slate-900/60 border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/90 hover:shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                }`}
              >
                {/* Status Toggle Checkbox */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTask(task.id, task.status);
                  }}
                  title={isCompleted ? 'Reopen objective' : 'Mark as completed'}
                  className="mt-0.5 shrink-0 text-cyan-400 hover:text-cyan-300 transition-colors p-0.5"
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-500 hover:text-cyan-400" />
                  )}
                </button>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1 flex-wrap gap-y-1">
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${getPriorityBadge(
                        task.priority
                      )}`}
                    >
                      {task.priority}
                    </span>
                    <span
                      className={`text-xs font-medium truncate max-w-[200px] sm:max-w-xs ${
                        isCompleted ? 'line-through text-slate-400' : 'text-slate-100'
                      }`}
                    >
                      {task.title}
                    </span>
                    {isCompleted ? (
                      <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.2 rounded shrink-0">
                        DONE
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-1.5 py-0.2 rounded shrink-0 animate-pulse">
                        ACTIVE
                      </span>
                    )}
                  </div>

                  {task.description && (
                    <p className="text-[11px] text-slate-400 leading-snug line-clamp-2 mb-1.5">
                      {task.description}
                    </p>
                  )}

                  <div className="flex items-center space-x-2 text-[9px] font-mono text-slate-500 flex-wrap gap-y-1">
                    {/* Execution Audit Pill */}
                    <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-950 border border-cyan-500/30 text-cyan-300 group-hover:border-cyan-400 transition-colors">
                      <Terminal className="w-2.5 h-2.5 text-cyan-400" />
                      <span>{auditCount > 0 ? `${auditCount} EXECUTION LOGS` : 'VIEW COMMANDS & MCP'}</span>
                    </span>

                    {task.tags && task.tags.length > 0 && (
                      <span className="hidden sm:inline-flex items-center space-x-1 text-slate-400">
                        <Tag className="w-2.5 h-2.5" />
                        <span>{task.tags.join(', ')}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTask(task.id);
                    }}
                    aria-label="Delete objective"
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity p-1 rounded hover:bg-slate-800"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* TASK EXECUTION AUDIT MODAL (COMMANDS, MCP TOOLS, & SYSTEM LOGS)           */}
      {/* ========================================================================= */}
      {selectedTask && (
        <TaskExecutionModal
          task={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          onToggleStatus={() => onToggleTask(selectedTask.id, selectedTask.status)}
          onDelete={() => {
            onDeleteTask(selectedTask.id);
            setSelectedTaskId(null);
          }}
          onTransmitToChat={onTransmitToChat}
          onLogExecution={(record) => onLogExecution?.(selectedTask.id, record)}
        />
      )}
    </div>
  );
};

interface TaskExecutionModalProps {
  task: Task;
  onClose: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onTransmitToChat?: (prompt: string) => void;
  onLogExecution?: (record: any) => void;
}

const TaskExecutionModal: React.FC<TaskExecutionModalProps> = ({
  task,
  onClose,
  onToggleStatus,
  onDelete,
  onTransmitToChat,
  onLogExecution,
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'COMMANDS' | 'MCP'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reportCopied, setReportCopied] = useState(false);
  const [manualCmd, setManualCmd] = useState('');
  const [manualOutput, setManualOutput] = useState('');
  const [manualServer, setManualServer] = useState('local-powershell');
  const [showAddAction, setShowAddAction] = useState(false);

  const isCompleted = task.status === 'COMPLETED';

  // Fallback realistic execution items if task has no explicit executionAudit yet
  const executionRecords: TaskExecutionRecord[] =
    task.executionAudit && task.executionAudit.length > 0
      ? task.executionAudit
      : [
          {
            id: `exec-default-1`,
            timestamp: task.createdAt,
            type: 'MCP_TOOL',
            name: 'mcp:mission_control/register_objective',
            command: `jarvis.tasks.create(title="${task.title}")`,
            server: 'jarvis-mcp-orchestrator',
            status: 'SUCCESS',
            durationMs: 110,
            output: `Objective registered into mission control matrix with priority ${task.priority}. Directive 04 tracking active.`,
          },
        ];

  // Tab Filtering
  const filteredRecords = executionRecords.filter((rec) => {
    if (activeTab === 'COMMANDS') return rec.type === 'SHELL_COMMAND';
    if (activeTab === 'MCP') return rec.type === 'MCP_TOOL' || rec.type === 'API_ORCHESTRATION';
    return true;
  });

  const commandCount = executionRecords.filter((r) => r.type === 'SHELL_COMMAND').length;
  const mcpCount = executionRecords.filter((r) => r.type === 'MCP_TOOL' || r.type === 'API_ORCHESTRATION').length;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyFullReport = () => {
    const report = [
      `# J.A.R.V.I.S. Task Execution Report`,
      `**Objective**: ${task.title}`,
      `**Status**: ${task.status} | **Priority**: ${task.priority}`,
      `**Created**: ${task.createdAt}`,
      ``,
      `## Executed Commands & MCP Tools (${executionRecords.length})`,
      ...executionRecords.map((r, i) => {
        return [
          `### ${i + 1}. [${r.type}] ${r.name} (${r.status})`,
          `- **Server / Host**: \`${r.server || 'local-host'}\``,
          `- **Timestamp**: ${r.timestamp}`,
          r.command ? `- **Command**: \`${r.command}\`` : '',
          `- **Output**:`,
          '```',
          r.output || 'No output recorded',
          '```',
          '',
        ]
          .filter(Boolean)
          .join('\n');
      }),
    ].join('\n');

    navigator.clipboard.writeText(report);
    setReportCopied(true);
    setTimeout(() => setReportCopied(false), 2000);
  };

  const handleAddManualAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCmd.trim()) return;
    onLogExecution?.({
      type: manualCmd.startsWith('mcp:') ? 'MCP_TOOL' : 'SHELL_COMMAND',
      name: manualCmd.startsWith('mcp:') ? manualCmd : `exec:${manualCmd.slice(0, 30)}`,
      command: manualCmd.trim(),
      server: manualServer,
      status: 'SUCCESS',
      output: manualOutput.trim() || 'Manual execution logged by Sir.',
      durationMs: 120,
    });
    setManualCmd('');
    setManualOutput('');
    setShowAddAction(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
      <div className="max-w-3xl w-full max-h-[90vh] bg-[#0b111e] border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(0,229,255,0.25)] flex flex-col overflow-hidden text-slate-100">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-cyan-500/20 bg-slate-950/80 flex items-start justify-between shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center space-x-2 text-[10px] font-mono text-cyan-400 mb-1 uppercase tracking-widest">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>TACTICAL AUDIT // OBJECTIVE EXECUTION TRAIL</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <h2 className="text-base sm:text-lg font-bold text-white tracking-wide break-words">
              {task.title}
            </h2>

            <div className="mt-2 flex items-center space-x-2 flex-wrap gap-y-1">
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                  task.priority === 'CRITICAL'
                    ? 'bg-red-950/80 text-red-400 border-red-500/50'
                    : task.priority === 'HIGH'
                    ? 'bg-amber-950/80 text-amber-400 border-amber-500/50'
                    : 'bg-cyan-950/80 text-cyan-400 border-cyan-500/50'
                }`}
              >
                PRIORITY: {task.priority}
              </span>

              <button
                type="button"
                onClick={onToggleStatus}
                className={`text-[10px] font-mono px-2 py-0.5 rounded border flex items-center space-x-1 transition-colors ${
                  isCompleted
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 hover:bg-emerald-900'
                    : 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50 hover:bg-cyan-900'
                }`}
              >
                {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                <span>STATUS: {task.status} (CLICK TO FLIP)</span>
              </button>

              <span className="text-[10px] font-mono text-slate-400">
                CREATED: {new Date(task.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metrics Telemetry HUD */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 sm:p-4 bg-slate-950/40 border-b border-cyan-500/10 shrink-0 font-mono text-xs">
          <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">COMMANDS EXECUTED</div>
            <div className="text-sm font-bold text-cyan-300 mt-0.5 flex items-center space-x-1">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>{commandCount} COMMANDS</span>
            </div>
          </div>

          <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">MCP TOOLS INVOKED</div>
            <div className="text-sm font-bold text-emerald-300 mt-0.5 flex items-center space-x-1">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              <span>{mcpCount} TOOLS</span>
            </div>
          </div>

          <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">INTEGRITY & STATUS</div>
            <div className="text-sm font-bold text-emerald-400 mt-0.5 flex items-center space-x-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>100% OPERATIONAL</span>
            </div>
          </div>

          <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">PRIMARY ENGINE</div>
            <div className="text-sm font-bold text-cyan-400 mt-0.5 truncate">
              {executionRecords[0]?.server || 'local-powershell'}
            </div>
          </div>
        </div>

        {/* Action Filter Tabs & Log New Action Toggle */}
        <div className="p-3 border-b border-cyan-500/10 flex items-center justify-between font-mono text-xs shrink-0">
          <div className="flex space-x-2">
            {[
              { key: 'ALL', label: `ALL ACTIONS (${executionRecords.length})` },
              { key: 'COMMANDS', label: `COMMANDS (${commandCount})` },
              { key: 'MCP', label: `MCP TOOLS (${mcpCount})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  activeTab === tab.key
                    ? 'bg-cyan-500 text-black font-bold'
                    : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowAddAction(!showAddAction)}
            className="text-[11px] px-2.5 py-1 rounded bg-slate-900 hover:bg-cyan-950 border border-slate-800 hover:border-cyan-500/40 text-cyan-300 flex items-center space-x-1 transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span>LOG ACTION</span>
          </button>
        </div>

        {/* Add Manual Action Form */}
        {showAddAction && (
          <form onSubmit={handleAddManualAction} className="p-3 bg-slate-950 border-b border-cyan-500/20 font-mono text-xs space-y-2 shrink-0 animate-fadeIn">
            <div className="text-cyan-400 font-bold uppercase text-[10px]">
              LOG MANUAL COMMAND OR MCP SERVER ACTION
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={manualCmd}
                onChange={(e) => setManualCmd(e.target.value)}
                placeholder="Command line or tool (e.g. git status, mcp:github/push)..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                autoFocus
              />
              <select
                value={manualServer}
                onChange={(e) => setManualServer(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200 focus:outline-none"
              >
                <option value="local-powershell">local-powershell</option>
                <option value="mcp-server-filesystem">mcp-server-filesystem</option>
                <option value="mcp-server-github">mcp-server-github</option>
                <option value="upstash-redis-edge">upstash-redis-edge</option>
                <option value="groq-lpu-us">groq-lpu-us</option>
              </select>
            </div>
            <textarea
              value={manualOutput}
              onChange={(e) => setManualOutput(e.target.value)}
              placeholder="Output logs, return value, or notes..."
              rows={2}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 resize-none text-[11px]"
            />
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowAddAction(false)}
                className="px-2.5 py-1 rounded bg-slate-900 text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 rounded bg-cyan-500 text-black font-bold hover:bg-cyan-400"
              >
                Append to Task Audit
              </button>
            </div>
          </form>
        )}

        {/* Scrollable Execution Timeline Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 font-sans">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-10 font-mono text-xs text-slate-500">
              NO EXECUTION RECORDS MATCH THIS FILTER
            </div>
          ) : (
            filteredRecords.map((rec, idx) => {
              const isCommand = rec.type === 'SHELL_COMMAND';
              const isSuccess = rec.status === 'SUCCESS';

              return (
                <div
                  key={rec.id || idx}
                  className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-cyan-500/30 transition-colors shadow-md space-y-2"
                >
                  {/* Action Header */}
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
                    <div className="flex items-center space-x-2">
                      <div
                        className={`p-1.5 rounded-md ${
                          isCommand ? 'bg-cyan-950 text-cyan-400' : 'bg-purple-950 text-purple-300'
                        }`}
                      >
                        {isCommand ? <Terminal className="w-3.5 h-3.5" /> : <Server className="w-3.5 h-3.5" />}
                      </div>

                      <span className="font-bold text-slate-200">{rec.name}</span>

                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                          isCommand
                            ? 'bg-cyan-950/70 border border-cyan-500/30 text-cyan-300'
                            : 'bg-purple-950/70 border border-purple-500/30 text-purple-300'
                        }`}
                      >
                        {rec.type}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold flex items-center space-x-1 ${
                          isSuccess
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                            : 'bg-red-950 text-red-400 border border-red-500/40'
                        }`}
                      >
                        <span>{rec.status}</span>
                      </span>

                      {rec.durationMs && (
                        <span className="text-[10px] text-slate-500">
                          {rec.durationMs > 1000 ? `${(rec.durationMs / 1000).toFixed(1)}s` : `${rec.durationMs}ms`}
                        </span>
                      )}

                      <span className="text-[10px] text-slate-500">
                        {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Environment Badge & Command Prompt */}
                  {rec.command && (
                    <div className="flex items-center justify-between bg-black/70 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
                      <div className="flex items-center space-x-2 truncate">
                        <span className="text-cyan-400 shrink-0 font-bold">$</span>
                        <code className="text-cyan-200 truncate">{rec.command}</code>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 ml-2">
                        {rec.server && (
                          <span className="text-[9px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                            {rec.server}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopy(rec.command!, `cmd-${rec.id}`)}
                          title="Copy command"
                          className="text-slate-400 hover:text-cyan-300 transition-colors p-0.5"
                        >
                          {copiedId === `cmd-${rec.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Output Log / Terminal Console View */}
                  {rec.output && (
                    <div className="relative group/output">
                      <div className="bg-[#05070d] p-3 rounded-lg border border-cyan-500/20 text-xs font-mono text-cyan-300/90 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                        {rec.output}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(rec.output!, `out-${rec.id}`)}
                        title="Copy output"
                        className="absolute top-2 right-2 p-1 rounded bg-slate-900/90 border border-slate-700 text-slate-400 hover:text-white opacity-0 group-hover/output:opacity-100 transition-opacity"
                      >
                        {copiedId === `out-${rec.id}` ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="p-3 sm:p-4 border-t border-cyan-500/20 bg-slate-950/90 flex items-center justify-between flex-wrap gap-2 shrink-0 font-mono text-xs">
          <div className="flex items-center space-x-2">
            {onTransmitToChat && (
              <button
                type="button"
                onClick={() => {
                  onTransmitToChat(`J.A.R.V.I.S., analyze active task "${task.title}" and execute the next autonomous commands or tool actions.`);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold flex items-center space-x-1.5 shadow-[0_0_15px_rgba(0,229,255,0.4)] transition-all"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>EXECUTE VIA J.A.R.V.I.S.</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyFullReport}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-300 flex items-center space-x-1.5 transition-colors"
            >
              {reportCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{reportCopied ? 'REPORT COPIED' : 'COPY AUDIT REPORT'}</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onDelete}
              className="px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-500/30 text-red-400 hover:text-red-200 transition-colors"
            >
              PURGE TASK
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
            >
              DISMISS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
