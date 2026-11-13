---
title: "Health"
description: "Auth & System - GET /api/health. Trivial liveness probe for monitors."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET /api/health`

> **In one line:** Trivial liveness probe for monitors.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** GET  
**Path:** `/api/health`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "status": "..."
}
```

> Full shape: `raw {status:'ok'}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/auth-system.md)

## Try it live

<EndpointTry path="/api/health" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/health" \
  -H "Content-Type: application/json"
```
