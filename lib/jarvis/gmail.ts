import * as tls from 'tls';
import * as fs from 'fs';
import { GoogleAuth } from 'google-auth-library';

export interface EmailSendOptions {
  to: string;
  subject: string;
  body: string;
  from?: string;
  cc?: string;
  bcc?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  transport: 'gmail_smtp' | 'gmail_rest_api' | 'resend' | 'none';
  error?: string;
  latencyMs: number;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet?: string;
  subject?: string;
  from?: string;
  date?: string;
}

/**
 * Creates RFC 2822 base64url encoded MIME message string.
 */
export function createRawEmail(options: EmailSendOptions): string {
  const { to, subject, body, from, cc, bcc } = options;
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const messageParts = [
    from ? `From: ${from}` : '',
    `To: ${to}`,
    cc ? `Cc: ${cc}` : '',
    bcc ? `Bcc: ${bcc}` : '',
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${utf8Subject}`,
    '',
    body,
  ].filter(Boolean);

  const message = messageParts.join('\r\n');
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Lightweight, native TLS SMTPS client for direct Gmail sending.
 * Requires Gmail App Password (myaccount.google.com/apppasswords).
 */
export async function sendEmailViaSmtp(options: EmailSendOptions): Promise<EmailSendResult> {
  const startTime = Date.now();
  const user = process.env.GMAIL_USER || process.env.SMTP_USER || 'harshans279@gmail.com';
  const pass = (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || process.env.GMAIL_PASS || '').replace(/\s+/g, '');
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);

  if (!pass) {
    return {
      success: false,
      transport: 'gmail_smtp',
      error: 'Gmail App Password not configured. Set GMAIL_APP_PASSWORD in .env.local (generated at myaccount.google.com/apppasswords).',
      latencyMs: Date.now() - startTime,
    };
  }

  return new Promise((resolve) => {
    try {
      const socket = tls.connect({ host, port, minVersion: 'TLSv1.2' }, () => {
        let step = 0;
        let buffer = '';

        const sendCmd = (cmd: string) => {
          socket.write(cmd + '\r\n');
        };

        socket.on('data', (data) => {
          buffer += data.toString();
          const lines = buffer.split('\r\n');
          const lastLine = lines[lines.length - 2] || lines[lines.length - 1];

          if (!lastLine) return;

          // Process SMTP state machine
          if (step === 0 && lastLine.startsWith('220')) {
            step = 1;
            sendCmd(`EHLO jarvis.sovereign`);
          } else if (step === 1 && lastLine.startsWith('250')) {
            step = 2;
            sendCmd('AUTH LOGIN');
          } else if (step === 2 && lastLine.startsWith('334')) {
            step = 3;
            sendCmd(Buffer.from(user).toString('base64'));
          } else if (step === 3 && lastLine.startsWith('334')) {
            step = 4;
            sendCmd(Buffer.from(pass).toString('base64'));
          } else if (step === 4 && lastLine.startsWith('235')) {
            step = 5;
            sendCmd(`MAIL FROM:<${user}>`);
          } else if (step === 4 && (lastLine.startsWith('535') || lastLine.startsWith('534') || lastLine.startsWith('530'))) {
            socket.end();
            resolve({
              success: false,
              transport: 'gmail_smtp',
              error: `SMTP Authentication failed: ${lastLine}`,
              latencyMs: Date.now() - startTime,
            });
          } else if (step === 5 && lastLine.startsWith('250')) {
            step = 6;
            sendCmd(`RCPT TO:<${options.to}>`);
          } else if (step === 6 && lastLine.startsWith('250')) {
            step = 7;
            sendCmd('DATA');
          } else if (step === 7 && lastLine.startsWith('354')) {
            step = 8;
            const utf8Subject = `=?utf-8?B?${Buffer.from(options.subject).toString('base64')}?=`;
            const rfcMessage = [
              `From: "${options.from || 'Harshan Sarvaiya via J.A.R.V.I.S.'}" <${user}>`,
              `To: ${options.to}`,
              options.cc ? `Cc: ${options.cc}` : '',
              'Content-Type: text/plain; charset=utf-8',
              'MIME-Version: 1.0',
              `Subject: ${utf8Subject}`,
              `Date: ${new Date().toUTCString()}`,
              `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@jarvis.local>`,
              '',
              options.body,
              '.',
            ].filter(Boolean).join('\r\n');

            socket.write(rfcMessage + '\r\n');
          } else if (step === 8 && lastLine.startsWith('250')) {
            step = 9;
            sendCmd('QUIT');
            socket.end();
            resolve({
              success: true,
              messageId: lastLine,
              transport: 'gmail_smtp',
              latencyMs: Date.now() - startTime,
            });
          } else if (lastLine.startsWith('5') || lastLine.startsWith('4')) {
            socket.end();
            resolve({
              success: false,
              transport: 'gmail_smtp',
              error: `SMTP Error (${lastLine})`,
              latencyMs: Date.now() - startTime,
            });
          }
        });

        socket.on('error', (err) => {
          resolve({
            success: false,
            transport: 'gmail_smtp',
            error: err.message,
            latencyMs: Date.now() - startTime,
          });
        });

        socket.setTimeout(12000, () => {
          socket.destroy();
          resolve({
            success: false,
            transport: 'gmail_smtp',
            error: 'SMTP Connection timeout (12s)',
            latencyMs: Date.now() - startTime,
          });
        });
      });
    } catch (err: any) {
      resolve({
        success: false,
        transport: 'gmail_smtp',
        error: err.message || 'Failed to initialize TLS socket',
        latencyMs: Date.now() - startTime,
      });
    }
  });
}

/**
 * Universal Sovereign Email Dispatcher.
 * Automatically selects the optimal verified transport:
 * 1. Native Gmail SMTPS (if GMAIL_APP_PASSWORD is set)
 * 2. Gmail REST API v1 (if OAuth access token or refresh token is available)
 * 3. Resend API (if RESEND_API_KEY is available)
 */
export async function sendEmail(options: EmailSendOptions): Promise<EmailSendResult> {
  const startTime = Date.now();

  // Try SMTPS first if credentials present
  if (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS) {
    const smtpRes = await sendEmailViaSmtp(options);
    if (smtpRes.success) return smtpRes;
    console.warn('[Email Engine] SMTP attempt failed, trying alternative transports:', smtpRes.error);
  }

  // Try Gmail REST API if user access token available
  const userToken = process.env.GMAIL_ACCESS_TOKEN || process.env.GOOGLE_USER_ACCESS_TOKEN;
  if (userToken) {
    try {
      const raw = createRawEmail(options);
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
      });
      const data = await res.json();
      if (res.ok) {
        return {
          success: true,
          messageId: data.id,
          transport: 'gmail_rest_api',
          latencyMs: Date.now() - startTime,
        };
      }
    } catch {}
  }

  // Try Resend API if present
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: options.from || 'JARVIS <onboarding@resend.dev>',
          to: [options.to],
          subject: options.subject,
          text: options.body,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        return {
          success: true,
          messageId: data.id,
          transport: 'resend',
          latencyMs: Date.now() - startTime,
        };
      }
    } catch {}
  }

  return {
    success: false,
    transport: 'none',
    error: 'No email transport configured. To enable instant in-house sending, generate a 16-letter Gmail App Password at https://myaccount.google.com/apppasswords and provide it as GMAIL_APP_PASSWORD in .env.local.',
    latencyMs: Date.now() - startTime,
  };
}
