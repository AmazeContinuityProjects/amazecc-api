---
title: "Orders [id]"
description: "Admin - GET/PUT/PATCH /api/admin/gorobo/orders/[id]. Order detail/edit (items, quote, status). parseQuoteBody handles both item and status updates."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET, PUT, PATCH /api/admin/gorobo/orders/[id]`

> **In one line:** Order detail/edit (items, quote, status). parseQuoteBody handles both item and status updates.

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** GET, PUT, PATCH  
**Path:** `/api/admin/gorobo/orders/[id]`

> Path parameter: the bracketed segment is part of the route (e.g. `[id]`).

| Field | Required | Type notes |
|---|---|---|
| `status?|items/quote fields` | optional | see code |

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

<EndpointTry path="/api/admin/gorobo/orders/[id]" method="get" auth="gorobo-admin" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/admin/gorobo/orders/[id]" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "status?|items/quote fields": [
             {
               "itemId": "...",
               "qty": 1
             }
           ]
         }'
```
