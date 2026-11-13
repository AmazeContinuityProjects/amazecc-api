---
title: "Syllabus"
description: "Academics & VTOP - POST /api/curriculum/syllabus. Single-course syllabus binary. Same binary proxy pattern as curriculum/download."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/curriculum/syllabus`

> **In one line:** Single-course syllabus binary. Same binary proxy pattern as curriculum/download.

## Auth

**VTOP session (body).** Cookies + `csrf` + `authorizedID` in the JSON body. Get them from `POST /api/login` - see the [VTOP login page](../../01-authentication/vtop-login.md). Sessions last ~10 minutes; re-login when you see `vtop_session_expired` or `invalid session`.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/curriculum/syllabus`

| Field | Required | Type notes |
|---|---|---|
| `courseCode` | required | see code |

## Response

```json
{
  "success": true,
  "error": "...",
  "snippet": "..."
}
```

> Full shape: `binary stream / {success:false,error,snippet}`

## Try it live

<EndpointTry path="/api/curriculum/syllabus" method="post" auth="vtop" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/curriculum/syllabus" \
  -H "Content-Type: application/json" \
  -d '{
           "courseCode": "..."
         }'
```
