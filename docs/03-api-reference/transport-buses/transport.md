---
title: "Transport"
description: "Transport & Buses - POST /api/transport. VTOP bus registration status + QR code + payment link for the route."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/transport`

> **In one line:** VTOP bus registration status + QR code + payment link for the route.

## Auth

**VTOP session (body).** Cookies + `csrf` + `authorizedID` in the JSON body. Get them from `POST /api/login` - see the [VTOP login page](../../01-authentication/vtop-login.md). Sessions last ~10 minutes; re-login when you see `vtop_session_expired` or `invalid session`.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/transport`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "hasRegistration": "...",
  "busRouteId": "...",
  "busUrl": "...",
  "qrCode": "...",
  "pageCsrf": "..."
}
```

> Full shape: `{success,hasRegistration,busRouteId,busUrl,qrCode,pageCsrf} / {error}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/transport-buses.md)

## Try it live

<EndpointTry path="/api/transport" method="post" auth="vtop" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/transport" \
  -H "Content-Type: application/json"
```
