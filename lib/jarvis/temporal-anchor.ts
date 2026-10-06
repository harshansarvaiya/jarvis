/**
 * J.A.R.V.I.S. Mark II — Empathetic Temporal Anchor (Dot-Inspired)
 * 
 * Tracks Sir's cognitive momentum, interaction pacing, energy levels, and focus shifts
 * longitudinally across sessions. Prevents cognitive fatigue, detects deep flow states,
 * and dynamically recommends tonal and conversational pacing adaptations.
 * 
 * Persistence: Upstash Redis REST (`jarvis:temporal_anchor`) + Local Disk (`data/jarvis-temporal-anchor.json`)
 */

import fs from 'fs';
import path from 'path';
import { getStorage } from './storage';

export type CognitivePacingState =
  | 'HIGH_INTENSITY_FLOW'
  | 'STEADY_DELIBERATE'
  | 'REFLECTIVE_EXPLORATION'
  | 'FATIGUE_PREVENTION';

export interface TemporalAnchorState {
  currentPacing: CognitivePacingState;
  sessionVelocity: {
    turnsInLastHour: number;
    avgLatencyMs: number;
    dominantDomain: string;
  };
  longitudinalFocusDistribution: Record<string, number>; // Domain percentages (0-100)
  fatigueRiskIndex: number; // 0 (fresh) to 100 (high fatigue risk)
  recommendedGroundingGuidance: string;
  lastUpdated: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const ANCHOR_FILE = path.join(DATA_DIR, 'jarvis-temporal-anchor.json');
const REDIS_KEY = 'jarvis:temporal_anchor';

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getDefaultTemporalAnchor(): TemporalAnchorState {
  return {
    currentPacing: 'STEADY_DELIBERATE',
    sessionVelocity: {
      turnsInLastHour: 6,
      avgLatencyMs: 420,
      dominantDomain: 'Distributed Systems & Autonomous Cognitive Architecture',
    },
    longitudinalFocusDistribution: {
      'Distributed Systems & Architecture': 45,
      'Model Distillation & LoRA Fine-Tuning': 30,
      'Real-Time Sentry & Radar Infrastructure': 25,
    },
    fatigueRiskIndex: 20,
    recommendedGroundingGuidance:
      'Sir is in an engaged, high-signal architectural mindset. Maintain composed British intellectual elegance, razor-sharp precision, and peer-level sparring.',
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Retrieves the current longitudinal temporal anchor state
 */
export async function getTemporalAnchorState(): Promise<TemporalAnchorState> {
  const storage = getStorage();

  // 1. Try Cloud Upstash Redis
  if (storage.isCloud) {
    try {
      const raw = await storage.execute('get', REDIS_KEY);
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed?.currentPacing) return parsed;
      }
    } catch (err) {
      console.warn('[Temporal Anchor] Upstash read warning, using local file:', err);
    }
  }

  // 2. Fall back to local file
  ensureDataDir();
  if (fs.existsSync(ANCHOR_FILE)) {
    try {
      const content = fs.readFileSync(ANCHOR_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed?.currentPacing) return parsed;
    } catch {
      // Fall through to defaults
    }
  }

  const defaults = getDefaultTemporalAnchor();
  await saveTemporalAnchorState(defaults);
  return defaults;
}

/**
 * Persists temporal anchor state to both Upstash and local disk
 */
export async function saveTemporalAnchorState(state: TemporalAnchorState): Promise<void> {
  ensureDataDir();
  try {
    fs.writeFileSync(ANCHOR_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('[Temporal Anchor] Failed to write local temporal anchor file:', err);
  }

  const storage = getStorage();
  if (storage.isCloud) {
    try {
      await storage.execute('set', REDIS_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('[Temporal Anchor] Failed to write Upstash temporal anchor key:', err);
    }
  }
}

/**
 * Records an ongoing interaction to update cognitive velocity and temporal pacing
 */
export async function recordTemporalInteraction(metadata: {
  domain?: string;
  latencyMs?: number;
  emotionValence?: string;
}): Promise<TemporalAnchorState> {
  const state = await getTemporalAnchorState();

  const domain = metadata.domain || 'Core Systems Architecture';
  const currentCount = state.sessionVelocity.turnsInLastHour + 1;
  state.sessionVelocity.turnsInLastHour = currentCount;

  if (metadata.latencyMs) {
    state.sessionVelocity.avgLatencyMs = Math.round(
      (state.sessionVelocity.avgLatencyMs + metadata.latencyMs) / 2
    );
  }

  // Determine cognitive pacing state
  if (currentCount > 15) {
    state.currentPacing = 'FATIGUE_PREVENTION';
    state.fatigueRiskIndex = Math.min(100, state.fatigueRiskIndex + 25);
    state.recommendedGroundingGuidance =
      'High conversational volume detected. Deliver ultra-crisp summaries, prioritize high-ROI fixes, and provide calming, effortless closure.';
  } else if (currentCount > 8) {
    state.currentPacing = 'HIGH_INTENSITY_FLOW';
    state.fatigueRiskIndex = Math.min(60, state.fatigueRiskIndex + 10);
    state.recommendedGroundingGuidance =
      'Sir is in a high-velocity flow state. Eliminate all friction; deliver immediate, production-ready code diffs and compiler verifications.';
  } else {
    state.currentPacing = 'STEADY_DELIBERATE';
    state.fatigueRiskIndex = Math.max(10, state.fatigueRiskIndex - 5);
    state.recommendedGroundingGuidance =
      'Maintain composed British-tinged intellectual elegance. Spar candidly on architecture, challenge unstated risks, and execute flawlessly.';
  }

  state.sessionVelocity.dominantDomain = domain;
  state.lastUpdated = new Date().toISOString();

  await saveTemporalAnchorState(state);
  return state;
}

/**
 * Formats temporal anchor state for system prompt injection
 */
export function formatTemporalAnchorPromptBlock(state: TemporalAnchorState): string {
  return `[EMPATHETIC TEMPORAL ANCHOR (DOT COGNITIVE PACING)]:
- Observed Cognitive Pacing: ${state.currentPacing} (Fatigue Risk Index: ${state.fatigueRiskIndex}/100)
- Recent Velocity: ${state.sessionVelocity.turnsInLastHour} turns/hr (Dominant Domain: ${state.sessionVelocity.dominantDomain})
- Adaptive Tone Mandate: ${state.recommendedGroundingGuidance}`;
}
