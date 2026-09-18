/**
 * J.A.R.V.I.S. Core Universal Storage Engine
 * Dual-mode persistence:
 *  - Primary (Cloud 24/7): Upstash Redis REST (Zero-dep, serverless-ready, Edge-compatible)
 *  - Secondary (Local Offline): Atomic Local File Storage (data/jarvis-state.json + data/jarvis-chats.json)
 * Directive 01 & 03 Enforced: Continuous cognitive persistence across all nodes.
 */

import fs from 'fs';
import path from 'path';
import { JarvisState } from './memory';

export interface ChatMessageRecord {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
  image?: string;
  toolCalls?: Array<{ name: string; args: any; result: any }>;
  timestamp: string;
  vocalSummary?: string;
  tacticalActions?: string[];
  motiveAnalysis?: string;
  internalThoughts?: string;
  telemetry?: any;
  // Shared Brain Attribution — which agent/channel produced this message
  source?: 'friday' | 'jarvis' | 'web' | 'system';
  channel?: 'antigravity' | 'telegram' | 'web-pwa' | 'api' | 'shortcut' | 'raycast';
}

export interface StorageProvider {
  name: 'upstash-redis' | 'local-disk';
  isCloud: boolean;
  execute(command: string, ...args: any[]): Promise<any>;
  getState(): Promise<JarvisState | null>;
  saveState(state: JarvisState): Promise<void>;
  getChatHistory(limit?: number): Promise<ChatMessageRecord[]>;
  saveChatHistory(messages: ChatMessageRecord[]): Promise<void>;
  appendChatMessage(message: ChatMessageRecord): Promise<void>;
  appendChatMessages(messages: ChatMessageRecord[]): Promise<void>;
  clearChatHistory(): Promise<void>;
}

function sanitizeChatMessageForStorage(m: ChatMessageRecord): ChatMessageRecord {
  return {
    ...m,
    image: undefined, // Never persist multi-megabyte base64 images in Redis chat history key
    content: m.content && m.content.length > 4000 ? m.content.slice(0, 4000) + '…' : m.content,
    toolCalls: m.toolCalls
      ? m.toolCalls.map((tc) => ({
          ...tc,
          result:
            typeof tc.result === 'object' && tc.result !== null
              ? {
                  stdout: typeof tc.result.stdout === 'string' ? tc.result.stdout.slice(0, 500) : undefined,
                  output: typeof tc.result.output === 'string' ? tc.result.output.slice(0, 500) : undefined,
                  success: tc.result.success,
                }
              : typeof tc.result === 'string'
              ? tc.result.slice(0, 500)
              : tc.result,
        }))
      : undefined,
  };
}

export function deduplicateChatHistory(messages: ChatMessageRecord[]): ChatMessageRecord[] {
  const result: ChatMessageRecord[] = [];
  const seenIds = new Set<string>();

  for (const msg of messages) {
    if (!msg || !msg.role || msg.content === undefined || msg.content === null) continue;
    const cleanMsg = sanitizeChatMessageForStorage(msg);

    // If ID already present, merge in place
    if (cleanMsg.id && seenIds.has(cleanMsg.id)) {
      const idx = result.findIndex((m) => m.id === cleanMsg.id);
      if (idx !== -1) {
        result[idx] = { ...result[idx], ...cleanMsg };
      }
      continue;
    }

    // Semantic content & timing deduplication across trailing turns
    const normContent = (cleanMsg.content || '').trim();
    const existingIndex = result.slice(-10).findIndex((existing) => {
      if (existing.role !== cleanMsg.role) return false;
      const existingNorm = (existing.content || '').trim();
      if (existingNorm !== normContent) return false;

      // If timestamps exist, check if within 45 seconds of each other
      if (existing.timestamp && cleanMsg.timestamp) {
        const timeDiff = Math.abs(new Date(cleanMsg.timestamp).getTime() - new Date(existing.timestamp).getTime());
        if (!isNaN(timeDiff) && timeDiff <= 45000) return true;
      } else {
        return true;
      }
      return false;
    });

    if (existingIndex !== -1) {
      const targetIdx = result.length - (result.slice(-10).length - existingIndex);
      if (targetIdx >= 0 && targetIdx < result.length) {
        result[targetIdx] = {
          ...result[targetIdx],
          ...cleanMsg,
          id: result[targetIdx].id || cleanMsg.id,
          timestamp: result[targetIdx].timestamp || cleanMsg.timestamp,
        };
      }
    } else {
      result.push(cleanMsg);
      if (cleanMsg.id) seenIds.add(cleanMsg.id);
    }
  }

  return result.slice(-50);
}

// ==========================================
// 1. Upstash Redis REST Provider (Cloud 24/7)
// ==========================================
class UpstashRedisProvider implements StorageProvider {
  name = 'upstash-redis' as const;
  isCloud = true;
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url.replace(/\/$/, '');
    this.token = token;
  }

  async execute(command: string, ...args: any[]): Promise<any> {
    const formattedArgs = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)));
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([command, ...formattedArgs]),
      cache: 'no-store',
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Upstash Redis error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.result;
  }

  async getState(): Promise<JarvisState | null> {
    try {
      const raw = await this.execute('get', 'jarvis:state');
      if (!raw) return null;
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (err) {
      console.error('[Storage:Upstash] Failed to get state:', err);
      return null;
    }
  }

  async saveState(state: JarvisState): Promise<void> {
    try {
      await this.execute('set', 'jarvis:state', JSON.stringify(state));
    } catch (err) {
      console.error('[Storage:Upstash] Failed to save state:', err);
    }
  }

  async getChatHistory(limit = 100): Promise<ChatMessageRecord[]> {
    try {
      const raw = await this.execute('get', 'jarvis:chat_history');
      if (!raw) return [];
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(-limit);
    } catch (err) {
      console.error('[Storage:Upstash] Failed to get chat history:', err);
      return [];
    }
  }



  async saveChatHistory(messages: ChatMessageRecord[]): Promise<void> {
    try {
      const sanitized = deduplicateChatHistory(messages);
      await this.execute('set', 'jarvis:chat_history', JSON.stringify(sanitized));
    } catch (err) {
      console.error('[Storage:Upstash] Failed to save chat history:', err);
    }
  }

  async appendChatMessage(message: ChatMessageRecord): Promise<void> {
    await this.appendChatMessages([message]);
  }

  async appendChatMessages(newMessages: ChatMessageRecord[]): Promise<void> {
    try {
      const current = await this.getChatHistory(50);
      const merged = deduplicateChatHistory([...current, ...newMessages]);
      await this.saveChatHistory(merged);
    } catch (err) {
      console.error('[Storage:Upstash] Failed to append chat messages:', err);
    }
  }

  async clearChatHistory(): Promise<void> {
    try {
      await this.execute('del', 'jarvis:chat_history');
    } catch (err) {
      console.error('[Storage:Upstash] Failed to clear chat history:', err);
    }
  }
}

// ==========================================
// 2. Local Disk Provider (Offline Fallback)
// ==========================================
class LocalDiskProvider implements StorageProvider {
  name = 'local-disk' as const;
  isCloud = false;
  private dataDir: string;
  private stateFile: string;
  private chatsFile: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.stateFile = path.join(this.dataDir, 'jarvis-state.json');
    this.chatsFile = path.join(this.dataDir, 'jarvis-chats.json');
    this.ensureDataDir();
  }

  private ensureDataDir() {
    if (!process.env.VERCEL && !fs.existsSync(this.dataDir)) {
      try {
        fs.mkdirSync(this.dataDir, { recursive: true });
      } catch {}
    }
  }

  private getFilePath(target: 'state' | 'chats'): string {
    const base = target === 'state' ? this.stateFile : this.chatsFile;
    if (process.env.VERCEL) {
      return path.join('/tmp', target === 'state' ? 'jarvis-state.json' : 'jarvis-chats.json');
    }
    return base;
  }

  async getState(): Promise<JarvisState | null> {
    try {
      const file = this.getFilePath('state');
      if (!fs.existsSync(file)) return null;
      const raw = fs.readFileSync(file, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('[Storage:Local] Failed to read state:', err);
      return null;
    }
  }

  async saveState(state: JarvisState): Promise<void> {
    try {
      this.ensureDataDir();
      const file = this.getFilePath('state');
      fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Storage:Local] Failed to save state:', err);
    }
  }

  async getChatHistory(limit = 60): Promise<ChatMessageRecord[]> {
    try {
      const file = this.getFilePath('chats');
      if (!fs.existsSync(file)) return [];
      const raw = fs.readFileSync(file, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(-limit);
    } catch (err) {
      return [];
    }
  }

  async saveChatHistory(messages: ChatMessageRecord[]): Promise<void> {
    try {
      this.ensureDataDir();
      const file = this.getFilePath('chats');
      const sanitized = deduplicateChatHistory(messages);
      fs.writeFileSync(file, JSON.stringify(sanitized, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Storage:Local] Failed to save chat history:', err);
    }
  }

  async appendChatMessage(message: ChatMessageRecord): Promise<void> {
    await this.appendChatMessages([message]);
  }

  async appendChatMessages(newMessages: ChatMessageRecord[]): Promise<void> {
    try {
      const current = await this.getChatHistory(50);
      const merged = deduplicateChatHistory([...current, ...newMessages]);
      await this.saveChatHistory(merged);
    } catch (err) {
      console.error('[Storage:Local] Failed to append chat messages:', err);
    }
  }

  async clearChatHistory(): Promise<void> {
    try {
      const file = this.getFilePath('chats');
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    } catch (err) {
      console.error('[Storage:Local] Failed to clear chat history:', err);
    }
  }

  async execute(command: string, ...args: any[]): Promise<any> {
    const cmd = command.toLowerCase();
    const key = String(args[0] || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const customFile = path.join(this.dataDir, `${key}.json`);

    try {
      this.ensureDataDir();
      if (cmd === 'get') {
        if (!fs.existsSync(customFile)) return null;
        const raw = fs.readFileSync(customFile, 'utf-8');
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      } else if (cmd === 'set') {
        const val = args[1];
        const content = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
        fs.writeFileSync(customFile, content, 'utf-8');
        return 'OK';
      } else if (cmd === 'del') {
        if (fs.existsSync(customFile)) {
          fs.unlinkSync(customFile);
        }
        return 1;
      }
    } catch (err) {
      console.error(`[Storage:Local] execute(${command}) failed:`, err);
    }
    return null;
  }
}

// ==========================================
// 3. Provider Singleton & Adaptive Dispatch
// ==========================================
let activeProvider: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (activeProvider) return activeProvider;

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    console.log('[J.A.R.V.I.S. Storage] Engaging Cloud 24/7 Upstash Redis Provider.');
    activeProvider = new UpstashRedisProvider(redisUrl, redisToken);
  } else {
    activeProvider = new LocalDiskProvider();
  }

  return activeProvider;
}

export const getUniversalStorage = getStorage;

/**
 * High-level unified asynchronous storage helpers
 */
export async function getUniversalState(): Promise<JarvisState | null> {
  return await getStorage().getState();
}

export async function saveUniversalState(state: JarvisState): Promise<void> {
  await getStorage().saveState(state);
}

export async function getUniversalChatHistory(limit = 100): Promise<ChatMessageRecord[]> {
  return await getStorage().getChatHistory(limit);
}

export async function appendUniversalChatMessage(msg: ChatMessageRecord): Promise<void> {
  await getStorage().appendChatMessage(msg);
}

export async function appendUniversalChatMessages(msgs: ChatMessageRecord[]): Promise<void> {
  await getStorage().appendChatMessages(msgs);
}

export async function clearUniversalChatHistory(): Promise<void> {
  await getStorage().clearChatHistory();
}

/**
 * Source-attributed write — every agent turn is tagged with who produced it.
 * Use this instead of appendUniversalChatMessage when agent identity matters.
 */
export async function appendAgentChatMessage(
  msg: Omit<ChatMessageRecord, 'source' | 'channel'>,
  source: ChatMessageRecord['source'],
  channel: ChatMessageRecord['channel']
): Promise<void> {
  await getStorage().appendChatMessage({ ...msg, source, channel });
}

/**
 * SHARED BRAIN — Cross-Channel Context Reader
 *
 * Returns the last N messages from the universal history that originated from
 * a *different* agent/channel than the caller, formatted as a compact prompt
 * block. This is how Friday knows what Jarvis said (and vice versa).
 *
 * @param callerSource - 'friday' | 'jarvis' | 'web' — the calling agent's identity
 * @param limit        - max messages to pull from the other channel (default: 8)
 */
export async function getCrossChannelContext(
  callerSource: ChatMessageRecord['source'],
  limit = 8
): Promise<string> {
  try {
    const all = await getStorage().getChatHistory(60);

    // Pull turns from other channels — exclude messages produced by the caller
    const crossTurns = all
      .filter((m) => m.source && m.source !== callerSource && m.role !== 'system')
      .slice(-limit);

    if (crossTurns.length === 0) return '';

    const lines = crossTurns.map((m) => {
      const who = m.source === 'friday'
        ? '🛡️ Friday (Antigravity)'
        : m.source === 'jarvis'
        ? '⚡ Jarvis (Telegram)'
        : m.source === 'web'
        ? '🌐 Web PWA'
        : `[${m.source}]`;
      const when = m.timestamp
        ? new Date(m.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : '';
      const roleLabel = m.role === 'user' ? 'Sir' : who;
      const snippet = m.content.length > 300 ? m.content.slice(0, 300) + '…' : m.content;
      return `[${when}] ${roleLabel}: ${snippet}`;
    });

    return `\n[SHARED BRAIN — CROSS-CHANNEL AWARENESS]:\nThe following are recent turns from another active agent channel. Use this to stay in sync with what Sir has been working on elsewhere. Do NOT repeat or summarise these back to Sir unless directly asked:\n${lines.join('\n')}\n`;
  } catch {
    return '';
  }
}
