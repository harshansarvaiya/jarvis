/**
 * J.A.R.V.I.S. Mark II — Sovereign Telegram Bot Gateway Substrate
 * 
 * Implements direct HTTP Telegram Bot API long-polling and transmission
 * without external npm dependencies.
 * 
 * Provides:
 * - 24/7 mobile uplink for Sir (Harshan Sarvaiya)
 * - Master PIN authentication sentry
 * - Bi-directional synchronization with Universal Chat History (Upstash Redis)
 * - Proactive alert dispatch for scheduled task reminders and subagent events
 */

import { getUniversalStorage } from './storage';

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      first_name?: string;
      username?: string;
      type: string;
    };
    date: number;
    text?: string;
    caption?: string;
  };
}

export class TelegramGateway {
  private token: string;
  private baseUrl: string;

  constructor(token?: string) {
    this.token = token || process.env.TELEGRAM_BOT_TOKEN || '';
    this.baseUrl = `https://api.telegram.org/bot${this.token}`;
  }

  public isConfigured(): boolean {
    return Boolean(this.token && this.token.length > 10);
  }

  /**
   * Retrieves long-polling updates from Telegram Bot API
   */
  public async getUpdates(offset?: number, timeout = 30): Promise<TelegramUpdate[]> {
    if (!this.isConfigured()) return [];

    try {
      const url = new URL(`${this.baseUrl}/getUpdates`);
      if (offset !== undefined) url.searchParams.set('offset', String(offset));
      url.searchParams.set('timeout', String(timeout));
      url.searchParams.set('allowed_updates', JSON.stringify(['message']));

      const res = await fetch(url.toString(), {
        method: 'GET',
        signal: AbortSignal.timeout((timeout + 10) * 1000),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[Telegram] getUpdates returned HTTP ${res.status}:`, errText);
        return [];
      }

      const data = await res.json();
      return data.result || [];
    } catch (err: any) {
      if (err.name !== 'TimeoutError') {
        console.warn('[Telegram] getUpdates network error:', err.message);
      }
      return [];
    }
  }

  /**
   * Sends typing status to indicate J.A.R.V.I.S. is processing/reasoning
   */
  public async sendTypingAction(chatId: number | string): Promise<void> {
    if (!this.isConfigured()) return;
    try {
      await fetch(`${this.baseUrl}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          action: 'typing',
        }),
      });
    } catch {}
  }

  /**
   * Sends a message to a Telegram chat with automatic chunking (>4096 chars)
   * and fallback to plain text if Markdown parsing fails.
   */
  public async sendMessage(
    chatId: number | string,
    text: string,
    options?: { parseMode?: 'Markdown' | 'HTML'; replyToMessageId?: number }
  ): Promise<boolean> {
    if (!this.isConfigured()) return false;

    // Telegram hard limits messages to 4096 characters
    const MAX_LEN = 4000;
    const chunks: string[] = [];

    if (text.length <= MAX_LEN) {
      chunks.push(text);
    } else {
      let remaining = text;
      while (remaining.length > 0) {
        if (remaining.length <= MAX_LEN) {
          chunks.push(remaining);
          break;
        }
        let splitIdx = remaining.lastIndexOf('\n\n', MAX_LEN);
        if (splitIdx === -1) splitIdx = remaining.lastIndexOf('\n', MAX_LEN);
        if (splitIdx === -1) splitIdx = remaining.lastIndexOf(' ', MAX_LEN);
        if (splitIdx === -1) splitIdx = MAX_LEN;

        chunks.push(remaining.substring(0, splitIdx).trim());
        remaining = remaining.substring(splitIdx).trim();
      }
    }

    let success = true;
    for (const chunk of chunks) {
      const payload: any = {
        chat_id: chatId,
        text: chunk,
      };

      if (options?.parseMode) {
        payload.parse_mode = options.parseMode;
      }
      if (options?.replyToMessageId) {
        payload.reply_to_message_id = options.replyToMessageId;
      }

      try {
        const res = await fetch(`${this.baseUrl}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          // If markdown syntax failed, fallback to raw plain text
          if (options?.parseMode) {
            delete payload.parse_mode;
            const retryRes = await fetch(`${this.baseUrl}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            if (!retryRes.ok) success = false;
          } else {
            success = false;
          }
        }
      } catch (err) {
        console.error('[Telegram] Failed to send message:', err);
        success = false;
      }
    }

    return success;
  }

  /**
   * Retrieves the authorized Telegram Chat ID from Upstash Redis or env
   */
  public async getAuthorizedChatId(): Promise<string | null> {
    const envId = process.env.TELEGRAM_AUTHORIZED_CHAT_ID;
    if (envId) return envId;

    try {
      const storage = getUniversalStorage();
      const val = await storage.execute('get', 'jarvis:telegram:authorized_chat_id');
      return val ? String(val) : null;
    } catch {
      return null;
    }
  }

  /**
   * Authorizes a chat ID as Sir's verified sovereign channel
   */
  public async setAuthorizedChatId(chatId: number | string): Promise<void> {
    try {
      const storage = getUniversalStorage();
      await storage.execute('set', 'jarvis:telegram:authorized_chat_id', String(chatId));
      console.log(`[Telegram] Sovereign Chat ID locked in: ${chatId}`);
    } catch (err) {
      console.error('[Telegram] Failed to save authorized chat ID:', err);
    }
  }
}

export const telegramGateway = new TelegramGateway();
