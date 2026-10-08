/**
 * J.A.R.V.I.S. & F.R.I.D.A.Y. Cloud-Native Image Generation Substrate
 *
 * Implements 100% Western, zero-thrashing visual synthesis complying with:
 * - Directive 01 (The Guardian Protocol): Strictly 100% Western foundation models (Google DeepMind Vertex AI).
 * - Directive 06 (Zero-Thrashing Infrastructure): 100% cloud-hosted API execution. Zero native heavy ML binaries.
 *
 * Architecture:
 * - Primary Engine: Google Cloud Vertex AI `gemini-3.1-flash-image` (Global Endpoint, antigravity-cloud-runner)
 * - Secondary Engine: Google Cloud Vertex AI `gemini-2.5-flash-image`
 * - Resilient Failover: Pollinations Flux / SDXL (High-availability Western open fallback)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getVertexAccessToken } from './vertex';

export type ImageAspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export type ImageStyle =
  | 'cinematic'
  | 'blueprint'
  | 'cyberpunk'
  | 'photorealistic'
  | 'minimalist'
  | 'concept_art'
  | 'diagram'
  | 'raw';

export interface ImageGenerationOptions {
  prompt: string;
  aspectRatio?: ImageAspectRatio;
  style?: ImageStyle;
  persona?: 'FRIDAY' | 'JARVIS';
  caller?: string;
}

export interface GeneratedImageResult {
  success: boolean;
  prompt: string;
  enhancedPrompt: string;
  imageUrl: string;
  filePath: string;
  base64Data: string;
  buffer: Buffer;
  mimeType: string;
  aspectRatio: ImageAspectRatio;
  engineUsed: string;
  latencyMs: number;
  markdown: string;
  error?: string;
}

const GENERATED_DIR = path.join(process.cwd(), 'public', 'generated-images');

function ensureDirectoryExists(): void {
  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }
}

/**
 * Applies cinematic style conditioning to elevate output fidelity.
 */
export function enhancePromptWithStyle(
  rawPrompt: string,
  style: ImageStyle = 'cinematic',
  aspectRatio: ImageAspectRatio = '1:1'
): string {
  const trimmed = rawPrompt.trim();
  const aspectHint = aspectRatio !== '1:1' ? ` in ${aspectRatio} aspect ratio format` : '';

  switch (style) {
    case 'blueprint':
      return `${trimmed}, architectural engineering blueprint, white and neon cyan wireframe schematic, high contrast, clean technical drafting, ISO precision grid${aspectHint}`;
    case 'cyberpunk':
      return `${trimmed}, cyberpunk aesthetic, neon cyan and electric gold lighting, dark high-tech background, holographic HUD overlays, cinematic 8k${aspectHint}`;
    case 'cinematic':
      return `${trimmed}, cinematic lighting, photorealistic 8k, dramatic composition, volumetric shadows, IMAX clarity, masterpiece${aspectHint}`;
    case 'diagram':
      return `${trimmed}, clean technical architectural diagram, sleek modern UI infographic, high contrast, crisp vector elements, elegant typography${aspectHint}`;
    case 'photorealistic':
      return `${trimmed}, ultra-detailed 8k photograph, natural volumetric lighting, shallow depth of field, sharp crisp focus, hyperrealistic texture${aspectHint}`;
    case 'minimalist':
      return `${trimmed}, minimalist vector graphic, clean silhouette, elegant modern palette, Bauhaus precision, sleek aesthetic${aspectHint}`;
    case 'concept_art':
      return `${trimmed}, digital concept art, trending on ArtStation, dynamic matte painting, epic atmosphere, hyper-detailed${aspectHint}`;
    case 'raw':
    default:
      return `${trimmed}${aspectHint}`;
  }
}

/**
 * Attempts image generation via Google Cloud Vertex AI
 */
async function generateViaVertexAI(
  enhancedPrompt: string,
  modelName: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const token = await getVertexAccessToken();
  if (!token) return null;

  const projectId = process.env.GCP_PROJECT_ID || 'antigravity-cloud-runner';
  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${modelName}:generateContent`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: `Generate an image: ${enhancedPrompt}` }],
      },
    ],
    generationConfig: {
      responseModalities: ['IMAGE'],
    },
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.warn(`[Vertex AI Image] ${modelName} returned HTTP ${res.status}:`, errText.slice(0, 200));
    return null;
  }

  const data = await res.json();
  const part = data.candidates?.[0]?.content?.parts?.[0];

  if (part?.inlineData?.data) {
    const mimeType = part.inlineData.mimeType || 'image/png';
    const buffer = Buffer.from(part.inlineData.data, 'base64');
    return { buffer, mimeType };
  }

  return null;
}

/**
 * Cloud-native Western fallback via Pollinations Flux (zero API key, zero quota exhaustion)
 */
async function generateViaCloudFallback(
  enhancedPrompt: string,
  aspectRatio: ImageAspectRatio
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    let width = 1024;
    let height = 1024;

    if (aspectRatio === '16:9') {
      width = 1280;
      height = 720;
    } else if (aspectRatio === '9:16') {
      width = 720;
      height = 1280;
    } else if (aspectRatio === '4:3') {
      width = 1024;
      height = 768;
    } else if (aspectRatio === '3:4') {
      width = 768;
      height = 1024;
    }

    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      enhancedPrompt
    )}?width=${width}&height=${height}&model=flux&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;

    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) return null;

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const mimeType = contentType.includes('png') ? 'image/png' : 'image/jpeg';

    return { buffer, mimeType };
  } catch (err: any) {
    console.warn('[Cloud Fallback Image] Error generating fallback:', err?.message);
    return null;
  }
}

/**
 * Executes sovereign cloud-native image generation
 */
export async function generateImageWithCloudEngine(
  options: ImageGenerationOptions
): Promise<GeneratedImageResult> {
  const startTime = Date.now();
  const prompt = options.prompt?.trim() || 'A sleek futuristic Iron Man HUD arc reactor core, sci-fi, cinematic 4k';
  const aspectRatio = options.aspectRatio || '1:1';
  const style = options.style || 'cinematic';
  const persona = options.persona || 'FRIDAY';
  const enhancedPrompt = enhancePromptWithStyle(prompt, style, aspectRatio);

  ensureDirectoryExists();

  let generated: { buffer: Buffer; mimeType: string } | null = null;
  let engineUsed = 'Unknown';

  // 1. Primary Engine: Vertex AI Gemini 3.1 Flash Image
  try {
    generated = await generateViaVertexAI(enhancedPrompt, 'gemini-3.1-flash-image');
    if (generated) {
      engineUsed = 'Vertex AI Gemini 3.1 Flash Image';
    }
  } catch (err: any) {
    console.warn('[Image Generator] Primary Vertex 3.1 Flash Image failed:', err.message);
  }

  // 2. Secondary Engine: Vertex AI Gemini 2.5 Flash Image
  if (!generated) {
    try {
      generated = await generateViaVertexAI(enhancedPrompt, 'gemini-2.5-flash-image');
      if (generated) {
        engineUsed = 'Vertex AI Gemini 2.5 Flash Image';
      }
    } catch (err: any) {
      console.warn('[Image Generator] Secondary Vertex 2.5 Flash Image failed:', err.message);
    }
  }

  // 3. Cloud Fallback: Pollinations Flux Engine (Directive 01 Western Open Model)
  if (!generated) {
    try {
      console.log('[Image Generator] Engaging cloud-native Flux fallback...');
      generated = await generateViaCloudFallback(enhancedPrompt, aspectRatio);
      if (generated) {
        engineUsed = 'Cloud-Native Flux Engine (Directive 01)';
      }
    } catch (err: any) {
      console.warn('[Image Generator] Cloud fallback failed:', err.message);
    }
  }

  if (!generated) {
    return {
      success: false,
      prompt,
      enhancedPrompt,
      imageUrl: '',
      filePath: '',
      base64Data: '',
      buffer: Buffer.alloc(0),
      mimeType: 'image/png',
      aspectRatio,
      engineUsed: 'None',
      latencyMs: Date.now() - startTime,
      markdown: '',
      error: 'All cloud image synthesis endpoints failed or timed out. System preserved without infrastructure thrashing.',
    };
  }

  // Persist asset to public directory for static serving
  const extension = generated.mimeType === 'image/jpeg' ? 'jpg' : 'png';
  const uniqueId = `${persona.toLowerCase()}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const fileName = `${uniqueId}.${extension}`;
  const filePath = path.join(GENERATED_DIR, fileName);
  const imageUrl = `/generated-images/${fileName}`;

  try {
    fs.writeFileSync(filePath, generated.buffer);
  } catch (writeErr: any) {
    console.error('[Image Generator] Failed to write image to disk:', writeErr.message);
  }

  const base64Data = `data:${generated.mimeType};base64,${generated.buffer.toString('base64')}`;
  const markdown = `![${prompt}](${imageUrl})`;

  // Broadcast event to Dual-Citizen State Bus
  import('./state-bus')
    .then(({ publishStateEvent }) => {
      publishStateEvent({
        type: 'agent:action',
        source: persona === 'FRIDAY' ? 'friday' : 'jarvis',
        title: `Visual Synthesis: ${prompt.slice(0, 36)}...`,
        detail: `${engineUsed} (${Date.now() - startTime}ms) - ${aspectRatio}`,
        payload: { imageUrl, prompt, style, aspectRatio, engineUsed },
      }).catch(() => {});
    })
    .catch(() => {});

  return {
    success: true,
    prompt,
    enhancedPrompt,
    imageUrl,
    filePath,
    base64Data,
    buffer: generated.buffer,
    mimeType: generated.mimeType,
    aspectRatio,
    engineUsed,
    latencyMs: Date.now() - startTime,
    markdown,
  };
}
