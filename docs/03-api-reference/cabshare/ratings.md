<!-- generated: aapi1 -->
---
title: "Ratings"
description: "CabShare - POST /api/cabshare/ratings. Rate a co-rider after a trip."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/cabshare/ratings`

> **In one line:** Rate a co-rider after a trip.

## Auth

**CabShare token.** `Authorization: Bearer <cabshare token>` - from `POST /api/cabshare/auth` (30-day TTL, needs `cabshare_users` row).


## Request

**Method:** POST  
**Path:** `/api/cabshare/ratings`

| Field | Required | Type notes |
|---|---|---|
| `trip_id` | required | see code |
| `ratee_id` | required | see code |
| `score` | required | see code |
| `comment` | optional | see code |

## Response

```json
{
  "success": true,
  "message": "..."
}
```

> Full shape: `{success,message}`

## Try it live

<EndpointTry path="/api/cabshare/ratings" method="post" auth="cabshare" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/cabshare/ratings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "trip_id": [],
           "ratee_id": [],
           "score": "...",
           "comment": "..."
         }'
```
