<!-- generated: aapi1 -->
---
title: "Vitol Data"
description: "LMS & Koha - POST /api/vitol-data. VIT Online (Vitol) Moodle. vitolSite selects the LMS instance if multiple."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/vitol-data`

> **In one line:** VIT Online (Vitol) Moodle. vitolSite selects the LMS instance if multiple.

## Auth

**Moodle/Vitol LMS (body).** `{ username, pass }` in the JSON body. Sent per-request; never stored. See the LMS auth page.


## Request

**Method:** POST  
**Path:** `/api/vitol-data`

| Field | Required | Type notes |
|---|---|---|
| `username` | required | see code |
| `pass` | required | see code |
| `vitolSite` | optional | see code |

## Response

```json
{
  "status": "..."
}
```

> Full shape: `raw Moodle scrape incl. {status} / {error} — not enveloped`

## Try it live

<EndpointTry path="/api/vitol-data" method="post" auth="moodle" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/vitol-data" \
  -H "Content-Type: application/json" \
  -d '{
           "username": "21BCE0000",
           "pass": "<your password>",
           "vitolSite": "..."
         }'
```
