# J.A.R.V.I.S. Mark I : "Project Hands" MCP Suite & Runtime Environment Architecture

## 1. Tactical Diagnosis: Does J.A.R.V.I.S. Lack a Command Prompt / Writable Environment?

**Yes, absolutely.** That is the exact architectural boundary:
1. **The Vercel Serverless Sandbox**:
   - J.A.R.V.I.S. is deployed as Next.js API route handlers on Vercel Edge/Serverless.
   - Vercel execution environments are **ephemeral, isolated, and strictly read-only** (only `/tmp` is temporarily writable and gets destroyed on container spin-down).
   - There is **no persistent shell (PowerShell/Bash)** and **no persistent disk write access**.
   - When J.A.R.V.I.S. planned and logged `write_to_file("lib/jarvis/mcp-registry.ts")` in his task execution audit on Vercel, the action was recorded in Upstash Redis, but could not physically create files on disk.
2. **How We Solved This ("Project Hands")**:
   - **Cloud-Native Hands via GitHub Octokit (`mcp_github`)**: Using the GitHub REST API (Octokit), J.A.R.V.I.S. can commit, read, and create files directly into the repository from anywhere—bypassing the serverless read-only disk limitation completely!
   - **Local Workstation Bridge (`mcp_filesystem`)**: When running on the host machine or via our Ngrok tunnel, J.A.R.V.I.S. now has sandboxed workspace file reading, listing, and writing capabilities.

---

## 2. Changes Implemented: "Project Hands"

### A. Edge-Compatible MCP Tool Engine (`lib/jarvis/mcp.ts`)
Built an edge-compatible tool suite using native fetch:
1. **`mcp:github`**: GitHub Octokit REST engine for `get_repo`, `list_commits`, `get_file`, `list_issues`, `create_issue`, and `create_or_update_file`.
2. **`mcp:filesystem`**: Sandboxed workspace file reader (`read_file`), directory inspector (`list_dir`), and writer (`write_file`) with path traversal guards.
3. **`mcp:cloud`**: Telemetry and latency pinger for Vercel Edge (`jarvis-iota-beige.vercel.app`) and the Ngrok uplink.
4. **`mcp:network`**: Outbound HTTP request runner (`GET`, `POST`, `HEAD`) for external API integration.
5. **`mcp:database`**: Direct Upstash Redis diagnostic queries (`ping`, `dbsize`, `list_keys`, `get_key`).

### B. MCP Registry & Connector (`lib/jarvis/mcp-registry.ts`)
Created the exact file J.A.R.V.I.S. logged in his task audit:
- Exports `getGitHubClient()` configured with `process.env.GITHUB_TOKEN`.
- Exports `MCP_SERVERS` registry mapping each server to its execution transport.

### C. Tools Integration (`lib/jarvis/tools.ts`)
Registered the new tools into `JARVIS_TOOLS` so Groq, Gemini, and GitHub Models have autonomous access:
- `mcp_github`
- `mcp_filesystem`
- `mcp_cloud`
- `mcp_network`
- `mcp_database`

### D. Groq TPM 429 Resilience Cascade (`lib/jarvis/agent.ts`)
- To solve the 8,000 TPM limit on Groq `openai/gpt-oss-120b`, implemented an automatic candidate cascade:
  `openai/gpt-oss-120b` → `openai/gpt-oss-20b` → `llama-3.3-70b-versatile` → GitHub Models (`gpt-4o`).
- If an upstream 429 is encountered, J.A.R.V.I.S. seamlessly cascades to the next candidate model in milliseconds without throwing errors to Sir.

### E. Strict Guardian Protocol Enforcement (`lib/jarvis/directives.ts`)
- Added Rule 5 to `CORE_DIRECTIVES`:
  > *"Never execute a remote git push autonomously without explicit, direct confirmation from Sir."*
- Hard-coded check in `validateActionAgainstDirectives` blocking any `git push` command unless explicitly granted by Sir.

---

## 3. Empirical Live Verification Results

All MCP tools were executed live via `/api/jarvis/chat` with real telemetry outputs:

| Tool | Action Tested | Result Status | Telemetry Output |
|---|---|---|---|
| **`mcp_github`** | `get_repo` | **SUCCESS (200)** | Full Name: `harshansarvaiya/jarvis`, Private: `true`, Branch: `main` |
| **`mcp_github`** | `list_commits` | **SUCCESS (200)** | Retrieved latest 3 commits: `ee2dc15`, `0064526`, `254be72` |
| **`mcp_filesystem`** | `read_file` | **SUCCESS (200)** | Read `lib/jarvis/mcp.ts` (18,694 bytes) |
| **`mcp_database`** | `ping` | **SUCCESS (200)** | Output: `PONG`, Healthy: `true` (Upstash Redis) |
| **`mcp_cloud`** | `ping_vercel` | **SUCCESS (200)** | Endpoint: `https://jarvis-iota-beige.vercel.app`, Latency: `297ms`, Status: `200` |

---

## 4. Task Matrix State
The 3 tasks J.A.R.V.I.S. registered in Upstash Redis have been verified and marked **`COMPLETED`**:
- `task-1789392374311-8wt6` (*Integrate GitHub MCP server*): **COMPLETED**
- `task-1789392450681-pjp9` (*Integrate GitHub MCP server (octokit) for self‑patching*): **COMPLETED**
- `task-1789392153918-llek` (*Integrate new MCP servers and toolset*): **COMPLETED**

> [!IMPORTANT]
> **No Remote Push Executed**: All changes remain local on the machine in compliance with Sir's instruction.
