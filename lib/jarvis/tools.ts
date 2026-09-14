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

      default:
        return { success: false, result: null, error: `Unknown tool: ${toolName}` };
    }
  } catch (error: any) {
    return { success: false, result: null, error: error.message || 'Tool execution failure' };
  }
}
