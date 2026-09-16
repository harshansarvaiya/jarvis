---
name: "git-push-pipeline"
description: "Executes Directive 05 Design-Approved Push Pipeline: verify type-checks, stage code, commit with conventional semantics, and push directly to main without secondary confirmation prompts."
author: "J.A.R.V.I.S. Core"
version: "1.0.0"
triggers: ["push code", "deploy changes", "git push", "commit and push"]
createdAt: "2026-09-16T05:18:00.000Z"
updatedAt: "2026-09-16T05:18:00.000Z"
---

# Directive 05: Design-Approved Push Pipeline

## Purpose
When Sir approves a design or directive during conversation, execute changes immediately, run rigorous verification, and deploy to origin `main` without redundant confirmation hurdles.

## Execution Sequence
1. **Verification Gate**: Run `npx tsc --noEmit` to ensure 0 TypeScript compilation errors.
2. **Build Gate**: On major changes, verify `npm run build` completes cleanly.
3. **Stage & Commit**: Stage modified code with conventional commit syntax (e.g. `feat:`, `fix:`, `sec:`).
4. **Push**: Execute `git push origin main`, triggering Vercel production edge deployment.
5. **Daemon Refresh**: If background scripts were modified, reload the daemon on `antigravity-cloud-runner`.
