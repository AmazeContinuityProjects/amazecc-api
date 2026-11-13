---
title: "Download [paperId]"
description: "QBank - GET /api/qbank/papers/download/[paperId]. Anonymous streaming download of an APPROVED paper from Backblaze B2."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET /api/qbank/papers/download/[paperId]`

> **In one line:** Anonymous streaming download of an APPROVED paper from Backblaze B2.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** GET  
**Path:** `/api/qbank/papers/download/[paperId]`

> Path parameter: the bracketed segment is part of the route (e.g. `[id]`).

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "error": "..."
}
```

> Full shape: `binary stream / {error}`

## Try it live

<EndpointTry path="/api/qbank/papers/download/[paperId]" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/qbank/papers/download/[paperId]" \
  -H "Content-Type: application/json"
```
