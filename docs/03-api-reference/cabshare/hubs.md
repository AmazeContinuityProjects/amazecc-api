<!-- generated: aapi1 -->
---
title: "Hubs"
description: "CabShare - GET /api/cabshare/hubs. Pickup hubs (hostel gates) from our DB."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


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

## Try it live

<EndpointTry path="/api/cabshare/hubs" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/cabshare/hubs" \
  -H "Content-Type: application/json"
```
