import { NextRequest, NextResponse } from 'next/server';
import { getTasks, addTask, updateTask, deleteTask } from '@/lib/jarvis/memory';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tasks = getTasks();
    return NextResponse.json({ tasks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, priority, dueDate, tags } = body;

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
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
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
