import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/jarvis/storage';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, message, priority = 'NORMAL', delaySeconds = 0, category = 'GENERAL', actionUrl = '/' } = body;

    if (!title && !message) {
      return NextResponse.json({ error: 'Title or message is required.' }, { status: 400 });
    }

    const notifId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date();
    const delaySec = Number(delaySeconds) || 0;
    const triggerAt = delaySec > 0 ? new Date(now.getTime() + delaySec * 1000).toISOString() : now.toISOString();

    const record = {
      id: notifId,
      title: title || 'J.A.R.V.I.S. Notification',
      message: message || 'Directive notification dispatched.',
      priority,
      category,
      delaySeconds: delaySec,
      triggerAt,
      status: delaySec > 0 ? 'PENDING' : 'SENT',
      actionUrl,
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Store in Upstash Redis notifications stream
    try {
      const storage = getStorage();
      if (storage.isCloud) {
        const raw = await (storage as any).execute('get', 'jarvis:notifications');
        const list = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
        list.unshift(record);
        await (storage as any).execute('set', 'jarvis:notifications', JSON.stringify(list.slice(0, 50)));
      }
    } catch (storeErr) {
      console.warn('[API:Notify] Storage error:', storeErr);
    }

    return NextResponse.json({ success: true, notification: record });
  } catch (error: any) {
    console.error('API /api/jarvis/notify error:', error);
    return NextResponse.json({ error: error.message || 'Notification dispatch failure' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const storage = getStorage();
    let notifications: any[] = [];
    if (storage.isCloud) {
      const raw = await (storage as any).execute('get', 'jarvis:notifications');
      notifications = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
    }
    return NextResponse.json({ notifications: Array.isArray(notifications) ? notifications : [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch notifications' }, { status: 500 });
  }
}
