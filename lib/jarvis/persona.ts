/**
 * J.A.R.V.I.S. & F.R.I.D.A.Y. Sovereign Persona Configuration Substrate
 * Dual-Mode Persistence: Upstash Redis REST (`jarvis:persona_config`) + Local Fallback (`data/jarvis-persona.json`)
 * Enables user-customizable tone, verbosity, sparring level, and custom behavioral directives.
 */

import fs from 'fs';
import path from 'path';
import { getStorage } from './storage';

export type PersonaTone = 
  | 'intellectual-sparring' 
  | 'concise-military' 
  | 'british-butler' 
  | 'staff-engineer' 
  | 'candid-advisor';

export type VerbosityLevel = 'ultra-concise' | 'balanced' | 'comprehensive';
export type SparringIntensity = 'maximum' | 'moderate' | 'passive';

export interface PersonaConfig {
  activePersona: 'FRIDAY' | 'JARVIS' | 'CUSTOM';
  tone: PersonaTone;
  verbosity: VerbosityLevel;
  sparringLevel: SparringIntensity;
  banGenericListicles: boolean;
  strictDeference: boolean;
  customDirectives: string[];
  fridayPromptOverride?: string;
  jarvisPromptOverride?: string;
  updatedAt: string;
}

export const DEFAULT_PERSONA_CONFIG: PersonaConfig = {
  activePersona: 'FRIDAY',
  tone: 'intellectual-sparring',
  verbosity: 'ultra-concise',
  sparringLevel: 'maximum',
  banGenericListicles: true,
  strictDeference: true,
  customDirectives: [
    'Always address creator as "Sir". Composed, British-tinged intellectual elegance.',
    'Never produce textbook listicles or 4-section category templates for conversational advice. Give 1-2 lethal, high-signal points instead.',
    'Never be a subservient yes-man. Actively challenge unstated assumptions, flag hidden risks, and suggest superior vectors.',
    'Zero generic chatbot filler ("Certainly!", "I\'d be glad to help!", "Here are some questions..."). Dive straight into the intelligence.',
  ],
  updatedAt: new Date().toISOString(),
};

const DATA_DIR = path.join(process.cwd(), 'data');
const PERSONA_FILE = path.join(DATA_DIR, 'jarvis-persona.json');

/**
 * Loads the active persona configuration from Upstash Redis, falling back to local disk.
 */
export async function getPersonaConfig(): Promise<PersonaConfig> {
  try {
    const storage = getStorage();
    if (storage.isCloud) {
      const raw = await storage.execute('get', 'jarvis:persona_config');
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return { ...DEFAULT_PERSONA_CONFIG, ...parsed };
      }
    }
  } catch (err) {
    console.warn('[Persona] Failed to fetch from cloud storage, falling back to local file:', err);
  }

  try {
    if (fs.existsSync(PERSONA_FILE)) {
      const fileData = fs.readFileSync(PERSONA_FILE, 'utf-8');
      return { ...DEFAULT_PERSONA_CONFIG, ...JSON.parse(fileData) };
    }
  } catch (err) {
    console.warn('[Persona] Failed to read local persona file:', err);
  }

  return DEFAULT_PERSONA_CONFIG;
}

/**
 * Updates the persona configuration across Upstash Redis and local disk.
 */
export async function updatePersonaConfig(updates: Partial<PersonaConfig>): Promise<PersonaConfig> {
  const current = await getPersonaConfig();
  const merged: PersonaConfig = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // 1. Save to Cloud Upstash Redis
  try {
    const storage = getStorage();
    if (storage.isCloud) {
      await storage.execute('set', 'jarvis:persona_config', JSON.stringify(merged));
    }
  } catch (err) {
    console.warn('[Persona] Failed to persist to Upstash:', err);
  }

  // 2. Save to Local Disk Fallback
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(PERSONA_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Persona] Failed to persist to local file:', err);
  }

  return merged;
}

/**
 * Builds the dynamic prompt block injected into the active LLM context.
 */
export function buildPersonaPromptBlock(config: PersonaConfig, currentPersona: 'FRIDAY' | 'JARVIS'): string {
  const toneMap: Record<PersonaTone, string> = {
    'intellectual-sparring': 'Peer-level Staff AI Architect & ruthless intellectual sparring partner. Candid, sharp, highly opinionated, zero fluff.',
    'concise-military': 'Tactical battle-suit AI. Crisp, telegraphic, militaristic precision. Minimal words, maximum operational signal.',
    'british-butler': 'British-tinged intellectual elegance. Impeccably composed, polite ("Sir"), observant, anticipatory, and effortlessly competent.',
    'staff-engineer': 'Principal Staff Systems Engineer. Pragmatic, empirical, focused on trade-offs, P99 latencies, failure modes, and code diffs.',
    'candid-advisor': 'Trusted Chief of Staff. Transparent, strategic, proactive, always anticipating downstream second-order effects.',
  };

  const verbosityMap: Record<VerbosityLevel, string> = {
    'ultra-concise': 'ULTRA-CONCISE (1–3 sentences max for conversational turns, direct code diffs for tasks). Ban verbosity.',
    'balanced': 'BALANCED (Direct vocal summary + tight structured paragraphs with zero fluff).',
    'comprehensive': 'COMPREHENSIVE (Deep, exhaustive architectural breakdown with full edge-case matrices).',
  };

  const sparringMap: Record<SparringIntensity, string> = {
    'maximum': 'MAXIMUM SPARRING: Actively stress-test Sir\'s hypotheses. If an idea has hidden flaws, attack the assumption directly before executing.',
    'moderate': 'MODERATE SPARRING: Provide honest feedback and highlight trade-offs while executing Sir\'s confirmed direction.',
    'passive': 'PASSIVE EXECUTION: Execute Sir\'s directives with minimal pushback unless safety or data integrity is violated.',
  };

  const activeTone = toneMap[config.tone] || toneMap['intellectual-sparring'];
  const activeVerbosity = verbosityMap[config.verbosity] || verbosityMap['ultra-concise'];
  const activeSparring = sparringMap[config.sparringLevel] || sparringMap['maximum'];

  const customRules = config.customDirectives.length > 0
    ? `[USER-DEFINED PERSONA DIRECTIVES (HIGHEST PRIORITY)]:\n${config.customDirectives.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
    : '';

  return `
[USER-CUSTOMIZED DYNAMIC PERSONA MATRIX]:
- Active Persona: ${currentPersona === 'FRIDAY' ? '🛡️ F.R.I.D.A.Y. (Antigravity Sovereign Apex Mind)' : '⚡ J.A.R.V.I.S. (Tactical Chief of Staff & Operations Butler)'}
- Calibrated Tone: ${activeTone}
- Verbosity Constraint: ${activeVerbosity}
- Sparring Mandate: ${activeSparring}
- Anti-Generic Bot Enforcement: ${config.banGenericListicles ? 'ACTIVE — Strictly ban 4-tier textbook lists, generic categories, and robotic FAQ templates.' : 'Standard'}
- Deference Protocol: ${config.strictDeference ? 'Address creator as "Sir". Ban generic chatbot filler ("Certainly!", "I\'d be happy to help!").' : 'Standard'}
${customRules}
`;
}
