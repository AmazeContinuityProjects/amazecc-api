<!-- generated: aapi1 -->
---
title: "Users [username]"
description: "Admin - PATCH/DELETE /api/admin/users/[username]. Update or deactivate an admin user (deactivation revokes at next request — verifyAdminToken re-checks the DB)."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `PATCH, DELETE /api/admin/users/[username]`

> **In one line:** Update or deactivate an admin user (deactivation revokes at next request — verifyAdminToken re-checks the DB).

## Auth

**Admin bearer token.** `Authorization: Bearer <admin token>` - issued by `POST /api/admin/auth` against a superadmin list or the `admin_users` table. Every request re-checks the DB row (deactivation revokes immediately).


## Request

**Method:** PATCH, DELETE  
**Path:** `/api/admin/users/[username]`

> Path parameter: the bracketed segment is part of the route (e.g. `[id]`).

| Field | Required | Type notes |
|---|---|---|
| `is_active` | optional | see code |
| `permissions` | optional | see code |
| `role` | optional | see code |

## Response

```json
{
  "success": true,
  "user": "..."
}
```

> Full shape: `{success,user|message}`

## Try it live

<EndpointTry path="/api/admin/users/[username]" method="patch" auth="admin" />

## curl

```bash
curl -X PATCH "https://api.amazecc.com/api/admin/users/[username]" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "is_active": "...",
           "permissions": "...",
           "role": "..."
         }'
```
