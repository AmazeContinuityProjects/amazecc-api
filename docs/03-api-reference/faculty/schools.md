---
title: "Schools"
description: "Faculty Directory - GET /api/faculty/schools. Faculty-directory schools from our DB (seeded from VIT faculty pages)."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET /api/faculty/schools`

> **In one line:** Faculty-directory schools from our DB (seeded from VIT faculty pages).

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** GET  
**Path:** `/api/faculty/schools`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "schools": "..."
}
```

> Full shape: `{success,schools}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/faculty.md)

## Try it live

<EndpointTry path="/api/faculty/schools" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/faculty/schools" \
  -H "Content-Type: application/json"
```
