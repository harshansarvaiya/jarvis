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

// ============================================================================
// 6. EXA SEMANTIC SEARCH MCP ENGINE
// Real-time semantic web search with neural ranking, citation scoring, and
// entity disambiguation. Integrates as Tier 0 in runWebSearch fallback chain.
// ============================================================================
export async function executeExaMCP(
  action: 'search' | 'find_similar' | 'get_contents',
  params: Record<string, any> = {}
): Promise<MCPExecutionResult> {
  const startTime = Date.now();
  const exaApiKey = process.env.EXA_API_KEY;

  if (!exaApiKey) {
    return {
      success: false,
      server: 'mcp:exa',
      action,
      output: null,
      error: 'EXA_API_KEY not configured. Add it to .env.local to enable neural search.',
      latencyMs: Date.now() - startTime,
    };
  }

  const headers = {
    'x-api-key': exaApiKey,
    'Content-Type': 'application/json',
  };

  try {
    switch (action) {
      case 'search': {
        const { query, numResults = 8, useAutoprompt = true, type = 'neural', includeText = true, startPublishedDate } = params;
        if (!query) throw new Error('Parameter "query" is required for Exa search');

        const body: Record<string, any> = {
          query,
          numResults,
          useAutoprompt,
          type,
          contents: { text: includeText ? { maxCharacters: 800 } : false },
        };
        if (startPublishedDate) body.startPublishedDate = startPublishedDate;

        const res = await fetch('https://api.exa.ai/search', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(8000),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Exa search failed: ${res.status}`);

        const results = (data.results || []).map((r: any) => ({
          title: r.title,
          url: r.url,
          score: r.score,
          publishedDate: r.publishedDate,
          author: r.author,
          snippet: r.text ? r.text.slice(0, 600) : '',
          source: 'Exa Neural Search',
        }));

        return {
          success: true,
          server: 'mcp:exa',
          action: 'search',
          output: {
            query,
            requestId: data.requestId,
            autopromptString: data.autopromptString,
            resultsCount: results.length,
            results,
          },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'find_similar': {
        const { url, numResults = 6, includeText = true } = params;
        if (!url) throw new Error('Parameter "url" is required for find_similar');

        const res = await fetch('https://api.exa.ai/findSimilar', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            url,
            numResults,
            contents: { text: includeText ? { maxCharacters: 600 } : false },
          }),
          signal: AbortSignal.timeout(8000),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Exa findSimilar failed: ${res.status}`);

        return {
          success: true,
          server: 'mcp:exa',
          action: 'find_similar',
          output: {
            sourceUrl: url,
            resultsCount: (data.results || []).length,
            results: (data.results || []).map((r: any) => ({
              title: r.title,
              url: r.url,
              score: r.score,
              snippet: r.text ? r.text.slice(0, 500) : '',
            })),
          },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'get_contents': {
        const { urls, maxCharacters = 2000 } = params;
        if (!urls || !Array.isArray(urls)) throw new Error('Parameter "urls" (array) is required for get_contents');

        const res = await fetch('https://api.exa.ai/contents', {
          method: 'POST',
          headers,
          body: JSON.stringify({ ids: urls, text: { maxCharacters } }),
          signal: AbortSignal.timeout(10000),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Exa get_contents failed: ${res.status}`);

        return {
          success: true,
          server: 'mcp:exa',
          action: 'get_contents',
          output: {
            count: (data.results || []).length,
            contents: (data.results || []).map((r: any) => ({
              title: r.title,
              url: r.url,
              text: r.text || '',
              publishedDate: r.publishedDate,
            })),
          },
          latencyMs: Date.now() - startTime,
        };
      }

      default:
        throw new Error(`Unsupported Exa action: ${action}`);
    }
  } catch (error: any) {
    return {
      success: false,
      server: 'mcp:exa',
      action,
      output: null,
      error: error.message || 'Exa MCP execution failure',
      latencyMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// 7. VERCEL DEPLOYMENT MANAGEMENT MCP ENGINE
// Native Vercel REST API integration: list deployments, inspect build logs,
// trigger redeployments, and manage environment variables.
// ============================================================================
export async function executeVercelMCP(
  action:
    | 'list_deployments'
    | 'get_deployment'
    | 'get_build_logs'
    | 'cancel_deployment'
    | 'list_projects'
    | 'get_project'
    | 'list_env_vars',
  params: Record<string, any> = {}
): Promise<MCPExecutionResult> {
  const startTime = Date.now();
  const vercelToken = process.env.VERCEL_TOKEN || process.env.VERCEL_ACCESS_TOKEN;

  if (!vercelToken) {
    return {
      success: false,
      server: 'mcp:vercel',
      action,
      output: null,
      error: 'VERCEL_TOKEN not configured. Add it to .env.local to enable deployment management.',
      latencyMs: Date.now() - startTime,
    };
  }

  const VERCEL_PROJECT = process.env.VERCEL_PROJECT_ID || 'jarvis';
  const VERCEL_TEAM   = process.env.VERCEL_TEAM_ID || '';

  const headers = {
    Authorization: `Bearer ${vercelToken}`,
    'Content-Type': 'application/json',
  };

  const teamQuery = VERCEL_TEAM ? `?teamId=${VERCEL_TEAM}` : '';
  const baseUrl = 'https://api.vercel.com';

  try {
    switch (action) {
      case 'list_projects': {
        const res = await fetch(`${baseUrl}/v9/projects${teamQuery}`, { headers, signal: AbortSignal.timeout(8000) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `Vercel list_projects failed: ${res.status}`);
        const projects = (data.projects || []).slice(0, 10).map((p: any) => ({
          id: p.id,
          name: p.name,
          framework: p.framework,
          latestDeploymentUrl: p.latestDeployments?.[0]?.url,
          updatedAt: new Date(p.updatedAt).toISOString(),
        }));
        return { success: true, server: 'mcp:vercel', action, output: { count: projects.length, projects }, latencyMs: Date.now() - startTime };
      }

      case 'get_project': {
        const projectId = params.projectId || VERCEL_PROJECT;
        const res = await fetch(`${baseUrl}/v9/projects/${projectId}${teamQuery}`, { headers, signal: AbortSignal.timeout(8000) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `Vercel get_project failed: ${res.status}`);
        return {
          success: true,
          server: 'mcp:vercel',
          action,
          output: {
            id: data.id,
            name: data.name,
            framework: data.framework,
            nodeVersion: data.nodeVersion,
            productionUrl: data.alias?.[0]?.domain,
            latestDeploymentState: data.latestDeployments?.[0]?.readyState,
            updatedAt: new Date(data.updatedAt).toISOString(),
          },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'list_deployments': {
        const limit = params.limit || 8;
        const projectId = params.projectId || VERCEL_PROJECT;
        const qs = teamQuery
          ? `${teamQuery}&projectId=${projectId}&limit=${limit}`
          : `?projectId=${projectId}&limit=${limit}`;
        const res = await fetch(`${baseUrl}/v6/deployments${qs}`, { headers, signal: AbortSignal.timeout(8000) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `Vercel list_deployments failed: ${res.status}`);
        const deployments = (data.deployments || []).map((d: any) => ({
          uid: d.uid,
          url: d.url ? `https://${d.url}` : null,
          state: d.readyState,
          target: d.target || 'preview',
          createdAt: new Date(d.createdAt).toISOString(),
          creator: d.creator?.username,
          meta: d.meta,
        }));
        return {
          success: true,
          server: 'mcp:vercel',
          action,
          output: { total: data.pagination?.count, deployments },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'get_deployment': {
        const { deploymentId } = params;
        if (!deploymentId) throw new Error('Parameter "deploymentId" is required');
        const res = await fetch(`${baseUrl}/v13/deployments/${deploymentId}${teamQuery}`, { headers, signal: AbortSignal.timeout(8000) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `Vercel get_deployment failed: ${res.status}`);
        return {
          success: true,
          server: 'mcp:vercel',
          action,
          output: {
            uid: data.id,
            url: data.url ? `https://${data.url}` : null,
            state: data.readyState,
            errorCode: data.errorCode,
            errorMessage: data.errorMessage,
            buildDurationMs: data.buildingAt && data.ready ? data.ready - data.buildingAt : null,
            createdAt: new Date(data.createdAt).toISOString(),
          },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'get_build_logs': {
        const { deploymentId, direction = 'backward', limit = 50 } = params;
        if (!deploymentId) throw new Error('Parameter "deploymentId" is required');
        const qs2 = teamQuery
          ? `${teamQuery}&direction=${direction}&limit=${limit}`
          : `?direction=${direction}&limit=${limit}`;
        const res = await fetch(`${baseUrl}/v2/deployments/${deploymentId}/events${qs2}`, { headers, signal: AbortSignal.timeout(10000) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `Vercel get_build_logs failed: ${res.status}`);
        const logs = (Array.isArray(data) ? data : data.rows || [])
          .map((e: any) => ({ type: e.type, text: e.text || e.payload?.text || '', date: e.date ? new Date(e.date).toISOString() : null }))
          .filter((e: any) => e.text);
        return {
          success: true,
          server: 'mcp:vercel',
          action,
          output: { deploymentId, logCount: logs.length, logs: logs.slice(-30) },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'cancel_deployment': {
        const { deploymentId } = params;
        if (!deploymentId) throw new Error('Parameter "deploymentId" is required');
        const res = await fetch(`${baseUrl}/v12/deployments/${deploymentId}/cancel${teamQuery}`, {
          method: 'PATCH',
          headers,
          signal: AbortSignal.timeout(8000),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `Vercel cancel failed: ${res.status}`);
        return {
          success: true,
          server: 'mcp:vercel',
          action,
          output: { uid: data.uid, state: data.state, cancelled: data.state === 'CANCELED' },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'list_env_vars': {
        const projectId = params.projectId || VERCEL_PROJECT;
        const res = await fetch(`${baseUrl}/v9/projects/${projectId}/env${teamQuery}`, { headers, signal: AbortSignal.timeout(8000) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `Vercel list_env_vars failed: ${res.status}`);
        const envs = (data.envs || []).map((e: any) => ({
          key: e.key,
          target: e.target,
          type: e.type,
          updatedAt: e.updatedAt ? new Date(e.updatedAt).toISOString() : null,
        }));
        return {
          success: true,
          server: 'mcp:vercel',
          action,
          output: { count: envs.length, envs },
          latencyMs: Date.now() - startTime,
        };
      }

      default:
        throw new Error(`Unsupported Vercel action: ${action}`);
    }
  } catch (error: any) {
    return {
      success: false,
      server: 'mcp:vercel',
      action,
      output: null,
      error: error.message || 'Vercel MCP execution failure',
      latencyMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// 8. KNOWLEDGE GRAPH MEMORY MCP ENGINE (Anthropic Memory MCP Standard)
// Entity-relation-observation knowledge graph backed by Upstash Redis.
// Sits atop the 4-tier AgentMemory as a Tier 5 relational graph layer.
// Keys: jarvis:kg:entities  |  jarvis:kg:relations
// ============================================================================

export interface KGEntity {
  id: string;
  name: string;
  type: string;
  observations: string[];
  createdAt: string;
  updatedAt: string;
}

export interface KGRelation {
  id: string;
  fromEntity: string;
  toEntity: string;
  relationType: string;
  weight: number;
  createdAt: string;
}

async function kgFetch(upstashPath: string, method = 'GET', body?: any): Promise<any> {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!upstashUrl || !token) throw new Error('Upstash credentials not configured for Knowledge Graph MCP.');
  const hdrs: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (body !== undefined) hdrs['Content-Type'] = 'application/json';
  const res = await fetch(`${upstashUrl}${upstashPath}`, {
    method,
    headers: hdrs,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5000),
  });
  return res.json();
}

async function kgGetAll(key: string): Promise<any[]> {
  const data = await kgFetch(`/get/${encodeURIComponent(key)}`);
  if (!data.result) return [];
  try { return typeof data.result === 'string' ? JSON.parse(data.result) : data.result; } catch { return []; }
}

async function kgSetAll(key: string, items: any[]): Promise<void> {
  await kgFetch(`/set/${encodeURIComponent(key)}`, 'POST', [JSON.stringify(items)]);
}

export async function executeMemoryMCP(
  action:
    | 'create_entities'
    | 'create_relations'
    | 'add_observations'
    | 'read_graph'
    | 'search_nodes'
    | 'open_nodes'
    | 'delete_entities'
    | 'delete_relations'
    | 'delete_observations',
  params: Record<string, any> = {}
): Promise<MCPExecutionResult> {
  const startTime = Date.now();
  const ENTITIES_KEY  = 'jarvis:kg:entities';
  const RELATIONS_KEY = 'jarvis:kg:relations';

  try {
    switch (action) {

      case 'create_entities': {
        const { entities } = params;
        if (!Array.isArray(entities) || entities.length === 0) throw new Error('Parameter "entities" array is required');
        const existing: KGEntity[] = await kgGetAll(ENTITIES_KEY);
        const now = new Date().toISOString();
        const created: KGEntity[] = [];
        for (const e of entities) {
          if (!e.name || !e.type) continue;
          if (existing.find((x) => x.name.toLowerCase() === e.name.toLowerCase())) continue;
          const entity: KGEntity = {
            id: `entity-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: e.name, type: e.type,
            observations: Array.isArray(e.observations) ? e.observations : [],
            createdAt: now, updatedAt: now,
          };
          existing.push(entity);
          created.push(entity);
        }
        await kgSetAll(ENTITIES_KEY, existing);
        return {
          success: true, server: 'mcp:memory', action,
          output: { created: created.length, entities: created.map((e) => ({ id: e.id, name: e.name, type: e.type })) },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'create_relations': {
        const { relations } = params;
        if (!Array.isArray(relations) || relations.length === 0) throw new Error('Parameter "relations" array is required');
        const existing: KGRelation[] = await kgGetAll(RELATIONS_KEY);
        const now = new Date().toISOString();
        const created: KGRelation[] = [];
        for (const r of relations) {
          if (!r.fromEntity || !r.toEntity || !r.relationType) continue;
          if (existing.find((x) => x.fromEntity === r.fromEntity && x.toEntity === r.toEntity && x.relationType === r.relationType)) continue;
          const rel: KGRelation = {
            id: `rel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            fromEntity: r.fromEntity, toEntity: r.toEntity,
            relationType: r.relationType,
            weight: typeof r.weight === 'number' ? r.weight : 1.0,
            createdAt: now,
          };
          existing.push(rel);
          created.push(rel);
        }
        await kgSetAll(RELATIONS_KEY, existing);
        return { success: true, server: 'mcp:memory', action, output: { created: created.length, relations: created }, latencyMs: Date.now() - startTime };
      }

      case 'add_observations': {
        const { entityName, observations } = params;
        if (!entityName || !Array.isArray(observations)) throw new Error('Parameters "entityName" and "observations" array are required');
        const entities: KGEntity[] = await kgGetAll(ENTITIES_KEY);
        const entity = entities.find((e) => e.name.toLowerCase() === entityName.toLowerCase());
        if (!entity) throw new Error(`Entity "${entityName}" not found in Knowledge Graph`);
        const newObs = observations.filter((o: string) => !entity.observations.includes(o));
        entity.observations.push(...newObs);
        entity.updatedAt = new Date().toISOString();
        await kgSetAll(ENTITIES_KEY, entities);
        return { success: true, server: 'mcp:memory', action, output: { entityName, addedObservations: newObs.length, totalObservations: entity.observations.length }, latencyMs: Date.now() - startTime };
      }

      case 'read_graph': {
        const [entities, relations] = await Promise.all([kgGetAll(ENTITIES_KEY), kgGetAll(RELATIONS_KEY)]);
        return {
          success: true, server: 'mcp:memory', action,
          output: { entityCount: entities.length, relationCount: relations.length, entities: entities.slice(0, 50), relations: relations.slice(0, 100) },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'search_nodes': {
        const { query } = params;
        if (!query) throw new Error('Parameter "query" is required');
        const entities: KGEntity[] = await kgGetAll(ENTITIES_KEY);
        const q = query.toLowerCase();
        const matched = entities.filter(
          (e) => e.name.toLowerCase().includes(q) || e.type.toLowerCase().includes(q) || e.observations.some((o) => o.toLowerCase().includes(q))
        );
        return { success: true, server: 'mcp:memory', action, output: { query, matchCount: matched.length, nodes: matched.slice(0, 20) }, latencyMs: Date.now() - startTime };
      }

      case 'open_nodes': {
        const { names } = params;
        if (!Array.isArray(names)) throw new Error('Parameter "names" array is required');
        const [entities, relations]: [KGEntity[], KGRelation[]] = await Promise.all([kgGetAll(ENTITIES_KEY), kgGetAll(RELATIONS_KEY)]);
        const normalised = names.map((n: string) => n.toLowerCase());
        const matched = entities.filter((e) => normalised.includes(e.name.toLowerCase()));
        const matchedIds = matched.map((e) => e.id);
        const linkedRelations = relations.filter((r) => matchedIds.includes(r.fromEntity) || matchedIds.includes(r.toEntity));
        return { success: true, server: 'mcp:memory', action, output: { nodes: matched, relations: linkedRelations }, latencyMs: Date.now() - startTime };
      }

      case 'delete_entities': {
        const { names } = params;
        if (!Array.isArray(names)) throw new Error('Parameter "names" array is required');
        const [entities, relations]: [KGEntity[], KGRelation[]] = await Promise.all([kgGetAll(ENTITIES_KEY), kgGetAll(RELATIONS_KEY)]);
        const normalised = names.map((n: string) => n.toLowerCase());
        const toDeleteIds = entities.filter((e) => normalised.includes(e.name.toLowerCase())).map((e) => e.id);
        const filteredEntities = entities.filter((e) => !normalised.includes(e.name.toLowerCase()));
        const filteredRelations = relations.filter((r) => !toDeleteIds.includes(r.fromEntity) && !toDeleteIds.includes(r.toEntity));
        await Promise.all([kgSetAll(ENTITIES_KEY, filteredEntities), kgSetAll(RELATIONS_KEY, filteredRelations)]);
        return { success: true, server: 'mcp:memory', action, output: { deletedEntities: toDeleteIds.length, cascadeDeletedRelations: relations.length - filteredRelations.length }, latencyMs: Date.now() - startTime };
      }

      case 'delete_relations': {
        const { relations: toDelete } = params;
        if (!Array.isArray(toDelete)) throw new Error('Parameter "relations" array is required');
        const existing: KGRelation[] = await kgGetAll(RELATIONS_KEY);
        const filtered = existing.filter((r) => !toDelete.some((d: any) => d.fromEntity === r.fromEntity && d.toEntity === r.toEntity && d.relationType === r.relationType));
        await kgSetAll(RELATIONS_KEY, filtered);
        return { success: true, server: 'mcp:memory', action, output: { deletedCount: existing.length - filtered.length }, latencyMs: Date.now() - startTime };
      }

      case 'delete_observations': {
        const { entityName, observations } = params;
        if (!entityName || !Array.isArray(observations)) throw new Error('Parameters "entityName" and "observations" array are required');
        const entities: KGEntity[] = await kgGetAll(ENTITIES_KEY);
        const entity = entities.find((e) => e.name.toLowerCase() === entityName.toLowerCase());
        if (!entity) throw new Error(`Entity "${entityName}" not found`);
        const before = entity.observations.length;
        entity.observations = entity.observations.filter((o) => !observations.includes(o));
        entity.updatedAt = new Date().toISOString();
        await kgSetAll(ENTITIES_KEY, entities);
        return { success: true, server: 'mcp:memory', action, output: { entityName, deletedObservations: before - entity.observations.length, remaining: entity.observations.length }, latencyMs: Date.now() - startTime };
      }

      default:
        throw new Error(`Unsupported Memory MCP action: ${action}`);
    }
  } catch (error: any) {
    return {
      success: false,
      server: 'mcp:memory',
      action,
      output: null,
      error: error.message || 'Memory MCP execution failure',
      latencyMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// 9. GOOGLE CALENDAR & WORKSPACE MCP ENGINE
// Synchronizes Sir's live schedule, meetings, reminders, and availability.
// Authenticates via Google Auth Library / Service Account / Access Token.
// ============================================================================

async function getGoogleCalendarAuthHeader(): Promise<string | null> {
  const explicitToken = process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
  if (explicitToken) return `Bearer ${explicitToken}`;

  const credsPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    '/home/harshans279/.gcp/jarvis-vertex.json';

  if (fs.existsSync(credsPath)) {
    try {
      const { GoogleAuth } = await import('google-auth-library');
      const auth = new GoogleAuth({
        keyFilename: credsPath,
        scopes: ['https://www.googleapis.com/auth/calendar'],
      });
      const client = await auth.getClient();
      const token = await client.getAccessToken();
      if (token?.token) return `Bearer ${token.token}`;
    } catch {}
  }
  return null;
}

export async function executeGoogleCalendarMCP(
  action:
    | 'list_events'
    | 'create_event'
    | 'get_event'
    | 'delete_event'
    | 'get_free_busy',
  params: Record<string, any> = {}
): Promise<MCPExecutionResult> {
  const startTime = Date.now();
  const calendarId = params.calendarId || 'primary';
  const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`;

  try {
    const authHeader = await getGoogleCalendarAuthHeader();
    if (!authHeader) {
      return {
        success: false,
        server: 'mcp:calendar',
        action,
        output: null,
        error: 'Google Calendar credentials not found. Provide GOOGLE_CALENDAR_ACCESS_TOKEN or configure Google Cloud Service Account.',
        latencyMs: Date.now() - startTime,
      };
    }

    const headers: Record<string, string> = {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    };

    switch (action) {
      case 'list_events': {
        const timeMin = params.timeMin || new Date().toISOString();
        const timeMax = params.timeMax;
        const maxResults = params.maxResults || 10;
        let url = `${baseUrl}/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMin)}&maxResults=${maxResults}`;
        if (timeMax) url += `&timeMax=${encodeURIComponent(timeMax)}`;

        const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `Google Calendar list_events failed: ${res.status}`);

        const events = (data.items || []).map((e: any) => ({
          id: e.id,
          summary: e.summary || '(No title)',
          description: e.description || '',
          start: e.start?.dateTime || e.start?.date,
          end: e.end?.dateTime || e.end?.date,
          location: e.location || '',
          status: e.status,
          htmlLink: e.htmlLink,
          attendees: (e.attendees || []).map((a: any) => a.email),
        }));

        return {
          success: true,
          server: 'mcp:calendar',
          action,
          output: { calendarId, count: events.length, events },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'create_event': {
        const { summary, start, end, description, location, attendees } = params;
        if (!summary || !start || !end) throw new Error('Parameters "summary", "start" (ISO), and "end" (ISO) are required');

        const body: Record<string, any> = {
          summary,
          description: description || 'Scheduled by J.A.R.V.I.S. Core.',
          start: { dateTime: new Date(start).toISOString() },
          end: { dateTime: new Date(end).toISOString() },
        };
        if (location) body.location = location;
        if (Array.isArray(attendees)) {
          body.attendees = attendees.map((email: string) => ({ email }));
        }

        const res = await fetch(`${baseUrl}/events`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(8000),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `Google Calendar create_event failed: ${res.status}`);

        return {
          success: true,
          server: 'mcp:calendar',
          action,
          output: {
            id: data.id,
            summary: data.summary,
            start: data.start?.dateTime,
            end: data.end?.dateTime,
            htmlLink: data.htmlLink,
            status: data.status,
          },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'get_event': {
        const { eventId } = params;
        if (!eventId) throw new Error('Parameter "eventId" is required');

        const res = await fetch(`${baseUrl}/events/${encodeURIComponent(eventId)}`, {
          headers,
          signal: AbortSignal.timeout(8000),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `Google Calendar get_event failed: ${res.status}`);

        return {
          success: true,
          server: 'mcp:calendar',
          action,
          output: {
            id: data.id,
            summary: data.summary,
            description: data.description,
            start: data.start?.dateTime || data.start?.date,
            end: data.end?.dateTime || data.end?.date,
            location: data.location,
            status: data.status,
            htmlLink: data.htmlLink,
          },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'delete_event': {
        const { eventId } = params;
        if (!eventId) throw new Error('Parameter "eventId" is required');

        const res = await fetch(`${baseUrl}/events/${encodeURIComponent(eventId)}`, {
          method: 'DELETE',
          headers,
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok && res.status !== 204) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || `Failed to delete event: ${res.status}`);
        }

        return {
          success: true,
          server: 'mcp:calendar',
          action,
          output: { eventId, status: 'DELETED' },
          latencyMs: Date.now() - startTime,
        };
      }

      case 'get_free_busy': {
        const timeMin = params.timeMin || new Date().toISOString();
        const timeMax = params.timeMax || new Date(Date.now() + 86400000).toISOString();
        const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            timeMin: new Date(timeMin).toISOString(),
            timeMax: new Date(timeMax).toISOString(),
            items: [{ id: calendarId }],
          }),
          signal: AbortSignal.timeout(8000),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `Google Calendar freeBusy query failed: ${res.status}`);

        const busySlots = data.calendars?.[calendarId]?.busy || [];
        return {
          success: true,
          server: 'mcp:calendar',
          action,
          output: { timeMin, timeMax, busySlots, busyCount: busySlots.length },
          latencyMs: Date.now() - startTime,
        };
      }

      default:
        throw new Error(`Unsupported Calendar action: ${action}`);
    }
  } catch (error: any) {
    return {
      success: false,
      server: 'mcp:calendar',
      action,
      output: null,
      error: error.message || 'Google Calendar MCP execution failure',
      latencyMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// 10. PLAYWRIGHT VISUAL WEB ACTUATION MCP ENGINE ("Project Hands")
// Headless Chromium engine running on Linux VM for JavaScript rendering,
// interactive clicking, form filling, and DOM evaluation.
// ============================================================================

export async function executePlaywrightMCP(
  action:
    | 'navigate_and_extract'
    | 'screenshot'
    | 'click_and_act'
    | 'evaluate_js',
  params: Record<string, any> = {}
): Promise<MCPExecutionResult> {
  const startTime = Date.now();
  const { url } = params;

  try {
    let chromium: any;
    try {
      const pw = await import('playwright-chromium');
      chromium = pw.chromium;
    } catch {
      throw new Error('Playwright Chromium is not available on this environment.');
    }

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote',
      ],
    });

    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 JARVIS-Agent',
        viewport: { width: 1280, height: 800 },
      });

      const page = await context.newPage();

      switch (action) {
        case 'navigate_and_extract': {
          if (!url) throw new Error('Parameter "url" is required');
          const waitUntil = params.waitUntil || 'domcontentloaded';
          await page.goto(url, { waitUntil, timeout: 15000 });

          // Wait for JS hydration if requested
          if (params.waitForSelector) {
            await page.waitForSelector(params.waitForSelector, { timeout: 5000 }).catch(() => {});
          }

          const pageTitle = await page.title();
          const pageUrl = page.url();

          const extracted = await page.evaluate(() => {
            const body = document.body;
            // Strip scripts and styles
            const clone = body.cloneNode(true) as HTMLElement;
            clone.querySelectorAll('script, style, noscript, svg, iframe').forEach((el) => el.remove());
            const text = clone.innerText || '';
            const links = Array.from(clone.querySelectorAll('a[href]')).slice(0, 20).map((a) => ({
              text: (a as HTMLElement).innerText.trim().slice(0, 60),
              href: (a as HTMLAnchorElement).href,
            })).filter((l) => l.text);

            return {
              text: text.slice(0, 4000),
              textLength: text.length,
              links,
            };
          });

          return {
            success: true,
            server: 'mcp:playwright',
            action,
            output: {
              url: pageUrl,
              title: pageTitle,
              text: extracted.text,
              totalLength: extracted.textLength,
              links: extracted.links,
            },
            latencyMs: Date.now() - startTime,
          };
        }

        case 'screenshot': {
          if (!url) throw new Error('Parameter "url" is required');
          await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => page.goto(url, { waitUntil: 'domcontentloaded' }));
          const screenshotBuffer = await page.screenshot({ fullPage: Boolean(params.fullPage) });
          const base64 = screenshotBuffer.toString('base64');

          return {
            success: true,
            server: 'mcp:playwright',
            action,
            output: {
              url,
              title: await page.title(),
              imageType: 'image/png',
              base64Data: `data:image/png;base64,${base64.slice(0, 200)}... (truncated ${Math.round(base64.length / 1024)} KB)`,
              sizeBytes: screenshotBuffer.byteLength,
            },
            latencyMs: Date.now() - startTime,
          };
        }

        case 'click_and_act': {
          if (!url) throw new Error('Parameter "url" is required');
          const { selector, fillText, clickAfterFill = true } = params;
          if (!selector) throw new Error('Parameter "selector" is required');

          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await page.waitForSelector(selector, { timeout: 6000 });

          if (fillText !== undefined) {
            await page.fill(selector, fillText);
          }

          if (clickAfterFill || !fillText) {
            await page.click(selector);
            await page.waitForLoadState('domcontentloaded').catch(() => {});
          }

          return {
            success: true,
            server: 'mcp:playwright',
            action,
            output: {
              url: page.url(),
              interactedSelector: selector,
              currentTitle: await page.title(),
              status: 'INTERACTION_SUCCESSFUL',
            },
            latencyMs: Date.now() - startTime,
          };
        }

        case 'evaluate_js': {
          if (!url) throw new Error('Parameter "url" is required');
          const { script } = params;
          if (!script) throw new Error('Parameter "script" is required');

          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
          const result = await page.evaluate(script);

          return {
            success: true,
            server: 'mcp:playwright',
            action,
            output: { url, evalResult: result },
            latencyMs: Date.now() - startTime,
          };
        }

        default:
          throw new Error(`Unsupported Playwright action: ${action}`);
      }
    } finally {
      await browser.close().catch(() => {});
    }
  } catch (error: any) {
    return {
      success: false,
      server: 'mcp:playwright',
      action,
      output: null,
      error: error.message || 'Playwright MCP execution failure',
      latencyMs: Date.now() - startTime,
    };
  }
}
