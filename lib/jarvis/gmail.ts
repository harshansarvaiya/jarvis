import { google } from 'googleapis';

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet?: string;
  subject?: string;
  from?: string;
  date?: string;
}

export class GmailAgentEngine {
  private oAuth2Client: any;

  constructor() {
    const clientId = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GMAIL_REDIRECT_URI || 'https://developers.google.com/oauthplayground';

    if (clientId && clientSecret) {
      this.oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    }
  }

  public setCredentials(tokens: { access_token?: string; refresh_token?: string }) {
    if (this.oAuth2Client) {
      this.oAuth2Client.setCredentials(tokens);
    }
  }

  public async listMessages(query: string = 'in:inbox', maxResults: number = 5): Promise<GmailMessage[]> {
    if (!this.oAuth2Client) {
      throw new Error('Gmail OAuth2 client is not initialized with client ID and secret.');
    }

    const gmail = google.gmail({ version: 'v1', auth: this.oAuth2Client });
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
    });

    const messages = res.data.messages || [];
    const detailedMessages: GmailMessage[] = [];

    for (const msg of messages) {
      if (!msg.id) continue;
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      });

      const headers = detail.data.payload?.headers || [];
      const subject = headers.find((h: any) => h.name === 'Subject')?.value;
      const from = headers.find((h: any) => h.name === 'From')?.value;
      const date = headers.find((h: any) => h.name === 'Date')?.value;

      detailedMessages.push({
        id: msg.id,
        threadId: msg.threadId || '',
        snippet: detail.data.snippet || '',
        subject,
        from,
        date,
      });
    }

    return detailedMessages;
  }

  public async sendDraftReply(threadId: string, recipient: string, subject: string, body: string) {
    if (!this.oAuth2Client) {
      throw new Error('Gmail OAuth2 client is not initialized.');
    }

    const gmail = google.gmail({ version: 'v1', auth: this.oAuth2Client });
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const messageParts = [
      `To: ${recipient}`,
      `Subject: ${utf8Subject}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      body,
    ];

    const message = messageParts.join('\n');
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
        threadId,
      },
    });

    return res.data;
  }
}

export const gmailAgent = new GmailAgentEngine();
