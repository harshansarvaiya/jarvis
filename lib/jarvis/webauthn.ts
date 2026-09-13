/**
 * J.A.R.V.I.S. Biometric Credential Authority (WebAuthn / Passkeys)
 * Supports Face ID, Touch ID, Windows Hello, and Android Biometrics.
 */

import fs from 'fs';
import path from 'path';

export interface BiometricCredential {
  id: string; // Base64URL credential ID
  name: string; // Friendly name (e.g., "iPhone 15 FaceID", "Pixel Fingerprint")
  createdAt: string;
  lastUsedAt?: string;
}

// Storage path - serverless friendly
function getBiometricsFilePath(): string {
  if (process.env.VERCEL) {
    return path.join('/tmp', 'jarvis-biometrics.json');
  }
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'jarvis-biometrics.json');
}

// In-memory active challenge registry (2 minute TTL)
interface ChallengeEntry {
  challenge: string;
  expiresAt: number;
}
const activeChallenges = new Map<string, ChallengeEntry>();

export function generateWebAuthnChallenge(sessionId: string): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const challenge = btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  activeChallenges.set(sessionId, {
    challenge,
    expiresAt: Date.now() + 2 * 60 * 1000,
  });

  return challenge;
}

export function verifyChallenge(sessionId: string, clientChallenge: string): boolean {
  const entry = activeChallenges.get(sessionId);
  if (!entry) return false;
  activeChallenges.delete(sessionId);
  if (entry.expiresAt < Date.now()) return false;
  return entry.challenge === clientChallenge;
}

export function getRegisteredCredentials(): BiometricCredential[] {
  try {
    const filePath = getBiometricsFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to read biometric credentials:', e);
  }
  return [];
}

export function saveRegisteredCredential(credential: BiometricCredential): void {
  try {
    const list = getRegisteredCredentials().filter((c) => c.id !== credential.id);
    list.push(credential);
    const filePath = getBiometricsFilePath();
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save biometric credential:', e);
  }
}

export function removeRegisteredCredential(id: string): void {
  try {
    const list = getRegisteredCredentials().filter((c) => c.id !== id);
    const filePath = getBiometricsFilePath();
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to remove biometric credential:', e);
  }
}
