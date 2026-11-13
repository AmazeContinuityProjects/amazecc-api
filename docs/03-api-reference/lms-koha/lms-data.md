---
title: "LMS Data"
description: "LMS & Koha - POST /api/lms-data. LMS (Moodle) LMS login + sesskey + AJAX calls. Credentials only transit in body — never stored."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/lms-data`

> **In one line:** LMS (Moodle) LMS login + sesskey + AJAX calls. Credentials only transit in body — never stored.

## Auth

**Moodle/Vitol LMS (body).** `{ username, pass }` in the JSON body. Sent per-request; never stored. See the LMS auth page.


## Request

**Method:** POST  
**Path:** `/api/lms-data`

| Field | Required | Type notes |
|---|---|---|
| `username` | required | see code |
| `pass` | required | see code |

## Response

```json
{
  "status": "..."
}
```

> Full shape: `raw Moodle scrape incl. {status} / {error} — not enveloped`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/lms-koha.md)

## Try it live

<EndpointTry path="/api/lms-data" method="post" auth="moodle" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/lms-data" \
  -H "Content-Type: application/json" \
  -d '{
           "username": "21BCE0000",
           "pass": "<your password>"
         }'
```
