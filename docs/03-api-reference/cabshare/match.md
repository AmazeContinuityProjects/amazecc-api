---
title: "Match"
description: "CabShare - POST /api/cabshare/match. Confirm/decline a cab-share match for a trip."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/cabshare/match`

> **In one line:** Confirm/decline a cab-share match for a trip.

## Auth

**CabShare token.** `Authorization: Bearer <cabshare token>` - from `POST /api/cabshare/auth` (30-day TTL, needs `cabshare_users` row).


## Request

**Method:** POST  
**Path:** `/api/cabshare/match`

| Field | Required | Type notes |
|---|---|---|
| `trip_id` | required | see code |
| `action` | required | see code |
| `match_id` | optional | see code |

## Response

```json
{
  "success": true,
  "message": "..."
}
```

> Full shape: `{success,message}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/cabshare.md)

## Try it live

<EndpointTry path="/api/cabshare/match" method="post" auth="cabshare" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/cabshare/match" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "trip_id": [],
           "action": "...",
           "match_id": []
         }'
```
