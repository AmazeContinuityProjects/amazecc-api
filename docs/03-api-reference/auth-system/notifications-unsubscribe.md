---
title: "Unsubscribe"
description: "Auth & System - POST /api/notifications/unsubscribe. Unregister a web-push subscription."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/notifications/unsubscribe`

> **In one line:** Unregister a web-push subscription.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** POST  
**Path:** `/api/notifications/unsubscribe`

| Field | Required | Type notes |
|---|---|---|
| `UserID` | required | see code |
| `endpoint` | required | see code |

## Response

```json
{
  "success": true
}
```

> Full shape: `{success} / {error}`

## Try it live

<EndpointTry path="/api/notifications/unsubscribe" method="post" auth="none" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/notifications/unsubscribe" \
  -H "Content-Type: application/json" \
  -d '{
           "UserID": [],
           "endpoint": "..."
         }'
```
