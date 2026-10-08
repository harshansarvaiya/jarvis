import { NextRequest, NextResponse } from 'next/server';
import { generateImageWithCloudEngine, ImageAspectRatio, ImageStyle } from '@/lib/jarvis/image-generator';
import { verifySessionToken, verifyMobileBearerToken } from '@/lib/jarvis/auth';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const dir = path.join(process.cwd(), 'public', 'generated-images');
    if (!fs.existsSync(dir)) {
      return NextResponse.json({ success: true, images: [] });
    }

    const files = fs.readdirSync(dir)
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
      .map((f) => {
        const fullPath = path.join(dir, f);
        const stats = fs.statSync(fullPath);
        return {
          fileName: f,
          url: `/generated-images/${f}`,
          sizeBytes: stats.size,
          createdAt: stats.birthtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 30);

    return NextResponse.json({ success: true, images: files });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to list generated images' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cookieToken = req.cookies.get('jarvis_session')?.value;

    const isBearerValid = authHeader ? verifyMobileBearerToken(authHeader) : false;
    const isSessionValid = cookieToken ? await verifySessionToken(cookieToken) : false;

    if (authHeader && !isBearerValid && !isSessionValid) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { prompt, aspectRatio, style, persona } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Valid prompt string is required.' },
        { status: 400 }
      );
    }

    const result = await generateImageWithCloudEngine({
      prompt,
      aspectRatio: (aspectRatio as ImageAspectRatio) || '1:1',
      style: (style as ImageStyle) || 'cinematic',
      persona: persona === 'JARVIS' ? 'JARVIS' : 'FRIDAY',
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Visual synthesis failed.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result: {
        imageUrl: result.imageUrl,
        prompt: result.prompt,
        enhancedPrompt: result.enhancedPrompt,
        aspectRatio: result.aspectRatio,
        engineUsed: result.engineUsed,
        latencyMs: result.latencyMs,
        markdown: result.markdown,
        base64Data: result.base64Data,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Visual synthesis failed.' },
      { status: 500 }
    );
  }
}
