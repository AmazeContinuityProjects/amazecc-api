---
title: "Buses"
description: "Admin - POST /api/admin/buses. Replace the buses table from an array upload (import of updated routes)."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/admin/buses`

> **In one line:** Replace the buses table from an array upload (import of updated routes).

## Auth

**Admin bearer token.** `Authorization: Bearer <admin token>` - issued by `POST /api/admin/auth` against a superadmin list or the `admin_users` table. Every request re-checks the DB row (deactivation revokes immediately).


## Request

**Method:** POST  
**Path:** `/api/admin/buses`

| Field | Required | Type notes |
|---|---|---|
| `` *(array)* `of bus objects` | required | see code |

## Response

```json
{
  "success": true,
  "message": "..."
}
```

> Full shape: `{success,message} / {success:false,message}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/admin.md)

## Try it live

<EndpointTry path="/api/admin/buses" method="post" auth="admin" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/admin/buses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "bus objects": "..."
         }'
```
