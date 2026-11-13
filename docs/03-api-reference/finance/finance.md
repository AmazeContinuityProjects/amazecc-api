{/* generated: aapi1 */}
---
title: "Finance"
description: "Finance - POST /api/finance. Fees: no-dues view + finance endpoints. ~460 LOC — the second-largest route in the codebase."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/finance`

> **In one line:** Fees: no-dues view + finance endpoints. ~460 LOC — the second-largest route in the codebase.

## Auth

**VTOP session (body).** Cookies + `csrf` + `authorizedID` in the JSON body. Get them from `POST /api/login` - see the [VTOP login page](../../01-authentication/vtop-login.md). Sessions last ~10 minutes; re-login when you see `vtop_session_expired` or `invalid session`.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/finance`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true
}
```

> Full shape: `{success,…} / {error}`

## Try it live

<EndpointTry path="/api/finance" method="post" auth="vtop" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/finance" \
  -H "Content-Type: application/json"
```
