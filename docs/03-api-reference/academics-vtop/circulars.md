---
title: "Circulars"
description: "Academics & VTOP - POST /api/circulars. University circulars list. Partial envelope (known inconsistency)."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/circulars`

> **In one line:** University circulars list. Partial envelope (known inconsistency).

## Auth

**VTOP session (body).** Cookies + `csrf` + `authorizedID` in the JSON body. Get them from `POST /api/login` - see the [VTOP login page](../../01-authentication/vtop-login.md). Sessions last ~10 minutes; re-login when you see `vtop_session_expired` or `invalid session`.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/circulars`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true
}
```

> Full shape: `{success,…} / {error,success:false}`

## Try it live

<EndpointTry path="/api/circulars" method="post" auth="vtop" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/circulars" \
  -H "Content-Type: application/json"
```
