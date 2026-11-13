<!-- generated: aapi1 -->
---
title: "Hostel"
description: "Academics & VTOP - POST /api/hostel. Hostel block/room/mess + leave history. Raw envelope, not _success_-wrapped."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/hostel`

> **In one line:** Hostel block/room/mess + leave history. Raw envelope, not &#123;success&#125;-wrapped.

## Auth

**VTOP session (body).** Cookies + `csrf` + `authorizedID` in the JSON body. Get them from `POST /api/login` - see the [VTOP login page](../../01-authentication/vtop-login.md). Sessions last ~10 minutes; re-login when you see `vtop_session_expired` or `invalid session`.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/hostel`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "hostelInfo": "...",
  "leaveHistory": "..."
}
```

> Full shape: `{hostelInfo,leaveHistory} (raw) / {error}`

## Try it live

<EndpointTry path="/api/hostel" method="post" auth="vtop" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/hostel" \
  -H "Content-Type: application/json"
```
