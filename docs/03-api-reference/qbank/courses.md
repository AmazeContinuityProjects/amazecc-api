<!-- generated: aapi1 -->
---
title: "Courses"
description: "QBank - GET /api/qbank/courses. Courses that have published papers/questions."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `GET /api/qbank/courses`

> **In one line:** Courses that have published papers/questions.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** GET  
**Path:** `/api/qbank/courses`

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

<EndpointTry path="/api/qbank/courses" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/qbank/courses" \
  -H "Content-Type: application/json"
```
