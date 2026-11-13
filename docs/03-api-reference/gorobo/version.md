---
title: "Version"
description: "GoRobo Shop - GET /api/gorobo/version. Catalog cache-bust fingerprint. The client polls this to invalidate local catalog cache."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET /api/gorobo/version`

> **In one line:** Catalog cache-bust fingerprint. The client polls this to invalidate local catalog cache.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** GET  
**Path:** `/api/gorobo/version`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "count": 1,
  "lastUpdate": "..."
}
```

> Full shape: `{success,count,lastUpdate}`

## Try it live

<EndpointTry path="/api/gorobo/version" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/gorobo/version" \
  -H "Content-Type: application/json"
```
