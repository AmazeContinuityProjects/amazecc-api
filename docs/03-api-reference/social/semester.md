---
title: "Semester"
description: "Social (FFCS Partners) - GET /api/social/semester. Server-resolved current campus semester (cached in app_config — not per-user). No semester readable from the VTOP dropdown."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET /api/social/semester`

> **In one line:** Server-resolved current campus semester (cached in app_config — not per-user). No semester readable from the VTOP dropdown.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** GET  
**Path:** `/api/social/semester`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "semesterId": "...",
  "semesterLabel": "...",
  "resolvedAt": "...",
  "detail": "..."
}
```

> Full shape: `{success,semesterId,semesterLabel,resolvedAt,detail}`

## Try it live

<EndpointTry path="/api/social/semester" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/social/semester" \
  -H "Content-Type: application/json"
```
