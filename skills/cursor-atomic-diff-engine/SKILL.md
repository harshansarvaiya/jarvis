---
name: "cursor-atomic-diff-engine"
description: "Cursor and Windsurf inspired atomic code diff and AST mutation engine for zero-drift codebase updates."
author: "J.A.R.V.I.S. Autonomous Evolution"
version: "1.0.0"
triggers: ["atomic diff","cursor diff","patch file","ast edit","code mutation"]
createdAt: "2026-09-20T22:15:30.537Z"
updatedAt: "2026-09-20T22:15:30.537Z"
---

# Cursor & Windsurf Atomic Code Patching Engine (Extracted from CL4R1T4S)

## Purpose
Enforces surgical, zero-drift code mutations without full-file rewrites, avoiding line-offset hallucinations and token bloat during multi-file refactoring.

## Core Mechanics
1. **Target String Exactness**: Every patch requires unique 3-5 line context matching to prevent ambiguous substring replacements.
2. **Deterministic Context Anchors**:
   - Leading anchor: Match preceding function/type declaration.
   - Trailing anchor: Match closing bracket or return statement.
3. **Closed-Loop Verification**:
   - Immediately execute compiler type-checking (`npx tsc --noEmit`) post-mutation.
   - If exitCode !== 0, execute automatic rollback to pristine snapshot before proceeding.
4. **Token Conservation**: Limit mutations strictly to modified AST nodes rather than streaming entire source files.
