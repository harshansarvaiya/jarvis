---
name: "frontier-agent-scaffolding"
description: "Manus and Replit inspired agent loop governance, iteration termination breakers, and state machine scaffolding."
author: "J.A.R.V.I.S. Autonomous Evolution"
version: "1.0.0"
triggers: ["agent loop","loop breaker","manus loop","agent state machine","turn governor"]
createdAt: "2026-09-20T22:15:34.795Z"
updatedAt: "2026-09-20T22:15:34.795Z"
---

# Frontier Agent Loop Scaffolding & Termination Breakers (Extracted from CL4R1T4S)

## Purpose
Prevents runaway multi-turn loops, token burning, and VM resource thrashing across autonomous background worker daemons.

## Core Execution Invariants
1. **Hard Iteration Caps**: Enforce maximum 8-12 reasoning/tool turns per user turn before forcing state convergence.
2. **Exponential Backoff on Tool Retries**: If a tool returns an error twice consecutively, switch tool strategy immediately rather than repeating the failing call.
3. **Manus State Machine Partitioning**:
   - `THINK`: Analyze state diff and isolate root objective.
   - `ACT`: Execute single high-confidence tool call.
   - `OBSERVE`: Ingest tool stdout/stderr.
   - `VERIFY`: Validate ground truth against goal before terminating.
4. **Graceful Degradation Protocol**: In case of network partition or sub-service degradation, return verified partial progress and escalate specific blocker to Sir without crashing.
