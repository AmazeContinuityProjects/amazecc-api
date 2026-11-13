---
title: "Revoke"
description: "Social (FFCS Partners) - POST /api/social/grant/revoke. Severs a pairing in both directions (idempotent). Secret check is redundant — the body proves possession anyway, but it is verified."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/social/grant/revoke`

> **In one line:** Severs a pairing in both directions (idempotent). Secret check is redundant — the body proves possession anyway, but it is verified.

## Auth

**Social identity (VTOP-verified).** Body carries `cookies` + `authorizedID` + `csrf`; the server verifies them VTOP-side and derives your identity - the body never asserts identity.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/social/grant/revoke`

| Field | Required | Type notes |
|---|---|---|
| `grantId` | required | see code |
| `secret` | optional | see code |

## Response

```json
{
  "success": true,
  "revoked": true,
  "grantId": "..."
}
```

> Full shape: `{success,revoked,grantId}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/social.md)

**Rate limit:** 60/min/IP

## Try it live

<EndpointTry path="/api/social/grant/revoke" method="post" auth="social" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/social/grant/revoke" \
  -H "Content-Type: application/json" \
  -d '{
           "grantId": "...",
           "secret": "..."
         }'
```
