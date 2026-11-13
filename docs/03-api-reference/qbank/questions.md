---
title: "Questions"
description: "QBank - GET /api/qbank/questions. Approved questions for a course. ?course filter."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET /api/qbank/questions`

> **In one line:** Approved questions for a course. ?course filter.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** GET  
**Path:** `/api/qbank/questions`

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

<EndpointTry path="/api/qbank/questions" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/qbank/questions" \
  -H "Content-Type: application/json"
```
