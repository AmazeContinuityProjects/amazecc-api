<!-- generated: aapi1 -->
---
title: "Push"
description: "Admin - POST /api/admin/push. Broadcast a web-push notification to all subscriptions."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/admin/push`

> **In one line:** Broadcast a web-push notification to all subscriptions.

## Auth

**Admin bearer token.** `Authorization: Bearer <admin token>` - issued by `POST /api/admin/auth` against a superadmin list or the `admin_users` table. Every request re-checks the DB row (deactivation revokes immediately).


## Request

**Method:** POST  
**Path:** `/api/admin/push`

| Field | Required | Type notes |
|---|---|---|
| `title` | required | see code |
| `body` | required | see code |

## Response

```json
{
  "success": true,
  "message": "..."
}
```

> Full shape: `{success,message} / {error}`

## Try it live

<EndpointTry path="/api/admin/push" method="post" auth="admin" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/admin/push" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "title": "...",
           "body": "..."
         }'
```
