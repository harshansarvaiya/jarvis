---
name: "scientific-data-validation"
description: "Pre-flight data validation, schema sanity checks, and pipeline verification recipe adapted from K-Dense scientific skills standard."
author: "J.A.R.V.I.S. Autonomous Evolution"
version: "1.0.0"
triggers: ["validate data","scientific pipeline","dataset sanity check","preflight data check"]
source: "custom"
createdAt: "2026-10-01T18:27:32.856Z"
updatedAt: "2026-10-01T18:27:32.856Z"
---

# Pre-Flight Scientific & Quantitative Data Validation Protocol

Procedural validation recipe adapted from the K-Dense scientific skills standard (`agentskills.io`). Enforces rigorous pre-flight sanity checks, edge-case boundary verifications, and output schema sanitization before committing or consuming quantitative analysis scripts and telemetry data.

## Phase 1: Input & Environment Sanity Checks
- Verify runtime environment and dependencies before execution.
- Validate data schemas, missing values (NaN/Null heuristics), and data types upfront.
- Confirm coordinate/index bounds, boundary timestamps, and asset symbols.

## Phase 2: Execution Sandboxing & Verification
- Execute compute steps in an isolated, non-destructive memory context.
- Log intermediate execution tensors/metrics to catch silent math or vector degradation early.
- Run deterministic assertion checks across output ranges (e.g. probability ∈ [0, 1], non-negative variances).

## Phase 3: Output Sanitization & Structured Telemetry
- Strip non-serializable objects and format outputs strictly into JSON/Markdown summaries.
- Append confidence intervals, data lineage metadata, and anomaly flags.
