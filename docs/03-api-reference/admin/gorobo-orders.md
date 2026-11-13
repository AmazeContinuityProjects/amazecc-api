---
title: "Orders"
description: "Admin - GET/POST /api/admin/gorobo/orders. Order list + create (admin can create on behalf). Query ?status&search."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET, POST /api/admin/gorobo/orders`

> **In one line:** Order list + create (admin can create on behalf). Query ?status&search.

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** GET, POST  
**Path:** `/api/admin/gorobo/orders`

| Field | Required | Type notes |
|---|---|---|
| `userName` | required | see code |
| `phoneNumber` | required | see code |
| `items` | optional | see code |

## Response

```json
{
  "success": true,
  "count": 1,
  "orders": "..."
}
```

> Full shape: `{success,count,orders|order}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/admin.md)

## Try it live

<EndpointTry path="/api/admin/gorobo/orders" method="get" auth="gorobo-admin" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/admin/gorobo/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "userName": "21BCE0000",
           "phoneNumber": "9xxxxxxxxx",
           "items": [
             {
               "itemId": "...",
               "qty": 1
             }
           ]
         }'
```
