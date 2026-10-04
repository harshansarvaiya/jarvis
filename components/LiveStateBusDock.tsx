'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Zap,
  Shield,
  Radio,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';

export interface StateBusEventPayload {
  id: string;
  type: string;
  source: 'friday' | 'jarvis' | 'user' | 'system' | 'sentinel';
  channel?: string;
  title: string;
  detail?: string;
  payload?: any;
  timestamp: string;
}

interface LiveStateBusDockProps {
  onTaskUpdated?: () => void;
  onMemoryUpdated?: () => void;
  onChatMessage?: () => void;
  onRadarAlert?: (payload: any) => void;
  authFetch?: (url: string, options?: RequestInit) => Promise<Response>;
}

export const LiveStateBusDock: React.FC<LiveStateBusDockProps> = ({
  onTaskUpdated,
  onMemoryUpdated,
  onChatMessage,
  onRadarAlert,
  authFetch,
}) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [events, setEvents] = useState<StateBusEventPayload[]>([]);
  const [latestEvent, setLatestEvent] = useState<StateBusEventPayload | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [hasPulse, setHasPulse] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastEventTimestampRef = useRef<string>(new Date(Date.now() - 60000).toISOString());

  // Trigger brief visual pulse on incoming event
  const triggerPulse = (ev: StateBusEventPayload) => {
    setLatestEvent(ev);
    setHasPulse(true);
    setTimeout(() => setHasPulse(false), 1200);

    // Reactive callback triggers
    if (ev.type === 'state:task_updated') {
      onTaskUpdated?.();
    } else if (ev.type === 'state:memory_updated') {
      onMemoryUpdated?.();
    } else if (ev.type === 'state:chat_message') {
      onChatMessage?.();
    } else if (ev.type === 'system:radar') {
      onRadarAlert?.(ev.payload);
    }
  };

  useEffect(() => {
    let isActive = true;
    let fallbackPollTimer: NodeJS.Timeout | null = null;

    const doFetch = authFetch || fetch;

    // 1. Fallback Incremental Polling Mode
    const pollEvents = async () => {
      try {
        const url = `/api/jarvis/events?since=${encodeURIComponent(lastEventTimestampRef.current)}&limit=20`;
        const res = await doFetch(url);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.events) && data.events.length > 0) {
            setIsConnected(true);
            const newEvents: StateBusEventPayload[] = data.events;
            // Update last timestamp
            lastEventTimestampRef.current = newEvents[0]?.timestamp || new Date().toISOString();

            setEvents((prev) => {
              const ids = new Set(prev.map((e) => e.id));
              const fresh = newEvents.filter((e) => !ids.has(e.id));
              if (fresh.length > 0) {
                triggerPulse(fresh[0]);
                return [...fresh, ...prev].slice(0, 50);
              }
              return prev;
            });
          }
        }
      } catch (err) {
        setIsConnected(false);
      }
    };

    // 2. High-Performance Stream via Fetch & ReadableStream (SSE)
    const connectStream = async () => {
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const res = await doFetch('/api/jarvis/events?stream=true', {
          signal: abortController.signal,
          headers: { Accept: 'text/event-stream' },
        });

        if (!res.ok || !res.body) {
          throw new Error('SSE stream unavailable, engaging fallback');
        }

        setIsConnected(true);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (isActive) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const chunk of lines) {
            const trimmed = chunk.trim();
            if (!trimmed || trimmed.startsWith(':')) continue; // skip heartbeats

            const dataMatch = trimmed.match(/^data:\s*(.*)$/m);
            if (dataMatch && dataMatch[1]) {
              try {
                const parsed = JSON.parse(dataMatch[1]);
                if (parsed && parsed.id && parsed.type) {
                  lastEventTimestampRef.current = parsed.timestamp;
                  setEvents((prev) => {
                    if (prev.some((e) => e.id === parsed.id)) return prev;
                    return [parsed, ...prev].slice(0, 50);
                  });
                  triggerPulse(parsed);
                }
              } catch {}
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError' && isActive) {
          setIsConnected(false);
          // Fall back to incremental polling every 4 seconds
          if (!fallbackPollTimer) {
            fallbackPollTimer = setInterval(pollEvents, 4000);
          }
        }
      }
    };

    // Start initial connection
    connectStream();
    pollEvents();

    return () => {
      isActive = false;
      abortControllerRef.current?.abort();
      if (fallbackPollTimer) clearInterval(fallbackPollTimer);
    };
  }, []);

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'friday':
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono tracking-wider bg-cyan-950/80 text-cyan-400 border border-cyan-500/30">
            <Shield className="w-2.5 h-2.5 text-cyan-400" /> FRIDAY
          </span>
        );
      case 'jarvis':
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono tracking-wider bg-amber-950/80 text-amber-400 border border-amber-500/30">
            <Zap className="w-2.5 h-2.5 text-amber-400" /> JARVIS
          </span>
        );
      case 'sentinel':
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono tracking-wider bg-rose-950/80 text-rose-400 border border-rose-500/30">
            <Activity className="w-2.5 h-2.5 text-rose-400" /> SENTINEL
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono tracking-wider bg-blue-950/80 text-blue-400 border border-blue-500/30">
            <Layers className="w-2.5 h-2.5 text-blue-400" /> SYSTEM
          </span>
        );
    }
  };

  return (
    <div className="w-full transition-all duration-300">
      {/* Sleek Tactical HUD Pill */}
      <div
        className={`relative flex items-center justify-between px-3 py-1.5 bg-slate-950/70 border backdrop-blur-md rounded-lg transition-all cursor-pointer ${
          hasPulse
            ? 'border-cyan-400/80 shadow-[0_0_15px_rgba(6,182,212,0.35)]'
            : isConnected
            ? 'border-cyan-900/40 hover:border-cyan-700/60'
            : 'border-slate-800'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {/* Status Dot */}
          <div className="relative flex items-center justify-center">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-cyan-400' : 'bg-amber-500'
              }`}
            />
            {isConnected && (
              <div
                className={`absolute w-3.5 h-3.5 rounded-full bg-cyan-400/30 animate-ping`}
              />
            )}
          </div>

          {/* Label */}
          <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-cyan-300/80 whitespace-nowrap">
            STATE BUS
          </span>

          <span className="text-slate-600 text-xs">|</span>

          {/* Marquee or Latest Event */}
          {latestEvent ? (
            <div className="flex items-center gap-1.5 truncate text-xs">
              {getSourceBadge(latestEvent.source)}
              <span className="text-slate-200 font-mono truncate text-[11px]">
                {latestEvent.title}
              </span>
              {latestEvent.detail && (
                <span className="text-slate-400 truncate text-[10px] hidden md:inline">
                  — {latestEvent.detail}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[11px] font-mono text-slate-400 italic">
              Dual-citizen link synchronized. Monitoring autonomous actions...
            </span>
          )}
        </div>

        {/* Right Toggle */}
        <div className="flex items-center gap-2 pl-2 flex-shrink-0">
          <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
            {events.length} EVTS
          </span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>
      </div>

      {/* Expanded Live Telemetry Drawer */}
      {isExpanded && (
        <div className="mt-1.5 p-2.5 bg-slate-950/95 border border-cyan-900/40 rounded-lg backdrop-blur-xl shadow-2xl max-h-56 overflow-y-auto space-y-1.5 font-mono text-xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[10px] text-slate-400 tracking-wider uppercase font-semibold">
            <span>Real-time Dual-Citizen Telemetry Stream</span>
            <span className="text-cyan-400">
              {isConnected ? '● STREAM ONLINE' : '○ CONNECTING...'}
            </span>
          </div>

          {events.length === 0 ? (
            <div className="py-4 text-center text-slate-500 text-[11px] italic">
              No recent bus events recorded. Actions executed by Friday, Jarvis, or Sir will appear here live.
            </div>
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                className="flex items-start justify-between gap-2 p-1.5 rounded bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 transition-colors"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <div className="pt-0.5">{getSourceBadge(ev.source)}</div>
                  <div className="min-w-0">
                    <div className="text-slate-200 font-medium text-[11px] truncate">
                      {ev.title}
                    </div>
                    {ev.detail && (
                      <div className="text-slate-400 text-[10px] truncate mt-0.5">
                        {ev.detail}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 flex-shrink-0 pt-0.5">
                  {new Date(ev.timestamp).toLocaleTimeString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
