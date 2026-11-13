<!-- generated: aapi1 -->
---
title: "Complete Orders ID"
description: "Admin - POST /api/admin/gorobo/orders/[id]/complete. confirmed → completed; computes wallet entries (split customer/vendor)."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/admin/gorobo/orders/[id]/complete`

> **In one line:** confirmed → completed; computes wallet entries (split customer/vendor).

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** POST  
**Path:** `/api/admin/gorobo/orders/[id]/complete`

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

## Try it live

<EndpointTry path="/api/admin/gorobo/orders/[id]/complete" method="post" auth="gorobo-admin" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/admin/gorobo/orders/[id]/complete" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>"
```
