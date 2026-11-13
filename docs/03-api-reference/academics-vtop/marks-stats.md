---
title: "Stats"
description: "Academics & VTOP - POST/GET /api/marks/stats. Class-wide marks stats for shared pooling (feeds /api/marks/sync). GET variant reads same data."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST, GET /api/marks/stats`

> **In one line:** Class-wide marks stats for shared pooling (feeds /api/marks/sync). GET variant reads same data.

## Auth

**VTOP session (body).** Cookies + `csrf` + `authorizedID` in the JSON body. Get them from `POST /api/login` - see the [VTOP login page](../../01-authentication/vtop-login.md). Sessions last ~10 minutes; re-login when you see `vtop_session_expired` or `invalid session`.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST, GET  
**Path:** `/api/marks/stats`

| Field | Required | Type notes |
|---|---|---|
| `classIds` | required | see code |

## Response

```json
{
  "success": true,
  "stats": "..."
}
```

> Full shape: `{success,stats:{<classId>:{mean,median?…}}}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/academics-vtop.md)

**Rate limit:** 60/min/IP

## Try it live

<EndpointTry path="/api/marks/stats" method="post" auth="vtop" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/marks/stats" \
  -H "Content-Type: application/json" \
  -d '{
           "classIds": [
             "CH2026270102069"
           ]
         }'
```
