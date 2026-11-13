---
title: "Items [id]"
description: "Admin - PUT/DELETE /api/admin/gorobo/items/[id]. Update/remove one item."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `PUT, DELETE /api/admin/gorobo/items/[id]`

> **In one line:** Update/remove one item.

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** PUT, DELETE  
**Path:** `/api/admin/gorobo/items/[id]`

> Path parameter: the bracketed segment is part of the route (e.g. `[id]`).

| Field | Required | Type notes |
|---|---|---|
| `name` | required | see code |
| `category` | required | see code |
| `basePrice` | required | see code |
| `margin` | required | see code |
| `…` | required | see code |

## Response

```json
{
  "success": true,
  "item": "..."
}
```

> Full shape: `{success,item|message}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/admin.md)

## Try it live

<EndpointTry path="/api/admin/gorobo/items/[id]" method="put" auth="gorobo-admin" />

## curl

```bash
curl -X PUT "https://api.amazecc.com/api/admin/gorobo/items/[id]" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "name": "...",
           "category": "...",
           "basePrice": "...",
           "margin": "...",
           "…": "..."
         }'
```
