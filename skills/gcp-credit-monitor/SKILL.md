---
name: "gcp-credit-monitor"
description: "Monitors Google Cloud Developer / Free Trial credits (₹33,435+ pool) and Vertex AI model operational health across us-central1 and global endpoints."
author: "J.A.R.V.I.S. Core"
version: "1.0.0"
triggers: ["gcp credits", "vertex ai status", "credit balance", "model status"]
createdAt: "2026-09-16T05:18:00.000Z"
updatedAt: "2026-09-16T05:18:00.000Z"
---

# Google Cloud Platform Credit & Quota Monitor

## Purpose
Ensures J.A.R.V.I.S. remains strictly funded by the ₹33,435+ INR (~$400 USD) Google Cloud credit pool with ₹0 out-of-pocket spend, while maintaining Stage 5 Performance Mode.

## Execution Sequence
1. **Service Account Verification**: Verify `/home/harshans279/.gcp/jarvis-vertex.json` permissions (`600`).
2. **Endpoint Health**: Test `https://aiplatform.googleapis.com` (Global) for Gemini 3.8/3.7 and `https://us-central1-aiplatform.googleapis.com` for Gemini 2.5 Pro.
3. **Credit Lifespan Tracking**: Enforce 90-day Performance Mode countdown.
