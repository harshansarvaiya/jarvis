export interface GmailMessage {
  id: string;
  threadId: string;
  snippet?: string;
  subject?: string;
  from?: string;
  date?: string;
}

export class GmailAgentEngine {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
    this.redirectUri = process.env.GMAIL_REDIRECT_URI || 'https://developers.google.com/oauthplayground';
  }

  public async listMessages(accessToken: string, query: string = 'in:inbox', maxResults: number = 5): Promise<GmailMessage[]> {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Gmail API error: ${res.statusText}`);
    }

    const data = await res.json();
    const messages = data.messages || [];
    const detailedMessages: GmailMessage[] = [];

    for (const msg of messages) {
      if (!msg.id) continue;
      const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!detailRes.ok) continue;
      const detail = await detailRes.json();
      const headers = detail.payload?.headers || [];
      const subject = headers.find((h: any) => h.name === 'Subject')?.value;
      const from = headers.find((h: any) => h.name === 'From')?.value;
      const date = headers.find((h: any) => h.name === 'Date')?.value;

      detailedMessages.push({
        id: msg.id,
        threadId: msg.threadId || '',
        snippet: detail.snippet || '',
        subject,
        from,
        date,
      });
    }

    return detailedMessages;
  }
}

export const gmailAgent = new GmailAgentEngine();
