---
title: "Unarchive Orders ID"
description: "Admin - POST /api/admin/gorobo/orders/[id]/unarchive. Undo archive."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/admin/gorobo/orders/[id]/unarchive`

> **In one line:** Undo archive.

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** POST  
**Path:** `/api/admin/gorobo/orders/[id]/unarchive`

> Path parameter: the bracketed segment is part of the route (e.g. `[id]`).

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "order": "...",
  "wallet": "..."
}
```

> Full shape: `{success,order,wallet}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/admin.md)

## Try it live

<EndpointTry path="/api/admin/gorobo/orders/[id]/unarchive" method="post" auth="gorobo-admin" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/admin/gorobo/orders/[id]/unarchive" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>"
```
