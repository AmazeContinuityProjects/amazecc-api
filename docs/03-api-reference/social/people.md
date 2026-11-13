---
title: "People"
description: "Social (FFCS Partners) - POST /api/social/people. Resolve a Crockford handle (AMZ-XXXX-XXXX) to a person card."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/social/people`

> **In one line:** Resolve a Crockford handle (AMZ-XXXX-XXXX) to a person card.

## Auth

**Social identity (VTOP-verified).** Body carries `cookies` + `authorizedID` + `csrf`; the server verifies them VTOP-side and derives your identity - the body never asserts identity.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/social/people`

| Field | Required | Type notes |
|---|---|---|
| `handle` | required | see code |

## Response

```json
{
  "success": true,
  "person": "...",
  "detail": "..."
}
```

> Full shape: `{success,person,detail} / {success:false,error}`

**Rate limit:** 20/min/IP

## Try it live

<EndpointTry path="/api/social/people" method="post" auth="social" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/social/people" \
  -H "Content-Type: application/json" \
  -d '{
           "handle": "..."
         }'
```
