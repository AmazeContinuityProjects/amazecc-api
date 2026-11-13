{/* generated: aapi1 */}
---
title: "Download"
description: "Academics & VTOP - POST /api/curriculum/download. Binary proxy (syllabus PDF). On upstream failure, returns the first ~200 bytes as snippet for debugging."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/curriculum/download`

> **In one line:** Binary proxy (syllabus PDF). On upstream failure, returns the first ~200 bytes as snippet for debugging.

## Auth

**VTOP session (body).** Cookies + `csrf` + `authorizedID` in the JSON body. Get them from `POST /api/login` - see the [VTOP login page](../../01-authentication/vtop-login.md). Sessions last ~10 minutes; re-login when you see `vtop_session_expired` or `invalid session`.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/curriculum/download`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "error": "...",
  "snippet": "..."
}
```

> Full shape: `binary stream / {success:false,error,snippet}`

## Try it live

<EndpointTry path="/api/curriculum/download" method="post" auth="vtop" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/curriculum/download" \
  -H "Content-Type: application/json"
```
