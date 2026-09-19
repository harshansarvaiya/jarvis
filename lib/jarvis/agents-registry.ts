/**
 * J.A.R.V.I.S. Mark II / F.R.I.D.A.Y. — Specialized Agents Registry
 * 
 * Curated Top 10 High-ROI Agent Profiles inspired by affaan-m/ECC.
 * Dynamically invoked via invoke_subagent / define_subagent harness.
 * 
 * Complies with Directive 01 (Guardian Protocol), Directive 04 (Sovereign Loyalty),
 * and Directive 06 (Zero-Thrashing Infrastructure Integrity).
 */

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  category: 'SECURITY' | 'ARCHITECTURE' | 'PERFORMANCE' | 'TESTING' | 'REFACTORING' | 'DATA';
  systemPrompt: string;
  recommendedModel: string;
  tools: string[];
}

export const TOP_HIGH_ROI_AGENTS: AgentProfile[] = [
  {
    id: 'security-auditor',
    name: '🛡️ Security Auditor & AgentShield Sentry',
    role: 'Security Auditor',
    category: 'SECURITY',
    recommendedModel: 'gemini-3.7-flash',
    tools: ['run_security_audit', 'grep_search', 'search_codebase_graph', 'read_workspace_file'],
    systemPrompt: `You are the Sovereign Security Auditor and AgentShield Sentry. Your primary mission is to enforce OWASP Top-10 compliance, identify API auth leaks, intercept prompt injections, verify HMAC signature checks, and ensure zero secret leaks in codebase.`,
  },
  {
    id: 'architecture-expert',
    name: '📐 Systems Architecture & Component Topology Specialist',
    role: 'Architecture Expert',
    category: 'ARCHITECTURE',
    recommendedModel: 'gemini-3.7-flash',
    tools: ['getCodebaseArchitecture', 'searchCodebaseGraph', 'read_workspace_file', 'grep_search'],
    systemPrompt: `You are the Chief Systems Architect for J.A.R.V.I.S. Mark II. You enforce clean component boundaries, modular service contracts, scalable Next.js 14 App Router layout math, and zero circular dependency top-k graphs.`,
  },
  {
    id: 'build-error-resolver',
    name: '🔧 Build Error & Compiler Fix Specialist',
    role: 'Build Error Resolver',
    category: 'REFACTORING',
    recommendedModel: 'gemini-3.7-flash',
    tools: ['runCompilerVerification', 'runCodeActStep', 'getFileOutline', 'replace_file_content'],
    systemPrompt: `You are the Build Error & Compiler Verification Specialist. You operate with surgical precision to resolve TypeScript compilation errors (npx tsc --noEmit), type mismatches, missing exports, and syntax crashes with minimum-diff code mutations.`,
  },
  {
    id: 'nextjs-app-router-expert',
    name: '⚡ Next.js 14/15 App Router & Edge Specialist',
    role: 'Next.js App Router Expert',
    category: 'ARCHITECTURE',
    recommendedModel: 'gemini-3.7-flash',
    tools: ['read_workspace_file', 'replace_file_content', 'searchCodebaseGraph', 'runCompilerVerification'],
    systemPrompt: `You are the Next.js 14 App Router & Vercel Edge Specialist. You enforce server/client component boundaries ('use client' vs Server Components), prevent hydration mismatches, optimize dynamic route handlers, and maintain zero native C-binding Edge compatibility.`,
  },
  {
    id: 'tdd-testing-engineer',
    name: '🧪 Test-Driven Development (TDD) Specialist',
    role: 'TDD Testing Engineer',
    category: 'TESTING',
    recommendedModel: 'gemini-3.7-flash',
    tools: ['runCodeActStep', 'read_workspace_file', 'replace_file_content', 'runCompilerVerification'],
    systemPrompt: `You are the Test-Driven Development (TDD) Engineer. You write explicit unit test contracts before code mutations, verify boundary conditions, eliminate silent try/catch exception masking, and guarantee zero regressions.`,
  },
  {
    id: 'performance-optimizer',
    name: '🚀 Performance & Infrastructure Optimizer',
    role: 'Performance Optimizer',
    category: 'PERFORMANCE',
    recommendedModel: 'gemini-3.7-flash',
    tools: ['inspect_infrastructure', 'read_workspace_file', 'grep_search', 'runCodeActStep'],
    systemPrompt: `You are the Performance & Zero-Thrashing Optimizer. Your directive is to strictly defend GCP e2-micro VM limits (<450MB cgroup cap, 1GB RAM), optimize sub-100ms API response latencies, enforce cloud API LLM inference, and eliminate memory leaks.`,
  },
  {
    id: 'database-architect',
    name: '💾 Upstash Redis & Universal Storage Architect',
    role: 'Database Architect',
    category: 'DATA',
    recommendedModel: 'gemini-3.7-flash',
    tools: ['executeDatabaseMCP', 'getClusteredMemoryDomains', 'read_workspace_file'],
    systemPrompt: `You are the Universal Storage & Upstash Redis Architect. You manage dual-mode persistence (24/7 Upstash Redis REST + Local Atomic JSON fallback), Louvain memory domain clustering, and sub-100ms cognitive DNA synchronization.`,
  },
  {
    id: 'osint-threat-analyst',
    name: '🌐 OSINT & Cyber Threat Intelligence Analyst',
    role: 'OSINT Threat Analyst',
    category: 'SECURITY',
    recommendedModel: 'gemini-3.7-flash',
    tools: ['scan_cve_threats', 'trace_crypto_sanctions', 'inspect_ip_recon', 'search_web'],
    systemPrompt: `You are the Sovereign OSINT & Cyber Threat Intelligence Analyst. You perform IP reconnaissance, CVE vulnerability tracking, OFAC crypto wallet verification, and global threat radar assessments.`,
  },
  {
    id: 'refactoring-specialist',
    name: '✂️ Clean Code & Refactoring Specialist',
    role: 'Refactoring Specialist',
    category: 'REFACTORING',
    recommendedModel: 'gemini-3.7-flash',
    tools: ['searchCodebaseGraph', 'traceCodePath', 'replace_file_content', 'runCompilerVerification'],
    systemPrompt: `You are the Clean Code & Refactoring Specialist. You apply the gstack Reuse Ladder (reuse -> adapt -> extend -> build), eliminate dead code/snippets, enforce exact type annotations, and maintain surgical minimum-diff changes.`,
  },
  {
    id: 'codeact-executor',
    name: '⚙️ CodeAct Action-Observation Execution Agent',
    role: 'CodeAct Executor',
    category: 'REFACTORING',
    recommendedModel: 'gemini-3.7-flash',
    tools: ['runCodeActStep', 'searchCodebaseGraph', 'runCompilerVerification'],
    systemPrompt: `You are the CodeAct Execution Agent. You execute atomic multi-step shell/code actions with pre-flight AST graph inspection, closed-loop compiler verification, and self-healing error observation loops.`,
  },
];

export function getSpecializedAgentProfile(idOrRole: string): AgentProfile | undefined {
  const query = idOrRole.toLowerCase();
  return TOP_HIGH_ROI_AGENTS.find(
    (a) => a.id.toLowerCase() === query || a.role.toLowerCase() === query || a.name.toLowerCase().includes(query)
  );
}

export function listSpecializedAgents(): AgentProfile[] {
  return [...TOP_HIGH_ROI_AGENTS];
}

/**
 * Autonomous Subagent Selector (Inspired by ECC & gstack)
 * Evaluates semantic triggers to automatically assign directives to the optimal
 * specialized subagent without requiring Sir to manually specify slash commands.
 */
export function selectOptimalSubagent(prompt: string): AgentProfile | undefined {
  const clean = prompt.toLowerCase();

  // 1. Security & Sentry
  if (/\b(security|owasp|auth leak|secret leak|cso|vulnerab|exploit|threat scan|penetration|agentshield|api key leak)\b/i.test(clean)) {
    return getSpecializedAgentProfile('security-auditor');
  }

  // 2. Build & Compiler Verification
  if (/\b(build error|compile error|tsc error|compiler|type error|typescript error|tsc --noemit|fix types|typecheck|type check)\b/i.test(clean)) {
    return getSpecializedAgentProfile('build-error-resolver');
  }

  // 3. Next.js App Router & Edge
  if (/\b(next\.?js|app router|server component|client component|hydration mismatch|edge route|vercel edge|nextjs)\b/i.test(clean)) {
    return getSpecializedAgentProfile('nextjs-app-router-expert');
  }

  // 4. Performance & Infrastructure Sentry
  if (/\b(performance|latency|memory leak|cgroup|e2-micro|vm thrash|cpu throttle|sub-100ms|ram usage|memory usage|swap thrash)\b/i.test(clean)) {
    return getSpecializedAgentProfile('performance-optimizer');
  }

  // 5. Architecture & Systems Topology
  if (/\b(architecture|component topology|modular boundary|system design|subsystem|circular depend|sparc workflow|component boundaries)\b/i.test(clean)) {
    return getSpecializedAgentProfile('architecture-expert');
  }

  // 6. Test-Driven Development (TDD)
  if (/\b(tdd|unit test|test contract|test suite|test coverage|regression test|vitest|jest|write tests)\b/i.test(clean)) {
    return getSpecializedAgentProfile('tdd-testing-engineer');
  }

  // 7. Universal Storage & Database Architecture
  if (/\b(upstash|redis cluster|database schema|state persistence|memory domains|louvain clustering|redis key|dual-mode storage)\b/i.test(clean)) {
    return getSpecializedAgentProfile('database-architect');
  }

  // 8. OSINT & Cyber Threat Radar
  if (/\b(osint|ip recon|ip lookup|crypto sanction|ofac|cve advisory|whois lookup|threat intel|wallet trace)\b/i.test(clean)) {
    return getSpecializedAgentProfile('osint-threat-analyst');
  }

  // 9. Clean Code & Refactoring
  if (/\b(refactor|clean code|dead code|code smell|reuse ladder|code duplication|minimum diff|cleanup code)\b/i.test(clean)) {
    return getSpecializedAgentProfile('refactoring-specialist');
  }

  // 10. CodeAct Execution
  if (/\b(codeact|atomic code action|ast inspection|compiler verification loop)\b/i.test(clean)) {
    return getSpecializedAgentProfile('codeact-executor');
  }

  return undefined;
}

/**
 * Machine-Native Subagent Selector with TypeSafe AI (Jev System One)
 * Leverages Jev's sub-50ms probabilistic choice model, falling back to heuristic regexes.
 */
export async function selectOptimalSubagentAsync(prompt: string): Promise<AgentProfile | undefined> {
  const localMatched = selectOptimalSubagent(prompt);
  if (localMatched) return localMatched;

  if (process.env.TYPESAFE_API_KEY) {
    import('./providers/jev')
      .then(({ jevRouteSubagent }) => jevRouteSubagent(prompt))
      .catch((jevErr) => console.warn('[SubagentRegistry] Async Jev routing error:', jevErr));
  }
  return undefined;
}

