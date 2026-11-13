{/* generated: aapi1 */}
---
title: "Stats"
description: "Admin - GET /api/admin/stats. Admin dashboard numbers (users, logs, storage)."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `GET /api/admin/stats`

> **In one line:** Admin dashboard numbers (users, logs, storage).

## Auth

**Admin bearer token.** `Authorization: Bearer <admin token>` - issued by `POST /api/admin/auth` against a superadmin list or the `admin_users` table. Every request re-checks the DB row (deactivation revokes immediately).


## Request

**Method:** GET  
**Path:** `/api/admin/stats`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "data": "..."
}
```

> Full shape: `{success,data}`

## Try it live

<EndpointTry path="/api/admin/stats" method="get" auth="admin" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/admin/stats" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>"
```
