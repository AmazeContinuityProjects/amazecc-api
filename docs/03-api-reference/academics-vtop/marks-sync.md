---
title: "SYNC"
description: "Academics & VTOP - POST /api/marks/sync. Marks contribution endpoint — the privacy-preserving sync: verify + fetch, then write class_* tables server-side."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/marks/sync`

> **In one line:** Marks contribution endpoint — the privacy-preserving sync: verify + fetch, then write class_* tables server-side.

## Auth

**VTOP session (body).** Cookies + `csrf` + `authorizedID` in the JSON body. Get them from `POST /api/login` - see the [VTOP login page](../../01-authentication/vtop-login.md). Sessions last ~10 minutes; re-login when you see `vtop_session_expired` or `invalid session`.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/marks/sync`

| Field | Required | Type notes |
|---|---|---|
| `contributions` | required | see code |

## Response

```json
{
  "success": true,
  "tally": "...",
  "tokens": "..."
}
```

> Full shape: `{success,tally,tokens}`

**Rate limit:** 20/min/IP

## Try it live

<EndpointTry path="/api/marks/sync" method="post" auth="vtop" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/marks/sync" \
  -H "Content-Type: application/json" \
  -d '{
           "contributions": "..."
         }'
```
