---
title: "Papers"
description: "QBank - GET /api/qbank/papers. APPROVED papers list. ?course filter. Anonymous download via /api/qbank/papers/download/[paperId]."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET /api/qbank/papers`

> **In one line:** APPROVED papers list. ?course filter. Anonymous download via /api/qbank/papers/download/[paperId].

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** GET  
**Path:** `/api/qbank/papers`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "data": "..."
}
```

> Full shape: `{success,data}`

## Try it live

<EndpointTry path="/api/qbank/papers" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/qbank/papers" \
  -H "Content-Type: application/json"
```
