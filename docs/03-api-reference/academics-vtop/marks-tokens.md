<!-- generated: aapi1 -->
---
title: "Tokens"
description: "Academics & VTOP - POST /api/marks/tokens. Marks sync tokens for the client (legacy tokens still honored)."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/marks/tokens`

> **In one line:** Marks sync tokens for the client (legacy tokens still honored).

## Auth

**VTOP session (body).** Cookies + `csrf` + `authorizedID` in the JSON body. Get them from `POST /api/login` - see the [VTOP login page](../../01-authentication/vtop-login.md). Sessions last ~10 minutes; re-login when you see `vtop_session_expired` or `invalid session`.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/marks/tokens`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "tokens": "...",
  "legacy": "..."
}
```

> Full shape: `{success,tokens,legacy}`

**Rate limit:** 60/min/IP

## Try it live

<EndpointTry path="/api/marks/tokens" method="post" auth="vtop" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/marks/tokens" \
  -H "Content-Type: application/json"
```
