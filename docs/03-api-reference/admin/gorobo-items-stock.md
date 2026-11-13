---
title: "Stock"
description: "Admin - PATCH /api/admin/gorobo/items/stock. Adjust stock by delta or set stockQuantity."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


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

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/admin.md)

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
