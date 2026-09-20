---
name: market-osint-screener
description: Cross-references geopolitical conflict and supply chain data with stock equity signals and commodity pricing for automated monetization.
triggers: ["market", "stocks", "share market", "monetization", "alpha"]
---

# Market OSINT Screener Playbook

## Objective
Scan global geopolitical disruptions (ACLED conflict, PortWatch shipping delays) against semiconductor, HBM memory, and energy infrastructure equities to surface high-alpha entry points.

## Execution Steps
1. Parse live feeds from ingested worldmonitor whitelist (`data/rss-allowed-domains.json`).
2. Filter for supply chain chokepoints and semiconductor equipment bottlenecks.
3. Generate daily briefing for 8:00 AM IST execution.
