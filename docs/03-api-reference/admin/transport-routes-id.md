---
title: "Routes [id]"
description: "Admin - GET/PUT/DELETE /api/admin/transport/routes/[id]. Single route management."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET, PUT, DELETE /api/admin/transport/routes/[id]`

> **In one line:** Single route management.

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** GET, PUT, DELETE  
**Path:** `/api/admin/transport/routes/[id]`

> Path parameter: the bracketed segment is part of the route (e.g. `[id]`).

| Field | Required | Type notes |
|---|---|---|
| `<route fields>` | required | see code |

## Response

```json
{
  "success": true,
  "route": "..."
}
```

> Full shape: `{success,route|message}`

## Try it live

<EndpointTry path="/api/admin/transport/routes/[id]" method="get" auth="gorobo-admin" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/admin/transport/routes/[id]" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "<route fields>": "..."
         }'
```
