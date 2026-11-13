---
title: "Bulk"
description: "Academics & VTOP - POST /api/bulk. Fans out to internal VTOP proxies (VTOP_PROXIES: hostel-counselling, registration-schedule, exc-registration, course-completion). runVtopPro"
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/bulk`

> **In one line:** Fans out to internal VTOP proxies (VTOP_PROXIES: hostel-counselling, registration-schedule, exc-registration, course-completion). runVtopProxy never throws — per-endpoint &#123;success:false&#125; inside results.

## Auth

**VTOP session (body).** Cookies + `csrf` + `authorizedID` in the JSON body. Get them from `POST /api/login` - see the [VTOP login page](../../01-authentication/vtop-login.md). Sessions last ~10 minutes; re-login when you see `vtop_session_expired` or `invalid session`.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/bulk`

| Field | Required | Type notes |
|---|---|---|
| `endpoints[]` | required | see code |

## Response

```json
{
  "success": true
}
```

> Full shape: `{success,results:{<name>:{…}} / {success:false,error}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/academics-vtop.md)

## Try it live

<EndpointTry path="/api/bulk" method="post" auth="vtop" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/bulk" \
  -H "Content-Type: application/json" \
  -d '{
           "endpoints": [
             "attendance",
             "marks"
           ]
         }'
```
