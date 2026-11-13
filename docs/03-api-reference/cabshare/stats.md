---
title: "Stats"
description: "CabShare - GET /api/cabshare/stats. Usage stats for the CabShare board."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET /api/cabshare/stats`

> **In one line:** Usage stats for the CabShare board.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** GET  
**Path:** `/api/cabshare/stats`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "stats": "..."
}
```

> Full shape: `{success,stats}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/cabshare.md)

## Try it live

<EndpointTry path="/api/cabshare/stats" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/cabshare/stats" \
  -H "Content-Type: application/json"
```
