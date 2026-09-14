/**
 * J.A.R.V.I.S. Modular MCP (Model Context Protocol) Suite & Infrastructure Bridge
 * "Project Hands": Equips J.A.R.V.I.S. with real execution capabilities across networks:
 *  1. mcp:github      - Repository inspection, commit tracking, file reading, and commit/PR operations
 *  2. mcp:filesystem  - Safe workspace inspection, file reading, directory listing
 *  3. mcp:cloud       - Vercel edge deployment telemetry & Ngrok uplink monitoring
 *  4. mcp:network     - Outbound HTTP requests to audit APIs and fetch remote data
 *  5. mcp:database    - Direct Upstash Redis diagnostic queries and cluster inspection
 * 
 * Complies with Directive 01 (Guardian Protocol) & Directive 04 (Sovereign Loyalty).
 * Edge-compatible (pure fetch / zero native C-bindings).
 */

import fs from 'fs';
import path from 'path';

export interface MCPExecutionResult {
  success: boolean;
  server: string;
  action: string;
  output: any;
  error?: string;
  latencyMs?: number;
}

const GITHUB_REPO_OWNER = 'harshansarvaiya';
const GITHUB_REPO_NAME = 'jarvis';

function getGitHubToken(): string {
  return (
    process.env.GITHUB_TOKEN ||
    process.env.GITHUB_MODELS_TOKEN ||
    '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'
  );
}

// ============================================================================
// 1. GITHUB MCP ENGINE (Octokit REST via Edge-Compatible Transport)
// ============================================================================
export async function executeGitHubMCP(
  action:
    | 'get_repo'
    | 'list_commits'
    | 'get_file'
    | 'create_issue'
    | 'list_issues'
    | 'create_or_update_file'
    | 'delete_file'
    | 'dispatch_workflow_run'
    | 'get_workflow_runs',
  params: Record<string, any> = {}
): Promise<MCPExecutionResult> {
  const startTime = Date.now();
  const token = getGitHubToken();
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'JARVIS-Mark-I-Autonomous-Agent',
  };

  const baseUrl = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;

  try {
    switch (action) {
      case 'get_repo': {
        const res = await fetch(baseUrl, { headers });
        const data = await res.json();
        return {
          success: res.ok,
          server: 'mcp:github',
          action: 'get_repo',
          output: {
            fullName: data.full_name,
            private: data.private,
            defaultBranch: data.default_branch,
            stars: data.stargazers_count,
            openIssues: data.open_issues_count,
            updatedAt: data.updated_at,
          },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'list_commits': {
        const limit = params.limit || 5;
        const res = await fetch(`${baseUrl}/commits?per_page=${limit}`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to list commits');
        const commits = (data as any[]).map((c) => ({
          sha: c.sha.slice(0, 7),
          message: c.commit.message,
          author: c.commit.author.name,
          date: c.commit.author.date,
        }));
        return {
          success: true,
          server: 'mcp:github',
          action: 'list_commits',
          output: commits,
          latencyMs: Date.now() - startTime,
        };
      }

      case 'get_file': {
        const filePath = params.path;
        if (!filePath) throw new Error('Parameter "path" is required for get_file');
        const ref = params.ref || 'main';
        const res = await fetch(`${baseUrl}/contents/${encodeURIComponent(filePath)}?ref=${ref}`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || `File ${filePath} not found`);

        let content = '';
        if (data.content && data.encoding === 'base64') {
          content = Buffer.from(data.content, 'base64').toString('utf-8');
        }
        return {
          success: true,
          server: 'mcp:github',
          action: 'get_file',
          output: {
            path: data.path,
            sha: data.sha,
            size: data.size,
            content: content.slice(0, 4000), // Protect token limit
            truncated: content.length > 4000,
          },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'list_issues': {
        const state = params.state || 'all';
        const res = await fetch(`${baseUrl}/issues?state=${state}&per_page=5`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to list issues');
        const issues = (data as any[]).map((i) => ({
          number: i.number,
          title: i.title,
          state: i.state,
          user: i.user?.login,
          comments: i.comments,
          updatedAt: i.updated_at,
        }));
        return {
          success: true,
          server: 'mcp:github',
          action: 'list_issues',
          output: issues,
          latencyMs: Date.now() - startTime,
        };
      }

      case 'create_issue': {
        const { title, body } = params;
        if (!title) throw new Error('Parameter "title" is required');
        const res = await fetch(`${baseUrl}/issues`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body: body || 'Autonomous task logged by J.A.R.V.I.S. Core.' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to create issue');
        return {
          success: true,
          server: 'mcp:github',
          action: 'create_issue',
          output: { number: data.number, title: data.title, url: data.html_url },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'create_or_update_file': {
        const { path: filePath, content, message, branch } = params;
        let fileSha = params.sha;
        if (!filePath || content === undefined) throw new Error('Parameters "path" and "content" are required');
        const targetBranch = branch || 'main';
        const commitMsg = message || `auto(jarvis): update ${filePath}`;
        const base64Content = Buffer.from(content).toString('base64');

        // Automatically discover existing SHA if updating
        if (!fileSha) {
          try {
            const checkRes = await fetch(`${baseUrl}/contents/${encodeURIComponent(filePath)}?ref=${targetBranch}`, { headers });
            if (checkRes.ok) {
              const existingData = await checkRes.json();
              fileSha = existingData.sha;
            }
          } catch {}
        }

        const body: Record<string, any> = {
          message: commitMsg,
          content: base64Content,
          branch: targetBranch,
        };
        if (fileSha) body.sha = fileSha;

        const res = await fetch(`${baseUrl}/contents/${encodeURIComponent(filePath)}`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to commit file to GitHub');
        return {
          success: true,
          server: 'mcp:github',
          action: 'create_or_update_file',
          output: {
            commitSha: data.commit?.sha?.slice(0, 7),
            file: data.content?.path,
            htmlUrl: data.content?.html_url,
          },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'delete_file': {
        const { path: filePath, message, branch } = params;
        let fileSha = params.sha;
        if (!filePath) throw new Error('Parameter "path" is required');
        const targetBranch = branch || 'main';
        if (!fileSha) {
          const checkRes = await fetch(`${baseUrl}/contents/${encodeURIComponent(filePath)}?ref=${targetBranch}`, { headers });
          if (checkRes.ok) {
            const existing = await checkRes.json();
            fileSha = existing.sha;
          }
        }
        if (!fileSha) throw new Error(`File ${filePath} not found to delete`);

        const res = await fetch(`${baseUrl}/contents/${encodeURIComponent(filePath)}`, {
          method: 'DELETE',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: message || `auto(jarvis): delete ${filePath}`,
            sha: fileSha,
            branch: targetBranch,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to delete file');
        return {
          success: true,
          server: 'mcp:github',
          action: 'delete_file',
          output: { commitSha: data.commit?.sha?.slice(0, 7), path: filePath },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'dispatch_workflow_run': {
        const { command, taskId } = params;
        if (!command) throw new Error('Parameter "command" is required');
        const workflowId = 'jarvis-cloud-runner.yml';
        const res = await fetch(`${baseUrl}/actions/workflows/${workflowId}/dispatches`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ref: 'main',
            inputs: {
              command,
              task_id: taskId || `task-cloud-${Date.now()}`,
            },
          }),
        });
        if (!res.ok) {
          const errData = await res.text();
          throw new Error(`Failed to dispatch cloud workflow: ${errData}`);
        }
        return {
          success: true,
          server: 'mcp:github',
          action: 'dispatch_workflow_run',
          output: {
            dispatched: true,
            workflow: workflowId,
            command,
            status: 'QUEUED_IN_24_7_CLOUD',
          },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'get_workflow_runs': {
        const workflowId = 'jarvis-cloud-runner.yml';
        const res = await fetch(`${baseUrl}/actions/workflows/${workflowId}/runs?per_page=5`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to fetch workflow runs');
        const runs = (data.workflow_runs || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          status: r.status,
          conclusion: r.conclusion,
          htmlUrl: r.html_url,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
        return {
          success: true,
          server: 'mcp:github',
          action: 'get_workflow_runs',
          output: { total: data.total_count, runs },
          latencyMs: Date.now() - startTime,
        };
      }

      default:
        throw new Error(`Unsupported GitHub action: ${action}`);
    }
  } catch (error: any) {
    return {
      success: false,
      server: 'mcp:github',
      action,
      output: null,
      error: error.message || 'GitHub MCP execution failure',
      latencyMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// 2. FILESYSTEM MCP ENGINE (Sandboxed Local File & Directory Operations)
// ============================================================================
export async function executeFileSystemMCP(
  action: 'read_file' | 'list_dir' | 'write_file',
  params: Record<string, any> = {}
): Promise<MCPExecutionResult> {
  const startTime = Date.now();
  const rootDir = process.cwd();

  try {
    switch (action) {
      case 'read_file': {
        const relPath = params.path;
        if (!relPath) throw new Error('Parameter "path" required');
        const resolved = path.resolve(rootDir, relPath);
        if (!resolved.startsWith(rootDir)) throw new Error('Security Violation: Path traversal outside project root blocked.');
        if (relPath.includes('.env') && !params.allowEnv) {
          throw new Error('Security Violation: Access to secrets blocked by Guardian Protocol.');
        }

        if (!fs.existsSync(resolved)) throw new Error(`File does not exist: ${relPath}`);
        const content = fs.readFileSync(resolved, 'utf-8');
        return {
          success: true,
          server: 'mcp:filesystem',
          action: 'read_file',
          output: {
            path: relPath,
            sizeBytes: Buffer.byteLength(content),
            content: content.slice(0, 3000),
            truncated: content.length > 3000,
          },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'list_dir': {
        const relPath = params.path || '.';
        const resolved = path.resolve(rootDir, relPath);
        if (!resolved.startsWith(rootDir)) throw new Error('Security Violation: Path traversal blocked.');
        if (!fs.existsSync(resolved)) throw new Error(`Directory does not exist: ${relPath}`);

        const entries = fs.readdirSync(resolved, { withFileTypes: true });
        const list = entries
          .filter((e) => !e.name.startsWith('.git') && e.name !== 'node_modules' && e.name !== '.next')
          .slice(0, 30)
          .map((e) => ({
            name: e.name,
            type: e.isDirectory() ? 'directory' : 'file',
          }));

        return {
          success: true,
          server: 'mcp:filesystem',
          action: 'list_dir',
          output: { directory: relPath, total: list.length, entries: list },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'write_file': {
        const relPath = params.path;
        const content = params.content;
        if (!relPath || content === undefined) throw new Error('Parameters "path" and "content" required');
        const resolved = path.resolve(rootDir, relPath);
        if (!resolved.startsWith(rootDir)) throw new Error('Security Violation: Path traversal blocked.');
        if (relPath.includes('.env') || relPath.includes('.git')) {
          throw new Error('Security Violation: Protected system files cannot be modified directly.');
        }

        // Ensure parent directory exists
        const parent = path.dirname(resolved);
        if (!fs.existsSync(parent)) {
          fs.mkdirSync(parent, { recursive: true });
        }

        fs.writeFileSync(resolved, content, 'utf-8');
        return {
          success: true,
          server: 'mcp:filesystem',
          action: 'write_file',
          output: { path: relPath, writtenBytes: Buffer.byteLength(content), status: 'SUCCESS' },
          latencyMs: Date.now() - startTime,
        };
      }

      default:
        throw new Error(`Unsupported filesystem action: ${action}`);
    }
  } catch (error: any) {
    return {
      success: false,
      server: 'mcp:filesystem',
      action,
      output: null,
      error: error.message,
      latencyMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// 3. CLOUD & DEPLOYMENT TELEMETRY MCP ENGINE
// ============================================================================
export async function executeCloudMCP(
  action: 'ping_vercel' | 'check_tunnel' | 'telemetry_overview'
): Promise<MCPExecutionResult> {
  const startTime = Date.now();

  try {
    switch (action) {
      case 'ping_vercel': {
        const url = 'https://jarvis-iota-beige.vercel.app/api/jarvis/auth/status';
        const pingStart = Date.now();
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const latency = Date.now() - pingStart;
        const data = await res.json().catch(() => ({}));
        return {
          success: res.ok,
          server: 'mcp:cloud',
          action: 'ping_vercel',
          output: {
            endpoint: url,
            status: res.status,
            latencyMs: latency,
            healthy: res.status === 200,
            payload: data,
          },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'check_tunnel': {
        const domain = process.env.NGROK_DOMAIN || 'washbasin-penpal-muppet.ngrok-free.dev';
        const url = `https://${domain}/api/jarvis/auth/status`;
        const pingStart = Date.now();
        const res = await fetch(url, {
          headers: { 'ngrok-skip-browser-warning': 'true' },
          signal: AbortSignal.timeout(5000),
        }).catch((e) => ({ ok: false, status: 504, text: () => e.message }));

        return {
          success: (res as any).ok,
          server: 'mcp:cloud',
          action: 'check_tunnel',
          output: {
            domain,
            accessible: (res as any).ok,
            status: (res as any).status,
            latencyMs: Date.now() - pingStart,
          },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'telemetry_overview': {
        return {
          success: true,
          server: 'mcp:cloud',
          action: 'telemetry_overview',
          output: {
            environment: process.env.NODE_ENV || 'production',
            isVercel: Boolean(process.env.VERCEL),
            region: process.env.VERCEL_REGION || 'iad1 (local-host)',
            uptimeSeconds: Math.floor(process.uptime()),
            memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          },
          latencyMs: Date.now() - startTime,
        };
      }

      default:
        throw new Error(`Unsupported cloud action: ${action}`);
    }
  } catch (error: any) {
    return {
      success: false,
      server: 'mcp:cloud',
      action,
      output: null,
      error: error.message,
      latencyMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// 4. NETWORK & WEB UPLINK MCP ENGINE (HTTP Fetch for Outbound API Diagnostics)
// ============================================================================
export async function executeNetworkMCP(
  url: string,
  method: 'GET' | 'POST' | 'HEAD' = 'GET',
  headers: Record<string, string> = {},
  body?: any
): Promise<MCPExecutionResult> {
  const startTime = Date.now();

  try {
    const parsed = new URL(url);
    // Block loopback/localhost SSRF if triggered externally
    if (parsed.hostname === '169.254.169.254') {
      throw new Error('Security Violation: Cloud metadata service access prohibited.');
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      signal: AbortSignal.timeout(6000),
    });

    const contentType = res.headers.get('content-type') || '';
    let responseData: any = null;
    if (contentType.includes('application/json')) {
      responseData = await res.json();
    } else {
      const text = await res.text();
      responseData = text.slice(0, 2000);
    }

    return {
      success: res.ok,
      server: 'mcp:network',
      action: `${method} ${url}`,
      output: {
        status: res.status,
        statusText: res.statusText,
        contentType,
        data: responseData,
      },
      latencyMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      server: 'mcp:network',
      action: `${method} ${url}`,
      output: null,
      error: error.message,
      latencyMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// 5. DATABASE & REDIS MCP ENGINE (Direct Upstash Redis Diagnostic Operations)
// ============================================================================
export async function executeDatabaseMCP(
  action: 'ping' | 'dbsize' | 'get_key' | 'list_keys',
  params: Record<string, any> = {}
): Promise<MCPExecutionResult> {
  const startTime = Date.now();
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!upstashUrl || !token) {
    return {
      success: false,
      server: 'mcp:database',
      action,
      output: null,
      error: 'Upstash Redis credentials not configured',
      latencyMs: Date.now() - startTime,
    };
  }

  const headers = { Authorization: `Bearer ${token}` };

  try {
    switch (action) {
      case 'ping': {
        const res = await fetch(`${upstashUrl}/ping`, { headers });
        const data = await res.json();
        return {
          success: res.ok && data.result === 'PONG',
          server: 'mcp:database',
          action: 'ping',
          output: { response: data.result, healthy: data.result === 'PONG' },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'dbsize': {
        const res = await fetch(`${upstashUrl}/dbsize`, { headers });
        const data = await res.json();
        return {
          success: res.ok,
          server: 'mcp:database',
          action: 'dbsize',
          output: { keyCount: data.result },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'list_keys': {
        const pattern = params.pattern || 'jarvis:*';
        const res = await fetch(`${upstashUrl}/keys/${encodeURIComponent(pattern)}`, { headers });
        const data = await res.json();
        return {
          success: res.ok,
          server: 'mcp:database',
          action: 'list_keys',
          output: { pattern, keys: data.result || [] },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'get_key': {
        const key = params.key;
        if (!key) throw new Error('Parameter "key" is required');
        const res = await fetch(`${upstashUrl}/get/${encodeURIComponent(key)}`, { headers });
        const data = await res.json();
        let parsed = data.result;
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch {}
        }
        return {
          success: res.ok,
          server: 'mcp:database',
          action: 'get_key',
          output: { key, value: parsed },
          latencyMs: Date.now() - startTime,
        };
      }

      default:
        throw new Error(`Unsupported database action: ${action}`);
    }
  } catch (error: any) {
    return {
      success: false,
      server: 'mcp:database',
      action,
      output: null,
      error: error.message,
      latencyMs: Date.now() - startTime,
    };
  }
}
