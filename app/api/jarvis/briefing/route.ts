import { NextResponse } from 'next/server';
import { executeJarvisTool } from '@/lib/jarvis/tools';

export async function GET() {
  try {
    const result = await executeJarvisTool('generate_briefing', {});
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
