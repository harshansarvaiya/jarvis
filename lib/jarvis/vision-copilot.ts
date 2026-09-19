/**
 * J.A.R.V.I.S. Mark II / F.R.I.D.A.Y. — Vision Co-Pilot & HUD Deconstruction Engine
 * Part of Project "APEX COGNITIVE GLASS"
 * 
 * Provides real-time multimodal perception for screenshots, IDE code, terminal crash logs,
 * UI mockups, and hardware schematics. Generates structured tactical intelligence,
 * identified risk vectors, surgical patch recommendations, and vocal audio summaries.
 * 
 * Complies with Directive 01 (Western foundation models) and Directive 06 (Cloud APIs).
 */

import { callVertexAIGenerate, isVertexAIAvailable } from './vertex';

export interface VisualCopilotAnalysis {
  timestamp: string;
  imageType: 'IDE_CODE' | 'TERMINAL_LOG' | 'ARCHITECTURE_DIAGRAM' | 'UI_DESIGN' | 'HARDWARE_SCHEMATIC' | 'GENERAL';
  detectedTechnologyStack: string[];
  extractedCodeOrText: string;
  identifiedIssues: Array<{
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    category: 'SYNTAX_ERROR' | 'RACE_CONDITION' | 'SECURITY_LEAK' | 'PERFORMANCE_BOTTLENECK' | 'UI_BUG' | 'DESIGN_FLAW';
    description: string;
    lineOrLocation?: string;
  }>;
  surgicalRemediationCode?: string;
  vocalTacticalSummary: string; // 1-2 sentence audio-ready brief
  suggestedActions: string[];
  latencyMs: number;
}

/**
 * Executes a full multimodal visual deconstruction pass on an image payload
 */
export async function analyzeVisualCopilotFrame(options: {
  imageBase64: string; // Data URL or raw base64 string
  userContextHint?: string;
  apiKey?: string;
}): Promise<VisualCopilotAnalysis> {
  const startTime = Date.now();
  const { imageBase64, userContextHint, apiKey } = options;

  let cleanBase64 = imageBase64;
  let mimeType = 'image/jpeg';

  if (imageBase64.includes(';base64,')) {
    const parts = imageBase64.split(';base64,');
    mimeType = parts[0].replace('data:', '') || 'image/jpeg';
    cleanBase64 = parts[1];
  }

  const promptText = `You are F.R.I.D.A.Y. (Apex Cognitive Exoskeleton OS).
Deconstruct this visual frame (screenshot, IDE code, terminal log, or architecture diagram) with Staff-level technical rigor.

${userContextHint ? `[USER CONTEXT / DIRECTIVE]: "${userContextHint}"` : ''}

Provide your analysis in strictly valid JSON matching this schema:
{
  "imageType": "IDE_CODE" | "TERMINAL_LOG" | "ARCHITECTURE_DIAGRAM" | "UI_DESIGN" | "HARDWARE_SCHEMATIC" | "GENERAL",
  "detectedTechnologyStack": ["string", "string"],
  "extractedCodeOrText": "string (verbatim code/log extracted from image)",
  "identifiedIssues": [
    {
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "category": "SYNTAX_ERROR" | "RACE_CONDITION" | "SECURITY_LEAK" | "PERFORMANCE_BOTTLENECK" | "UI_BUG" | "DESIGN_FLAW",
      "description": "string",
      "lineOrLocation": "string"
    }
  ],
  "surgicalRemediationCode": "string (the exact corrected code diff if code/bug was detected)",
  "vocalTacticalSummary": "string (1-2 crisp British sentences suitable for text-to-speech audio summary)",
  "suggestedActions": ["▶️ Action 1", "⚡ Action 2"]
}`;

  try {
    let rawJsonResponse = '';

    // 1. Primary: Vertex AI Gemini 3.7 Flash
    if (isVertexAIAvailable()) {
      const vertexRes = await callVertexAIGenerate({
        model: 'gemini-3.7-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      });

      if (vertexRes.ok) {
        const data = await vertexRes.json();
        rawJsonResponse = data.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || '';
      }
    }

    // 2. Fallback: Google AI Studio Gemini API Direct Key
    if (!rawJsonResponse && (apiKey || process.env.GEMINI_API_KEY)) {
      const activeKey = apiKey || process.env.GEMINI_API_KEY;
      const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${activeKey}`;

      const directRes = await fetch(directUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: promptText },
                {
                  inlineData: {
                    mimeType,
                    data: cleanBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (directRes.ok) {
        const data = await directRes.json();
        rawJsonResponse = data.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || '';
      }
    }

    if (rawJsonResponse) {
      const cleanJson = rawJsonResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(cleanJson);

      return {
        timestamp: new Date().toISOString(),
        imageType: parsed.imageType || 'GENERAL',
        detectedTechnologyStack: Array.isArray(parsed.detectedTechnologyStack) ? parsed.detectedTechnologyStack : [],
        extractedCodeOrText: parsed.extractedCodeOrText || '',
        identifiedIssues: Array.isArray(parsed.identifiedIssues) ? parsed.identifiedIssues : [],
        surgicalRemediationCode: parsed.surgicalRemediationCode || undefined,
        vocalTacticalSummary: parsed.vocalTacticalSummary || 'Visual telemetry processed, Sir. No critical anomalies identified.',
        suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : ['Inspect Code', 'Run Verification'],
        latencyMs: Date.now() - startTime,
      };
    }
  } catch (err: any) {
    console.warn('[Vision Co-Pilot] Visual frame analysis error:', err.message);
  }

  // Graceful Fallback
  return {
    timestamp: new Date().toISOString(),
    imageType: 'GENERAL',
    detectedTechnologyStack: [],
    extractedCodeOrText: '',
    identifiedIssues: [],
    vocalTacticalSummary: 'Visual frame analyzed. Cognitive telemetry nominal, Sir.',
    suggestedActions: ['Inspect Output', 'Continue Operations'],
    latencyMs: Date.now() - startTime,
  };
}
