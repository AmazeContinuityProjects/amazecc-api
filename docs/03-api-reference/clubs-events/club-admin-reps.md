---
title: "Reps"
description: "Clubs & Events - GET/POST/DELETE /api/club-admin/reps. Club representative management; super reps may manage everyone."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET, POST, DELETE /api/club-admin/reps`

> **In one line:** Club representative management; super reps may manage everyone.

## Auth

**Club bearer token.** `Authorization: Bearer <club token>` - issued at `POST /api/login` when the authorizedID represents club(s). `X-Club-Id` header re-selects the club context.


## Request

**Method:** GET, POST, DELETE  
**Path:** `/api/club-admin/reps`

| Field | Required | Type notes |
|---|---|---|
| `<rep fields>` | required | see code |

## Response

```json
{
  "success": true,
  "reps": "..."
}
```

> Full shape: `{success,reps|isSuperRep|message} + ?club_id&vtop_id`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/clubs-events.md)

## Try it live

<EndpointTry path="/api/club-admin/reps" method="get" auth="club" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/club-admin/reps" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "<rep fields>": "..."
         }'
```
