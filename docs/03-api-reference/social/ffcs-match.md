{/* generated: aapi1 */}
---
title: "FFCS Match"
description: "Social (FFCS Partners) - GET/POST /api/social/ffcs-match. Friend-finder: who is in my classes. Server computes reciprocal pairing only — never exposes non-shared info."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `GET, POST /api/social/ffcs-match`

> **In one line:** Friend-finder: who is in my classes. Server computes reciprocal pairing only — never exposes non-shared info.

## Auth

**Social identity (VTOP-verified).** Body carries `cookies` + `authorizedID` + `csrf`; the server verifies them VTOP-side and derives your identity - the body never asserts identity.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** GET, POST  
**Path:** `/api/social/ffcs-match`

| Field | Required | Type notes |
|---|---|---|
| `classIds` | required | see code |
| `semesterId` | required | see code |
| `op` | optional | see code |
| `source` | optional | see code |
| `discoverable` | optional | see code |

## Response

```json
{
  "success": true,
  "semesterId": "...",
  "classes": "..."
}
```

> Full shape: `{success,semesterId,classes} or buildState() spread; GET reads ?classIds&semesterId`

**Rate limit:** 30/min/IP

## Try it live

<EndpointTry path="/api/social/ffcs-match" method="get" auth="social" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/social/ffcs-match" \
  -H "Content-Type: application/json" \
  -d '{
           "classIds": [
             "CH2026270102069"
           ],
           "semesterId": "CH20262705",
           "op": "...",
           "source": "...",
           "discoverable": "..."
         }'
```
