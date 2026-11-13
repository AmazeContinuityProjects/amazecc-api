---
title: "Status"
description: "Auth & System - GET /api/notifications/status. Reads notification preferences per user. ?endpoint filter."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


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

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/auth-system.md)

## Try it live

<EndpointTry path="/api/notifications/status" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/notifications/status" \
  -H "Content-Type: application/json"
```
