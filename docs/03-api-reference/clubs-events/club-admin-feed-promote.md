---
title: "Promote"
description: "Clubs & Events - POST /api/club-admin/feed/promote. Member-counted promote toggle. Intentionally PUBLIC (backlog: only rate limit) — flagged in docs."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/club-admin/feed/promote`

> **In one line:** Member-counted promote toggle. Intentionally PUBLIC (backlog: only rate limit) — flagged in docs.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** POST  
**Path:** `/api/club-admin/feed/promote`

| Field | Required | Type notes |
|---|---|---|
| `post_id` | required | see code |
| `vtop_id` | required | see code |

## Response

```json
{
  "success": true,
  "promoted": "..."
}
```

> Full shape: `{success,promoted} toggle`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/clubs-events.md)

**Rate limit:** 30/min/IP

## Try it live

<EndpointTry path="/api/club-admin/feed/promote" method="post" auth="none" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/club-admin/feed/promote" \
  -H "Content-Type: application/json" \
  -d '{
           "post_id": [],
           "vtop_id": "..."
         }'
```
