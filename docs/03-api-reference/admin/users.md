{/* generated: aapi1 */}
---
title: "Users"
description: "Admin - GET/POST /api/admin/users. Admin user management. GET lists; POST creates with role+permissions."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `GET, POST /api/admin/users`

> **In one line:** Admin user management. GET lists; POST creates with role+permissions.

## Auth

**Admin bearer token.** `Authorization: Bearer <admin token>` - issued by `POST /api/admin/auth` against a superadmin list or the `admin_users` table. Every request re-checks the DB row (deactivation revokes immediately).


## Request

**Method:** GET, POST  
**Path:** `/api/admin/users`

| Field | Required | Type notes |
|---|---|---|
| `username` | required | see code |
| `role` | required | see code |
| `permissions` | required | see code |

## Response

```json
{
  "success": true,
  "users": "..."
}
```

> Full shape: `{success,users|user}`

## Try it live

<EndpointTry path="/api/admin/users" method="get" auth="admin" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/admin/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "username": "21BCE0000",
           "role": "...",
           "permissions": "..."
         }'
```
