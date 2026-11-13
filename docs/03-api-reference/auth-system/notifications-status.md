{/* generated: aapi1 */}
---
title: "Status"
description: "Auth & System - GET /api/notifications/status. Reads notification preferences per user. ?endpoint filter."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `GET /api/notifications/status`

> **In one line:** Reads notification preferences per user. ?endpoint filter.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** GET  
**Path:** `/api/notifications/status`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "vitol": "...",
  "vitol_reminder_day": "...",
  "vitol_reminder_time": "..."
}
```

> Full shape: `raw {vitol,vitol_reminder_day,vitol_reminder_time} / {error}`

## Try it live

<EndpointTry path="/api/notifications/status" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/notifications/status" \
  -H "Content-Type: application/json"
```
