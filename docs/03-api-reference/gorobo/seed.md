---
title: "Seed"
description: "GoRobo Shop - POST /api/gorobo/seed. Seed the catalog from src/data/gorobo/items.json. Admin + gorobo permission."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/gorobo/seed`

> **In one line:** Seed the catalog from src/data/gorobo/items.json. Admin + gorobo permission.

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** POST  
**Path:** `/api/gorobo/seed`

| Field | Required | Type notes |
|---|---|---|
| `items` | required | see code |
| `replace` | optional | see code |

## Response

```json
{
  "success": true,
  "message": "...",
  "stats": "..."
}
```

> Full shape: `{success,message,stats}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/gorobo.md)

## Try it live

<EndpointTry path="/api/gorobo/seed" method="post" auth="gorobo-admin" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/gorobo/seed" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "items": [
             {
               "itemId": "...",
               "qty": 1
             }
           ],
           "replace": "..."
         }'
```
