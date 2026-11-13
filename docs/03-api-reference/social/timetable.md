<!-- generated: aapi1 -->
---
title: "Timetable"
description: "Social (FFCS Partners) - POST /api/social/timetable. Read a paired peer's timetable/busy map. 'coarse' visibility strips courses, keeps only busy slots."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/social/timetable`

> **In one line:** Read a paired peer's timetable/busy map. 'coarse' visibility strips courses, keeps only busy slots.

## Auth

**Social identity (VTOP-verified).** Body carries `cookies` + `authorizedID` + `csrf`; the server verifies them VTOP-side and derives your identity - the body never asserts identity.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/social/timetable`

| Field | Required | Type notes |
|---|---|---|
| `handle|secret` | required | see code |
| `semester` | optional | see code |
| `semesterLabel` | optional | see code |

## Response

```json
{
  "success": true,
  "identity": "...",
  "courses": "...",
  "busyMap": "...",
  "visibility": "...",
  "stale": true,
  "version": 1,
  "detail": "..."
}
```

> Full shape: `{success,identity,courses,busyMap,visibility,stale,version,detail}`

**Rate limit:** 120/min/IP

## Try it live

<EndpointTry path="/api/social/timetable" method="post" auth="social" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/social/timetable" \
  -H "Content-Type: application/json" \
  -d '{
           "handle|secret": "...",
           "semester": "...",
           "semesterLabel": "..."
         }'
```
