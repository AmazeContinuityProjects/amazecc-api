---
title: "Feed"
description: "Clubs & Events - GET/POST/DELETE /api/club-admin/feed. Club feed CRUD. Promote endpoint is separate: POST /api/club-admin/feed/promote."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET, POST, DELETE /api/club-admin/feed`

> **In one line:** Club feed CRUD. Promote endpoint is separate: POST /api/club-admin/feed/promote.

## Auth

**Club bearer token.** `Authorization: Bearer <club token>` - issued at `POST /api/login` when the authorizedID represents club(s). `X-Club-Id` header re-selects the club context.


## Request

**Method:** GET, POST, DELETE  
**Path:** `/api/club-admin/feed`

| Field | Required | Type notes |
|---|---|---|
| `<feed fields>` | required | see code |

## Response

```json
{
  "success": true,
  "feed": "..."
}
```

> Full shape: `{success,feed|post} + ?club_id&post_id&vtop_id`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/clubs-events.md)

## Try it live

<EndpointTry path="/api/club-admin/feed" method="get" auth="club" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/club-admin/feed" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "<feed fields>": "..."
         }'
```
