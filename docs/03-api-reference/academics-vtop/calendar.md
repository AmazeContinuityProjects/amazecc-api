---
title: "Calendar"
description: "Academics & VTOP - POST /api/calendar. Academic calendar scrape. Raw JSON, not _success_-enveloped."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/calendar`

> **In one line:** Academic calendar scrape. Raw JSON, not &#123;success&#125;-enveloped.

## Auth

**VTOP session (body).** Cookies + `csrf` + `authorizedID` in the JSON body. Get them from `POST /api/login` - see the [VTOP login page](../../01-authentication/vtop-login.md). Sessions last ~10 minutes; re-login when you see `vtop_session_expired` or `invalid session`.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/calendar`

| Field | Required | Type notes |
|---|---|---|
| `semesterId` | required | see code |

## Response

```json
{
  "calendars": "...",
  "semesterId": "..."
}
```

> Full shape: `{calendars,semesterId} (raw) / {error}`

## Try it live

<EndpointTry path="/api/calendar" method="post" auth="vtop" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/calendar" \
  -H "Content-Type: application/json" \
  -d '{
           "semesterId": "CH20262705"
         }'
```
