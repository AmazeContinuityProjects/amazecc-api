---
title: "Claim"
description: "Social (FFCS Partners) - POST /api/social/pair/claim. Claim a pairing by handle. Mutual secret is minted, hashed at rest, AES-GCM-encrypted so the non-claiming peer can fetch it later."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/social/pair/claim`

> **In one line:** Claim a pairing by handle. Mutual secret is minted, hashed at rest, AES-GCM-encrypted so the non-claiming peer can fetch it later.

## Auth

**Social identity (VTOP-verified).** Body carries `cookies` + `authorizedID` + `csrf`; the server verifies them VTOP-side and derives your identity - the body never asserts identity.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/social/pair/claim`

| Field | Required | Type notes |
|---|---|---|
| `handle` | required | see code |
| `visibility` | required | see code |
| `expiresInMinutes` | optional | see code |

## Response

```json
{
  "success": true,
  "grantId": "...",
  "secret": "...",
  "peer": "...",
  "visibility": "...",
  "created": "...",
  "detail": "..."
}
```

> Full shape: `{success,grantId,secret,peer,visibility,created,detail}`

**Rate limit:** 30/hour/IP

## Try it live

<EndpointTry path="/api/social/pair/claim" method="post" auth="social" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/social/pair/claim" \
  -H "Content-Type: application/json" \
  -d '{
           "handle": "...",
           "visibility": "...",
           "expiresInMinutes": "..."
         }'
```
