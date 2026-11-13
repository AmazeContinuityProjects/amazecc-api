<!-- generated: aapi1 -->
---
title: "Subscribe"
description: "Auth & System - POST /api/notifications/subscribe. Register a web-push subscription. Public by design (the app must call it pre-sync)."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/notifications/subscribe`

> **In one line:** Register a web-push subscription. Public by design (the app must call it pre-sync).

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** POST  
**Path:** `/api/notifications/subscribe`

| Field | Required | Type notes |
|---|---|---|
| `UserID` | required | see code |
| `subscription` | required | see code |
| `vitol_enabled` | optional | see code |
| `vitol_reminder_day` | optional | see code |
| `vitol_reminder_time` | optional | see code |

## Response

```json
{
  "success": true
}
```

> Full shape: `{success} / {error}`

## Try it live

<EndpointTry path="/api/notifications/subscribe" method="post" auth="none" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/notifications/subscribe" \
  -H "Content-Type: application/json" \
  -d '{
           "UserID": [],
           "subscription": "...",
           "vitol_enabled": true,
           "vitol_reminder_day": "...",
           "vitol_reminder_time": "..."
         }'
```
