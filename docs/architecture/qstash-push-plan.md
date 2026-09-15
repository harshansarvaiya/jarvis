# J.A.R.V.I.S. Autonomous Infrastructure Architecture: QStash Cron & Web Push Integration

## 1. Executive Summary
To elevate J.A.R.V.I.S. from a reactive conversational interface into a proactive autonomous chief of staff, we are implementing two foundational infrastructural capabilities:
1. **Serverless Background Cron Execution (via Upstash QStash)**: Enables scheduled tasks (morning briefings, codebase health audits, dependency vulnerability scans, periodic data synchronization) to run reliably without maintaining dedicated server infrastructure.
2. **Guaranteed Native Push Notifications (via Web Push API & VAPID)**: Dispatches instant alerts and briefing summaries directly to Sir's device (mobile and desktop PWA) even when browser tabs are closed.

---

## 2. Architecture & Data Flow

### A. Background Cron Execution (Upstash QStash)
```
[Upstash QStash Scheduler] 
       │ (HTTP POST on cron schedule e.g. 0 8 * * *)
       ▼
[Vercel Edge API Route: /api/cron/execute]
       │ 
       ├─► 1. Authenticate QStash Signature (HMAC-SHA256)
       ├─► 2. Execute Autonomous Task (e.g. Codebase Audit / Briefing Generation)
       └─► 3. Dispatch Result via Web Push / Store in Upstash Redis
```

### B. Push Notification Delivery Loop
```
[Background Job or User Trigger]
       │
       ▼
[API Route: /api/push/send]
       │
       ├─► Fetch Subscriptions from Upstash Redis (`jarvis:push_subs:*`)
       └─► web-push.sendNotification(subscription, payload, VAPID_KEYS)
              │
              ▼
[Service Worker: sw.js on Client Device]
       │
       └─► self.showNotification(title, { body, icon, data })
```

---

## 3. Implementation Components & File Blueprint

### 1. Client-Side Service Worker & Push Registration (`public/sw.js` & `lib/push-client.ts`)
* Register service worker in the Next.js client layout.
* Request Push Notification permissions.
* Generate and store push subscription objects in Upstash Redis.

### 2. Push Notification API Route (`app/api/push/send/route.ts`)
* Uses `web-push` npm package.
* Validates VAPID private/public keys (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
* Iterates through active stored subscriptions and pushes JSON payloads.

### 3. Cron Job Endpoint (`app/api/cron/execute/route.ts`)
* Secured via Upstash QStash receiver verification (`Receiver` from `@upstash/qstash`).
* Executes scheduled routines:
  * Morning Executive Briefing generation.
  * GitHub repository health check & dependency scan.
  * Automatic synchronization of cognitive DNA into Upstash.

---

## 4. Security & Robustness Guarantees
* **Signature Verification**: Every incoming QStash webhook is cryptographically verified to prevent unauthorized invocation.
* **VAPID Encryption**: End-to-end encrypted push transmissions adhering to W3C Web Push standards.
* **Graceful Error Handling**: Failed push deliveries automatically prune stale/expired subscriptions from Upstash Redis.

---
*Drafted autonomously by J.A.R.V.I.S. Tactical Core — 2026-09-15*
