---
title: "Attendance"
description: "Academics & VTOP - POST /api/attendance. Merges attendance with timetable (mergeAttendanceWithTimetable) and fans out per-course detail fetches (concurrency 3). attRes.attendance[]."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/attendance`

> **In one line:** Merges attendance with timetable (mergeAttendanceWithTimetable) and fans out per-course detail fetches (concurrency 3). attRes.attendance[].viewLink becomes an array of per-date status.

## Auth

**VTOP session (body).** Cookies + `csrf` + `authorizedID` in the JSON body. Get them from `POST /api/login` - see the [VTOP login page](../../01-authentication/vtop-login.md). Sessions last ~10 minutes; re-login when you see `vtop_session_expired` or `invalid session`.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/attendance`

| Field | Required | Type notes |
|---|---|---|
| `semesterId` | required | see code |

## Response

```json
{
  "attRes": "...",
  "marksRes": "..."
}
```

> Full shape: `{attRes:{semester,attendance},marksRes:{courses,cgpa}} (raw, NOT {success}) / {error}`

## Try it live

<EndpointTry path="/api/attendance" method="post" auth="vtop" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/attendance" \
  -H "Content-Type: application/json" \
  -d '{
           "semesterId": "CH20262705"
         }'
```
