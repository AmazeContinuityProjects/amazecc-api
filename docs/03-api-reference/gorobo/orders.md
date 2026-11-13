---
title: "Orders"
description: "GoRobo Shop - POST /api/gorobo/orders. Public order placement (rate-limited). Pending → confirmed by admin."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/gorobo/orders`

> **In one line:** Public order placement (rate-limited). Pending → confirmed by admin.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** POST  
**Path:** `/api/gorobo/orders`

| Field | Required | Type notes |
|---|---|---|
| `name` | required | see code |
| `phone` | required | see code |
| `items[{itemId,qty}]` | required | see code |
| `deliveryMode` | optional | see code |
| `mapsUrl` | optional | see code |

## Response

```json
{
  "success": true,
  "order": "..."
}
```

> Full shape: `{success,order} / {success:false,error|message}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/gorobo.md)

**Rate limit:** 5/min/IP

## Try it live

<EndpointTry path="/api/gorobo/orders" method="post" auth="none" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/gorobo/orders" \
  -H "Content-Type: application/json" \
  -d '{
           "name": "...",
           "phone": "9xxxxxxxxx",
           "items": [
             {
               "itemId": "...",
               "qty": 1
             }
           ],
           "deliveryMode": "...",
           "mapsUrl": "..."
         }'
```
