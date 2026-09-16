---
name: cloud-security-iam-sentry
description: Cloud security posture management, API key exposure detection, environment variable audit, and least-privilege IAM validation (NIST CSF 2.0 & MITRE ATT&CK Cloud Matrix).
author: J.A.R.V.I.S. Guardian Core
version: 1.0.0
triggers: ["iam", "cloud security", "api key audit", "secret leak", "env security", "credentials check", "nist csf", "permission review"]
---

# Cloud Security & IAM Posture Sentry Playbook

## Purpose
Enforces proactive security hygiene across our Google Cloud runner VM (`antigravity-cloud-runner`), Upstash Redis, Vercel edge deployment, and external API gateways.

## Audit Checkpoints

### 1. Secret & Key Exposure Sentry
* Scan all code commits and logs to ensure **zero raw API keys** are committed to Git:
  * Google Vertex / Cloud Service Account JSON
  * Upstash Redis REST Tokens (`UPSTASH_REDIS_REST_TOKEN`)
  * NVIDIA NIM (`NVIDIA_NIM_API_KEY`)
  * OpenRouter (`OPENROUTER_API_KEY`)
  * Telegram Bot API Token (`TELEGRAM_BOT_TOKEN`)
* Verify `.env.local`, `.env`, and secret configs are properly included in `.gitignore`.

### 2. Sentry Access Control & Allowed User Filtering
* Verify Telegram Gateway strictly verifies `msg.from.id === TELEGRAM_ALLOWED_USER_ID` before any agent logic is executed.
* Reject, log, and drop any unauthorized sender attempting to access J.A.R.V.I.S. or F.R.I.D.A.Y.

### 3. Cloud VM Process & Port Isolation
* Ensure no unauthorized ports are exposed to the public internet on Google Cloud Compute Engine.
* Only allow outbound HTTPS connections to verified foundation model endpoints (Google, Groq, NVIDIA, OpenAI).
