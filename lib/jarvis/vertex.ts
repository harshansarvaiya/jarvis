import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';

let cachedAccessToken: { token: string; expiresAt: number } | null = null;
let cachedAuthClient: any = null;

export function isVertexAIAvailable(): boolean {
  if (process.env.GCP_VERTEX_CREDENTIALS) return true;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) return true;
  if (fs.existsSync('/home/harshans279/.gcp/jarvis-vertex.json')) return true;
  return false;
}

function getCredentialsConfig(): any {
  if (process.env.GCP_VERTEX_CREDENTIALS) {
    try {
      const raw = process.env.GCP_VERTEX_CREDENTIALS.trim();
      if (raw.startsWith('{')) {
        return { credentials: JSON.parse(raw) };
      }
      // Check if base64 encoded
      const decoded = Buffer.from(raw, 'base64').toString('utf8');
      if (decoded.startsWith('{')) {
        return { credentials: JSON.parse(decoded) };
      }
    } catch (e) {
      console.warn('[Vertex AI] Failed parsing GCP_VERTEX_CREDENTIALS:', e);
    }
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    return { keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS };
  }

  if (fs.existsSync('/home/harshans279/.gcp/jarvis-vertex.json')) {
    return { keyFilename: '/home/harshans279/.gcp/jarvis-vertex.json' };
  }

  return null;
}

export async function getVertexAccessToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60000) {
    return cachedAccessToken.token;
  }

  const config = getCredentialsConfig();
  if (!config) return null;

  try {
    if (!cachedAuthClient) {
      cachedAuthClient = new GoogleAuth({
        ...config,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
    }

    const client = await cachedAuthClient.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse.token;

    if (token) {
      // Access tokens are generally valid for 1 hour; cache for 50 minutes
      cachedAccessToken = {
        token,
        expiresAt: now + 50 * 60 * 1000,
      };
      return token;
    }
  } catch (err: any) {
    console.error('[Vertex AI] Error obtaining access token:', err.message);
  }

  return null;
}

export interface VertexGenerateOptions {
  model?: string;
  contents: any[];
  systemInstruction?: any;
  tools?: any[];
  generationConfig?: any;
  signal?: AbortSignal;
}

/**
 * Maps common model identifiers to active Vertex AI endpoints and locations
 */
export function mapToVertexModel(requestedModel: string): { model: string; location: string } {
  const normalized = requestedModel.toLowerCase();

  // Gemini 3.x Series (Global Multi-Region Endpoint)
  if (normalized.includes('3.8')) {
    return { model: 'gemini-3.8-flash', location: 'global' };
  }
  if (normalized.includes('3.7')) {
    return { model: 'gemini-3.7-flash', location: 'global' };
  }
  if (normalized.includes('3.6')) {
    return { model: 'gemini-3.6-flash', location: 'global' };
  }
  if (normalized.includes('3.1-pro')) {
    return { model: 'gemini-3.1-pro-preview', location: 'global' };
  }
  if (normalized.includes('3.1')) {
    return { model: 'gemini-3.1-flash-lite', location: 'global' };
  }

  // Deep Strategic Synthesis (us-central1)
  if (normalized.includes('pro')) {
    return { model: 'gemini-2.5-pro', location: 'us-central1' };
  }

  // Reflex Speed & Multimodal (us-central1)
  if (normalized.includes('2.5') || normalized.includes('flash')) {
    return { model: 'gemini-2.5-flash', location: 'us-central1' };
  }

  // Default to Gemini 3.8 Flash (Global) for ultimate frontier reasoning
  return { model: 'gemini-3.8-flash', location: 'global' };
}

/**
 * Executes a generateContent request against Google Cloud Vertex AI
 * Drawing 100% from GCP Free Trial / Developer credits on project antigravity-cloud-runner
 */
export async function callVertexAIGenerate(options: VertexGenerateOptions): Promise<Response> {
  const token = await getVertexAccessToken();
  if (!token) {
    throw new Error('Vertex AI authentication failed: No valid Bearer token.');
  }

  const projectId = process.env.GCP_PROJECT_ID || 'antigravity-cloud-runner';
  const { model: vertexModel, location } = mapToVertexModel(options.model || 'gemini-3.8-flash');

  const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
  const endpoint = `https://${host}/v1/projects/${projectId}/locations/${location}/publishers/google/models/${vertexModel}:generateContent`;

  const defaultGenConfig: any = {
    temperature: 0.3,
    maxOutputTokens: 4096,
  };

  // Enable Google's native internal thinking layer for Gemini 3.8 and Pro (Pillar 1)
  if (vertexModel.includes('3.8') || vertexModel.includes('pro')) {
    defaultGenConfig.thinkingConfig = {
      includeThoughts: true,
      thinkingBudget: 1024,
    };
  }

  const bodyPayload: any = {
    contents: options.contents,
    generationConfig: options.generationConfig || defaultGenConfig,
  };

  if (options.systemInstruction) {
    bodyPayload.systemInstruction = options.systemInstruction;
  }

  if (options.tools && options.tools.length > 0) {
    bodyPayload.tools = options.tools;
  }

  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bodyPayload),
    signal: options.signal || AbortSignal.timeout(25000),
  });
}
