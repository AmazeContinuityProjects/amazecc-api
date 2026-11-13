---
title: "Items"
description: "Admin - GET/POST /api/admin/gorobo/items. Gorobo catalog admin. Query ?search&category&lowStock&limit."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET, POST /api/admin/gorobo/items`

> **In one line:** Gorobo catalog admin. Query ?search&category&lowStock&limit.

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** GET, POST  
**Path:** `/api/admin/gorobo/items`

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
  "count": 1,
  "items": "...",
  "totalCount": "...",
  "hasMore": 1
}
```

> Full shape: `{success,count,items,totalCount,hasMore|item}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/admin.md)

## Try it live

<EndpointTry path="/api/admin/gorobo/items" method="get" auth="gorobo-admin" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/admin/gorobo/items" \
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
