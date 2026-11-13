---
title: "Waitlist"
description: "CabShare - POST /api/cabshare/waitlist. Join the waitlist for a full trip."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/cabshare/waitlist`

> **In one line:** Join the waitlist for a full trip.

## Auth

**CabShare token.** `Authorization: Bearer <cabshare token>` - from `POST /api/cabshare/auth` (30-day TTL, needs `cabshare_users` row).


## Request

**Method:** POST  
**Path:** `/api/cabshare/waitlist`

| Field | Required | Type notes |
|---|---|---|
| `hub_id` | required | see code |
| `travel_date` | required | see code |

## Response

```json
{
  "success": true,
  "message": "..."
}
```

> Full shape: `{success,message}`

## Try it live

<EndpointTry path="/api/cabshare/waitlist" method="post" auth="cabshare" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/cabshare/waitlist" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "hub_id": "...",
           "travel_date": "..."
         }'
```
