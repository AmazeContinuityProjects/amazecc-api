{/* generated: aapi1 */}
---
title: "Patron"
description: "LMS & Koha - POST /api/koha/patron. Patron account scrape (opac-user.pl etc.) via CGI. Koha credentials in body — session never stored server-side."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/koha/patron`

> **In one line:** Patron account scrape (opac-user.pl etc.) via CGI. Koha credentials in body — session never stored server-side.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** POST  
**Path:** `/api/koha/patron`

| Field | Required | Type notes |
|---|---|---|
| `card` | required | see code |
| `password` | required | see code |
| `page` | optional | see code |

## Response

```json
{
  "success": true,
  "data": "...",
  "page": 1
}
```

> Full shape: `{success,data,page} / {error}`

## Try it live

<EndpointTry path="/api/koha/patron" method="post" auth="none" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/koha/patron" \
  -H "Content-Type: application/json" \
  -d '{
           "card": "...",
           "password": "<your password>",
           "page": 10
         }'
```
