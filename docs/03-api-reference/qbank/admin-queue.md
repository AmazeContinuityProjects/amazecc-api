<!-- generated: aapi1 -->
---
title: "Queue"
description: "QBank - GET/PATCH /api/qbank/admin/queue. Moderation queue list (GET) and whitelisted status updates (PATCH)."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `GET, PATCH /api/qbank/admin/queue`

> **In one line:** Moderation queue list (GET) and whitelisted status updates (PATCH).

## Auth

**Admin bearer token.** `Authorization: Bearer <admin token>` - issued by `POST /api/admin/auth` against a superadmin list or the `admin_users` table. Every request re-checks the DB row (deactivation revokes immediately).


## Request

**Method:** GET, PATCH  
**Path:** `/api/qbank/admin/queue`

| Field | Required | Type notes |
|---|---|---|
| `paperId` | required | see code |
| `…updates` | required | see code |

## Response

```json
{
  "success": true,
  "data": "..."
}
```

> Full shape: `{success,data}`

## Try it live

<EndpointTry path="/api/qbank/admin/queue" method="get" auth="admin" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/qbank/admin/queue" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "paperId": "<paper id>",
           "…updates": "..."
         }'
```
