---
title: "Availability"
description: "LMS & Koha - GET /api/koha/availability. Koha item availability proxy. ?biblionumbers=comma,list"
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET /api/koha/availability`

> **In one line:** Koha item availability proxy. ?biblionumbers=comma,list

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** GET  
**Path:** `/api/koha/availability`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "items": "..."
}
```

> Full shape: `{success,items}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/lms-koha.md)

## Try it live

<EndpointTry path="/api/koha/availability" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/koha/availability" \
  -H "Content-Type: application/json"
```
