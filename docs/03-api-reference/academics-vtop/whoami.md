<!-- generated: aapi1 -->
---
title: "Whoami"
description: "Academics & VTOP - POST /api/whoami. Scrapes ~10 VTOP profile endpoints sequentially (deliberately — avoids VTOP rate issues). Used by the app on every cold start (cache_whoami)"
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/whoami`

> **In one line:** Scrapes ~10 VTOP profile endpoints sequentially (deliberately — avoids VTOP rate issues). Used by the app on every cold start (cache_whoami).

## Auth

**VTOP session (body).** Cookies + `csrf` + `authorizedID` in the JSON body. Get them from `POST /api/login` - see the [VTOP login page](../../01-authentication/vtop-login.md). Sessions last ~10 minutes; re-login when you see `vtop_session_expired` or `invalid session`.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/whoami`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "contact": "..."
}
```

> Full shape: `{success,contact,…identity (buildIdentity)} / {error}`

## Try it live

<EndpointTry path="/api/whoami" method="post" auth="vtop" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/whoami" \
  -H "Content-Type: application/json"
```
