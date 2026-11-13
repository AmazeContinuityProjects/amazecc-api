---
title: "Scrape"
description: "Faculty Directory - POST /api/faculty/scrape. Scrapes the VIT faculty directory for a school and caches rows in our DB. Public (rate-limited) — flagged in docs."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/faculty/scrape`

> **In one line:** Scrapes the VIT faculty directory for a school and caches rows in our DB. Public (rate-limited) — flagged in docs.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** POST  
**Path:** `/api/faculty/scrape`

| Field | Required | Type notes |
|---|---|---|
| `schoolId` | required | see code |

## Response

```json
{
  "success": true,
  "faculties": "..."
}
```

> Full shape: `{success,faculties}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/faculty.md)

**Rate limit:** 10/min/IP

## Try it live

<EndpointTry path="/api/faculty/scrape" method="post" auth="none" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/faculty/scrape" \
  -H "Content-Type: application/json" \
  -d '{
           "schoolId": []
         }'
```
