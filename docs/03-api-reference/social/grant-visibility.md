---
title: "Visibility"
description: "Social (FFCS Partners) - POST /api/social/grant/visibility. Flip a pairing grant between coarse and full visibility."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/social/grant/visibility`

> **In one line:** Flip a pairing grant between coarse and full visibility.

## Auth

**Social identity (VTOP-verified).** Body carries `cookies` + `authorizedID` + `csrf`; the server verifies them VTOP-side and derives your identity - the body never asserts identity.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/social/grant/visibility`

| Field | Required | Type notes |
|---|---|---|
| `grantId` | required | see code |
| `visibility` | required | see code |

## Response

```json
{
  "success": true,
  "grantId": "...",
  "visibility": "...",
  "detail": "..."
}
```

> Full shape: `{success,grantId,visibility,detail}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/social.md)

**Rate limit:** 60/min/IP

## Try it live

<EndpointTry path="/api/social/grant/visibility" method="post" auth="social" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/social/grant/visibility" \
  -H "Content-Type: application/json" \
  -d '{
           "grantId": "...",
           "visibility": "..."
         }'
```
