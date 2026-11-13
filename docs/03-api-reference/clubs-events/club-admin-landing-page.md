---
title: "Landing Page"
description: "Clubs & Events - GET/POST /api/club-admin/landing-page. Club landing-page config (theme + curated showcase rail)."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET, POST /api/club-admin/landing-page`

> **In one line:** Club landing-page config (theme + curated showcase rail).

## Auth

**Club bearer token.** `Authorization: Bearer <club token>` - issued at `POST /api/login` when the authorizedID represents club(s). `X-Club-Id` header re-selects the club context.


## Request

**Method:** GET, POST  
**Path:** `/api/club-admin/landing-page`

| Field | Required | Type notes |
|---|---|---|
| `club_id` | required | see code |
| `theme` | required | see code |
| `showcase_projects` | required | see code |
| `popular_events` | required | see code |

## Response

```json
{
  "success": true,
  "landingPage": "..."
}
```

> Full shape: `{success,landingPage|message} + ?club_id`

## Try it live

<EndpointTry path="/api/club-admin/landing-page" method="get" auth="club" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/club-admin/landing-page" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "club_id": "...",
           "theme": "...",
           "showcase_projects": "...",
           "popular_events": "..."
         }'
```
