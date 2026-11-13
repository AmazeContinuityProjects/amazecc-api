{/* generated: aapi1 */}
---
title: "Stock"
description: "Admin - PATCH /api/admin/gorobo/items/stock. Adjust stock by delta or set stockQuantity."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `PATCH /api/admin/gorobo/items/stock`

> **In one line:** Adjust stock by delta or set stockQuantity.

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** PATCH  
**Path:** `/api/admin/gorobo/items/stock`

| Field | Required | Type notes |
|---|---|---|
| `itemId` | required | see code |
| `delta` | required | see code |
| `stockQuantity` | optional | see code |

## Response

```json
{
  "success": true,
  "item": "..."
}
```

> Full shape: `{success,item}`

## Try it live

<EndpointTry path="/api/admin/gorobo/items/stock" method="patch" auth="gorobo-admin" />

## curl

```bash
curl -X PATCH "https://api.amazecc.com/api/admin/gorobo/items/stock" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "itemId": [],
           "delta": 10,
           "stockQuantity": "..."
         }'
```
