---
title: "OD"
description: "Academics & VTOP - POST /api/od. On-duty (OD) requests: /vtop/proctor/viewOdDetails via getVtopReferer."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/od`

> **In one line:** On-duty (OD) requests: /vtop/proctor/viewOdDetails via getVtopReferer.

## Auth

**VTOP session (body).** Cookies + `csrf` + `authorizedID` in the JSON body. Get them from `POST /api/login` - see the [VTOP login page](../../01-authentication/vtop-login.md). Sessions last ~10 minutes; re-login when you see `vtop_session_expired` or `invalid session`.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/od`

| Field | Required | Type notes |
|---|---|---|
| `semesterId` | required | see code |

## Response

```json
{
  "success": true
}
```

> Full shape: `{success,…} / {error}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/academics-vtop.md)

## Try it live

<EndpointTry path="/api/od" method="post" auth="vtop" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/od" \
  -H "Content-Type: application/json" \
  -d '{
           "semesterId": "CH20262705"
         }'
```
