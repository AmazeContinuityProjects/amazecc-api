---
title: "Search"
description: "LMS & Koha - GET /api/koha/search. Public Koha OPAC RSS search proxy. ?idx&q&count&offset — idx is the search-index selector (kw/title/...)."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET /api/koha/search`

> **In one line:** Public Koha OPAC RSS search proxy. ?idx&q&count&offset — idx is the search-index selector (kw/title/...).

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** GET  
**Path:** `/api/koha/search`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "books": "...",
  "total": 1,
  "query": "...",
  "count": 1,
  "offset": "..."
}
```

> Full shape: `{success,books,total,query,count,offset}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/lms-koha.md)

## Try it live

<EndpointTry path="/api/koha/search" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/koha/search" \
  -H "Content-Type: application/json"
```
