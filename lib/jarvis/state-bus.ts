/**
 * J.A.R.V.I.S. & F.R.I.D.A.Y. — Dual-Citizen Shared State Bus
 * 
 * Inspired by PhreshOS's unified state bus paradigm.
 * Enables real-time bidirectional synchronization between:
 *  - 🛡️ F.R.I.D.A.Y. (Antigravity Apex Mind & CLI)
 *  - ⚡ J.A.R.V.I.S. (Telegram & 24/7 Cloud Worker)
 *  - 🌐 Master Web PWA & Desktop Tactical HUD
 * 
 * When Friday executes a tactical directive or mutates state, this bus
 * pushes an atomic event to the HUD instantly (via SSE and Redis list stream).
 */

import { EventEmitter } from 'events';
import { getStorage } from './storage';

export type StateBusEventType =
  | 'agent:telemetry'     // Model thinking, tool call execution, engine latency
  | 'agent:action'        // Git commit, compiler verification, patch applied
  | 'agent:speech'        // Vocal summary transmission
  | 'state:task_updated'  // Task created, updated, completed, or deleted
  | 'state:memory_updated'// Cognitive memory formed or DNA evolved
  | 'state:chat_message'  // Unified chat history message appended
  | 'system:radar'        // Radar sentinel scan, opportunity, or security alert
  | 'system:heartbeat';   // Substrate liveness check

export interface StateBusEvent {
  id: string;
  type: StateBusEventType;
  source: 'friday' | 'jarvis' | 'user' | 'system' | 'sentinel';
  channel?: 'antigravity' | 'telegram' | 'web-pwa' | 'cloud-worker' | 'satellite' | 'rpc' | 'api' | 'shortcut' | 'raycast' | string;
  title: string;
  detail?: string;
  payload?: any;
  timestamp: string; // ISO 8601
}

const STATE_BUS_KEY = 'jarvis:state_events';
const MAX_EVENTS_IN_STREAM = 100;

// In-process event emitter for local listeners and long-polling / SSE streams
const busEmitter = new EventEmitter();
busEmitter.setMaxListeners(100);

/**
 * Publish an event onto the Dual-Citizen State Bus
 */
export async function publishStateEvent(
  eventInput: Omit<StateBusEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): Promise<StateBusEvent> {
  const fullEvent: StateBusEvent = {
    id: eventInput.id || `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: eventInput.timestamp || new Date().toISOString(),
    type: eventInput.type,
    source: eventInput.source,
    channel: eventInput.channel || 'antigravity',
    title: eventInput.title,
    detail: eventInput.detail,
    payload: eventInput.payload,
  };

  // 1. Dispatch immediately to in-memory listeners
  try {
    busEmitter.emit('state_event', fullEvent);
    busEmitter.emit(fullEvent.type, fullEvent);
  } catch (err) {
    console.error('[StateBus] Local emitter error:', err);
  }

  // 2. Persist to shared storage stream (Upstash Redis list with LocalDisk fallback)
  try {
    const storage = getStorage();
    const serialized = JSON.stringify(fullEvent);
    await storage.execute('lpush', STATE_BUS_KEY, serialized);
    await storage.execute('ltrim', STATE_BUS_KEY, 0, MAX_EVENTS_IN_STREAM - 1);
  } catch (err) {
    console.error('[StateBus] Persistence error:', err);
  }

  return fullEvent;
}

/**
 * Fetch recent events from the bus stream, optionally filtering after a given timestamp
 */
export async function getRecentStateEvents(limit = 30, sinceIso?: string): Promise<StateBusEvent[]> {
  try {
    const storage = getStorage();
    const rawList = await storage.execute('lrange', STATE_BUS_KEY, 0, Math.min(limit, MAX_EVENTS_IN_STREAM) - 1);

    if (!Array.isArray(rawList)) return [];

    const parsed: StateBusEvent[] = [];
    for (const item of rawList) {
      if (!item) continue;
      try {
        const obj = typeof item === 'object' ? item : JSON.parse(item);
        if (obj && obj.id && obj.type) {
          parsed.push(obj);
        }
      } catch {}
    }

    if (sinceIso) {
      const sinceTime = new Date(sinceIso).getTime();
      if (!isNaN(sinceTime)) {
        return parsed.filter((e) => new Date(e.timestamp).getTime() > sinceTime);
      }
    }

    return parsed;
  } catch (err) {
    console.error('[StateBus] Failed to retrieve events:', err);
    return [];
  }
}

/**
 * Subscribe to live events inside the current Node.js process
 */
export function onStateEvent(listener: (event: StateBusEvent) => void): () => void {
  busEmitter.on('state_event', listener);
  return () => {
    busEmitter.off('state_event', listener);
  };
}

/**
 * Clear event history if needed
 */
export async function clearStateEvents(): Promise<void> {
  try {
    const storage = getStorage();
    await storage.execute('del', STATE_BUS_KEY);
  } catch (err) {
    console.error('[StateBus] Failed to clear events:', err);
  }
}
