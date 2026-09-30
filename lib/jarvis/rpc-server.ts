/**
 * J.A.R.V.I.S. & F.R.I.D.A.Y. Sovereign Direct VM RPC Server
 * 
 * Runs as a native, lightweight HTTP listener on the GCP VM (antigravity-cloud-runner).
 * Receives remote execution directives directly from Vercel Edge in <100ms.
 * 
 * Features:
 * - 0 Upstash Redis calls (100% immune to API rate limits and quotas)
 * - Cryptographic Token Gate (x-jarvis-rpc-token)
 * - /CAREFUL Command Guardian (hard-denies destructive commands)
 * - Memory & timeout bounded execution (Directive 06)
 */

import http from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const DEFAULT_RPC_PORT = 4004;
export const DEFAULT_RPC_SECRET =
  process.env.VM_RPC_SECRET || 'jarvis-sovereign-rpc-652a16c035ab8640b52f724d3302790c31ec7497c3a71ae7db119f76d70f50d8';

const HARD_DENY_PATTERNS = [
  /\brm\s+-[rf]*\s+[\/\*]/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /:(){ :\|:& };:/, // fork bomb
  /\bgit\s+push\s+.*--force\s+(origin\s+)?(main|master)\b/i,
];

export function isCommandCarefulBlocked(cmd: string): { blocked: boolean; reason?: string } {
  for (const pattern of HARD_DENY_PATTERNS) {
    if (pattern.test(cmd)) {
      return { blocked: true, reason: `Command matches /CAREFUL Hard-Deny rule: ${pattern.toString()}` };
    }
  }
  return { blocked: false };
}

let rpcServerInstance: http.Server | null = null;

export function startSovereignRpcServer(port: number = Number(process.env.VM_RPC_PORT) || DEFAULT_RPC_PORT): http.Server {
  if (rpcServerInstance) {
    return rpcServerInstance;
  }

  const server = http.createServer(async (req, res) => {
    // CORS headers for Web PWA
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-jarvis-rpc-token');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const hostHeader = req.headers.host || 'localhost';
    const parsedUrl = new URL(req.url || '/', `http://${hostHeader}`);

    // Health check endpoint
    if (req.method === 'GET' && (parsedUrl.pathname === '/health' || parsedUrl.pathname === '/api/vm-rpc/health')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ONLINE',
          host: 'antigravity-cloud-runner',
          port,
          uptimeSeconds: Math.round(process.uptime()),
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    // Direct Sovereign Satellite Mesh Relay
    if (parsedUrl.pathname === '/api/satellite/poll' && req.method === 'POST') {
      let bodyRaw = '';
      req.on('data', (chunk) => { bodyRaw += chunk; });
      req.on('end', async () => {
        try {
          const body = JSON.parse(bodyRaw);
          const { registerOrHeartbeatSatellite, pollSatelliteInbox, reportSatelliteResult } = await import('./satellite');
          if (body.result) {
            await reportSatelliteResult(body.result);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, recorded: true }));
            return;
          }
          if (body.device && body.device.id) {
            const registered = await registerOrHeartbeatSatellite(body.device);
            const cmd = await pollSatelliteInbox(body.device.id);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, device: registered, command: cmd || null }));
            return;
          }
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid payload' }));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (parsedUrl.pathname === '/api/satellite/list' && req.method === 'GET') {
      const { listRegisteredSatellites } = await import('./satellite');
      const devices = await listRegisteredSatellites();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, count: devices.length, devices }));
      return;
    }

    if (req.method !== 'POST' || (parsedUrl.pathname !== '/api/vm-rpc' && parsedUrl.pathname !== '/')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
      return;
    }

    // Cryptographic token verification
    const authHeader = req.headers['authorization'];
    const bearerToken = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : '';
    const headerToken = req.headers['x-jarvis-rpc-token'];
    const clientToken = (typeof headerToken === 'string' ? headerToken : '') || bearerToken;
    const validSecret = process.env.VM_RPC_SECRET || DEFAULT_RPC_SECRET;

    if (!clientToken || clientToken !== validSecret) {
      console.warn(`[Sovereign RPC] 🚨 Unauthorized attempt rejected from: ${req.socket.remoteAddress}`);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Invalid x-jarvis-rpc-token' }));
      return;
    }

    // Read request body
    let bodyRaw = '';
    req.on('data', (chunk) => {
      bodyRaw += chunk;
      if (bodyRaw.length > 2 * 1024 * 1024) {
        req.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(bodyRaw);
        const { command, cwd, timeoutMs, requestedBy, requestId: incomingId } = payload;
        const requestId = incomingId || `rpc-direct-${Date.now()}`;

        if (!command || typeof command !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required field "command"' }));
          return;
        }

        // Safety Guardian Inspection
        const check = isCommandCarefulBlocked(command);
        if (check.blocked) {
          console.warn(`[Sovereign RPC] 🛑 Blocked dangerous command: "${command}" - Reason: ${check.reason}`);
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              requestId,
              stdout: '',
              stderr: check.reason,
              exitCode: 126,
              durationMs: 0,
              executedOn: 'antigravity-cloud-runner (/CAREFUL Guardian)',
              error: check.reason,
            })
          );
          return;
        }

        const start = Date.now();
        console.log(`[Sovereign RPC] ⚡ Direct directive from ${requestedBy || 'Vercel Edge'}: "${command.slice(0, 80)}"`);

        const execCwd = cwd || process.cwd();
        const execTimeout = Math.min(Math.max(Number(timeoutMs) || 30000, 1000), 120000);

        try {
          const { stdout, stderr } = await execAsync(command, {
            cwd: execCwd,
            timeout: execTimeout,
            maxBuffer: 2 * 1024 * 1024,
          });

          const durationMs = Date.now() - start;
          console.log(`[Sovereign RPC] ✅ Completed in ${durationMs}ms (exitCode 0)`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              requestId,
              stdout: stdout.trim(),
              stderr: stderr.trim(),
              exitCode: 0,
              durationMs,
              executedOn: 'antigravity-cloud-runner (Direct Sovereign RPC)',
            })
          );
        } catch (execErr: any) {
          const durationMs = Date.now() - start;
          console.warn(`[Sovereign RPC] ⚠️ Non-zero exit in ${durationMs}ms: ${execErr.message}`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              requestId,
              stdout: execErr?.stdout ? String(execErr.stdout).trim() : '',
              stderr: execErr?.stderr ? String(execErr.stderr).trim() : (execErr.message || 'Execution error'),
              exitCode: typeof execErr?.code === 'number' ? execErr.code : 1,
              durationMs,
              executedOn: 'antigravity-cloud-runner (Direct Sovereign RPC)',
              error: execErr.message,
            })
          );
        }
      } catch (parseErr: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Invalid JSON payload: ${parseErr.message}` }));
      }
    });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[Sovereign RPC Server] 🛡️ Active and listening on http://0.0.0.0:${port} (Direct Reflex Bridge ready).`);
  });

  server.on('error', (err: any) => {
    console.warn(`[Sovereign RPC Server] Error: ${err.message}`);
  });

  rpcServerInstance = server;
  return server;
}
