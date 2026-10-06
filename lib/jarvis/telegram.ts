/**
 * J.A.R.V.I.S. Mark II — Sovereign Telegram Bot Gateway Substrate
 * 
 * Implements direct HTTP Telegram Bot API long-polling, audio voice handling,
 * inline interactive callbacks, and proactive alert transmission without external npm dependencies.
 * 
 * Provides:
 * - 24/7 mobile uplink for Sir (Harshan Sarvaiya)
 * - Master PIN authentication sentry (Directive 01)
 * - Groq Whisper speech-to-text integration for instant voice memos
 * - Rich interactive inline action keyboards (Approve/Deploy/Tasks)
 * - Bi-directional synchronization with Universal Chat History (Upstash Redis)
 * - Proactive alert dispatch for scheduled task reminders and subagent events
 */

import { getUniversalStorage } from './storage';

export interface TelegramInlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
  web_app?: { url: string };
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

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
    photo?: Array<{
      file_id: string;
      file_unique_id: string;
      width: number;
      height: number;
      file_size?: number;
    }>;
    document?: {
      file_id: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
    };
    voice?: {
      file_id: string;
      file_unique_id: string;
      duration: number;
      mime_type?: string;
      file_size?: number;
    };
    audio?: {
      file_id: string;
      file_unique_id: string;
      duration: number;
      mime_type?: string;
      file_size?: number;
      file_name?: string;
    };
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    message?: {
      message_id: number;
      chat: {
        id: number;
        type: string;
      };
      text?: string;
    };
    data: string;
  };
}

/**
 * Safely transforms standard Markdown formatting into Telegram-compliant HTML entities.
 * Eliminates unescaped entity parse crashes and raw asterisks.
 */
export function formatMarkdownForTelegramHtml(text: string): string {
  if (!text) return '';

  // 1. Preserve code blocks and inline code by replacing with unique non-character tokens
  const codeBlocks: string[] = [];
  let processed = text.replace(/```(?:[a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g, (_, code) => {
    const placeholder = `\u0000CB${codeBlocks.length}\u0000`;
    codeBlocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`);
    return placeholder;
  });

  const inlineCodes: string[] = [];
  processed = processed.replace(/`([^`]+)`/g, (_, code) => {
    const placeholder = `\u0000IC${inlineCodes.length}\u0000`;
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return placeholder;
  });

  // 2. Escape HTML special characters in the rest of the text
  processed = escapeHtml(processed);

  // 3. Convert Markdown syntax
  // Bold: **text**
  processed = processed.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

  // Single asterisk bold: *text* (when bounded)
  processed = processed.replace(/(^|[\s(])\*([^*]+)\*(?=[)\s.,;!?]|$)/g, '$1<b>$2</b>');

  // Italic: _text_ (when bounded by whitespace/punctuation to preserve SNAKE_CASE variables)
  processed = processed.replace(/(^|[\s(])_([^_]+)_(?=[)\s.,;!?]|$)/g, '$1<i>$2</i>');

  // Markdown links: [label](url)
  processed = processed.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  // 4. Restore code blocks & inline code
  processed = processed.replace(/\u0000CB(\d+)\u0000/g, (_, idx) => codeBlocks[Number(idx)] || '');
  processed = processed.replace(/\u0000IC(\d+)\u0000/g, (_, idx) => inlineCodes[Number(idx)] || '');

  return processed;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
      url.searchParams.set('allowed_updates', JSON.stringify(['message', 'callback_query']));

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
   * Fetches file path from Telegram Bot API for a fileId
   */
  public async getFilePath(fileId: string): Promise<string | null> {
    if (!this.isConfigured()) return null;
    try {
      const res = await fetch(`${this.baseUrl}/getFile?file_id=${encodeURIComponent(fileId)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.result?.file_path || null;
    } catch {
      return null;
    }
  }

  /**
   * Downloads raw file buffer with detected mime type
   */
  public async downloadFileBuffer(
    fileId: string
  ): Promise<{ buffer: Buffer; filePath: string; mimeType: string } | null> {
    if (!this.isConfigured()) return null;
    try {
      const filePath = await this.getFilePath(fileId);
      if (!filePath) return null;

      const fileUrl = `https://api.telegram.org/file/bot${this.token}/${filePath}`;
      const res = await fetch(fileUrl);
      if (!res.ok) return null;

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      let mimeType = 'application/octet-stream';
      if (filePath.endsWith('.oga') || filePath.endsWith('.ogg')) mimeType = 'audio/ogg';
      else if (filePath.endsWith('.mp3')) mimeType = 'audio/mpeg';
      else if (filePath.endsWith('.m4a')) mimeType = 'audio/mp4';
      else if (filePath.endsWith('.wav')) mimeType = 'audio/wav';
      else if (filePath.endsWith('.png')) mimeType = 'image/png';
      else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) mimeType = 'image/jpeg';
      else if (filePath.endsWith('.webp')) mimeType = 'image/webp';

      return { buffer, filePath, mimeType };
    } catch (err: any) {
      console.warn('[Telegram] Failed to download file buffer:', err?.message);
      return null;
    }
  }

  /**
   * Downloads a file from Telegram and converts it to a base64 Data URI
   */
  public async downloadFileAsBase64(fileId: string, defaultMime = 'image/jpeg'): Promise<string | null> {
    const downloaded = await this.downloadFileBuffer(fileId);
    if (!downloaded) return null;

    const mime = downloaded.mimeType !== 'application/octet-stream' ? downloaded.mimeType : defaultMime;
    return `data:${mime};base64,${downloaded.buffer.toString('base64')}`;
  }

  /**
   * Sends a message to a Telegram chat with automatic chunking (>4096 chars),
   * optional inline action keyboards, and seamless conversion of Markdown to Telegram HTML.
   */
  public async sendMessage(
    chatId: number | string,
    text: string,
    options?: {
      parseMode?: 'Markdown' | 'HTML';
      replyToMessageId?: number;
      replyMarkup?: TelegramInlineKeyboardMarkup;
      messageThreadId?: number;
      message_thread_id?: number;
    }
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
    for (let i = 0; i < chunks.length; i++) {
      const isLastChunk = i === chunks.length - 1;
      const rawChunk = chunks[i];

      // Convert Markdown to clean Telegram HTML to eliminate raw asterisks and parsing crashes
      const shouldConvertToHtml = options?.parseMode === 'Markdown' || !options?.parseMode;
      const formattedText = shouldConvertToHtml ? formatMarkdownForTelegramHtml(rawChunk) : rawChunk;

      const payload: any = {
        chat_id: chatId,
        text: formattedText,
        parse_mode: 'HTML',
      };

      if (options?.replyToMessageId && i === 0) {
        payload.reply_to_message_id = options.replyToMessageId;
      }
      if (options?.messageThreadId || options?.message_thread_id) {
        payload.message_thread_id = options.messageThreadId || options.message_thread_id;
      }
      // Attach inline keyboard to the last message chunk only
      if (isLastChunk && options?.replyMarkup) {
        payload.reply_markup = options.replyMarkup;
      }

      try {
        const res = await fetch(`${this.baseUrl}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          // If HTML syntax fails, strip tags and fallback to clean plain text
          payload.text = rawChunk.replace(/<[^>]+>/g, '').replace(/[*_`]/g, '');
          delete payload.parse_mode;
          const retryRes = await fetch(`${this.baseUrl}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!retryRes.ok) success = false;
        }
      } catch (err) {
        console.error('[Telegram] Failed to send message:', err);
        success = false;
      }
    }

    return success;
  }

  /**
   * Creates a topic/room in a Telegram supergroup with topics enabled
   */
  public async createForumTopic(
    chatId: number | string,
    name: string,
    iconColor?: number
  ): Promise<{ message_thread_id: number; name: string } | null> {
    if (!this.isConfigured()) return null;
    try {
      const res = await fetch(`${this.baseUrl}/createForumTopic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          name,
          icon_color: iconColor,
        }),
      });
      const data = await res.json();
      if (data.ok && data.result) {
        return {
          message_thread_id: data.result.message_thread_id,
          name: data.result.name,
        };
      }
      console.warn(`[Telegram] createForumTopic failed:`, data.description);
      return null;
    } catch (err: any) {
      console.warn(`[Telegram] createForumTopic error:`, err?.message);
      return null;
    }
  }

  /**
   * Sends a native Telegram voice memo (.wav/.ogg audio buffer)
   */
  public async sendVoice(
    chatId: number | string,
    voiceBuffer: Buffer,
    options?: {
      caption?: string;
      replyToMessageId?: number;
      duration?: number;
    }
  ): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const formData = new FormData();
      formData.append('chat_id', String(chatId));
      formData.append('voice', new Blob([new Uint8Array(voiceBuffer)], { type: 'audio/mpeg' }), 'voice.mp3');
      if (options?.caption) {
        formData.append('caption', options.caption.slice(0, 1024));
      }
      if (options?.replyToMessageId) {
        formData.append('reply_to_message_id', String(options.replyToMessageId));
      }
      if (options?.duration) {
        formData.append('duration', String(options.duration));
      }

      const res = await fetch(`${this.baseUrl}/sendVoice`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[Telegram] sendVoice returned HTTP ${res.status}:`, errText);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[Telegram] Failed to send voice memo:', err);
      return false;
    }
  }

  /**
   * Sends a photo / screenshot image buffer directly to Telegram
   */
  public async sendPhoto(
    chatId: number | string,
    photoBuffer: Buffer,
    options?: {
      caption?: string;
      parseMode?: 'Markdown' | 'HTML';
      replyToMessageId?: number;
    }
  ): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const formData = new FormData();
      formData.append('chat_id', String(chatId));
      formData.append('photo', new Blob([new Uint8Array(photoBuffer)], { type: 'image/png' }), 'screenshot.png');
      if (options?.caption) {
        formData.append('caption', options.caption.slice(0, 1024));
        if (options.parseMode) formData.append('parse_mode', options.parseMode);
      }
      if (options?.replyToMessageId) {
        formData.append('reply_to_message_id', String(options.replyToMessageId));
      }

      const res = await fetch(`${this.baseUrl}/sendPhoto`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[Telegram] sendPhoto returned HTTP ${res.status}:`, errText);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[Telegram] Failed to send photo:', err);
      return false;
    }
  }

  /**
   * Responds to an inline callback query (e.g., button press acknowledgment)
   */
  public async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
    showAlert = false
  ): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const res = await fetch(`${this.baseUrl}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text,
          show_alert: showAlert,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Edits the text of an existing message on Telegram
   */
  public async editMessageText(
    chatId: number | string,
    messageId: number,
    text: string,
    options?: {
      parseMode?: 'Markdown' | 'HTML';
      replyMarkup?: TelegramInlineKeyboardMarkup;
    }
  ): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const res = await fetch(`${this.baseUrl}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: options?.parseMode || 'Markdown',
          reply_markup: options?.replyMarkup || { inline_keyboard: [] },
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Edits inline keyboard on an existing message
   */
  public async editMessageReplyMarkup(
    chatId: number | string,
    messageId: number,
    replyMarkup?: TelegramInlineKeyboardMarkup
  ): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const res = await fetch(`${this.baseUrl}/editMessageReplyMarkup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          reply_markup: replyMarkup || { inline_keyboard: [] },
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Retrieves the authorized Telegram Chat ID from Upstash Redis or env
   */
  public async getAuthorizedChatId(): Promise<string | null> {
    const envId = process.env.TELEGRAM_AUTHORIZED_CHAT_ID || process.env.TELEGRAM_ALLOWED_USER_ID;
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

  /**
   * Configures the native bottom-left menu button in Telegram chat to launch the Mini App
   */
  public async setChatMenuButton(chatId: number | string, webAppUrl: string, text = '📞 Live Uplink'): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const res = await fetch(`${this.baseUrl}/setChatMenuButton`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          menu_button: {
            type: 'web_app',
            text,
            web_app: { url: webAppUrl },
          },
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Registers bot commands with Telegram autocomplete menu
   */
  public async setMyCommands(commands: Array<{ command: string; description: string }>): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const res = await fetch(`${this.baseUrl}/setMyCommands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commands }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Dispatches an autonomous cron alert directly to its dedicated topic room,
   * falling back to Sir's private 1-on-1 chat if topics are not yet configured.
   */
  public async dispatchCronAlert(
    category: 'BRIEFINGS' | 'MARKETS' | 'AINEWS' | 'MONETIZATION' | 'DEFENSE' | 'GENERAL',
    text: string,
    options?: {
      parseMode?: 'Markdown' | 'HTML';
      replyMarkup?: TelegramInlineKeyboardMarkup;
    }
  ): Promise<boolean> {
    const topicConfig = getTelegramTopicConfig();
    if (topicConfig && topicConfig.supergroupId && topicConfig.topics?.[category]) {
      const threadId = topicConfig.topics[category];
      const sent = await this.sendMessage(topicConfig.supergroupId, text, {
        ...options,
        messageThreadId: threadId,
      });
      if (sent) return true;
    }

    // Fallback to Sir's private authorized DM chat
    const authChatId = (await this.getAuthorizedChatId()) || '864360540';
    return this.sendMessage(authChatId, text, options);
  }
}

export type CronCategory = 'BRIEFINGS' | 'MARKETS' | 'AINEWS' | 'MONETIZATION' | 'DEFENSE' | 'GENERAL';

export interface TelegramTopicConfig {
  supergroupId: number | string;
  topics: Record<string, number>;
  configuredAt: string;
}

export function getTelegramTopicConfig(): TelegramTopicConfig | null {
  try {
    const fs = require('fs');
    const path = require('path');
    const topicsFilePath = path.join(process.cwd(), 'data', 'telegram-topics.json');
    if (fs.existsSync(topicsFilePath)) {
      return JSON.parse(fs.readFileSync(topicsFilePath, 'utf-8'));
    }
  } catch {}
  return null;
}

export const telegramGateway = new TelegramGateway();
