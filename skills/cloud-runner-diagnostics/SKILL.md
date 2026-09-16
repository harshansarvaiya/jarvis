---
name: cloud-runner-diagnostics
description: 24/7 cloud runner VM health auditing, memory leak detection, orphan process cleanup, and daemon telemetry verification.
author: J.A.R.V.I.S. Core
version: 1.0.0
triggers: ["vm", "runner", "health", "diagnostics", "memory leak", "orphan", "daemon", "cloud status", "cpu", "disk"]
---

# 24/7 Cloud Runner VM Diagnostics Playbook

## Purpose
Monitors and maintains the health of the sovereign Google Cloud VM (`antigravity-cloud-runner`, e2-micro Ubuntu 24.04 LTS), ensuring background worker daemons remain active with low resource consumption.

## Diagnostic Procedures

### 1. Memory & CPU Profile
* Check memory consumption: ensure heap allocation is kept within the 1GB RAM budget.
* Identify any rogue node processes or build artifacts accumulating in `/tmp` or `.next/cache`.

### 2. Daemon Sentry Check
* Verify the 2 core daemons:
  1. `scripts/cloud-worker.ts` — Cron briefings, task radar polling every 30s.
  2. `scripts/telegram-worker.ts` — 24/7 Telegram long-polling gateway.

### 3. Upstash & Network Connectivity
* Verify HTTP/2 latency to Upstash Redis REST endpoint (`witty-grouse-110573.upstash.io`).
* Verify VAPID web push gateway responsiveness.
