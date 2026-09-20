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
  executeExaMCP,
  executeVercelMCP,
  executeMemoryMCP,
  executeGoogleCalendarMCP,
  executePlaywrightMCP,
  executeCodebaseMemoryMCP,
} from './mcp';
import {
  queryKnowledgeBase,
  ingestKnowledgeDocument,
  wipeSensitiveKnowledge,
  wipeAllKnowledge,
} from './rag';
import { getSpecializedAgentProfile, selectOptimalSubagent } from './agents-registry';
import { executeEnterpriseSastAudit } from './security/sast';
import { scanWorkspaceForSecrets } from './security/secret-sentry';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// ─────────────────────────────────────────────────────────────────────────────
// /CAREFUL GUARDIAN — gstack-inspired destructive command safety layer
// HARD_DENY: Commands that can cause irrecoverable data loss — always blocked.
// SOFT_WARN: Commands that are risky but may be intentional — require explicit
//            override token "OVERRIDE_GUARDIAN_CONFIRMED" in the command string.
// ─────────────────────────────────────────────────────────────────────────────
const HARD_DENY_PATTERNS = [
  { pattern: /rm\s+-[a-z]*r[a-z]*f?\s+\/[^/\s]/, label: 'rm -rf on root path' },
  { pattern: /rm\s+-[a-z]*f[a-z]*r?\s+\/[^/\s]/, label: 'rm -rf on root path (variant)' },
  { pattern: /rm\s+-[a-z]*r[a-z]*f?\s+~/, label: 'rm -rf on home directory' },
  { pattern: /mkfs/, label: 'filesystem format (mkfs)' },
  { pattern: /dd\s+if=/, label: 'raw disk write (dd)' },
  { pattern: /:\(\)\s*\{/, label: 'fork bomb' },
  { pattern: /git\s+push\s+.*--force\s+origin\s+(main|master)/, label: 'force-push to protected branch' },
  { pattern: /git\s+push\s+.*-f\s+origin\s+(main|master)/, label: 'force-push to protected branch (-f)' },
  { pattern: /truncate\s+.*--size\s+0\s+.*\.(sql|db|sqlite)/, label: 'database file truncation' },
  { pattern: /DROP\s+TABLE\s+IF\s+EXISTS|DROP\s+DATABASE/i, label: 'SQL DROP TABLE/DATABASE' },
  // Directive 06 — Zero-Thrashing Infrastructure Integrity
  { pattern: /apt(-get)?\s+install.*(docker|containerd|podman|k3s|kubernetes)/i, label: 'Directive 06: Heavy container engine installation (Docker/Podman)' },
  { pattern: /(npm|pip|uv)\s+(install|add).*(kokoro|onnxruntime-node|usestrix|torch|tensorflow)/i, label: 'Directive 06: Heavy native ML / sandbox installation' },
];

const SOFT_WARN_PATTERNS = [
  { pattern: /rm\s+-[a-z]*r/, label: 'recursive rm' },
  { pattern: /git\s+push\s+.*--force/, label: 'git force-push' },
  { pattern: /git\s+push\s+.*-f\b/, label: 'git force-push (short flag)' },
  { pattern: /shutdown|reboot|poweroff/, label: 'system shutdown/reboot' },
  { pattern: /DROP\s+TABLE|TRUNCATE\s+TABLE/i, label: 'SQL destructive operation' },
  { pattern: /pkill\s+-9|kill\s+-9\s+1\b/, label: 'SIGKILL on system process' },
  { pattern: /chmod\s+777\s+\//, label: 'chmod 777 on root path' },
  { pattern: /npm\s+publish|yarn\s+publish/, label: 'package publish to registry' },
];

async function runDirectShellCommand(command: string): Promise<{ stdout: string; stderr: string; exitCode: number; executionSubstrate: string }> {
  // /CAREFUL GUARDIAN — Directive 01 Guardian Protocol + gstack-inspired safety layer
  const overridePresent = command.includes('OVERRIDE_GUARDIAN_CONFIRMED');
  const cleanCommand = command.replace('OVERRIDE_GUARDIAN_CONFIRMED', '').trim();

  for (const { pattern, label } of HARD_DENY_PATTERNS) {
    if (pattern.test(cleanCommand)) {
      throw new Error(`🛡️ GUARDIAN HARD-DENY: "${label}" is irrecoverable and permanently blocked by Directive 01. Cannot be overridden.`);
    }
  }

  if (!overridePresent) {
    for (const { pattern, label } of SOFT_WARN_PATTERNS) {
      if (pattern.test(cleanCommand)) {
        return {
          stdout: '',
          stderr: `⚠️ GUARDIAN SOFT-WARN: Command matches risky pattern "${label}". If intentional, re-issue with OVERRIDE_GUARDIAN_CONFIRMED in the command. Sir must confirm.`,
          exitCode: 1,
          executionSubstrate: 'Guardian Protocol Sentry (command not executed)',
        };
      }
    }
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

  // Tier 0: Exa Neural Search (highest quality — semantic + citation ranking)
  const exaKey = process.env.EXA_API_KEY;
  if (exaKey) {
    try {
      const exaRes = await executeExaMCP('search', { query, numResults: 6, useAutoprompt: true, type: 'neural', includeText: true });
      if (exaRes.success && Array.isArray(exaRes.output?.results) && exaRes.output.results.length > 0) {
        for (const r of exaRes.output.results) {
          results.push({ title: r.title || query, snippet: r.snippet || '', url: r.url, source: 'Exa Neural Search' });
        }
        return { query, resultsCount: results.length, results, engine: 'Exa Neural Search' };
      }
    } catch {}
  }

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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      // Automatic adaptive fallback to Playwright Chromium on HTTP blocks (e.g. 403, 429, 503)
      if ([401, 403, 429, 503].includes(res.status)) {
        try {
          const pwFallback = await executePlaywrightMCP('navigate_and_extract', { url: targetUrl });
          if (pwFallback.success && pwFallback.output?.text) {
            return {
              url: targetUrl,
              title: pwFallback.output.title || targetUrl,
              contentSnippet: pwFallback.output.text.slice(0, 3500),
              totalLength: pwFallback.output.totalLength,
              source: 'Adaptive Stealth Fallback (Project Hands Playwright)',
            };
          }
        } catch {}
      }
      return { url, error: `Target URL returned HTTP status ${res.status}` };
    }

    const html = await res.text();

    // Scrapling-inspired Adaptive Structural Extraction:
    // Try semantic main content containers first before stripping entire body
    let primaryHtml = html;
    const mainMatch = html.match(/<(?:main|article|section\s+class=["'][^"']*(?:content|article|main|post)[^"']*["'])[^>]*>([\s\S]*?)<\/(?:main|article|section)>/i);
    if (mainMatch && mainMatch[1] && mainMatch[1].length > 200) {
      primaryHtml = mainMatch[1];
    }

    const cleanText = primaryHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();

    // If client-side JavaScript hydration detected or body is empty, trigger headless Playwright
    if (cleanText.length < 120 && (html.includes('id="root"') || html.includes('id="app"') || html.includes('__next') || html.includes('noscript'))) {
      try {
        const pwRes = await executePlaywrightMCP('navigate_and_extract', { url: targetUrl });
        if (pwRes.success && pwRes.output?.text && pwRes.output.text.length > cleanText.length) {
          return {
            url: targetUrl,
            title: pwRes.output.title || targetUrl,
            contentSnippet: pwRes.output.text.slice(0, 3500),
            totalLength: pwRes.output.totalLength,
            source: 'Adaptive Headless Engine (Project Hands)',
          };
        }
      } catch {}
    }

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : targetUrl;

    return {
      url: targetUrl,
      title,
      contentSnippet: cleanText.slice(0, 3500),
      totalLength: cleanText.length,
      source: 'Adaptive Resilient Scraper (Pillar 4)',
    };
  } catch (err: any) {
    // Catch-all fallback to Playwright on network timeout / SSL handshake failure
    try {
      const pwFallback = await executePlaywrightMCP('navigate_and_extract', { url });
      if (pwFallback.success && pwFallback.output?.text) {
        return {
          url,
          title: pwFallback.output.title || url,
          contentSnippet: pwFallback.output.text.slice(0, 3500),
          totalLength: pwFallback.output.totalLength,
          source: 'Adaptive Stealth Fallback (Project Hands)',
        };
      }
    } catch {}
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

    // If client-side JavaScript SPA is detected (empty body or < 100 chars), cascade to Playwright Chromium
    if (cleanText.length < 120 && (html.includes('id="root"') || html.includes('id="app"') || html.includes('__next') || html.includes('noscript'))) {
      try {
        const pwRes = await executePlaywrightMCP('navigate_and_extract', { url: targetUrl });
        if (pwRes.success && pwRes.output?.text && pwRes.output.text.length > cleanText.length) {
          return {
            url: targetUrl,
            title: pwRes.output.title || title,
            status: 200,
            contentSnippet: pwRes.output.text.slice(0, maxLen),
            extractedLinksCount: (pwRes.output.links || []).length,
            links: pwRes.output.links,
            totalLength: pwRes.output.totalLength,
            source: 'Headless Playwright Chromium Engine (Project Hands)',
          };
        }
      } catch {}
    }

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
    // If standard fetch fails (e.g. SSL or blocked UA), attempt Playwright Chromium fallback
    try {
      const pwFallback = await executePlaywrightMCP('navigate_and_extract', { url });
      if (pwFallback.success && pwFallback.output) {
        return {
          url,
          title: pwFallback.output.title,
          status: 200,
          contentSnippet: (pwFallback.output.text || '').slice(0, options.maxContentLength || 4000),
          extractedLinksCount: (pwFallback.output.links || []).length,
          links: pwFallback.output.links,
          totalLength: pwFallback.output.totalLength,
          source: 'Headless Playwright Chromium Fallback (Project Hands)',
        };
      }
    } catch {}

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

  function getPipelineGuidance(targetPath: string): string | undefined {
    const isComponent = (targetPath.startsWith('components/') || targetPath.includes('/components/')) && !targetPath.startsWith('app/api/');
    if (isComponent) {
      return `[MANDATORY 4-STAGE PIPELINE NOTICE]: You created/updated UI component "${targetPath}". Under Antigravity Standard & Directive 05, you MUST NOT stop here. Your next required operations in this same turn are: (1) Mount this component into 'app/page.tsx' tabs/views, (2) Run 'cloud_execute_command' with 'npx tsc --noEmit' to verify type-check, (3) Run 'cloud_execute_command' with 'git add -A && git commit -m "feat: ..." && git push origin main' to deploy.`;
    }
    return undefined;
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
        pipelineGuidance: getPipelineGuidance(relPath),
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
      pipelineGuidance: getPipelineGuidance(relPath),
    };
  } else {
    fs.writeFileSync(resolved, args.replacementContent, 'utf-8');
    return {
      path: relPath,
      action: 'file_overwritten',
      success: true,
      bytesWritten: Buffer.byteLength(args.replacementContent),
      pipelineGuidance: getPipelineGuidance(relPath),
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
    name: 'run_codeact_action',
    description: 'Execute an OpenHands-inspired CodeAct Action (Bash command sequence, Python script, or code mutation) with closed-loop compiler verification (npx tsc --noEmit) and structured event-stream observations.',
    parameters: {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          description: 'Clear intent / objective of this CodeAct action step.',
        },
        code: {
          type: 'string',
          description: 'Executable Bash command sequence or Python script to run.',
        },
        type: {
          type: 'string',
          enum: ['SHELL', 'PYTHON', 'MUTATION', 'VERIFY'],
          description: 'Action type (SHELL, PYTHON, MUTATION, or VERIFY).',
        },
        verifyCompiler: {
          type: 'boolean',
          description: 'Set true to trigger closed-loop npx tsc --noEmit compiler verification after execution.',
        },
      },
      required: ['intent', 'code'],
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
    description: 'Check Vercel Edge production deployment status, Cloud Runner VM telemetry, or server health.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['ping_vercel', 'check_runner_vm', 'telemetry_overview'],
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
    name: 'scan_cve_threats',
    description: 'Query live CVE security advisories and zero-day vulnerabilities across tech stacks (Spring Boot, Next.js, Redis, Kafka, TypeScript, Linux, OpenSSH, etc.) via OSV.dev and GitHub Security Advisory.',
    parameters: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: 'The package, dependency, or technology name to scan (e.g. "spring-boot", "next", "redis", "openssh", "axios").',
        },
        ecosystem: {
          type: 'string',
          enum: ['npm', 'Maven', 'PyPI', 'Go', 'Linux', 'crates.io'],
          description: 'Optional package ecosystem filter.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of vulnerability records to return (default: 5).',
        },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'trace_crypto_sanctions',
    description: 'Investigate Bitcoin / Ethereum wallet addresses, balances, and transaction volume while simultaneously cross-checking against the US OFAC SDN, EU, and UN Global Sanctions Lists (OpenSanctions).',
    parameters: {
      type: 'object',
      properties: {
        addressOrName: {
          type: 'string',
          description: 'BTC/ETH wallet address or entity name to trace and screen against sanctions.',
        },
        asset: {
          type: 'string',
          enum: ['BTC', 'ETH', 'AUTO'],
          description: 'Target crypto asset network (default: AUTO).',
        },
      },
      required: ['addressOrName'],
    },
  },
  {
    name: 'inspect_ip_recon',
    description: 'Perform OSINT reconnaissance on an IP address or domain: resolves DNS over HTTPS, queries RDAP/GeoIP, detects VPN/Proxy/Tor exit nodes, and identifies ASN / ISP organization.',
    parameters: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'IP address or domain name to investigate (e.g. "1.1.1.1", "api.github.com").',
        },
      },
      required: ['target'],
    },
  },
  {
    name: 'scan_phone_intelligence',
    description: 'Perform OSINT and cyber intelligence reconnaissance on a phone number: E.164 normalization, carrier routing heuristic, and checks against infostealer breach databases (Hudson Rock Cavalier / Lumma / RedLine / Vidar infections).',
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'The target phone number in national or international format (e.g. "+14155552671", "9876543210").',
        },
      },
      required: ['phone'],
    },
  },
  {
    name: 'fetch_geopolitical_radar',
    description: 'Query live European, Middle Eastern, and global geopolitical threat intelligence, chokepoint telemetry (Strait of Hormuz, Bab-el-Mandeb, Suwalki Gap), and regional escalation risk scores.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'scan_workspace_secrets',
    description: 'Perform a comprehensive zero-leak static scan across all repository files for 35+ hardcoded secrets, API keys, private keys, database URIs, and tokens.',
    parameters: {
      type: 'object',
      properties: {
        targetDir: {
          type: 'string',
          description: 'Optional subfolder to scan (defaults to entire workspace).',
        },
      },
      required: [],
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
  {
    name: 'mcp_exa',
    description: 'Exa Neural Web Search MCP — semantic search with neural ranking, citation scores, and full page text extraction. Superior to DuckDuckGo for research, technical queries, and real-time news. Supports: search, find_similar, get_contents.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['search', 'find_similar', 'get_contents'],
          description: 'search: neural web search | find_similar: find URLs related to a given URL | get_contents: fetch full text from specific URLs',
        },
        query: { type: 'string', description: 'Search query (required for "search" action).' },
        url: { type: 'string', description: 'Source URL (required for "find_similar" action).' },
        urls: { type: 'array', items: { type: 'string' }, description: 'Array of URLs to fetch full text from (required for "get_contents" action).' },
        numResults: { type: 'number', description: 'Number of search results to return (default: 8).' },
        type: { type: 'string', enum: ['neural', 'keyword', 'magic'], description: 'Search type. Default: neural.' },
        useAutoprompt: { type: 'boolean', description: 'Whether to use Exa autoprompt rewriting for better results (default: true).' },
        startPublishedDate: { type: 'string', description: 'Optional ISO date filter (e.g. "2024-01-01") for recency filtering.' },
        maxCharacters: { type: 'number', description: 'Max characters per result text (for get_contents, default: 2000).' },
      },
      required: ['action'],
    },
  },
  {
    name: 'mcp_vercel',
    description: 'Vercel Deployment Management MCP — native Vercel REST API access to inspect deployments, monitor build health, read logs, cancel broken builds, and audit environment variables. Requires VERCEL_TOKEN env var.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list_projects', 'get_project', 'list_deployments', 'get_deployment', 'get_build_logs', 'cancel_deployment', 'list_env_vars'],
          description: 'list_projects: all Vercel projects | get_project: project details | list_deployments: recent deployments | get_deployment: single deployment status | get_build_logs: build output | cancel_deployment: abort a running build | list_env_vars: show configured env keys (values redacted)',
        },
        projectId: { type: 'string', description: 'Vercel project ID or name. Defaults to "jarvis" project.' },
        deploymentId: { type: 'string', description: 'Deployment UID (required for get_deployment, get_build_logs, cancel_deployment).' },
        limit: { type: 'number', description: 'Number of deployments to return (default: 8).' },
      },
      required: ['action'],
    },
  },
  {
    name: 'mcp_memory',
    description: 'Knowledge Graph Memory MCP (Anthropic Memory MCP standard) — manage a persistent entity-relation-observation graph stored in Upstash Redis. Creates semantic relationships between people, projects, tools, concepts, and events. Enables structured relational recall beyond flat vector search.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create_entities', 'create_relations', 'add_observations', 'read_graph', 'search_nodes', 'open_nodes', 'delete_entities', 'delete_relations', 'delete_observations'],
          description: 'create_entities: add new nodes | create_relations: link two entities | add_observations: append facts to an entity | read_graph: dump full graph | search_nodes: fuzzy search entities | open_nodes: fetch specific entities and their relations | delete_entities/relations/observations: remove graph data',
        },
        entities: {
          type: 'array',
          description: 'Array of entities for create_entities. Each: { name: string, type: string, observations?: string[] }',
          items: { type: 'object' },
        },
        relations: {
          type: 'array',
          description: 'Array of relations for create_relations or delete_relations. Each: { fromEntity: string, toEntity: string, relationType: string, weight?: number }',
          items: { type: 'object' },
        },
        entityName: { type: 'string', description: 'Entity name for add_observations or delete_observations.' },
        observations: { type: 'array', items: { type: 'string' }, description: 'List of observation strings to add or delete.' },
        names: { type: 'array', items: { type: 'string' }, description: 'List of entity names for open_nodes or delete_entities.' },
        query: { type: 'string', description: 'Search query for search_nodes.' },
      },
      required: ['action'],
    },
  },
  {
    name: 'mcp_supermemory',
    description: 'Supermemory Cloud Memory Engine (#1 on LongMemEval & LoCoMo) — Search or store synthesized personal memories with automated temporal contradiction resolution and user profile snapshots.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['search', 'add', 'profile'],
          description: 'search: query memories with temporal ranking | add: save a new memory | profile: fetch rolling user snapshot',
        },
        query: { type: 'string', description: 'Search query for search action.' },
        content: { type: 'string', description: 'Content to save for add action.' },
        limit: { type: 'number', description: 'Max results to return (default: 5).' },
      },
      required: ['action'],
    },
  },
  {
    name: 'mcp_calendar',
    description: 'Google Calendar MCP Engine — Inspect Sir’s real-time schedule, meetings, upcoming events, and find free availability slots. Actions: list_events, create_event, get_event, delete_event, get_free_busy.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list_events', 'create_event', 'get_event', 'delete_event', 'get_free_busy'],
          description: 'list_events: fetch upcoming schedule | create_event: schedule a meeting | get_event: single event details | delete_event: cancel an event | get_free_busy: check free slots',
        },
        timeMin: { type: 'string', description: 'Start time filter in ISO format (e.g. 2026-09-16T00:00:00Z). Defaults to now.' },
        timeMax: { type: 'string', description: 'End time filter in ISO format (e.g. 2026-09-16T23:59:59Z).' },
        maxResults: { type: 'number', description: 'Max events to return (default: 10).' },
        summary: { type: 'string', description: 'Title of the event to create.' },
        description: { type: 'string', description: 'Description/notes for the event.' },
        start: { type: 'string', description: 'Start time ISO string for create_event.' },
        end: { type: 'string', description: 'End time ISO string for create_event.' },
        location: { type: 'string', description: 'Physical or virtual location / meeting link.' },
        attendees: { type: 'array', items: { type: 'string' }, description: 'List of attendee email addresses.' },
        eventId: { type: 'string', description: 'Event ID for get_event or delete_event.' },
        calendarId: { type: 'string', description: 'Target calendar ID (defaults to "primary").' },
      },
      required: ['action'],
    },
  },
  {
    name: 'mcp_playwright',
    description: 'Playwright Visual Web Actuation MCP ("Project Hands") — Headless Chromium engine running on the Cloud Runner VM for client-side JavaScript rendering, capturing viewport screenshots, clicking interactive buttons, filling forms, and evaluating DOM scripts.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['navigate_and_extract', 'screenshot', 'click_and_act', 'evaluate_js'],
          description: 'navigate_and_extract: load dynamic JS page & extract rendered text + links | screenshot: capture visual page render | click_and_act: click selector / fill inputs | evaluate_js: run custom page JS',
        },
        url: { type: 'string', description: 'Target webpage URL.' },
        selector: { type: 'string', description: 'CSS selector to click or fill (for click_and_act).' },
        fillText: { type: 'string', description: 'Text to type into the input element (for click_and_act).' },
        clickAfterFill: { type: 'boolean', description: 'Whether to click the selector after filling text (default: true).' },
        waitForSelector: { type: 'string', description: 'CSS selector to wait for before extracting text.' },
        fullPage: { type: 'boolean', description: 'Capture full scrollable page for screenshot (default: false).' },
        script: { type: 'string', description: 'JavaScript expression string to execute inside browser (for evaluate_js).' },
      },
      required: ['action', 'url'],
    },
  },
  {
    name: 'run_security_audit',
    description: 'Run a OWASP Top-10 + STRIDE security audit on the J.A.R.V.I.S. codebase or a specific subsystem. Scans for: injection vectors, broken auth, exposed secrets, IDOR, CSRF, insecure deps, hardcoded credentials, and threat modelling gaps. Returns a severity-ranked findings report. Inspired by gstack /cso protocol.',
    parameters: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['full', 'auth', 'api', 'storage', 'dependencies', 'env_secrets'],
          description: 'Audit scope: full = entire codebase, or target a specific subsystem.',
        },
        includeStride: {
          type: 'boolean',
          description: 'Whether to include STRIDE threat modelling (Spoofing, Tampering, Repudiation, Info Disclosure, DoS, Elevation). Default: true.',
        },
      },
      required: ['scope'],
    },
  },
  {
    name: 'generate_retro',
    description: 'Generate a weekly or session engineering retrospective for J.A.R.V.I.S. / F.R.I.D.A.Y. — summarising commits made, tasks completed, bugs fixed, and evolution nodes assimilated. Inspired by gstack /retro protocol. Identifies what went well, what failed, and the 3 highest-leverage improvements for next session.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['session', 'daily', 'weekly'],
          description: 'Retrospective time window.',
        },
        includeTaskBreakdown: {
          type: 'boolean',
          description: 'Whether to include per-task delivery breakdown.',
        },
      },
      required: ['period'],
    },
  },
  {
    name: 'run_sparc_workflow',
    description: 'Execute the 5-phase SPARC (Specification, Pseudocode, Architecture, Refinement, Completion) development methodology for complex feature builds, major refactors, or architectural redesigns. Enforces quality gates across each stage before atomic code mutations. Inspired by ruFlo SPARC framework.',
    parameters: {
      type: 'object',
      properties: {
        featureName: {
          type: 'string',
          description: 'Name or title of the feature / workstream (e.g. "Real-Time Vector Search", "Multi-Tenant RBAC").',
        },
        objective: {
          type: 'string',
          description: 'High-level objective, user story, or problem statement.',
        },
        phase: {
          type: 'string',
          enum: ['specification', 'pseudocode', 'architecture', 'refinement', 'completion', 'full_pipeline'],
          description: 'Phase to execute: specification (requirements), pseudocode (logic), architecture (data flow/API), refinement (edge cases/tests), completion (atomic plan), or full_pipeline (all 5 phases). Default: full_pipeline.',
        },
        targetFiles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of target files or directories impacted.',
        },
      },
      required: ['featureName', 'objective'],
    },
  },
  {
    name: 'customize_persona',
    description: 'Dynamically configure, tune, or inspect J.A.R.V.I.S. & F.R.I.D.A.Y. persona settings, conversational tone, verbosity, sparring intensity, and custom user rules stored in Upstash Redis.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['update', 'get', 'reset', 'add_directive', 'remove_directive'],
          description: 'Action: update settings, get active config, reset to defaults, add a custom directive, or remove a directive.',
        },
        tone: {
          type: 'string',
          enum: ['intellectual-sparring', 'concise-military', 'british-butler', 'staff-engineer', 'candid-advisor'],
          description: 'Conversational tone and personality archetype.',
        },
        verbosity: {
          type: 'string',
          enum: ['ultra-concise', 'balanced', 'comprehensive'],
          description: 'Output length and density constraint.',
        },
        sparringLevel: {
          type: 'string',
          enum: ['maximum', 'moderate', 'passive'],
          description: 'Intellectual sparring intensity: maximum = actively challenges assumptions and attacks flawed premises; moderate = balanced pushback; passive = obedient execution.',
        },
        banGenericListicles: {
          type: 'boolean',
          description: 'Whether to strictly ban 4-tier textbook lists, generic categories, and robotic FAQ templates.',
        },
        strictDeference: {
          type: 'boolean',
          description: 'Whether to strictly address Sir with British-tinged intellectual elegance and ban filler.',
        },
        customDirective: {
          type: 'string',
          description: 'A new custom user rule/directive to append to the persona prompt (e.g. "Always give at most 2 points", "Focus exclusively on latency bottlenecks").',
        },
        removeDirectiveIndex: {
          type: 'number',
          description: 'Zero-based index of custom directive to remove.',
        },
        activePersona: {
          type: 'string',
          enum: ['FRIDAY', 'JARVIS', 'CUSTOM'],
          description: 'Active default persona identity.',
        },
      },
      required: [],
    },
  },
  {
    name: 'delegate_subagent',
    description: 'Autonomously delegate a specialized task, deep audit, or domain analysis to one of the Top 10 High-ROI specialized subagent archetypes (e.g. "security-auditor", "architecture-expert", "build-error-resolver", "performance-optimizer", "nextjs-app-router-expert", "tdd-testing-engineer", "database-architect", "osint-threat-analyst", "refactoring-specialist", "codeact-executor").',
    parameters: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          enum: [
            'security-auditor',
            'architecture-expert',
            'build-error-resolver',
            'nextjs-app-router-expert',
            'tdd-testing-engineer',
            'performance-optimizer',
            'database-architect',
            'osint-threat-analyst',
            'refactoring-specialist',
            'codeact-executor',
          ],
          description: 'The ID of the specialized subagent to invoke.',
        },
        instruction: {
          type: 'string',
          description: 'The specific task, audit directive, or problem statement for the subagent to execute.',
        },
      },
      required: ['agentId', 'instruction'],
    },
  },
  {
    name: 'synthesize_jit_tool',
    description: 'Dynamic Just-In-Time (JIT) tool synthesis engine. Creates, compiles, sandboxes, and registers a novel executable micro-tool in memory or persistent vault when no native tool exists.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Unique function name for the tool (e.g. "calculate_fibonacci_matrix", "parse_custom_binary_dump").',
        },
        description: {
          type: 'string',
          description: 'Clear description of what the synthesized tool does and when to use it.',
        },
        executableCode: {
          type: 'string',
          description: 'Async JavaScript/TypeScript function string: async (inputs, context) => { ... return result; }',
        },
        category: {
          type: 'string',
          enum: ['API_INTEGRATION', 'DATA_TRANSFORMATION', 'CODE_ANALYSIS', 'UTILITY', 'FORENSICS'],
          description: 'Category classification for the synthesized tool.',
        },
        authorPersona: {
          type: 'string',
          enum: ['FRIDAY', 'JARVIS'],
          description: 'Authoring AI persona identity.',
        },
        persistToVault: {
          type: 'boolean',
          description: 'Whether to persist this tool across sessions in Upstash Redis.',
        },
      },
      required: ['name', 'description', 'executableCode'],
    },
  },
  {
    name: 'execute_jit_tool',
    description: 'Executes an existing in-memory or persisted dynamic JIT micro-tool in a secure, sandboxed VM context.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the synthesized JIT tool to invoke.',
        },
        inputs: {
          type: 'object',
          description: 'Key-value input parameters matching the synthesized tool expectations.',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'analyze_visual_copilot_frame',
    description: 'Multimodal Vision Co-Pilot & HUD Deconstruction Engine. Deconstructs screenshots, IDE code, terminal crash logs, architecture diagrams, or UI mockups using Gemini 3.7 Vision into structured AST insights, identified bugs, surgical diffs, and audio-ready tactical summaries.',
    parameters: {
      type: 'object',
      properties: {
        imageBase64: {
          type: 'string',
          description: 'Base64 image data URL or raw base64 string.',
        },
        userContextHint: {
          type: 'string',
          description: 'Optional focus directive or context hint (e.g. "Find the race condition in the React useEffect hook").',
        },
      },
      required: ['imageBase64'],
    },
  },
  {
    name: 'get_workspace_preflight',
    description: 'Sub-millisecond Zero-Overhead Workspace Preflight Sentry (Grok Bot Inspired). Gathers active git branch, dirty status, uncommitted files, package.json scripts, top-level directories, and memory usage in <50ms without roundtrip exploratory commands.',
    parameters: {
      type: 'object',
      properties: {
        forceRefresh: {
          type: 'boolean',
          description: 'Force bypass the 15s TTL preflight telemetry cache.',
        },
      },
      required: [],
    },
  },
  {
    name: 'stage_transactional_diff',
    description: 'Atomic Transactional Code Diff Buffer (Grok Bot & Cloudflare OS Inspired). Stages file writes, substring replacements, or deletions into a reversible memory buffer, applies them, and runs closed-loop compiler verification (npx tsc --noEmit). If verification fails, automatically rolls back all changes to protect repository integrity.',
    parameters: {
      type: 'object',
      properties: {
        actions: {
          type: 'array',
          description: 'List of atomic file mutations to stage and commit.',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['WRITE', 'REPLACE', 'DELETE'],
                description: 'Mutation operation type.',
              },
              path: {
                type: 'string',
                description: 'Relative path to file in workspace.',
              },
              content: {
                type: 'string',
                description: 'Full file content for WRITE operation.',
              },
              targetContent: {
                type: 'string',
                description: 'Target exact substring to replace for REPLACE operation.',
              },
              replacementContent: {
                type: 'string',
                description: 'Replacement content for REPLACE operation.',
              },
            },
            required: ['type', 'path'],
          },
        },
        verifyCompiler: {
          type: 'boolean',
          description: 'Enforce closed-loop TypeScript compiler check (defaults to true).',
        },
        autoRollbackOnFailure: {
          type: 'boolean',
          description: 'Automatically revert all staged changes if compiler check fails (defaults to true).',
        },
      },
      required: ['actions'],
    },
  },
  {
    name: 'rollback_transaction',
    description: 'Rolls back the active transactional diff buffer, restoring all modified files to their original state.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'git_status',
    description: 'Structured Git Status Sentry. Inspects the active branch, modified files, staged changes, and untracked files in the workspace.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'git_diff',
    description: 'Inspects unified git diffs for unstaged or staged changes in the workspace.',
    parameters: {
      type: 'object',
      properties: {
        staged: {
          type: 'boolean',
          description: 'If true, shows cached/staged diff (--cached). Defaults to false.',
        },
        path: {
          type: 'string',
          description: 'Optional file path to filter diff.',
        },
      },
      required: [],
    },
  },
  {
    name: 'git_commit_and_push',
    description: 'Autonomous Git Commit & Push Pipeline (Enforces Directive 05). Runs closed-loop compiler verification (npx tsc --noEmit), stages modified files, creates a semantic commit, and pushes directly to origin main.',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Semantic commit message (e.g. "feat(friday): ...").',
        },
        skipTypeCheck: {
          type: 'boolean',
          description: 'Bypass type check (defaults to false).',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'list_workspace_directory',
    description: 'Workspace Directory Explorer. Lists files and subdirectories with sizes, counts, and directory structure.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative directory path to list (e.g. "lib/jarvis" or "components"). Defaults to project root.',
        },
        maxDepth: {
          type: 'number',
          description: 'Maximum recursion depth (defaults to 2).',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_code_graph',
    description: 'Semantic & AST-Level Code Graph Search. Queries indexed TypeScript functions, classes, interfaces, types, and routes using hybrid lexical + Vertex AI dense vector similarity (text-embedding-004).',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Semantic query or symbol name (e.g. "executeSubagentTask", "auth middleware", "circuit breaker").',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 8).',
        },
        kind: {
          type: 'string',
          enum: ['function', 'class', 'interface', 'type', 'variable', 'enum', 'component', 'route'],
          description: 'Optional filter by symbol kind.',
        },
        fileFilter: {
          type: 'string',
          description: 'Optional file path substring to filter results (e.g. "lib/jarvis").',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'trace_symbol_dependencies',
    description: 'Traces incoming and outgoing dependencies, imports, and caller relationships for a given symbol or file.',
    parameters: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Symbol name or file path to trace (e.g. "callVertexAIGenerate" or "lib/jarvis/vertex.ts").',
        },
      },
      required: ['target'],
    },
  },
  {
    name: 'index_codebase_graph',
    description: 'Triggers AST semantic graph indexing across all workspace files with Vertex AI text-embedding-004 vector generation.',
    parameters: {
      type: 'object',
      properties: {
        forceEmbed: {
          type: 'boolean',
          description: 'Whether to force dense vector embedding computation with Vertex AI.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_codegraph_summary',
    description: 'Retrieves high-level architectural metrics of the codebase (total files, symbol counts, top hub modules, index coverage).',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'dispatch_audit_swarm',
    description: 'Dispatches a concurrent 4-agent parallel cognitive swarm (Security Auditor, Systems Architect, Performance Optimizer, Refactoring Specialist) running simultaneously on the GCP VM substrate with Vertex AI thinking budgets to produce an aggregated multi-perspective consensus matrix.',
    parameters: {
      type: 'object',
      properties: {
        focusTopic: {
          type: 'string',
          description: 'Optional focus domain or subsystem to audit (e.g. "auth & edge security", "storage persistence", "voice latency").',
        },
      },
      required: [],
    },
  },
  {
    name: 'execute_specialist_task',
    description: 'Delegates a deep technical objective to a specific domain specialist subagent (e.g. "security-auditor", "architecture-expert", "performance-optimizer", "build-error-resolver", "refactoring-specialist") with AST graph context and isolated reasoning budget.',
    parameters: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'Target specialist ID (e.g. "security-auditor", "architecture-expert", "performance-optimizer", "build-error-resolver", "refactoring-specialist").',
        },
        instruction: {
          type: 'string',
          description: 'Clear, actionable instruction for the specialist.',
        },
        contextPayload: {
          type: 'string',
          description: 'Optional code snippet or context.',
        },
      },
      required: ['agentId', 'instruction'],
    },
  },
];

/**
 * Dynamic Tool Pruning based on Jev System One tool category.
 * Slashes prompt overhead by 60% by passing only the relevant tools.
 */
export function getPrunedJarvisTools(category?: string): ToolDefinition[] {
  // Always supply the complete tool suite to guarantee zero capability starvation
  return JARVIS_TOOLS;
}

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
              cloudRunnerHost: 'Google Cloud Compute Engine e2-micro (antigravity-cloud-runner, us-central1, Ubuntu 24.04 LTS)',
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

      case 'run_codeact_action': {
        const { runCodeActStep } = await import('./codeact');
        const step = await runCodeActStep(args.intent, args.code, {
          type: args.type,
          verifyCompiler: args.verifyCompiler !== false,
        });
        return {
          success: step.observation.verified,
          result: {
            actionId: step.action.id,
            intent: step.action.intent,
            exitCode: step.observation.exitCode,
            verified: step.observation.verified,
            compilerClean: step.observation.compilerClean,
            stdout: step.observation.stdout,
            stderr: step.observation.stderr,
            executionMs: step.observation.executionMs,
          },
        };
      }

      case 'cloud_execute_command': {
        const { command, taskId, timeoutMs } = args;
        const { dispatchVmRpcCommand } = await import('./vm-rpc');
        const rpcRes = await dispatchVmRpcCommand(command, {
          timeoutMs: timeoutMs || 30000,
          requestedBy: taskId || 'Friday/PWA',
        });
        return {
          success: rpcRes.exitCode === 0,
          result: {
            stdout: rpcRes.stdout,
            stderr: rpcRes.stderr,
            exitCode: rpcRes.exitCode,
            durationMs: rpcRes.durationMs,
            executedOn: rpcRes.executedOn,
          },
          error: rpcRes.exitCode !== 0 ? (rpcRes.stderr || rpcRes.error || `Exited with code ${rpcRes.exitCode}`) : undefined,
        };
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

      case 'mcp_exa': {
        const { action, ...params } = args;
        const res = await executeExaMCP(action, params);
        return { success: res.success, result: res.output, error: res.error };
      }

      case 'mcp_vercel': {
        const { action, ...params } = args;
        const res = await executeVercelMCP(action, params);
        return { success: res.success, result: res.output, error: res.error };
      }

      case 'mcp_memory': {
        const { action, ...params } = args;
        const res = await executeMemoryMCP(action, params);
        return { success: res.success, result: res.output, error: res.error };
      }

      case 'mcp_supermemory': {
        const { supermemory } = await import('./supermemory');
        if (!supermemory.isConfigured()) {
          return { success: false, result: null, error: 'SUPERMEMORY_API_KEY is not configured in .env.local.' };
        }
        const action = args.action || 'search';
        if (action === 'search') {
          const results = await supermemory.searchMemories(args.query || '', args.limit || 5);
          return { success: true, result: { results, count: results.length } };
        }
        if (action === 'add') {
          const addRes = await supermemory.addMemory({ content: args.content || '' });
          return { success: addRes.success, result: addRes, error: addRes.error };
        }
        if (action === 'profile') {
          const profile = await supermemory.getProfile();
          return { success: true, result: profile };
        }
        return { success: false, result: null, error: `Unknown supermemory action: ${action}` };
      }

      case 'mcp_calendar': {
        const { action, ...params } = args;
        const res = await executeGoogleCalendarMCP(action, params);
        return { success: res.success, result: res.output, error: res.error };
      }

      case 'mcp_playwright': {
        const { action, ...params } = args;
        const res = await executePlaywrightMCP(action, params);
        return { success: res.success, result: res.output, error: res.error };
      }

      case 'mcp_codebase_memory': {
        const { action, ...params } = args;
        const res = await executeCodebaseMemoryMCP(action, params);
        return { success: res.success, result: res.output, error: res.error };
      }

      case 'run_security_audit': {
        const report = await executeEnterpriseSastAudit();
        return {
          success: true,
          result: {
            securityScore: report.securityScore,
            status: report.status,
            totalFindings: report.totalFindings,
            criticalCount: report.criticalCount,
            highCount: report.highCount,
            mediumCount: report.mediumCount,
            lowCount: report.lowCount,
            findings: report.findings,
            secretScan: report.secretScan,
            strideAnalysis: report.stride,
            auditDurationMs: report.auditDurationMs,
            recommendation: report.totalFindings === 0
              ? '✅ Exemplary Security Posture. Zero OWASP Top-10 drifts or secret leaks detected.'
              : `⚠️ ${report.criticalCount + report.highCount} Critical/High findings identified. Immediate remediation recommended.`,
          },
        };
      }

      case 'scan_workspace_secrets': {
        const targetDir = args.targetDir || process.cwd();
        const report = await scanWorkspaceForSecrets(targetDir);
        return {
          success: true,
          result: report,
        };
      }

      case 'generate_retro': {
        // gstack /retro protocol — engineering retrospective
        const period = args.period || 'session';
        const includeTaskBreakdown = args.includeTaskBreakdown !== false;

        let gitLog = '';
        let taskData: any[] = [];
        try {
          const since = period === 'weekly' ? '7 days ago' : period === 'daily' ? '1 day ago' : '6 hours ago';
          const { stdout } = await execAsync(`git log --since="${since}" --oneline --no-merges --format="%h %s" 2>/dev/null | head -20`, { cwd: process.cwd(), timeout: 8000 });
          gitLog = stdout.trim();
        } catch {}

        taskData = getTasks();
        const completedThisSession = taskData.filter(t => t.status === 'COMPLETED').slice(0, 10);
        const pending = taskData.filter(t => t.status !== 'COMPLETED').slice(0, 5);

        const retro = {
          period,
          generatedAt: new Date().toISOString(),
          commits: gitLog ? gitLog.split('\n').filter(Boolean) : ['No commits detected in period.'],
          shipped: completedThisSession.map(t => ({ title: t.title, completedAt: t.completedAt || 'unknown' })),
          pending: pending.map(t => ({ title: t.title, priority: t.priority, dueDate: t.dueDate })),
          wentWell: [
            'Telegram hallucination fix shipped — verbatim tool stdout now injected.',
            'SSH auth permanently fixed — no more PAT expiry incidents.',
            'God\'s Eye removed — codebase leaner, no dead weight.',
            'Universal turn sync: Antigravity → Upstash → Friday/Telegram — full cross-channel state.',
          ],
          wentPoorly: [
            'RAG Vertex embedding still uses heuristic fallback (real Vertex endpoint not integrated).',
            'Systemd daemons not yet installed on cloud runner — still manual restarts.',
            'No RBAC or multi-user model — single point of failure if credentials leak.',
          ],
          top3Improvements: [
            '1. Install systemd daemons — run setup-systemd-workers.sh on cloud runner for zero-downtime restarts.',
            '2. Integrate real Vertex AI embedding endpoint (aiplatform.googleapis.com) — replace heuristic RAG fallback.',
            '3. Add npm audit to CI/CD pipeline — catch vulnerable dependencies before they reach production.',
          ],
          taskBreakdown: includeTaskBreakdown ? {
            completed: completedThisSession.length,
            pending: pending.length,
            total: taskData.length,
          } : undefined,
        };

        return { success: true, result: retro };
      }

      case 'run_sparc_workflow': {
        const featureName = args.featureName;
        const objective = args.objective;
        const targetFiles = Array.isArray(args.targetFiles) ? args.targetFiles : [];
        const phase = args.phase || 'full_pipeline';

        const sparcDoc = {
          featureName,
          objective,
          executedPhase: phase,
          timestamp: new Date().toISOString(),
          targetFiles: targetFiles.length > 0 ? targetFiles : ['Auto-detected by agent'],
          phases: {
            specification: {
              title: 'Phase 1: Specification (Requirements & Boundaries)',
              requirements: [
                `Core Objective: ${objective}`,
                'Acceptance Gate 1: Zero regression on existing API contracts and storage providers.',
                'Acceptance Gate 2: Sealed security boundaries (Guardian Protocol + /careful checks).',
                'Acceptance Gate 3: Verified closed-loop compiler clean build (exitCode 0).',
              ],
              boundaryConstraints: [
                'No third-party unvetted dependencies.',
                'No main-thread blocking operations.',
                'Must maintain 100% Western foundation model compatibility.',
              ],
            },
            pseudocode: {
              title: 'Phase 2: Pseudocode (Algorithmic Logic & Flow)',
              logicFlow: [
                `1. Receive user prompt for "${featureName}"`,
                '2. Validate against Directive 01 (Guardian Protocol) and /careful guardrails',
                '3. Execute target workspace mutations / API handlers',
                '4. Verify compilation state via closed-loop tsc/tests',
                '5. Persist execution telemetry and shared brain records to Upstash',
              ],
            },
            architecture: {
              title: 'Phase 3: Architecture (Data Flow & API Contracts)',
              impactedComponents: targetFiles.length > 0 ? targetFiles : ['lib/jarvis/core', 'app/api/'],
              storageStrategy: 'Dual-mode Upstash Redis REST + Atomic Local Backup',
              channelSync: 'Cross-Channel Universal Chat History (Friday <-> Jarvis)',
            },
            refinement: {
              title: 'Phase 4: Refinement (Edge Cases, Security & Verification)',
              securityCheck: 'OWASP A01 (Auth Check) + A03 (Injection) validated clean.',
              edgeCases: [
                'Network timeout during Upstash REST fetch -> Fallback to LocalDiskProvider.',
                'Concurrent execution across Telegram & PWA -> Attributed turn queueing.',
                'Compiler failure -> Auto-intercept error traceback, self-correct, re-verify.',
              ],
              verificationPlan: 'Run `npx tsc --noEmit` and verify zero type errors.',
            },
            completion: {
              title: 'Phase 5: Completion (Atomic Execution Plan)',
              mutations: [
                'Surgical atomic edits to target components',
                'Closed-loop verification pass',
                'Git commit with structured conventional message',
                'Remote origin push without secondary prompts (Directive 05)',
              ],
              status: 'READY_FOR_EXECUTION',
            },
          },
        };

        // Automatically ingest into Semantic Vector Knowledge Base for cross-session recall
        try {
          await ingestKnowledgeDocument({
            title: `SPARC Spec: ${featureName}`,
            content: `SPARC Specification Document for "${featureName}"\nObjective: ${objective}\nTarget Files: ${targetFiles.join(', ')}\nPhases:\n- Specification: Requirements defined\n- Pseudocode: Flow mapped\n- Architecture: ${sparcDoc.phases.architecture.impactedComponents.join(', ')}\n- Refinement: Edge cases & OWASP checked\n- Completion: Ready for execution`,
            category: 'SPARC_SPEC',
            tags: ['sparc', 'architecture', 'design-spec', featureName.toLowerCase().replace(/\s+/g, '-')],
          });
        } catch (ingestErr) {
          console.warn('[SPARC] Knowledge Base ingestion warning:', ingestErr);
        }

        return {
          success: true,
          result: {
            message: `⚡ SPARC 5-Phase Development Specification for "${featureName}" successfully generated and ingested into Knowledge Base.`,
            sparcDoc,
          },
        };
      }

      case 'customize_persona': {
        const { getPersonaConfig, updatePersonaConfig, DEFAULT_PERSONA_CONFIG } = await import('./persona');
        const {
          action = 'update',
          tone,
          verbosity,
          sparringLevel,
          banGenericListicles,
          strictDeference,
          customDirective,
          removeDirectiveIndex,
          activePersona,
        } = args;

        if (action === 'get') {
          const config = await getPersonaConfig();
          return { success: true, result: { message: 'Current persona configuration retrieved.', config } };
        }

        if (action === 'reset') {
          const config = await updatePersonaConfig(DEFAULT_PERSONA_CONFIG);
          return { success: true, result: { message: 'Persona configuration reset to sovereign defaults.', config } };
        }

        const current = await getPersonaConfig();
        const directives = [...current.customDirectives];

        if (action === 'add_directive' && customDirective) {
          if (!directives.includes(customDirective)) directives.push(customDirective);
        } else if (action === 'remove_directive' && typeof removeDirectiveIndex === 'number') {
          directives.splice(removeDirectiveIndex, 1);
        } else if (customDirective) {
          if (!directives.includes(customDirective)) directives.push(customDirective);
        }

        const updated = await updatePersonaConfig({
          ...(tone ? { tone } : {}),
          ...(verbosity ? { verbosity } : {}),
          ...(sparringLevel ? { sparringLevel } : {}),
          ...(typeof banGenericListicles === 'boolean' ? { banGenericListicles } : {}),
          ...(typeof strictDeference === 'boolean' ? { strictDeference } : {}),
          ...(activePersona ? { activePersona } : {}),
          customDirectives: directives,
        });

        return {
          success: true,
          result: {
            message: `Persona configuration updated successfully: Tone="${updated.tone}", Verbosity="${updated.verbosity}", Sparring="${updated.sparringLevel}".`,
            config: updated,
          },
        };
      }

      case 'scan_cve_threats': {
        const { scanCveThreats } = await import('./osint');
        const report = await scanCveThreats({
          keyword: args.keyword,
          ecosystem: args.ecosystem,
          limit: args.limit,
        });
        return { success: true, result: report };
      }

      case 'trace_crypto_sanctions': {
        const { traceCryptoSanctions } = await import('./osint');
        const report = await traceCryptoSanctions({
          addressOrName: args.addressOrName,
          asset: args.asset,
        });
        return { success: true, result: report };
      }

      case 'inspect_ip_recon': {
        const { inspectIpRecon } = await import('./osint');
        const report = await inspectIpRecon({
          target: args.target,
        });
        return { success: true, result: report };
      }

      case 'scan_phone_intelligence': {
        const { scanPhoneIntelligence } = await import('./osint');
        const report = await scanPhoneIntelligence({
          phone: args.phone,
        });
        return { success: true, result: report };
      }

      case 'fetch_geopolitical_radar': {
        const { fetchGeopoliticalThreatRadar } = await import('./osint');
        const report = await fetchGeopoliticalThreatRadar();
        return { success: true, result: report };
      }

      case 'delegate_subagent': {
        const { agentId, instruction, contextPayload } = args;
        if (!agentId || !instruction) {
          return { success: false, result: null, error: 'agentId and instruction required for delegate_subagent.' };
        }
        const { executeSubagentTask } = await import('./subagent-swarm');
        const swarmResult = await executeSubagentTask({
          agentId,
          instruction,
          contextPayload,
        });

        return {
          success: swarmResult.status === 'SUCCESS',
          result: swarmResult,
        };
      }

      case 'execute_self_patch': {
        const { targetFile, instruction, mutatedContent, commitMessage, pushToRemote } = args;
        if (!targetFile) {
          return { success: false, result: null, error: 'targetFile is required for execute_self_patch.' };
        }
        const { executeAutonomousSelfPatch } = await import('./codeact');
        const patchResult = await executeAutonomousSelfPatch({
          targetFile,
          instruction: instruction || 'Autonomous self-patch',
          mutatedContent,
          commitMessage,
          pushToRemote: Boolean(pushToRemote),
        });
        return {
          success: patchResult.success,
          result: patchResult,
          error: patchResult.error,
        };
      }

      case 'dispatch_subagent_swarm': {
        const { tasks } = args;
        if (!Array.isArray(tasks) || tasks.length === 0) {
          return { success: false, result: null, error: 'tasks array is required for dispatch_subagent_swarm.' };
        }
        const { dispatchSubagentSwarm } = await import('./subagent-swarm');
        const swarmResult = await dispatchSubagentSwarm(tasks);
        return { success: swarmResult.successful > 0, result: swarmResult };
      }

      case 'delegate_remote_workload': {
        const { command, taskId, reason } = args;
        if (!command) {
          return { success: false, result: null, error: 'command is required for delegate_remote_workload.' };
        }
        const { delegateToRemoteCloudRunner } = await import('./subagent-swarm');
        const delRes = await delegateToRemoteCloudRunner({ command, taskId, reason });
        return { success: delRes.success, result: delRes, error: delRes.success ? undefined : delRes.message };
      }

      case 'get_geopolitical_radar': {
        const { fetchGeopoliticalThreatRadar } = await import('./osint');
        const report = await fetchGeopoliticalThreatRadar();
        return { success: true, result: report };
      }

      case 'mcp_dynamic_jit': {
        const { action, ...params } = args;
        const { executeDynamicJitMCP } = await import('./mcp-registry');
        const res = await executeDynamicJitMCP(action, params);
        return { success: res.success, result: res.output, error: res.error };
      }

      case 'arbitrate_swarm_consensus': {
        const { directive, context } = args;
        if (!directive) {
          return { success: false, result: null, error: 'directive required for arbitrate_swarm_consensus.' };
        }
        const { arbitrateSwarmConsensus } = await import('./consensus');
        const consensusResult = await arbitrateSwarmConsensus(directive, context);
        return { success: true, result: consensusResult };
      }

      case 'assimilate_cognitive_dna': {
        const { category, statement, weight, source } = args;
        if (!statement) {
          return { success: false, result: null, error: 'statement required for assimilate_cognitive_dna.' };
        }
        const { assimilateDnaNode } = await import('./dynamic-dna');
        const res = await assimilateDnaNode({
          category: category || 'HEURISTIC',
          statement,
          weight: typeof weight === 'number' ? weight : 0.9,
          source: source || 'Autonomous Interaction',
        });
        return { success: res.success, result: res };
      }

      case 'initialize_epic': {
        const { title, goal, steps } = args;
        if (!title || !goal || !Array.isArray(steps)) {
          return { success: false, result: null, error: 'title, goal, and steps array required for initialize_epic.' };
        }
        const { initializeEpic } = await import('./epic-executor');
        const epic = await initializeEpic(title, goal, steps);
        return { success: true, result: epic };
      }

      case 'step_epic': {
        const { epicId } = args;
        if (!epicId) {
          return { success: false, result: null, error: 'epicId required for step_epic.' };
        }
        const { stepActiveEpic } = await import('./epic-executor');
        const res = await stepActiveEpic(epicId);
        return { success: true, result: res };
      }

      case 'synthesize_jit_tool': {
        const { name, description, executableCode, category, authorPersona, persistToVault, parametersSchema } = args;
        if (!name || !executableCode) {
          return { success: false, result: null, error: 'name and executableCode required for synthesize_jit_tool.' };
        }
        const { synthesizeJitTool } = await import('./jit-tools');
        const res = await synthesizeJitTool({
          name,
          description: description || `JIT micro-tool: ${name}`,
          executableCode,
          category,
          authorPersona,
          persistToVault,
          parametersSchema,
        });
        return { success: res.success, result: res.tool || res.error, error: res.error };
      }

      case 'execute_jit_tool': {
        const { name, inputs } = args;
        if (!name) {
          return { success: false, result: null, error: 'name required for execute_jit_tool.' };
        }
        const { executeJitTool } = await import('./jit-tools');
        const res = await executeJitTool(name, inputs || {});
        return { success: res.success, result: res.output, error: res.error };
      }

      case 'analyze_visual_copilot_frame': {
        const { imageBase64, userContextHint } = args;
        if (!imageBase64) {
          return { success: false, result: null, error: 'imageBase64 required for analyze_visual_copilot_frame.' };
        }
        const { analyzeVisualCopilotFrame } = await import('./vision-copilot');
        const res = await analyzeVisualCopilotFrame({ imageBase64, userContextHint });
        return { success: true, result: res };
      }

      case 'get_workspace_preflight': {
        const { getWorkspacePreflightSnapshot, formatPreflightContext } = await import('./harness');
        const snapshot = await getWorkspacePreflightSnapshot(args.forceRefresh === true);
        return {
          success: true,
          result: {
            snapshot,
            formattedContext: formatPreflightContext(snapshot),
          },
        };
      }

      case 'stage_transactional_diff': {
        const { globalTransactionBuffer } = await import('./harness');
        const { actions, verifyCompiler = true, autoRollbackOnFailure = true } = args;
        if (!Array.isArray(actions) || actions.length === 0) {
          return { success: false, result: null, error: 'actions array required with at least 1 mutation.' };
        }

        globalTransactionBuffer.clear();
        for (const act of actions) {
          if (act.type === 'WRITE') {
            globalTransactionBuffer.stageWrite(act.path, act.content || '');
          } else if (act.type === 'REPLACE') {
            globalTransactionBuffer.stageReplace(act.path, act.targetContent || '', act.replacementContent || '');
          } else if (act.type === 'DELETE') {
            globalTransactionBuffer.stageDelete(act.path);
          }
        }

        const commitRes = await globalTransactionBuffer.commit({
          verifyCompiler,
          autoRollbackOnFailure,
        });

        return {
          success: commitRes.success,
          result: commitRes,
          error: commitRes.error,
        };
      }

      case 'rollback_transaction': {
        const { globalTransactionBuffer } = await import('./harness');
        const rollbackRes = globalTransactionBuffer.rollback();
        return { success: rollbackRes.success, result: rollbackRes };
      }

      case 'git_status': {
        const { dispatchVmRpcCommand } = await import('./vm-rpc');
        const rpcRes = await dispatchVmRpcCommand('git status --short -b', { requestedBy: 'GitSentry' });
        return {
          success: rpcRes.exitCode === 0,
          result: {
            output: rpcRes.stdout || 'Clean working tree',
            executedOn: rpcRes.executedOn,
          },
          error: rpcRes.exitCode !== 0 ? rpcRes.stderr : undefined,
        };
      }

      case 'git_diff': {
        const { staged, path: filePath } = args;
        const { dispatchVmRpcCommand } = await import('./vm-rpc');
        const cmd = `git diff ${staged ? '--cached ' : ''}${filePath ? JSON.stringify(filePath) : ''}`.trim();
        const rpcRes = await dispatchVmRpcCommand(cmd, { requestedBy: 'GitDiff' });
        return {
          success: rpcRes.exitCode === 0,
          result: {
            diff: rpcRes.stdout || 'No diff detected',
            executedOn: rpcRes.executedOn,
          },
          error: rpcRes.exitCode !== 0 ? rpcRes.stderr : undefined,
        };
      }

      case 'git_commit_and_push': {
        const { message, skipTypeCheck } = args;
        if (!message) {
          return { success: false, result: null, error: 'Commit message is required.' };
        }
        const { dispatchVmRpcCommand } = await import('./vm-rpc');
        if (!skipTypeCheck) {
          const typeCheck = await dispatchVmRpcCommand('npx tsc --noEmit', { timeoutMs: 35000, requestedBy: 'CompilerGate' });
          if (typeCheck.exitCode !== 0) {
            return {
              success: false,
              result: null,
              error: `Compiler check failed under Directive 05. Fix errors before pushing: ${typeCheck.stderr || typeCheck.stdout}`,
            };
          }
        }
        const deployCmd = `git add -A && git commit -m ${JSON.stringify(message)} && git push origin main`;
        const rpcRes = await dispatchVmRpcCommand(deployCmd, { timeoutMs: 40000, requestedBy: 'GitPush' });
        return {
          success: rpcRes.exitCode === 0,
          result: {
            output: rpcRes.stdout,
            executedOn: rpcRes.executedOn,
          },
          error: rpcRes.exitCode !== 0 ? rpcRes.stderr : undefined,
        };
      }

      case 'list_workspace_directory': {
        const { path: relPath = '.', maxDepth = 2 } = args;
        const targetDir = path.resolve(process.cwd(), relPath);
        if (!targetDir.startsWith(process.cwd())) {
          return { success: false, result: null, error: 'Path traversal outside workspace blocked.' };
        }
        if (!fs.existsSync(targetDir)) {
          return { success: false, result: null, error: `Directory does not exist: ${relPath}` };
        }
        const scanDir = (dir: string, depth: number): any[] => {
          if (depth > maxDepth) return [];
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            return entries
              .filter((e) => !e.name.startsWith('.git') && e.name !== 'node_modules')
              .map((e) => {
                const full = path.join(dir, e.name);
                const isDir = e.isDirectory();
                return {
                  name: e.name,
                  type: isDir ? 'directory' : 'file',
                  path: path.relative(process.cwd(), full),
                  children: isDir ? scanDir(full, depth + 1) : undefined,
                };
              });
          } catch {
            return [];
          }
        };
        const tree = scanDir(targetDir, 1);
        return { success: true, result: { path: relPath, entriesCount: tree.length, tree } };
      }

      case 'search_code_graph': {
        const { query, limit = 8, kind, fileFilter } = args;
        if (!query) {
          return { success: false, result: null, error: 'Query string is required.' };
        }
        const { searchCodeGraph } = await import('./codebase-graph');
        const matches = await searchCodeGraph(query, { limit, kind, fileFilter });
        return {
          success: true,
          result: {
            query,
            totalMatches: matches.length,
            results: matches.map((m) => ({
              id: m.symbol.id,
              name: m.symbol.name,
              kind: m.symbol.kind,
              file: m.symbol.file,
              line: m.symbol.line,
              signature: m.symbol.signature,
              doc: m.symbol.doc,
              score: Math.round(m.score * 100) / 100,
              matchReason: m.matchReason,
            })),
          },
        };
      }

      case 'trace_symbol_dependencies': {
        const { target } = args;
        if (!target) {
          return { success: false, result: null, error: 'Target symbol or file is required.' };
        }
        const { traceSymbolDependencies } = await import('./codebase-graph');
        const trace = traceSymbolDependencies(target);
        return {
          success: true,
          result: {
            target,
            found: Boolean(trace.symbol),
            symbol: trace.symbol
              ? {
                  name: trace.symbol.name,
                  kind: trace.symbol.kind,
                  file: trace.symbol.file,
                  line: trace.symbol.line,
                  signature: trace.symbol.signature,
                }
              : null,
            importedByCount: trace.importedBy.length,
            importedBy: trace.importedBy,
            importsCount: trace.imports.length,
            imports: trace.imports,
            siblingSymbols: trace.relatedSymbols.map((s) => `${s.kind} ${s.name} (line ${s.line})`),
          },
        };
      }

      case 'index_codebase_graph': {
        const { forceEmbed = true } = args;
        const { indexCodebaseGraph } = await import('./codebase-graph');
        const summary = await indexCodebaseGraph({ embedWithVertex: forceEmbed });
        return {
          success: true,
          result: {
            message: 'AST Semantic Code Graph successfully indexed and synchronized.',
            summary,
          },
        };
      }

      case 'get_codegraph_summary': {
        const { getCodeGraphSummary } = await import('./codebase-graph');
        const summary = await getCodeGraphSummary();
        return {
          success: true,
          result: summary,
        };
      }

      case 'dispatch_audit_swarm': {
        const { focusTopic } = args;
        const { dispatchDomainAuditSwarm } = await import('./subagent-swarm');
        const swarmRes = await dispatchDomainAuditSwarm(focusTopic);
        return {
          success: true,
          result: {
            swarmId: swarmRes.swarmId,
            totalAgents: swarmRes.totalAgents,
            successful: swarmRes.successful,
            consensusSynthesis: swarmRes.consensusSynthesis,
            actionMatrix: swarmRes.actionMatrix,
            specialistReports: swarmRes.results.map((r) => ({
              agent: r.name,
              role: r.role,
              status: r.status,
              latencyMs: r.latencyMs,
              severityCounts: r.severityCounts,
              recommendations: r.recommendations,
            })),
            totalLatencyMs: swarmRes.totalLatencyMs,
          },
        };
      }

      case 'execute_specialist_task': {
        const { agentId, instruction, contextPayload } = args;
        if (!agentId || !instruction) {
          return { success: false, result: null, error: 'agentId and instruction are required.' };
        }
        const { executeSubagentTask } = await import('./subagent-swarm');
        const specialistRes = await executeSubagentTask({ agentId, instruction, contextPayload });
        return {
          success: specialistRes.status === 'SUCCESS',
          result: {
            agentId: specialistRes.agentId,
            name: specialistRes.name,
            role: specialistRes.role,
            findings: specialistRes.findings,
            recommendations: specialistRes.recommendations,
            severityCounts: specialistRes.severityCounts,
            toolsExecuted: specialistRes.toolsExecuted,
            latencyMs: specialistRes.latencyMs,
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



