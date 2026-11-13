---
title: "Hubs"
description: "CabShare - GET /api/cabshare/hubs. Pickup hubs (hostel gates) from our DB."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET /api/cabshare/hubs`

> **In one line:** Pickup hubs (hostel gates) from our DB.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** GET  
**Path:** `/api/cabshare/hubs`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "hubs": "..."
}
```

> Full shape: `{success,hubs}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/cabshare.md)

## Try it live

<EndpointTry path="/api/cabshare/hubs" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/cabshare/hubs" \
  -H "Content-Type: application/json"
```
