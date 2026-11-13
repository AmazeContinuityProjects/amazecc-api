---
title: "FFCS"
description: "Academics & VTOP - POST /api/ffcs. All-in bundle (17 KB route). section=schedule/feedback/wishlist returns only that slice. Body section of the file for each mode."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/ffcs`

> **In one line:** All-in bundle (17 KB route). section=schedule/feedback/wishlist returns only that slice. Body section of the file for each mode.

## Auth

**VTOP session (body).** Cookies + `csrf` + `authorizedID` in the JSON body. Get them from `POST /api/login` - see the [VTOP login page](../../01-authentication/vtop-login.md). Sessions last ~10 minutes; re-login when you see `vtop_session_expired` or `invalid session`.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/ffcs`

| Field | Required | Type notes |
|---|---|---|
| `semesterId` | required | see code |
| `section` | optional | see code |

## Response

```json
{
  "success": true,
  "registrationSchedule": "...",
  "feedbackStatus": "...",
  "feedback": "...",
  "wishlist": "...",
  "schedule": "...",
  "qcmView": "..."
}
```

> Full shape: `{success,registrationSchedule,feedbackStatus,feedback,wishlist,schedule,qcmView} / {error} — section=narrowed slice`

## Try it live

<EndpointTry path="/api/ffcs" method="post" auth="vtop" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/ffcs" \
  -H "Content-Type: application/json" \
  -d '{
           "semesterId": "CH20262705",
           "section": "..."
         }'
```
