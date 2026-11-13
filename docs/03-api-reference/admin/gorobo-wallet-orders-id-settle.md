<!-- generated: aapi1 -->
---
title: "Settle Orders ID"
description: "Admin - POST /api/admin/gorobo/wallet/orders/[id]/settle. Mark order wallet entries settled (actual settlement happens outside this repo)."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/admin/gorobo/wallet/orders/[id]/settle`

> **In one line:** Mark order wallet entries settled (actual settlement happens outside this repo).

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** POST  
**Path:** `/api/admin/gorobo/wallet/orders/[id]/settle`

> Path parameter: the bracketed segment is part of the route (e.g. `[id]`).

| Field | Required | Type notes |
|---|---|---|
| `party` | optional | see code |

## Response

```json
{
  "success": true,
  "settled": "...",
  "entries": "..."
}
```

> Full shape: `{success,settled,entries}`

## Try it live

<EndpointTry path="/api/admin/gorobo/wallet/orders/[id]/settle" method="post" auth="gorobo-admin" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/admin/gorobo/wallet/orders/[id]/settle" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "party": "..."
         }'
```
