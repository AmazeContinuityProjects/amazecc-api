---
title: "Clubs"
description: "Admin - GET/POST /api/admin/clubs. Club directory CRUD."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET, POST /api/admin/clubs`

> **In one line:** Club directory CRUD.

## Auth

**Admin bearer token.** `Authorization: Bearer <admin token>` - issued by `POST /api/admin/auth` against a superadmin list or the `admin_users` table. Every request re-checks the DB row (deactivation revokes immediately).


## Request

**Method:** GET, POST  
**Path:** `/api/admin/clubs`

| Field | Required | Type notes |
|---|---|---|
| `club_id` | required | see code |
| `club_name` | required | see code |
| `…` | required | see code |

## Response

```json
{
  "success": true,
  "clubs": "..."
}
```

> Full shape: `{success,clubs|club}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/admin.md)

## Try it live

<EndpointTry path="/api/admin/clubs" method="get" auth="admin" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/admin/clubs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "club_id": "...",
           "club_name": "...",
           "…": "..."
         }'
```
