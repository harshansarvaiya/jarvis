import { NextRequest, NextResponse } from 'next/server';
import { mcpClient, MCPServerId } from '@/lib/jarvis/mcp-client';
import { verifyHmacSession } from '@/lib/jarvis/security/auth-gate';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = verifyHmacSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { server, action, params } = body;

    if (!server || !action) {
      return NextResponse.json(
        { error: 'Parameters "server" and "action" are required.' },
        { status: 400 }
      );
    }

    const validServers: MCPServerId[] = ['github', 'filesystem', 'cloud', 'network', 'database'];
    if (!validServers.includes(server)) {
      return NextResponse.json(
        { error: `Invalid server "${server}". Must be one of: ${validServers.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await mcpClient.dispatch({
      server,
      action,
      params: params || {},
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /api/mcp] Execution error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
