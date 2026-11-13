{/* generated: aapi1 */}
---
title: "Course Page"
description: "Academics & VTOP - POST /api/course-page. Course view page scrape: parseCoursePage/parseCourseClasses/parseCoursePageMaterials. Heavy parser, ~300 lines of cheerio selectors."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/course-page`

> **In one line:** Course view page scrape: parseCoursePage/parseCourseClasses/parseCoursePageMaterials. Heavy parser, ~300 lines of cheerio selectors.

## Auth

**VTOP session (body).** Cookies + `csrf` + `authorizedID` in the JSON body. Get them from `POST /api/login` - see the [VTOP login page](../../01-authentication/vtop-login.md). Sessions last ~10 minutes; re-login when you see `vtop_session_expired` or `invalid session`.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/course-page`

| Field | Required | Type notes |
|---|---|---|
| `formData` | required | see code |

## Response

```json
{
  "success": true,
  "results": "..."
}
```

> Full shape: `{success,results} / {error}`

## Try it live

<EndpointTry path="/api/course-page" method="post" auth="vtop" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/course-page" \
  -H "Content-Type: application/json" \
  -d '{
           "formData": "..."
         }'
```
