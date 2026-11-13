<!-- generated: aapi1 -->
---
title: "Representatives"
description: "Admin - GET/POST/DELETE /api/admin/clubs/representatives. Assign/remove club representatives. GET ?club_id."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `GET, POST, DELETE /api/admin/clubs/representatives`

> **In one line:** Assign/remove club representatives. GET ?club_id.

## Auth

**Admin bearer token.** `Authorization: Bearer <admin token>` - issued by `POST /api/admin/auth` against a superadmin list or the `admin_users` table. Every request re-checks the DB row (deactivation revokes immediately).


## Request

**Method:** GET, POST, DELETE  
**Path:** `/api/admin/clubs/representatives`

| Field | Required | Type notes |
|---|---|---|
| `club_id` | required | see code |
| `vtop_id` | required | see code |

## Response

```json
{
  "success": true,
  "representatives": "..."
}
```

> Full shape: `{success,representatives|representative|message}`

## Try it live

<EndpointTry path="/api/admin/clubs/representatives" method="get" auth="admin" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/admin/clubs/representatives" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "club_id": "...",
           "vtop_id": "..."
         }'
```
