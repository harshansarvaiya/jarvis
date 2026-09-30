/**
 * J.A.R.V.I.S. & F.R.I.D.A.Y. Sovereign Satellite Mesh Substrate
 * 
 * Enables Friday & Jarvis to bridge into any physical device (MacBook, Linux, Windows,
 * Android/Termux, Raspberry Pi, IoT) and execute authorized directives remotely.
 * 
 * Features:
 * - Device registry with live heartbeat & system telemetry (CPU, RAM, Battery, OS)
 * - Remote terminal execution (with local /CAREFUL Guardian Protocol)
 * - Native OS Actions (Desktop Notifications, App Launch, Browser Open, Clipboard Sync, Screen Lock)
 * - Cloud & Direct Dual-Channel Queue (Upstash Redis with zero-dep local fallback)
 * - Directive 01 & 06 Compliant (Memory bounds, hard-deny destructive operations)
 */

import { getStorage } from './storage';
import { isCommandCarefulBlocked } from './rpc-server';

export type SatellitePlatform = 'darwin' | 'linux' | 'win32' | 'android' | 'other';
export type SatelliteCapability =
  | 'shell'
  | 'desktop-notify'
  | 'open-url'
  | 'clipboard'
  | 'app-launch'
  | 'screen-lock'
  | 'media-control'
  | 'camera'
  | 'audio';

export interface SatelliteSystemTelemetry {
  cpuUsagePct?: number;
  freeMemMb?: number;
  totalMemMb?: number;
  batteryPercent?: number;
  isCharging?: boolean;
  uptimeSeconds?: number;
  activeWindow?: string;
  osRelease?: string;
}

export interface SatelliteDevice {
  id: string; // e.g. "sat-macbook-pro", "sat-workstation-linux"
  name: string; // "Sir's MacBook Pro M3"
  hostname: string;
  platform: SatellitePlatform;
  arch: string; // "arm64", "x64"
  ip?: string;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY';
  lastSeen: string;
  capabilities: SatelliteCapability[];
  telemetry?: SatelliteSystemTelemetry;
  pairedAt: string;
}

export type SatelliteCommandType = 'SHELL' | 'ACTION';

export type SatelliteActionType =
  | 'NOTIFY'
  | 'OPEN_URL'
  | 'APP_LAUNCH'
  | 'CLIPBOARD_SET'
  | 'CLIPBOARD_GET'
  | 'MEDIA_CONTROL'
  | 'LOCK_SCREEN';

export interface SatelliteCommand {
  id: string;
  deviceId: string;
  type: SatelliteCommandType;
  command?: string;
  action?: SatelliteActionType;
  payload?: any;
  timeoutMs: number;
  createdAt: string;
  requestedBy: string;
}

export interface SatelliteExecutionResult {
  commandId: string;
  deviceId: string;
  success: boolean;
  output: string;
  error?: string;
  exitCode?: number;
  durationMs: number;
  executedAt: string;
}

const SATELLITE_REGISTRY_KEY = 'jarvis:satellites:registry';
const SATELLITE_INBOX_PREFIX = 'jarvis:satellite:inbox:';
const SATELLITE_RESULT_PREFIX = 'jarvis:satellite:result:';
const DEFAULT_PAIRING_SECRET =
  process.env.SATELLITE_SECRET ||
  process.env.VM_RPC_SECRET ||
  'jarvis-satellite-sovereign-mesh-98e3b1c8f42a67';

/**
 * Validates inbound satellite authentication token
 */
export function verifySatelliteToken(token?: string | null): boolean {
  if (!token) return false;
  return token === DEFAULT_PAIRING_SECRET;
}

/**
 * Registers or updates a satellite node's heartbeat & telemetry
 */
export async function registerOrHeartbeatSatellite(
  info: Partial<SatelliteDevice> & { id: string; name: string }
): Promise<SatelliteDevice> {
  const storage = getStorage();
  const now = new Date().toISOString();

  const existingRaw = await storage.execute('get', SATELLITE_REGISTRY_KEY);
  let registry: Record<string, SatelliteDevice> = {};
  if (existingRaw) {
    registry = typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw;
  }

  const existing = registry[info.id];
  const updated: SatelliteDevice = {
    id: info.id,
    name: info.name || existing?.name || info.id,
    hostname: info.hostname || existing?.hostname || 'unknown-host',
    platform: info.platform || existing?.platform || 'linux',
    arch: info.arch || existing?.arch || process.arch,
    ip: info.ip || existing?.ip,
    status: 'ONLINE',
    lastSeen: now,
    capabilities: info.capabilities || existing?.capabilities || ['shell', 'desktop-notify', 'open-url'],
    telemetry: info.telemetry || existing?.telemetry,
    pairedAt: existing?.pairedAt || now,
  };

  registry[info.id] = updated;
  await storage.execute('set', SATELLITE_REGISTRY_KEY, JSON.stringify(registry));
  return updated;
}

/**
 * Lists all registered satellites with live ONLINE/OFFLINE statuses
 */
export async function listRegisteredSatellites(): Promise<SatelliteDevice[]> {
  const storage = getStorage();
  const raw = await storage.execute('get', SATELLITE_REGISTRY_KEY);
  if (!raw) return [];

  const registry: Record<string, SatelliteDevice> =
    typeof raw === 'string' ? JSON.parse(raw) : raw;

  const now = Date.now();
  const devices = Object.values(registry);

  // Mark OFFLINE if no heartbeat in the last 45 seconds
  for (const dev of devices) {
    const lastSeenMs = new Date(dev.lastSeen).getTime();
    if (isNaN(lastSeenMs) || now - lastSeenMs > 45000) {
      dev.status = 'OFFLINE';
    }
  }

  return devices.sort((a, b) => (b.status === 'ONLINE' ? 1 : 0) - (a.status === 'ONLINE' ? 1 : 0));
}

/**
 * Retrieves a single satellite by ID
 */
export async function getSatellite(deviceId: string): Promise<SatelliteDevice | null> {
  const devices = await listRegisteredSatellites();
  return devices.find((d) => d.id === deviceId || d.name.toLowerCase() === deviceId.toLowerCase()) || null;
}

/**
 * Dispatches a shell command or OS action to a specific satellite device and waits for result
 */
export async function dispatchSatelliteCommand(
  deviceId: string,
  type: SatelliteCommandType,
  payload: { command?: string; action?: SatelliteActionType; params?: any },
  timeoutMs: number = 25000,
  requestedBy: string = 'Friday/Core'
): Promise<SatelliteExecutionResult> {
  const start = Date.now();
  const commandId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const storage = getStorage();

  // 1. Safety Guardian: inspect shell commands
  if (type === 'SHELL' && payload.command) {
    const guardianCheck = isCommandCarefulBlocked(payload.command);
    if (guardianCheck.blocked) {
      return {
        commandId,
        deviceId,
        success: false,
        output: '',
        error: guardianCheck.reason || 'Blocked by /CAREFUL Guardian Protocol',
        exitCode: 126,
        durationMs: 0,
        executedAt: new Date().toISOString(),
      };
    }
  }

  // 2. Format command packet
  const cmdPacket: SatelliteCommand = {
    id: commandId,
    deviceId,
    type,
    command: payload.command,
    action: payload.action,
    payload: payload.params,
    timeoutMs,
    createdAt: new Date().toISOString(),
    requestedBy,
  };

  // 3. Push to device inbox
  await storage.execute('rpush', `${SATELLITE_INBOX_PREFIX}${deviceId}`, JSON.stringify(cmdPacket));

  // 4. Poll for result with timeout
  const pollIntervalMs = 250;
  const maxPolls = Math.ceil(timeoutMs / pollIntervalMs);
  const resultKey = `${SATELLITE_RESULT_PREFIX}${commandId}`;

  for (let i = 0; i < maxPolls; i++) {
    await new Promise((res) => setTimeout(res, pollIntervalMs));
    const rawResult = await storage.execute('get', resultKey);
    if (rawResult) {
      const parsed: SatelliteExecutionResult =
        typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;
      // Clean up result key
      storage.execute('del', resultKey).catch(() => {});
      return parsed;
    }
  }

  return {
    commandId,
    deviceId,
    success: false,
    output: '',
    error: `Satellite device "${deviceId}" timed out after ${timeoutMs}ms. Verify satellite agent is running on the host.`,
    exitCode: 124,
    durationMs: Date.now() - start,
    executedAt: new Date().toISOString(),
  };
}

/**
 * Satellite Agent Worker: Polls device inbox for next command
 */
export async function pollSatelliteInbox(deviceId: string): Promise<SatelliteCommand | null> {
  const storage = getStorage();
  try {
    const item = await storage.execute('lpop', `${SATELLITE_INBOX_PREFIX}${deviceId}`);
    if (!item) return null;
    return typeof item === 'string' ? JSON.parse(item) : item;
  } catch (err: any) {
    return null;
  }
}

/**
 * Satellite Agent Worker: Stores execution result for caller
 */
export async function reportSatelliteResult(result: SatelliteExecutionResult): Promise<void> {
  const storage = getStorage();
  const resultKey = `${SATELLITE_RESULT_PREFIX}${result.commandId}`;
  await storage.execute('setex', resultKey, 120, JSON.stringify(result));
}

/**
 * Removes a satellite from the registry
 */
export async function unregisterSatellite(deviceId: string): Promise<boolean> {
  const storage = getStorage();
  const raw = await storage.execute('get', SATELLITE_REGISTRY_KEY);
  if (!raw) return false;

  const registry: Record<string, SatelliteDevice> =
    typeof raw === 'string' ? JSON.parse(raw) : raw;

  if (registry[deviceId]) {
    delete registry[deviceId];
    await storage.execute('set', SATELLITE_REGISTRY_KEY, JSON.stringify(registry));
    return true;
  }
  return false;
}
