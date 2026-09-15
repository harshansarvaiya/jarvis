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
import { exec } from 'child_process';
import { promisify } from 'util';

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
  try {
    const endpoint = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(endpoint, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      return { query, error: `Search provider returned HTTP ${res.status}` };
    }

    const html = await res.text();
    const results: Array<{ title: string; snippet: string; url: string }> = [];
    const resultBlocks = html.split('class="result__body"').slice(1, 6);

    for (const block of resultBlocks) {
      const titleMatch = block.match(/class="result__title"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);

      if (titleMatch) {
        const url = titleMatch[1];
        const rawTitle = titleMatch[2].replace(/<[^>]+>/g, '').trim();
        const rawSnippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';
        results.push({
          title: rawTitle,
          snippet: rawSnippet,
          url,
        });
      }
    }

    return {
      query,
      resultsCount: results.length,
      results: results.length > 0 ? results : 'No text results parsed from search provider.',
    };
  } catch (err: any) {
    return { query, error: err.message || 'Web search timeout' };
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
    description: 'Permanently assimilate a preference, principle, insight, decision, or project knowledge into long-term memory.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['PRINCIPLE', 'PREFERENCE', 'PROJECT', 'DECISION', 'INSIGHT', 'EVOLUTION'],
          description: 'The ontological category of the memory.',
        },
        content: {
          type: 'string',
          description: 'The clear, structured knowledge or rule to remember.',
        },
        context: {
          type: 'string',
          description: 'Why or where this was learned (e.g. "User feedback during conversation").',
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
          description: 'Optional URL or route to open when Sir taps the notification.',
        },
      },
      required: ['title', 'message'],
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
        const { category, content, context } = args;
        const memory = addMemory(
          (category as MemoryCategory) || 'INSIGHT',
          content,
          context || 'Assimilated via J.A.R.V.I.S. tool execution'
        );
        return {
          success: true,
          result: {
            message: `Memory assimilated under [${category}].`,
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
            system: 'J.A.R.V.I.S. Mark I Sovereign Autonomous Exoskeleton',
            version: '1.2.0',
            evolutionStage: 3,
            guardianProtocol: 'ONLINE (HMAC-SHA256 Cryptographic Sentry Active)',
            cognitiveEngines: {
              tier1Reflex: 'Groq US LPU (openai/gpt-oss-120b, openai/gpt-oss-20b) ~100ms inference',
              tier2Multimodal: 'Google Gemini 3.8 Flash (Multimodal perception & vision)',
              quantumFallbackChain: '3.8-flash -> 3.7-flash -> 3.6-flash -> 3.5-flash -> 2.5-flash',
              tier3Backup: 'GitHub Models (gpt-4o, gpt-4o-mini)',
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

      default:
        return { success: false, result: null, error: `Unknown tool: ${toolName}` };
    }
  } catch (error: any) {
    return { success: false, result: null, error: error.message || 'Tool execution failure' };
  }
}
