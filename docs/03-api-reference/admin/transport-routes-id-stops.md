<!-- generated: aapi1 -->
---
title: "Stops"
description: "Admin - POST /api/admin/transport/routes/[id]/stops. Bulk-replace stops for a route."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/admin/transport/routes/[id]/stops`

> **In one line:** Bulk-replace stops for a route.

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** POST  
**Path:** `/api/admin/transport/routes/[id]/stops`

> Path parameter: the bracketed segment is part of the route (e.g. `[id]`).

| Field | Required | Type notes |
|---|---|---|
| `` *(array)* `of BusStop[]` | required | see code |

## Response

```json
{
  "success": true,
  "message": "..."
}
```

> Full shape: `{success,message}`

## Try it live

<EndpointTry path="/api/admin/transport/routes/[id]/stops" method="post" auth="gorobo-admin" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/admin/transport/routes/[id]/stops" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "BusStop": "..."
         }'
```
