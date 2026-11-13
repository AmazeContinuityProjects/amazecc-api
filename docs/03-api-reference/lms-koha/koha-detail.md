---
title: "Detail"
description: "LMS & Koha - GET /api/koha/detail. Koha biblio detail proxy. ?biblionumber"
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET /api/koha/detail`

> **In one line:** Koha biblio detail proxy. ?biblionumber

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** GET  
**Path:** `/api/koha/detail`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "book": "..."
}
```

> Full shape: `{success,book}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/lms-koha.md)

## Try it live

<EndpointTry path="/api/koha/detail" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/koha/detail" \
  -H "Content-Type: application/json"
```
