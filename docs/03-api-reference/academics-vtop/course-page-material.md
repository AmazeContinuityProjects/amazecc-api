{/* generated: aapi1 */}
---
title: "Material"
description: "Academics & VTOP - POST /api/course-page/material. Course material downloads (PDF/zip streams) via VTOP binary endpoints, returns base64 or proxied file data."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/course-page/material`

> **In one line:** Course material downloads (PDF/zip streams) via VTOP binary endpoints, returns base64 or proxied file data.

## Auth

**VTOP session (body).** Cookies + `csrf` + `authorizedID` in the JSON body. Get them from `POST /api/login` - see the [VTOP login page](../../01-authentication/vtop-login.md). Sessions last ~10 minutes; re-login when you see `vtop_session_expired` or `invalid session`.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/course-page/material`

| Field | Required | Type notes |
|---|---|---|
| `action` | optional | see code |
| `…params` | required | see code |

## Response

```json
{
  "success": true
}
```

> Full shape: `{success,…} / {error}`

## Try it live

<EndpointTry path="/api/course-page/material" method="post" auth="vtop" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/course-page/material" \
  -H "Content-Type: application/json" \
  -d '{
           "action": "...",
           "…params": "..."
         }'
```
