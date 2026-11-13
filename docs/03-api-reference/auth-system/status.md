---
title: "Status"
description: "Auth & System - GET /api/status. Trivial liveness probe."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET /api/status`

> **In one line:** Trivial liveness probe.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** GET  
**Path:** `/api/status`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "text": "..."
}
```

> Full shape: `raw {text:'API is working'}`

## Try it live

<EndpointTry path="/api/status" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/status" \
  -H "Content-Type: application/json"
```
