{/* generated: aapi1 */}
---
title: "Blocks"
description: "CabShare - POST/DELETE /api/cabshare/blocks. Block or unblock a co-rider."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST, DELETE /api/cabshare/blocks`

> **In one line:** Block or unblock a co-rider.

## Auth

**CabShare token.** `Authorization: Bearer <cabshare token>` - from `POST /api/cabshare/auth` (30-day TTL, needs `cabshare_users` row).


## Request

**Method:** POST, DELETE  
**Path:** `/api/cabshare/blocks`

| Field | Required | Type notes |
|---|---|---|
| `blocked_id` | required | see code |

## Response

```json
{
  "success": true,
  "message": "..."
}
```

> Full shape: `{success,message}`

## Try it live

<EndpointTry path="/api/cabshare/blocks" method="post" auth="cabshare" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/cabshare/blocks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "blocked_id": []
         }'
```
