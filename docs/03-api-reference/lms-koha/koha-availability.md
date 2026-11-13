<!-- generated: aapi1 -->
---
title: "Availability"
description: "LMS & Koha - GET /api/koha/availability. Koha item availability proxy. ?biblionumbers=comma,list"
---

import { EndpointTry } from "/snippets/endpoint-try.js";


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

## Try it live

<EndpointTry path="/api/koha/availability" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/koha/availability" \
  -H "Content-Type: application/json"
```
