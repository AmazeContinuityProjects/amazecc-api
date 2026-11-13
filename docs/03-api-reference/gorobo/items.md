---
title: "Items"
description: "GoRobo Shop - GET /api/gorobo/items. Public catalog (CDN-cached). Query: ?category&limit&page&q."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET /api/gorobo/items`

> **In one line:** Public catalog (CDN-cached). Query: ?category&limit&page&q.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** GET  
**Path:** `/api/gorobo/items`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "items": "...",
  "count": 1,
  "page": 1,
  "pages": "...",
  "total": 1
}
```

> Full shape: `{success,items,count,page,pages,total}`

## Try it live

<EndpointTry path="/api/gorobo/items" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/gorobo/items" \
  -H "Content-Type: application/json"
```
