---
title: "Curriculum"
description: "Academics & VTOP - POST /api/curriculum. Extracts course list + pageCsrf needed for WADE/minors flows; auto-follows to the curriculum category view."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/curriculum`

> **In one line:** Extracts course list + pageCsrf needed for WADE/minors flows; auto-follows to the curriculum category view.

## Auth

**VTOP session (body).** Cookies + `csrf` + `authorizedID` in the JSON body. Get them from `POST /api/login` - see the [VTOP login page](../../01-authentication/vtop-login.md). Sessions last ~10 minutes; re-login when you see `vtop_session_expired` or `invalid session`.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/curriculum`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "pageCsrf": "..."
}
```

> Full shape: `{success,pageCsrf,…} / {error,success:false}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/academics-vtop.md)

## Try it live

<EndpointTry path="/api/curriculum" method="post" auth="vtop" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/curriculum" \
  -H "Content-Type: application/json"
```
