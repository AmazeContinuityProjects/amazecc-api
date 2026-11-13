---
title: "Details"
description: "Clubs & Events - GET/POST /api/club-admin/details. Club profile editing (branding, showcase projects, popular events)."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET, POST /api/club-admin/details`

> **In one line:** Club profile editing (branding, showcase projects, popular events).

## Auth

**Club bearer token.** `Authorization: Bearer <club token>` - issued at `POST /api/login` when the authorizedID represents club(s). `X-Club-Id` header re-selects the club context.


## Request

**Method:** GET, POST  
**Path:** `/api/club-admin/details`

| Field | Required | Type notes |
|---|---|---|
| `<details fields>` | required | see code |

## Response

```json
{
  "success": true,
  "details": "..."
}
```

> Full shape: `{success,details|message} + ?club_id`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/clubs-events.md)

## Try it live

<EndpointTry path="/api/club-admin/details" method="get" auth="club" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/club-admin/details" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "<details fields>": "..."
         }'
```
