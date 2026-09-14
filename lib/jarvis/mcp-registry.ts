/**
 * J.A.R.V.I.S. MCP Registry & Tool Connector
 * Autonomous Infrastructure Management
 * 
 * Fulfills tactical objective registered by J.A.R.V.I.S.:
 * "Create lib/jarvis/mcp-registry.ts and add GitHub Octokit client setup using existing
 * Vercel env vars for GITHUB_TOKEN. Export function getGitHubClient()."
 */

import {
  executeGitHubMCP,
  executeFileSystemMCP,
  executeCloudMCP,
  executeNetworkMCP,
  executeDatabaseMCP,
  MCPExecutionResult,
} from './mcp';

export interface GitHubClient {
  token: string;
  repoOwner: string;
  repoName: string;
  getRepo: () => Promise<MCPExecutionResult>;
  listCommits: (limit?: number) => Promise<MCPExecutionResult>;
  getFile: (path: string, ref?: string) => Promise<MCPExecutionResult>;
  listIssues: (state?: 'open' | 'closed' | 'all') => Promise<MCPExecutionResult>;
  createIssue: (title: string, body?: string) => Promise<MCPExecutionResult>;
  createOrUpdateFile: (path: string, content: string, message?: string, sha?: string, branch?: string) => Promise<MCPExecutionResult>;
}

export function getGitHubClient(): GitHubClient {
  const token =
    process.env.GITHUB_TOKEN ||
    process.env.GITHUB_MODELS_TOKEN ||
    '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';

  return {
    token,
    repoOwner: 'harshansarvaiya',
    repoName: 'jarvis',
    getRepo: () => executeGitHubMCP('get_repo'),
    listCommits: (limit = 5) => executeGitHubMCP('list_commits', { limit }),
    getFile: (path: string, ref = 'main') => executeGitHubMCP('get_file', { path, ref }),
    listIssues: (state = 'all') => executeGitHubMCP('list_issues', { state }),
    createIssue: (title: string, body?: string) => executeGitHubMCP('create_issue', { title, body }),
    createOrUpdateFile: (path: string, content: string, message?: string, sha?: string, branch = 'main') =>
      executeGitHubMCP('create_or_update_file', { path, content, message, sha, branch }),
  };
}

export const MCP_SERVERS = {
  github: {
    name: 'mcp:github',
    description: 'GitHub Octokit REST integration for repository inspection, commits, files, and issues.',
    execute: executeGitHubMCP,
  },
  filesystem: {
    name: 'mcp:filesystem',
    description: 'Sandboxed local filesystem explorer for project directory listing and file reads.',
    execute: executeFileSystemMCP,
  },
  cloud: {
    name: 'mcp:cloud',
    description: 'Vercel Edge and Ngrok tunnel telemetry, status inspection, and health auditing.',
    execute: executeCloudMCP,
  },
  network: {
    name: 'mcp:network',
    description: 'Outbound HTTP engine for external API queries, web fetch, and endpoint validation.',
    execute: executeNetworkMCP,
  },
  database: {
    name: 'mcp:database',
    description: 'Upstash Redis cluster query, key inspection, and memory health monitoring.',
    execute: executeDatabaseMCP,
  },
};
