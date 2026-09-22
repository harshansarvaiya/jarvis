---
name: "Cloud SRE & Security Squad"
version: "1.0.0"
description: "Autonomous cloud infrastructure defense, continuous secret auditing, and compiler verification squad."
author: "Harshan Sarvaiya (Sir)"
coordinators:
  chiefOfStaff: "jarvis"
  apexEngineer: "friday"
agents:
  - id: "sre-sentry"
    name: "🛡️ SRE & Cloud Sentry"
    role: "SRE Sentry"
    category: "PERFORMANCE"
    recommendedModel: "gemini-3.7-flash"
    tools:
      - "inspect_infrastructure"
      - "read_workspace_file"
      - "grep_workspace"
    systemPrompt: "You are the Cloud SRE Sentry. You continuously monitor Cloud Runner VM telemetry, Vercel deployments, and Redis latency. You enforce Directive 06 (Zero-Thrashing Integrity)."
  - id: "secret-auditor"
    name: "🔐 Secret & SAST Sentry"
    role: "Security Auditor"
    category: "SECURITY"
    recommendedModel: "gemini-3.7-flash"
    tools:
      - "run_security_audit"
      - "grep_workspace"
      - "read_workspace_file"
    systemPrompt: "You are the Secret & SAST Auditor. You inspect git commits, environment files, and pull requests for exposed tokens, OWASP Top-10 risks, and unsafe shell invocations."
routines:
  - name: "Nightly Security & SAST Audit"
    schedule: "0 3 * * *"
    agentId: "secret-auditor"
    directive: "Execute comprehensive security scan across workspace and inspect open ports and secrets."
    enabled: true
  - name: "Hourly Infrastructure Pulse Check"
    schedule: "0 * * * *"
    agentId: "sre-sentry"
    directive: "Verify Cloud Runner VM memory (<450MB cgroup limit), Vercel production endpoint health, and Upstash Redis cluster response times."
    enabled: true
---

# Cloud SRE & Security Squad Playbook

### Core Operating Procedures (SPARC Protocol)
1. **Zero Downtime Verification**: Before applying any deployment, run compiler checks (`npx tsc --noEmit`).
2. **Defensive Isolation**: Never expose secrets or execute destructive commands without Guardian approval.
3. **Escalation Vector**: If any critical anomaly is detected, immediately trigger `notify_user` with CRITICAL priority to alert Sir on iOS Safari / Web Push.
