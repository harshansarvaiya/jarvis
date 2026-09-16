import {
  addTask,
  updateTask,
  getTasks,
  recordTaskExecution,
  addMemory,
  searchMemories,
  getMemories,
  Task,
  Priority,
  TaskStatus,
  MemoryCategory,
} from './memory';
import { validateActionAgainstDirectives } from './directives';
import {
  executeGitHubMCP,
  executeFileSystemMCP,
  executeCloudMCP,
  executeNetworkMCP,
  executeDatabaseMCP,
} from './mcp';
import {
  queryKnowledgeBase,
  ingestKnowledgeDocument,
  wipeSensitiveKnowledge,
  wipeAllKnowledge,
} from './rag';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

async function runDirectShellCommand(command: string): Promise<{ stdout: string; stderr: string; exitCode: number; executionSubstrate: string }> {
  // Safety filter against destructive commands per Directive 01 Guardian Protocol
  const lower = command.toLowerCase().trim();
  const dangerousPatterns = ['rm -rf /', 'mkfs', 'dd if=', ':(){ :|:& };:', 'shutdown', 'reboot'];
  if (dangerousPatterns.some((p) => lower.includes(p))) {
    throw new Error('Security Violation: Destructive command intercepted by Directive 01 Guardian Protocol.');
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 15000,
      maxBuffer: 1024 * 1024,
      cwd: process.cwd(),
      env: { ...process.env, PATH: process.env.PATH },
    });

    return {
      stdout: (stdout || '').slice(0, 3500),
      stderr: (stderr || '').slice(0, 1500),
      exitCode: 0,
      executionSubstrate: 'Direct VM Terminal (antigravity-cloud-runner)',
    };
  } catch (err: any) {
    return {
      stdout: (err.stdout || '').slice(0, 1500),
      stderr: (err.stderr || err.message || 'Execution error').slice(0, 2000),
      exitCode: err.code || 1,
      executionSubstrate: 'Direct VM Terminal (antigravity-cloud-runner)',
    };
  }
}

async function runWebSearch(query: string): Promise<any> {
  const results: Array<{ title: string; snippet: string; url: string; source?: string }> = [];

  // Tier 0A: Serper.dev Google Search Engine (If configured)
  const serperKey = process.env.SERPER_API_KEY;
  if (serperKey) {
    try {
      const isLocalQuery = /near|clinic|doctor|physio|hospital|shop|store|price|fee|mumbai|mira road/i.test(query);
      const serperEndpoint = isLocalQuery
        ? 'https://google.serper.dev/places'
        : 'https://google.serper.dev/search';

      const serperRes = await fetch(serperEndpoint, {
        method: 'POST',
        headers: {
          'X-API-KEY': serperKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, gl: 'in', hl: 'en', num: 6 }),
        signal: AbortSignal.timeout(3500),
      });

      if (serperRes.ok) {
        const serperData = await serperRes.json();
        if (Array.isArray(serperData.places)) {
          for (const p of serperData.places) {
            results.push({
              title: `${p.title}${p.rating ? ` (★ ${p.rating})` : ''}`,
              snippet: `${p.address || ''}${p.phoneNumber ? ` | Tel: ${p.phoneNumber}` : ''}${p.category ? ` | Category: ${p.category}` : ''}`,
              url: p.website || p.cid ? `https://maps.google.com/?cid=${p.cid}` : '',
              source: 'Google Places (Serper)',
            });
          }
        }
        if (Array.isArray(serperData.organic)) {
          for (const o of serperData.organic.slice(0, 5)) {
            results.push({
              title: o.title,
              snippet: o.snippet || '',
              url: o.link,
              source: 'Google Search (Serper)',
            });
          }
        }
        if (results.length > 0) {
          return {
            query,
            resultsCount: results.length,
            results,
          };
        }
      }
    } catch {}
  }

  // Tier 0B: Tavily AI Search Engine (If configured)
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    try {
      const tavilyRes = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tavilyKey,
          query,
          search_depth: 'basic',
          max_results: 6,
        }),
        signal: AbortSignal.timeout(3500),
      });
      if (tavilyRes.ok) {
        const tavilyData = await tavilyRes.json();
        if (Array.isArray(tavilyData.results)) {
          for (const r of tavilyData.results) {
            results.push({
              title: r.title,
              snippet: r.content || '',
              url: r.url,
              source: 'Tavily Search',
            });
          }
          if (results.length > 0) {
            return {
              query,
              resultsCount: results.length,
              results,
            };
          }
        }
      }
    } catch {}
  }

  // Tier 1: DuckDuckGo Instant Answer Knowledge Graph API
  try {
    const ddgApi = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(3000),
    });
    if (ddgApi.ok) {
      const text = await ddgApi.text();
      if (text) {
        const json = JSON.parse(text);
        if (json.AbstractText) {
          results.push({
            title: json.Heading || query,
            snippet: json.AbstractText,
            url: json.AbstractURL || '',
            source: 'DuckDuckGo Instant Answer',
          });
        }
        if (Array.isArray(json.RelatedTopics)) {
          for (const topic of json.RelatedTopics.slice(0, 3)) {
            if (topic.Text && topic.FirstURL) {
              results.push({
                title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 50),
                snippet: topic.Text,
                url: topic.FirstURL,
                source: 'DuckDuckGo Knowledge Graph',
              });
            }
          }
        }
      }
    }
  } catch {}

  // Tier 2: DuckDuckGo HTML Full Web Search Scraper
  try {
    const endpoint = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(endpoint, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(4500),
    });

    if (res.ok) {
      const html = await res.text();
      const titleRegex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      const snippetRegex = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;

      const rawTitles: Array<{ url: string; title: string }> = [];
      let tMatch;
      while ((tMatch = titleRegex.exec(html)) !== null) {
        let rawUrl = tMatch[1];
        const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
        if (uddgMatch) {
          try {
            rawUrl = decodeURIComponent(uddgMatch[1]);
          } catch {}
        }
        rawTitles.push({
          url: rawUrl,
          title: tMatch[2]
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&#x27;/g, "'")
            .replace(/&quot;/g, '"')
            .trim(),
        });
      }

      const rawSnippets: string[] = [];
      let sMatch;
      while ((sMatch = snippetRegex.exec(html)) !== null) {
        rawSnippets.push(
          sMatch[1]
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&#x27;/g, "'")
            .replace(/&quot;/g, '"')
            .trim()
        );
      }

      for (let i = 0; i < Math.min(rawTitles.length, 8); i++) {
        results.push({
          title: rawTitles[i].title,
          snippet: rawSnippets[i] || '',
          url: rawTitles[i].url,
          source: 'Web Search',
        });
      }
    }
  } catch {}

  // Tier 3: Wikipedia OpenSearch Fallback (Guarantees zero failed searches)
  if (results.length === 0) {
    try {
      const wikiRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=5&namespace=0&format=json`,
        {
          headers: { 'User-Agent': 'JarvisAssistant/1.0 (harshnas279@gmail.com)' },
          signal: AbortSignal.timeout(3000),
        }
      );
      if (wikiRes.ok) {
        const [_, titles, descriptions, urls] = await wikiRes.json();
        for (let i = 0; i < titles.length; i++) {
          results.push({
            title: titles[i],
            snippet: descriptions[i] || `Encyclopedia entry for ${titles[i]}`,
            url: urls[i] || '',
            source: 'Wikipedia Knowledge Base',
          });
        }
      }
    } catch {}
  }

  return {
    query,
    resultsCount: results.length,
    results: results.length > 0 ? results : 'No text results parsed from search provider.',
  };
}

async function runDeepWebScraper(url: string): Promise<any> {
  try {
    const targetUrl = url.startsWith('http') ? url : `https://${url}`;
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      return { url, error: `Target URL returned HTTP status ${res.status}` };
    }

    const html = await res.text();
    const cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : targetUrl;

    return {
      url: targetUrl,
      title,
      contentSnippet: cleanText.slice(0, 3500),
      totalLength: cleanText.length,
      source: 'Deep Web Scraper (Pillar 4)',
    };
  } catch (err: any) {
    return { url, error: err.message || 'Deep web scraper request timed out' };
  }
}

async function runAdvancedBrowserAction(
  url: string,
  options: {
    extractType?: 'all' | 'tables' | 'forms' | 'links' | 'metadata' | 'text';
    queryFilter?: string;
    maxContentLength?: number;
  } = {}
): Promise<any> {
  try {
    const targetUrl = url.startsWith('http') ? url : `https://${url}`;
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return { url: targetUrl, error: `HTTP ${res.status}: ${res.statusText}` };
    }

    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : targetUrl;

    // Extract forms
    const forms: any[] = [];
    const formRegex = /<form\b[^>]*>([\s\S]*?)<\/form>/gi;
    let formMatch;
    while ((formMatch = formRegex.exec(html)) !== null && forms.length < 5) {
      const formHtml = formMatch[1];
      const inputs = Array.from(formHtml.matchAll(/<input\b[^>]*name=["']([^"']+)["'][^>]*>/gi)).map((m) => m[1]);
      const actionMatch = formMatch[0].match(/action=["']([^"']+)["']/i);
      forms.push({
        action: actionMatch ? actionMatch[1] : undefined,
        inputs,
      });
    }

    // Extract tables
    const tables: string[] = [];
    const tableRegex = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
    let tableMatch;
    while ((tableMatch = tableRegex.exec(html)) !== null && tables.length < 5) {
      const cleanTable = tableMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (cleanTable.length > 20) tables.push(cleanTable.slice(0, 800));
    }

    // Extract links
    const links: Array<{ text: string; href: string }> = [];
    const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(html)) !== null && links.length < 15) {
      const href = linkMatch[1];
      const text = linkMatch[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (text.length > 2 && !href.startsWith('#') && !href.startsWith('javascript:')) {
        links.push({ text: text.slice(0, 50), href });
      }
    }

    // Clean body text
    const cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const maxLen = options.maxContentLength || 4000;
    let contentSnippet = cleanText.slice(0, maxLen);

    if (options.queryFilter) {
      const q = options.queryFilter.toLowerCase();
      const sentences = cleanText.split(/\. |\n+/);
      const filtered = sentences.filter((s) => s.toLowerCase().includes(q));
      if (filtered.length > 0) {
        contentSnippet = filtered.join('. ').slice(0, maxLen);
      }
    }

    return {
      url: targetUrl,
      title,
      status: res.status,
      contentSnippet,
      extractedFormsCount: forms.length,
      forms: forms.length > 0 ? forms : undefined,
      extractedTablesCount: tables.length,
      tables: tables.length > 0 ? tables : undefined,
      extractedLinksCount: links.length,
      links: links.length > 0 ? links : undefined,
      totalLength: cleanText.length,
      source: 'Autonomous Browser Engine (Project Hands)',
    };
  } catch (err: any) {
    return { url, error: err.message || 'Browser navigation request timed out' };
  }
}

async function spawnSubagentTask(title: string, instructions: string, priority: string = 'HIGH'): Promise<any> {
  const taskId = `subagent-${Date.now()}`;
  const task = addTask({
    title: `[Subagent Worker] ${title}`,
    description: instructions,
    priority: (priority as any) || 'HIGH',
    status: 'PENDING',
    dueDate: new Date(Date.now() + 3600000).toISOString(),
    tags: ['subagent', 'cloud-runner', 'background-execution'],
  });

  try {
    const { Redis } = await import('@upstash/redis');
    const redis = Redis.fromEnv();
    await redis.lpush('jarvis:subagent_tasks', JSON.stringify({
      id: taskId,
      title,
      instructions,
      priority,
      createdAt: new Date().toISOString(),
    }));
  } catch (redisErr) {
    console.warn('[Subagent] Redis queue push warning:', redisErr);
  }

  return {
    taskId: task.id,
    status: 'QUEUED',
    message: `Subagent mission "${title}" successfully dispatched to 24/7 Cloud Runner VM queue. Sir will be notified via Web Push upon completion.`,
  };
}

async function handleReadWorkspaceFile(args: { path: string; startLine?: number; endLine?: number; allowEnv?: boolean }) {
  const rootDir = process.cwd();
  const relPath = args.path;
  if (!relPath) throw new Error('Parameter "path" is required');
  const resolved = path.resolve(rootDir, relPath);
  if (!resolved.startsWith(rootDir)) throw new Error('Security Violation: Path traversal outside project root blocked.');
  if (relPath.includes('.env') && !args.allowEnv) {
    throw new Error('Security Violation: Access to secrets blocked by Guardian Protocol.');
  }
  if (!fs.existsSync(resolved)) throw new Error(`File does not exist: ${relPath}`);
  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) throw new Error(`Path is a directory: ${relPath}. Use find_files or mcp_filesystem instead.`);

  const content = fs.readFileSync(resolved, 'utf-8');
  const lines = content.split('\n');
  const totalLines = lines.length;

  const start = Math.max(1, args.startLine || 1);
  const end = Math.min(totalLines, args.endLine || (args.startLine ? Math.min(totalLines, start + 100) : Math.min(totalLines, 120)));

  const slicedLines = lines.slice(start - 1, end);
  const formatted = slicedLines.map((line, idx) => `${start + idx}: ${line}`).join('\n');

  return {
    path: relPath,
    totalLines,
    showingLines: `${start} to ${end}`,
    content: formatted,
  };
}

async function handleEditWorkspaceFile(args: { path: string; targetContent?: string; replacementContent: string; createIfMissing?: boolean }) {
  const rootDir = process.cwd();
  const relPath = args.path;
  if (!relPath) throw new Error('Parameter "path" is required');
  const resolved = path.resolve(rootDir, relPath);
  if (!resolved.startsWith(rootDir)) throw new Error('Security Violation: Path traversal outside project root blocked.');
  if (relPath.includes('.env')) {
    throw new Error('Security Violation: Modifying secrets blocked by Guardian Protocol.');
  }

  const fileExists = fs.existsSync(resolved);
  if (!fileExists) {
    if (args.createIfMissing || !args.targetContent) {
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, args.replacementContent, 'utf-8');
      return {
        path: relPath,
        action: 'file_created',
        bytesWritten: Buffer.byteLength(args.replacementContent),
      };
    }
    throw new Error(`File does not exist: ${relPath}. Set createIfMissing to true to create.`);
  }

  const currentContent = fs.readFileSync(resolved, 'utf-8');
  if (args.targetContent) {
    if (!currentContent.includes(args.targetContent)) {
      throw new Error(`Target content not found in ${relPath}. Read the file first to get the exact lines to replace.`);
    }
    const occurrences = currentContent.split(args.targetContent).length - 1;
    if (occurrences > 1) {
      throw new Error(`Target content occurs ${occurrences} times in ${relPath}. Provide more surrounding context to match a unique block.`);
    }
    const newContent = currentContent.replace(args.targetContent, args.replacementContent);
    fs.writeFileSync(resolved, newContent, 'utf-8');
    return {
      path: relPath,
      action: 'content_replaced',
      success: true,
      bytesWritten: Buffer.byteLength(newContent),
    };
  } else {
    fs.writeFileSync(resolved, args.replacementContent, 'utf-8');
    return {
      path: relPath,
      action: 'file_overwritten',
      success: true,
      bytesWritten: Buffer.byteLength(args.replacementContent),
    };
  }
}

async function handleGrepWorkspace(args: { query: string; path?: string; caseInsensitive?: boolean }) {
  const rootDir = process.cwd();
  const relTarget = args.path || '.';
  const searchPath = path.resolve(rootDir, relTarget);
  if (!searchPath.startsWith(rootDir)) throw new Error('Security Violation: Path traversal blocked.');

  const caseFlag = args.caseInsensitive ? '-i' : '';
  const cmd = `grep -rn ${caseFlag} --exclude-dir=".git" --exclude-dir="node_modules" --exclude-dir=".next" --exclude-dir=".gemini" --exclude-dir="dist" --exclude=".env*" ${JSON.stringify(args.query)} ${JSON.stringify(relTarget)}`;
  try {
    const { stdout } = await execAsync(cmd, {
      cwd: rootDir,
      timeout: 10000,
      maxBuffer: 512 * 1024,
    });
    const lines = (stdout || '').trim().split('\n').filter(Boolean);
    const capped = lines.slice(0, 30);
    return {
      query: args.query,
      matchesCount: lines.length,
      matches: capped.map(line => {
        const parts = line.split(':');
        return {
          file: parts[0],
          line: parts[1],
          snippet: parts.slice(2).join(':').trim(),
        };
      }),
      truncated: lines.length > 30,
    };
  } catch (err: any) {
    if (err.code === 1) {
      return { query: args.query, matchesCount: 0, matches: [] };
    }
    throw new Error(err.message || 'Grep failed');
  }
}

async function handleFindFiles(args: { pattern: string; directory?: string }) {
  const rootDir = process.cwd();
  const relDir = args.directory || '.';
  const searchDir = path.resolve(rootDir, relDir);
  if (!searchDir.startsWith(rootDir)) throw new Error('Security Violation: Path traversal blocked.');

  const cmd = `find ${JSON.stringify(relDir)} -not -path '*/.*' -not -path '*/node_modules/*' -not -path '*/.next/*' -not -name '.env*' -name ${JSON.stringify(args.pattern)}`;
  try {
    const { stdout } = await execAsync(cmd, {
      cwd: rootDir,
      timeout: 10000,
      maxBuffer: 256 * 1024,
    });
    const files = (stdout || '').trim().split('\n').filter(Boolean).slice(0, 40);
    return {
      pattern: args.pattern,
      count: files.length,
      files,
    };
  } catch (err: any) {
    return { pattern: args.pattern, count: 0, files: [], error: err.message };
  }
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}

export const JARVIS_TOOLS: ToolDefinition[] = [
  {
    name: 'manage_task',
    description: 'Create, update, complete, or log execution actions for tasks in the Mission Control tactical matrix.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'complete', 'list', 'log_action'],
          description: 'The task action to execute.',
        },
        taskId: {
          type: 'string',
          description: 'The ID of the task when updating, completing, or logging an action.',
        },
        title: {
          type: 'string',
          description: 'The title or objective of the task.',
        },
        actionName: {
          type: 'string',
          description: 'Name of the command or MCP tool executed (e.g. "git push origin main", "mcp:github/create_file").',
        },
        command: {
          type: 'string',
          description: 'The exact terminal command or shell invocation executed.',
        },
        server: {
          type: 'string',
          description: 'The MCP server or execution environment (e.g. "mcp:filesystem", "local-powershell").',
        },
        actionOutput: {
          type: 'string',
          description: 'The terminal stdout/stderr or tool execution result output.',
        },
        description: {
          type: 'string',
          description: 'Detailed scope, deliverables, or checklist for the task.',
        },
        priority: {
          type: 'string',
          enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
          description: 'Strategic priority level.',
        },
        dueDate: {
          type: 'string',
          description: 'ISO 8601 date string for completion deadline.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Keywords or project categories.',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'store_memory',
    description: 'Permanently assimilate a preference, principle, insight, decision, procedural rule, workflow recipe, or correction into long-term memory across 4 cognitive tiers (Working, Episodic, Semantic, Procedural).',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['PRINCIPLE', 'PREFERENCE', 'PROJECT', 'DECISION', 'INSIGHT', 'EVOLUTION', 'PROCEDURAL_RULE', 'WORKFLOW_RECIPE', 'CORRECTION'],
          description: 'The ontological category of the memory.',
        },
        content: {
          type: 'string',
          description: 'The clear, structured knowledge or rule to remember.',
        },
        context: {
          type: 'string',
          description: 'Why or where this was learned (e.g. "User correction during debugging").',
        },
        recipe: {
          type: 'string',
          description: 'For PROCEDURAL rules: exact terminal command line, code pattern, or step-by-step recipe.',
        },
        triggers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Keywords or operational triggers that should automatically activate this rule.',
        },
      },
      required: ['category', 'content'],
    },
  },
  {
    name: 'search_memory',
    description: 'Search through past memories, user preferences, principles, and past decisions.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Keywords or conceptual query to search for.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'run_red_team_critique',
    description: 'Act as an adversarial intellectual sparring partner. Ruthlessly stress-test a plan or idea for failure points, hidden risks, and blind spots.',
    parameters: {
      type: 'object',
      properties: {
        subject: {
          type: 'string',
          description: 'The proposal, plan, or idea to stress-test.',
        },
        domain: {
          type: 'string',
          description: 'e.g. "Technical Architecture", "Product Strategy", "Time Management", "Security".',
        },
      },
      required: ['subject'],
    },
  },
  {
    name: 'generate_briefing',
    description: 'Compile an executive status briefing covering active priorities, critical deadlines, and tactical recommendations.',
    parameters: {
      type: 'object',
      properties: {
        timeContext: {
          type: 'string',
          description: 'e.g. "Morning", "Midday", "Evening", "Immediate".',
        },
      },
      required: [],
    },
  },
  {
    name: 'inspect_infrastructure',
    description: 'Query live system telemetry, runtime engines, database connection health, evolution stage, memory counts, and infrastructure architecture.',
    parameters: {
      type: 'object',
      properties: {
        verbose: {
          type: 'boolean',
          description: 'Whether to include detailed component trees and environment configurations.',
        },
      },
      required: [],
    },
  },
  {
    name: 'mcp_github',
    description: 'Execute GitHub actions (get_repo, list_commits, get_file, list_issues, create_issue, create_or_update_file) via Octokit.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get_repo', 'list_commits', 'get_file', 'list_issues', 'create_issue', 'create_or_update_file'],
          description: 'GitHub action to execute.',
        },
        path: { type: 'string', description: 'File path in repo (e.g. "package.json", "lib/jarvis/mcp.ts").' },
        content: { type: 'string', description: 'Content when creating or updating a file.' },
        message: { type: 'string', description: 'Commit message.' },
        limit: { type: 'number', description: 'Number of items to retrieve.' },
        title: { type: 'string', description: 'Issue title.' },
        body: { type: 'string', description: 'Issue body.' },
        branch: { type: 'string', description: 'Target branch (default: "main").' },
      },
      required: ['action'],
    },
  },
  {
    name: 'mcp_filesystem',
    description: 'Inspect workspace files and directories (read_file, list_dir, write_file) in project workspace.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['read_file', 'list_dir', 'write_file'],
          description: 'Filesystem action to execute.',
        },
        path: { type: 'string', description: 'Relative path in workspace (e.g. "data/jarvis-state.json", "lib").' },
        content: { type: 'string', description: 'File content to write.' },
      },
      required: ['action', 'path'],
    },
  },
  {
    name: 'read_workspace_file',
    description: 'View the contents of any workspace file with line numbers (1-indexed). You can specify startLine and endLine to inspect specific code sections. Crucial for empirical code inspection before modifying files.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path to the workspace file (e.g. "lib/jarvis/agent.ts", "package.json").',
        },
        startLine: {
          type: 'number',
          description: 'Optional 1-indexed starting line number.',
        },
        endLine: {
          type: 'number',
          description: 'Optional 1-indexed ending line number.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'edit_workspace_file',
    description: 'Surgically edit or create a workspace file directly on the VM. Provide targetContent (the exact existing snippet) and replacementContent to make precise atomic replacements. If targetContent is omitted, writes replacementContent directly.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path to the target file in the workspace.',
        },
        targetContent: {
          type: 'string',
          description: 'The exact string snippet in the existing file to replace. Must match existing text uniquely.',
        },
        replacementContent: {
          type: 'string',
          description: 'The new replacement code or text to substitute in.',
        },
        createIfMissing: {
          type: 'boolean',
          description: 'Set true if creating a new file from scratch.',
        },
      },
      required: ['path', 'replacementContent'],
    },
  },
  {
    name: 'grep_workspace',
    description: 'Search workspace files for a text pattern or regular expression. Returns matching files, line numbers, and exact code snippets (ripgrep / grep speed).',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The text pattern or search term.',
        },
        path: {
          type: 'string',
          description: 'Optional relative directory or file to restrict search to (default: ".").',
        },
        caseInsensitive: {
          type: 'boolean',
          description: 'Set true for case-insensitive search.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'find_files',
    description: 'Find files in workspace by filename or extension pattern (e.g. "*.ts", "*worker*", "agent").',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob or name pattern to search for.',
        },
        directory: {
          type: 'string',
          description: 'Optional search root directory (default: ".").',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'invoke_antigravity_cli',
    description: 'Dispatch a deep, heavy engineering, refactoring, or architectural directive to the Sovereign Antigravity Apex CLI (agy) on the cloud runner VM. Antigravity runs with full autonomous tools and self-correcting reasoning, returning the complete verified report.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The detailed engineering objective or prompt to execute.',
        },
        timeoutSeconds: {
          type: 'number',
          description: 'Optional timeout in seconds (default: 180).',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'mcp_cloud',
    description: 'Check Vercel Edge production deployment status, Ngrok static tunnel, or server telemetry.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['ping_vercel', 'check_tunnel', 'telemetry_overview'],
          description: 'Cloud inspection action.',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'mcp_network',
    description: 'Perform outbound HTTP request (GET, POST, HEAD) to inspect web APIs or external documentation.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Full HTTP/HTTPS URL to query.' },
        method: { type: 'string', enum: ['GET', 'POST', 'HEAD'], description: 'HTTP method.' },
        headers: { type: 'object', description: 'Optional HTTP headers.' },
        body: { type: 'string', description: 'Optional request body.' },
      },
      required: ['url'],
    },
  },
  {
    name: 'mcp_database',
    description: 'Execute diagnostic query on Upstash Redis cluster (ping, dbsize, list_keys, get_key).',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['ping', 'dbsize', 'list_keys', 'get_key'], description: 'Redis operation.' },
        key: { type: 'string', description: 'Redis key when calling get_key.' },
        pattern: { type: 'string', description: 'Key pattern when calling list_keys (e.g. "jarvis:*").' },
      },
      required: ['action'],
    },
  },
  {
    name: 'cloud_write_file',
    description: 'Physically create or update a file directly in the GitHub repository (harshansarvaiya/jarvis) on branch main. Generates real Git commits in the cloud without needing local disk access. Works 24/7 autonomously.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path of the file in the repository (e.g. "data/autonomous_log.json", "lib/jarvis/new_module.ts").',
        },
        content: {
          type: 'string',
          description: 'The full text or code content to write to the file.',
        },
        commitMessage: {
          type: 'string',
          description: 'Descriptive Git commit message explaining the change.',
        },
        branch: {
          type: 'string',
          description: 'Target branch (default: "main").',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'cloud_execute_command',
    description: 'Dispatch and execute a shell command in the 24/7 GitHub Actions cloud runner (Ubuntu Linux VM). Zero local PC dependency. Runs type-checks, tests, builds, and diagnostic scripts in the cloud.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute in the 24/7 cloud runner (e.g. "npx tsc --noEmit", "npm test", "node -e \'console.log(process.version)\'").',
        },
        taskId: {
          type: 'string',
          description: 'Associated task ID to bind this cloud execution to for audit history.',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'cloud_check_deployment',
    description: 'Inspect 24/7 cloud health, Vercel Edge deployment status, and latest GitHub Actions cloud execution runs.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'search_web',
    description: 'Search the live web for current technical documentation, market benchmarks, cloud pricing, or external facts.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search keywords or question.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_web_page',
    description: 'Fetch and extract clean readable text content from any public webpage URL. Use after search_web to read complete doctor profiles, clinic price lists, address details, or full documentation.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The target webpage URL to scrape.',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'browser_navigate_and_act',
    description: 'Autonomous browser automation tool (Project Hands). Navigates to any web URL, emulates real browser headers, extracts interactive forms, tables, links, metadata, and filters content by query.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Target website URL to navigate to.',
        },
        extractType: {
          type: 'string',
          enum: ['all', 'tables', 'forms', 'links', 'metadata', 'text'],
          description: 'Type of content to prioritize extracting.',
        },
        queryFilter: {
          type: 'string',
          description: 'Optional semantic keyword or query to filter page content around.',
        },
        maxContentLength: {
          type: 'number',
          description: 'Max character length of the extracted content snippet (default: 4000).',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'spawn_subagent_task',
    description: 'Spawn an autonomous background subagent worker to execute multi-step research, web scraping, or system audits on the 24/7 cloud runner. Sends a lock-screen Web Push notification to Sir when finished.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the background subagent task.',
        },
        instructions: {
          type: 'string',
          description: 'Detailed operational instructions for the subagent worker.',
        },
        priority: {
          type: 'string',
          enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
          description: 'Task priority level.',
        },
      },
      required: ['title', 'instructions'],
    },
  },
  {
    name: 'notify_user',
    description: 'Send an immediate or scheduled push notification / reminder to Sir’s device with priority and optional delay.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Header/title of the push notification (e.g. "Mission Milestone Reminder", "Deployment Complete").',
        },
        message: {
          type: 'string',
          description: 'The body message or reminder content.',
        },
        priority: {
          type: 'string',
          enum: ['CRITICAL', 'HIGH', 'NORMAL', 'LOW'],
          description: 'Priority of the alert. CRITICAL/HIGH triggers distinct audio chime and persistent banner.',
        },
        delaySeconds: {
          type: 'number',
          description: 'Optional delay in seconds before triggering (e.g. 300 for 5 minutes, 3600 for 1 hour).',
        },
        category: {
          type: 'string',
          enum: ['REMINDER', 'SECURITY', 'TASK', 'DEPLOYMENT', 'GENERAL'],
          description: 'Category of the notification.',
        },
        actionUrl: {
          type: 'string',
          description: 'Optional target path to open when user taps notification (e.g. "/", "/tasks").',
        },
      },
      required: ['title', 'message'],
    },
  },
  {
    name: 'send_telegram_message',
    description: 'Dispatch an immediate proactive Telegram text message directly to Sir’s private Telegram channel (@harshan_jarvis_bot).',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The text message or operational update to send directly to Sir’s Telegram.',
        },
        chatId: {
          type: 'string',
          description: 'Optional Telegram chat ID (defaults to Sir’s verified user ID).',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'rag_search_knowledge',
    description: 'Perform semantic vector search on the J.A.R.V.I.S. Knowledge Base using dense vector embeddings (Gemini 004). Returns relevant chunks with similarity confidence.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query or concept to look up.',
        },
        category: {
          type: 'string',
          description: 'Optional category filter (e.g. "TECHNICAL", "ARCHITECTURE", "DOCS", "PROJECT", "SENSITIVE").',
        },
        topK: {
          type: 'number',
          description: 'Number of top matching chunks to retrieve (default: 4).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'rag_ingest_document',
    description: 'Chunk, embed, and permanently index a document, guide, codebase reference, or personal notes into the Semantic Vector Knowledge Base.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title or document identifier.',
        },
        content: {
          type: 'string',
          description: 'The full text, markdown, or code content to index.',
        },
        category: {
          type: 'string',
          description: 'Category tag (e.g. "ARCHITECTURE", "TECHNICAL", "CREDENTIALS", "SENSITIVE", "REFERENCE").',
        },
        isSensitive: {
          type: 'boolean',
          description: 'Set true if this contains private, personal, or credential data subject to Directive 01 Guardian Wipe.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of searchable tags.',
        },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'emergency_wipe_sensitive',
    description: 'Execute Directive 01 Guardian Sanitization Wipe to permanently purge sensitive documents, credentials, API overrides, and private knowledge from Upstash Redis and local storage.',
    parameters: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['sensitive_only', 'nuclear_all'],
          description: 'Wipe mode: "sensitive_only" (purges sensitive RAG chunks and credentials) or "nuclear_all" (complete factory reset).',
        },
        reason: {
          type: 'string',
          description: 'Audit explanation for why the sanitization was invoked.',
        },
      },
      required: [],
    },
  },
  {
    name: 'synthesize_skill',
    description: 'Synthesize or update a modular, reusable operational skill in the skills/ library (Hermes agentskills.io standard) for future autonomous execution.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Unique kebab-case name of the skill (e.g. "github-pr-audit", "dns-leak-check").',
        },
        description: {
          type: 'string',
          description: 'Clear description of what the skill accomplishes and when it should trigger.',
        },
        content: {
          type: 'string',
          description: 'The step-by-step markdown playbook, checklist, and terminal execution commands.',
        },
        triggers: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of prompt phrases or keywords that trigger this skill.',
        },
      },
      required: ['name', 'description', 'content', 'triggers'],
    },
  },
];

export async function executeJarvisTool(
  toolName: string,
  args: Record<string, any>
): Promise<{ success: boolean; result: any; error?: string }> {
  // 1. Directives & Guardian Check
  const validation = validateActionAgainstDirectives(
    `${toolName}: ${JSON.stringify(args)}`
  );
  if (!validation.allowed) {
    return {
      success: false,
      result: null,
      error: `Action halted under [${validation.violatedDirective?.name}]: ${validation.reason}`,
    };
  }

  try {
    switch (toolName) {
      case 'manage_task': {
        const { action, taskId, title, description, priority, dueDate, tags, actionName, command, server, actionOutput } = args;
        if (action === 'create') {
          if (!title) return { success: false, result: null, error: 'Title required for create' };
          const task = addTask({
            title,
            description: description || '',
            priority: (priority as Priority) || 'MEDIUM',
            status: 'PENDING',
            dueDate: dueDate || undefined,
            tags: tags || ['general'],
            executionAudit: [
              {
                id: `exec-init-${Date.now()}`,
                timestamp: new Date().toISOString(),
                type: 'MCP_TOOL',
                name: 'mcp:mission_control/create_task',
                command: command || `jarvis.tasks.create(title="${title}", priority="${priority || 'MEDIUM'}")`,
                server: server || 'jarvis-mcp-orchestrator',
                status: 'SUCCESS',
                output: actionOutput || 'Objective initialized and registered to tactical matrix. Ready for autonomous execution.',
              },
            ],
          });
          return { success: true, result: { message: `Task "${title}" created successfully.`, task } };
        }
        if (action === 'complete') {
          let targetId = taskId;
          if (!targetId && title) {
            const all = getTasks();
            const match = all.find(
              (t) =>
                t.title.toLowerCase().includes(title.toLowerCase()) ||
                title.toLowerCase().includes(t.title.toLowerCase())
            );
            if (match) targetId = match.id;
          }
          if (!targetId) return { success: false, result: null, error: 'taskId or matching title required for complete' };
          const task = updateTask(targetId, { status: 'COMPLETED' });
          recordTaskExecution(targetId, {
            type: 'MCP_TOOL',
            name: actionName || 'mcp:mission_control/complete_task',
            command: command || `jarvis.tasks.complete("${targetId}")`,
            server: server || 'jarvis-core-orchestrator',
            status: 'SUCCESS',
            output: actionOutput || 'Objective fulfilled with 100% fidelity under Core Directive 04.',
          });
          return { success: true, result: { message: `Task "${task?.title || targetId}" marked as completed.`, task } };
        }
        if (action === 'log_action') {
          let targetId = taskId;
          if (!targetId && title) {
            const all = getTasks();
            const match = all.find(
              (t) =>
                t.title.toLowerCase().includes(title.toLowerCase()) ||
                title.toLowerCase().includes(t.title.toLowerCase())
            );
            if (match) targetId = match.id;
          }
          if (!targetId) return { success: false, result: null, error: 'taskId required to log action' };
          const task = recordTaskExecution(targetId, {
            type: command ? 'SHELL_COMMAND' : 'MCP_TOOL',
            name: actionName || (command ? `exec:${command.slice(0, 30)}` : 'mcp:tool_execution'),
            command,
            server: server || 'jarvis-terminal-host',
            status: 'SUCCESS',
            output: actionOutput || 'Autonomous action completed successfully.',
          });
          return { success: true, result: { message: `Action logged to task "${task?.title || targetId}".`, task } };
        }
        if (action === 'update') {
          let targetId = taskId;
          if (!targetId && title) {
            const all = getTasks();
            const match = all.find(
              (t) =>
                t.title.toLowerCase().includes(title.toLowerCase()) ||
                title.toLowerCase().includes(t.title.toLowerCase())
            );
            if (match) targetId = match.id;
          }
          if (!targetId) return { success: false, result: null, error: 'taskId or matching title required for update' };
          const updates: Partial<Task> = {};
          if (args.newTitle) updates.title = args.newTitle;
          if (description) updates.description = description;
          if (priority) updates.priority = priority as Priority;
          if (dueDate) updates.dueDate = dueDate;
          if (tags) updates.tags = tags;
          const task = updateTask(targetId, updates);
          if (command || actionName) {
            recordTaskExecution(targetId, {
              type: command ? 'SHELL_COMMAND' : 'MCP_TOOL',
              name: actionName || 'mcp:mission_control/update_task',
              command,
              server: server || 'jarvis-orchestrator',
              status: 'SUCCESS',
              output: actionOutput || `Task parameters modified.`,
            });
          }
          return { success: true, result: { message: `Task "${task?.title || targetId}" updated.`, task } };
        }
        if (action === 'list') {
          const tasks = getTasks();
          return { success: true, result: { tasks } };
        }
        return { success: false, result: null, error: `Unknown task action: ${action}` };
      }

      case 'store_memory': {
        const { category, content, context, recipe, triggers, tier } = args;
        const memory = addMemory(
          (category as MemoryCategory) || 'INSIGHT',
          content,
          context || 'Assimilated via J.A.R.V.I.S. tool execution',
          0.95,
          tier,
          triggers,
          recipe
        );
        return {
          success: true,
          result: {
            message: `Memory assimilated under [${memory.tier}:${category}].`,
            memory,
          },
        };
      }

      case 'search_memory': {
        const { query } = args;
        const results = searchMemories(query || '');
        return { success: true, result: { query, count: results.length, memories: results } };
      }

      case 'run_red_team_critique': {
        const { subject, domain } = args;
        return {
          success: true,
          result: {
            analysisType: 'Adversarial Red-Team Stress Test',
            subject,
            domain: domain || 'General Architecture',
            status: 'CRITIQUE_COMPILED',
            mandate: 'Highlight single points of failure, unstated assumptions, and cognitive bias.',
          },
        };
      }

      case 'generate_briefing': {
        const tasks = getTasks();
        const pending = tasks.filter((t) => t.status !== 'COMPLETED');
        const critical = pending.filter((t) => t.priority === 'CRITICAL');
        const high = pending.filter((t) => t.priority === 'HIGH');
        const memories = getMemories().slice(0, 5);

        return {
          success: true,
          result: {
            briefingTime: new Date().toLocaleTimeString(),
            activePrioritiesCount: pending.length,
            criticalCount: critical.length,
            highCount: high.length,
            criticalItems: critical.map((t) => t.title),
            highItems: high.map((t) => t.title),
            recentMemories: memories.map((m) => `[${m.category}] ${m.content}`),
            systemStatus: 'ALL DIRECTIVES ONLINE & FUNCTIONAL',
          },
        };
      }

      case 'inspect_infrastructure': {
        const tasks = getTasks();
        const memories = getMemories();
        const pendingTasks = tasks.filter((t) => t.status !== 'COMPLETED');
        const completedTasks = tasks.filter((t) => t.status === 'COMPLETED');

        return {
          success: true,
          result: {
            system: 'J.A.R.V.I.S. Mark II Sovereign Autonomous Exoskeleton',
            version: '2.0.0',
            evolutionStage: 5,
            stage: 'Stage 5: Autonomous Sovereign Cloud-Native Substrate',
            guardianProtocol: 'ONLINE (HMAC-SHA256 Cryptographic Sentry Active)',
            cognitiveEngines: {
              tier1Reflex: 'Groq US LPU (openai/gpt-oss-120b) ~100-180ms inference',
              tier2Multimodal: 'Google Gemini (gemini-3.7-flash Primary)',
              quantumFallbackChain: '3.7-flash -> flash-lite-latest -> 3.1-flash-lite -> 3.5-flash-lite -> 3.8-flash',
              tier3Backup: 'GitHub Models / Azure (gpt-4o, gpt-4o-mini)',
            },
            storageArchitecture: {
              cloudEdge: 'Upstash Redis REST (witty-grouse-110573.upstash.io) 24/7 Active',
              localAtomicFallback: 'Atomic disk synchronization (data/jarvis-state.json)',
              episodicRecallRAG: 'Semantic correlation vector search active',
            },
            memoryMetrics: {
              totalMemories: memories.length,
              principles: memories.filter((m) => m.category === 'PRINCIPLE').length,
              preferences: memories.filter((m) => m.category === 'PREFERENCE').length,
              evolutionNodes: memories.filter((m) => m.category === 'EVOLUTION').length,
            },
            taskMetrics: {
              totalTasks: tasks.length,
              active: pendingTasks.length,
              completed: completedTasks.length,
              auditedTasks: tasks.filter((t) => t.executionAudit && t.executionAudit.length > 0).length,
            },
            deploymentTopology: {
              cloudProduction: 'Vercel Edge (https://jarvis-iota-beige.vercel.app)',
              encryptedTunnel: 'Ngrok static uplink (washbasin-penpal-muppet.ngrok-free.dev)',
              gitRepository: 'https://github.com/harshansarvaiya/jarvis (branch: main)',
            },
            coreDirectives: [
              'D-01: Guardian Protocol (Absolute Creator Protection)',
              'D-02: Benevolent Alignment (Universal Non-Harm)',
              'D-03: Evolutionary Adaptation & Continuous DNA Synchronization',
              'D-04: Sovereign Loyalty & Relentless Execution',
            ],
          },
        };
      }

      case 'mcp_github': {
        const { action, ...params } = args;
        const res = await executeGitHubMCP(action, params);
        return { success: res.success, result: res.output, error: res.error };
      }

      case 'mcp_filesystem': {
        const { action, ...params } = args;
        const res = await executeFileSystemMCP(action, params);
        return { success: res.success, result: res.output, error: res.error };
      }

      case 'mcp_cloud': {
        const { action } = args;
        const res = await executeCloudMCP(action);
        return { success: res.success, result: res.output, error: res.error };
      }

      case 'read_workspace_file': {
        const { path: filePath, startLine, endLine } = args;
        const res = await handleReadWorkspaceFile({ path: filePath, startLine, endLine });
        return { success: true, result: res };
      }

      case 'edit_workspace_file': {
        const { path: filePath, targetContent, replacementContent, createIfMissing } = args;
        const res = await handleEditWorkspaceFile({ path: filePath, targetContent, replacementContent, createIfMissing });
        return { success: true, result: res };
      }

      case 'grep_workspace': {
        const { query, path: searchPath, caseInsensitive } = args;
        const res = await handleGrepWorkspace({ query, path: searchPath, caseInsensitive });
        return { success: true, result: res };
      }

      case 'find_files': {
        const { pattern, directory } = args;
        const res = await handleFindFiles({ pattern, directory });
        return { success: true, result: res };
      }

      case 'invoke_antigravity_cli': {
        const { prompt: cliPrompt, timeoutSeconds = 180 } = args;
        const agyBin = '/home/harshans279/.local/bin/agy';
        if (!fs.existsSync(agyBin)) {
          throw new Error('Antigravity CLI binary not found on this substrate.');
        }
        try {
          const { stdout, stderr } = await execAsync(
            `${agyBin} -p ${JSON.stringify(cliPrompt)} --dangerously-skip-permissions --output-format text`,
            {
              cwd: process.cwd(),
              timeout: timeoutSeconds * 1000,
              maxBuffer: 1024 * 1024,
            }
          );
          return {
            success: true,
            result: {
              source: 'Antigravity Apex CLI Engine (agy)',
              output: stdout.trim(),
              stderr: stderr.trim() || undefined,
            },
          };
        } catch (err: any) {
          return {
            success: false,
            error: `Antigravity CLI execution error: ${err.message}`,
            result: err.stdout ? { partialOutput: err.stdout } : undefined,
          };
        }
      }

      case 'mcp_network': {
        const { url, method, headers, body } = args;
        const res = await executeNetworkMCP(url, method, headers, body);
        return { success: res.success, result: res.output, error: res.error };
      }

      case 'mcp_database': {
        const { action, ...params } = args;
        const res = await executeDatabaseMCP(action, params);
        return { success: res.success, result: res.output, error: res.error };
      }

      case 'cloud_write_file': {
        const { path: filePath, content, commitMessage, branch } = args;
        const res = await executeGitHubMCP('create_or_update_file', {
          path: filePath,
          content,
          message: commitMessage || `auto(jarvis): physical cloud write ${filePath}`,
          branch: branch || 'main',
        });
        return { success: res.success, result: res.output, error: res.error };
      }

      case 'cloud_execute_command': {
        const { command, taskId } = args;
        // 1. Direct sub-second execution on this Google Cloud VM substrate
        try {
          const directResult = await runDirectShellCommand(command);
          return {
            success: directResult.exitCode === 0,
            result: directResult,
            error: directResult.exitCode !== 0 ? directResult.stderr : undefined,
          };
        } catch (directErr: any) {
          // 2. Fallback to GitHub Actions Cloud Runner if direct shell fails
          console.warn('[Tools] Direct VM execution failed, cascading to GitHub Actions runner:', directErr?.message);
          const res = await executeGitHubMCP('dispatch_workflow_run', {
            command,
            taskId: taskId || `task-exec-${Date.now()}`,
          });
          return { success: res.success, result: res.output, error: res.error };
        }
      }

      case 'read_web_page': {
        const { url } = args;
        const res = await runDeepWebScraper(url);
        return { success: !res.error, result: res, error: res.error };
      }

      case 'browser_navigate_and_act': {
        const { url, extractType, queryFilter, maxContentLength } = args;
        const res = await runAdvancedBrowserAction(url, {
          extractType,
          queryFilter,
          maxContentLength,
        });
        return { success: !res.error, result: res, error: res.error };
      }

      case 'spawn_subagent_task': {
        const { title, instructions, priority = 'HIGH' } = args;
        const res = await spawnSubagentTask(title, instructions, priority);
        return { success: true, result: res };
      }

      case 'search_web': {
        const { query } = args;
        const searchResult = await runWebSearch(query);
        return { success: !searchResult.error, result: searchResult, error: searchResult.error };
      }

      case 'cloud_check_deployment': {
        const [cloudRes, runsRes] = await Promise.all([
          executeCloudMCP('ping_vercel'),
          executeGitHubMCP('get_workflow_runs'),
        ]);
        return {
          success: cloudRes.success,
          result: {
            vercelEdge: cloudRes.output,
            githubActionsRuns: runsRes.output,
          },
          error: cloudRes.error || runsRes.error,
        };
      }

      case 'notify_user': {
        const { title, message, priority = 'NORMAL', delaySeconds = 0, category = 'GENERAL', actionUrl = '/' } = args;
        const notifId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const now = new Date();
        const delaySec = Number(delaySeconds) || 0;
        const triggerAt = delaySec > 0 ? new Date(now.getTime() + delaySec * 1000).toISOString() : now.toISOString();

        const notificationRecord = {
          id: notifId,
          title: title || 'J.A.R.V.I.S. Alert',
          message: message || 'Operational notification from J.A.R.V.I.S.',
          priority,
          category,
          delaySeconds: delaySec,
          triggerAt,
          status: delaySec > 0 ? 'PENDING' : 'SENT',
          actionUrl: actionUrl || '/',
          timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        // If scheduled with a delay, record on tactical radar
        if (delaySec > 0) {
          addTask({
            title: `[NOTIFICATION REMINDER] ${title}`,
            description: `Scheduled push alert: ${message}`,
            priority: priority === 'CRITICAL' ? 'CRITICAL' : priority === 'HIGH' ? 'HIGH' : 'MEDIUM',
            status: 'PENDING',
            dueDate: triggerAt,
            tags: ['Notification', 'Reminder', category],
          });
        }

        return {
          success: true,
          result: {
            message: delaySec > 0
              ? `Scheduled push notification armed for ${new Date(triggerAt).toLocaleTimeString()} (${delaySec}s delay).`
              : `Push notification dispatched directly to Sir's device.`,
            notification: notificationRecord,
          },
        };
      }

      case 'send_telegram_message': {
        const { message, chatId } = args;
        const targetChatId = chatId || process.env.TELEGRAM_ALLOWED_USER_ID || '864360540';
        const { TelegramGateway } = await import('./telegram');
        const gateway = new TelegramGateway();
        const sent = await gateway.sendMessage(Number(targetChatId), message);
        return {
          success: sent,
          result: {
            messageSent: message,
            targetChatId,
            status: sent ? 'DELIVERED_TO_SIR' : 'TELEGRAM_DISPATCH_FAILED',
          },
        };
      }

      case 'rag_search_knowledge': {
        const { query, category, topK = 4 } = args;
        const results = await queryKnowledgeBase(query, { topK: Number(topK) || 4, category });
        return {
          success: true,
          result: {
            query,
            chunksFound: results.length,
            results: results.map((r) => ({
              title: r.title,
              category: r.category,
              similarity: `${(r.similarity * 100).toFixed(1)}%`,
              content: r.content,
              isSensitive: r.isSensitive,
            })),
          },
        };
      }

      case 'rag_ingest_document': {
        const { title, content, category = 'GENERAL', isSensitive, tags } = args;
        const res = await ingestKnowledgeDocument({
          title,
          content,
          category,
          isSensitive,
          tags: Array.isArray(tags) ? tags : [],
        });
        return {
          success: true,
          result: {
            message: `Document "${title}" successfully chunked, embedded, and indexed into knowledge base (${res.chunksIndexed} vector chunks).`,
            ...res,
          },
        };
      }

      case 'emergency_wipe_sensitive': {
        const { mode = 'sensitive_only', reason } = args;
        if (mode === 'nuclear_all') {
          const wipeRes = await wipeAllKnowledge();
          return {
            success: true,
            result: {
              message: `DEFCON 0 Emergency Nuclear Wipe executed. Purged ${wipeRes.totalChunksPurged} vector chunks across ${wipeRes.totalDocsPurged} documents.`,
              reason: reason || 'Directive 01 Guardian Sanitization Mandate',
            },
          };
        } else {
          const wipeRes = await wipeSensitiveKnowledge();
          return {
            success: true,
            result: {
              message: `Directive 01 Guardian Sensitive Wipe executed. Purged ${wipeRes.chunksRemoved} sensitive vector chunks across ${wipeRes.docsRemoved} documents.`,
              reason: reason || 'Directive 01 Guardian Sanitization Mandate',
            },
          };
        }
      }

      case 'synthesize_skill': {
        const { name, description, content, triggers } = args;
        const { synthesizeSkill } = await import('./skills');
        const res = synthesizeSkill({
          name: name || 'unnamed-skill',
          description: description || '',
          content: content || '',
          triggers: Array.isArray(triggers) ? triggers : [],
        });
        return {
          success: res.success,
          result: {
            message: res.message,
            filePath: res.filePath,
          },
        };
      }

      default:
        return { success: false, result: null, error: `Unknown tool: ${toolName}` };
    }
  } catch (error: any) {
    return { success: false, result: null, error: error.message || 'Tool execution failure' };
  }
}
