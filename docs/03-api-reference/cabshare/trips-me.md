---
title: "Me"
description: "CabShare - GET /api/cabshare/trips/me. Trips I created + trips I joined."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET /api/cabshare/trips/me`

> **In one line:** Trips I created + trips I joined.

## Auth

**CabShare token.** `Authorization: Bearer <cabshare token>` - from `POST /api/cabshare/auth` (30-day TTL, needs `cabshare_users` row).


## Request

**Method:** GET  
**Path:** `/api/cabshare/trips/me`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "my_trips": "...",
  "joined_trips": "..."
}
```

> Full shape: `{success,my_trips,joined_trips}`

## Try it live

<EndpointTry path="/api/cabshare/trips/me" method="get" auth="cabshare" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/cabshare/trips/me" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>"
```
