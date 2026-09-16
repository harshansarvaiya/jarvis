---
name: "codebase-health-audit"
description: "Audits entire repository health, checks TypeScript definitions, verifies Upstash Redis connectivity, and tests background cloud worker daemons."
author: "J.A.R.V.I.S. Core"
version: "1.0.0"
triggers: ["health audit", "check codebase", "system diagnostic", "audit health"]
createdAt: "2026-09-16T05:18:00.000Z"
updatedAt: "2026-09-16T05:18:00.000Z"
---

# J.A.R.V.I.S. Mark II Codebase Health Audit

## Purpose
Comprehensive autonomous diagnostic pass evaluating static types, build artifacts, external services, and daemons.

## Execution Sequence
1. Run `npx tsc --noEmit` to verify type safety.
2. Check `antigravity-cloud-runner` daemon process: `ps aux | grep tsx`.
3. Ping Upstash Redis REST cluster: `GET jarvis:state`.
4. Check Telegram Bot API status: `https://api.telegram.org/bot<token>/getMe`.
