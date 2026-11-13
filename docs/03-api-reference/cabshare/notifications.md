<!-- generated: aapi1 -->
---
title: "Notifications"
description: "CabShare - GET/PATCH /api/cabshare/notifications. CabShare notifications. PATCH marks read."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `GET, PATCH /api/cabshare/notifications`

> **In one line:** CabShare notifications. PATCH marks read.

## Auth

**CabShare token.** `Authorization: Bearer <cabshare token>` - from `POST /api/cabshare/auth` (30-day TTL, needs `cabshare_users` row).


## Request

**Method:** GET, PATCH  
**Path:** `/api/cabshare/notifications`

| Field | Required | Type notes |
|---|---|---|
| `notif_id` | optional | see code |

## Response

```json
{
  "success": true,
  "notifications": "..."
}
```

> Full shape: `{success,notifications|message}`

## Try it live

<EndpointTry path="/api/cabshare/notifications" method="get" auth="cabshare" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/cabshare/notifications" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "notif_id": "..."
         }'
```
