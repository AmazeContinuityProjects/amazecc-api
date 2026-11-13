---
title: "Grades"
description: "Academics & VTOP - POST /api/grades. Unified endpoint: /api/all-grades is served through here. adaptUnifiedGradesResponse() in the app normalizes to _gradesSummary, allGrades_."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/grades`

> **In one line:** Unified endpoint: /api/all-grades is served through here. adaptUnifiedGradesResponse() in the app normalizes to &#123;gradesSummary, allGrades&#125;.

## Auth

**VTOP session (body).** Cookies + `csrf` + `authorizedID` in the JSON body. Get them from `POST /api/login` - see the [VTOP login page](../../01-authentication/vtop-login.md). Sessions last ~10 minutes; re-login when you see `vtop_session_expired` or `invalid session`.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/grades`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "semesters": "...",
  "overall": "..."
}
```

> Full shape: `{success,semesters,overall} / {error}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/academics-vtop.md)

## Try it live

<EndpointTry path="/api/grades" method="post" auth="vtop" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/grades" \
  -H "Content-Type: application/json"
```
