---
title: "Auth & System"
description: "Every Auth & System endpoint: method, path, auth and rate limits."
---

{/* generated: aapi1 */}

# Auth & System

> **In one line:** The door in and the lights that say the server is alive. Log in here, check the heartbeat, broadcast a push notification, or ask the gateway what it is.

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| post | `/api/login` | None | 5/min/IP |
| get | `/api/settings/global` | None | - |
| post | `/api/notifications/subscribe` | None | - |
| post | `/api/notifications/unsubscribe` | None | - |
| get | `/api/notifications/status` | None | - |
| get, post | `/api/cron/reminders` | CRON_SECRET bearer | - |
| get | `/api/status` | None | - |
| get | `/api/health` | None | - |
| get | `/api/docs` | None | - |
| post | `/api/admin/auth` | None | 5/min/IP |
| get | `/api/fresher-resources` | None | - |
