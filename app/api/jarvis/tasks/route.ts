import { NextRequest, NextResponse } from 'next/server';
import { getTasks, addTask, updateTask, deleteTask, recordTaskExecution } from '@/lib/jarvis/memory';
import { verifyHmacSession } from '@/lib/jarvis/security/auth-gate';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = verifyHmacSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }
  try {
    if (auth.role === 'guest') {
      const demoTasks = [
        {
          id: 'demo-task-1',
          title: 'Autonomous Bounty Hunter: Algora/Polar scan & PR dispatch',
          description: 'Tri-Vector Revenue Sentry scanning open-source bounties >= $50 and generating verification test harness in isolated sandbox.',
          priority: 'HIGH',
          status: 'IN_PROGRESS',
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          tags: ['bounty', 'autonomous', 'github'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'demo-task-2',
          title: 'Full-Duplex WebRTC Voice Uplink: Sub-200ms latency benchmark',
          description: 'AirPods hands-free driving mode with instant barge-in interruption and Telegram Mini App bridge.',
          priority: 'HIGH',
          status: 'COMPLETED',
          dueDate: new Date().toISOString(),
          tags: ['voice', 'webrtc', 'telephony'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'demo-task-3',
          title: 'Stage 5 Cloud Runner VM: Zero-thrashing resource sentry',
          description: 'Protect GCP e2-standard-2 runner VM memory and verify subagent health.',
          priority: 'MEDIUM',
          status: 'PENDING',
          tags: ['infra', 'gcp', 'guardian'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'demo-task-4',
          title: 'Omni-Sponge Second Brain: Multimodal paper & video ingestion',
          description: 'Download arXiv research papers and YouTube transcripts into TurboQuant memory.',
          priority: 'LOW',
          status: 'PENDING',
          tags: ['second-brain', 'turboquant'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      return NextResponse.json({ tasks: demoTasks, isDemoMode: true });
    }

    const tasks = getTasks();
    return NextResponse.json({ tasks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = verifyHmacSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { title, description, priority, dueDate, tags, executionAudit } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const task = addTask({
      title,
      description: description || '',
      priority: priority || 'MEDIUM',
      status: 'PENDING',
      dueDate: dueDate || undefined,
      tags: tags || ['general'],
      executionAudit: executionAudit || [],
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = verifyHmacSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { id, auditRecord, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    if (auditRecord) {
      const task = recordTaskExecution(id, auditRecord);
      if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }
      if (Object.keys(updates).length > 0) {
        updateTask(id, updates);
      }
      return NextResponse.json({ task });
    }

    const task = updateTask(id, updates);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = verifyHmacSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const success = deleteTask(id);
    if (!success) {
      return NextResponse.json({ error: 'Task not found or not deleted' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
