{/* generated: aapi1 */}
---
title: "Attendance Htmlparser2"
description: "Academics & VTOP - POST /api/attendance/htmlparser2. Same contract as /api/attendance, built on parseDocument + css-select instead of Cheerio. Performance/portability variant."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/attendance/htmlparser2`

> **In one line:** Same contract as /api/attendance, built on parseDocument + css-select instead of Cheerio. Performance/portability variant.

## Auth

**VTOP session (body).** Cookies + `csrf` + `authorizedID` in the JSON body. Get them from `POST /api/login` - see the [VTOP login page](../../01-authentication/vtop-login.md). Sessions last ~10 minutes; re-login when you see `vtop_session_expired` or `invalid session`.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/attendance/htmlparser2`

| Field | Required | Type notes |
|---|---|---|
| `semesterId` | required | see code |

## Response

```json
{
  "attRes": "...",
  "marksRes": "..."
}
```

> Full shape: `{attRes,marksRes} (raw) / {error}`

## Try it live

<EndpointTry path="/api/attendance/htmlparser2" method="post" auth="vtop" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/attendance/htmlparser2" \
  -H "Content-Type: application/json" \
  -d '{
           "semesterId": "CH20262705"
         }'
```
