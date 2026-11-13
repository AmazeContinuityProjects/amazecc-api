{/* generated: aapi1 */}
---
title: "Details"
description: "Clubs & Events - GET /api/clubs/details. Public club directory from our DB."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `GET /api/clubs/details`

> **In one line:** Public club directory from our DB.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** GET  
**Path:** `/api/clubs/details`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "clubs": "..."
}
```

> Full shape: `{success,clubs}`

## Try it live

<EndpointTry path="/api/clubs/details" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/clubs/details" \
  -H "Content-Type: application/json"
```
