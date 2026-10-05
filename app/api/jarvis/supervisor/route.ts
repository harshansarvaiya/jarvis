import { NextRequest, NextResponse } from 'next/server';
import { verifyHmacSession } from '@/lib/jarvis/security/auth-gate';
import {
  getSupervisorDAGs,
  getPendingHITLTasks,
  decomposeDirectiveIntoDAG,
  resolveHITLApproval,
  runSupervisorCycle,
  postToAgentMailbox,
  drainAgentMailbox,
} from '@/lib/jarvis/supervisor';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = verifyHmacSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }

  try {
    const dags = await getSupervisorDAGs();
    const pendingHITL = await getPendingHITLTasks();

    const activeDags = dags.filter((d) => d.status === 'ACTIVE' || d.status === 'PAUSED_HITL');
    const completedDags = dags.filter((d) => d.status === 'COMPLETED');

    return NextResponse.json({
      success: true,
      stats: {
        totalDAGs: dags.length,
        activeDAGs: activeDags.length,
        completedDAGs: completedDags.length,
        pendingHITLCount: pendingHITL.length,
      },
      activeDags,
      pendingHITL,
      recentDags: dags.slice(0, 10),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = verifyHmacSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // 1. Submit a new high-level directive to be decomposed into a DAG
    if (action === 'submit_directive' || action === 'decompose') {
      const { directive, initiator } = body;
      if (!directive || typeof directive !== 'string') {
        return NextResponse.json({ error: 'directive string is required' }, { status: 400 });
      }

      const dag = await decomposeDirectiveIntoDAG(directive, initiator || 'sir');
      return NextResponse.json({ success: true, dag });
    }

    // 2. Resolve a blocked HITL Task (Approve or Reject)
    if (action === 'approve_hitl' || action === 'reject_hitl') {
      const { taskId, note } = body;
      if (!taskId) {
        return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
      }

      const isApprove = action === 'approve_hitl';
      const result = await resolveHITLApproval(taskId, isApprove, note);
      return NextResponse.json(result);
    }

    // 3. Trigger immediate supervisor execution tick
    if (action === 'run_cycle') {
      const report = await runSupervisorCycle();
      return NextResponse.json({ success: true, report });
    }

    // 4. Stigmergic Mailbox Operations
    if (action === 'post_mailbox') {
      const { toAgent, fromAgent, type, subject, payload } = body;
      if (!toAgent || !subject) {
        return NextResponse.json({ error: 'toAgent and subject are required' }, { status: 400 });
      }

      const msg = await postToAgentMailbox(toAgent, {
        fromAgent: fromAgent || 'friday',
        type: type || 'DIRECTIVE',
        subject,
        payload: payload || {},
      });

      return NextResponse.json({ success: true, message: msg });
    }

    if (action === 'drain_mailbox') {
      const { agentId } = body;
      if (!agentId) {
        return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
      }

      const messages = await drainAgentMailbox(agentId);
      return NextResponse.json({ success: true, messages });
    }

    return NextResponse.json({ error: `Unrecognized action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
