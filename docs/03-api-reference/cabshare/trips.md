---
title: "Trips"
description: "CabShare - POST/GET /api/cabshare/trips. Trip planning board for hostel cab-shares. POST creates; GET lists for a date/hub."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST, GET /api/cabshare/trips`

> **In one line:** Trip planning board for hostel cab-shares. POST creates; GET lists for a date/hub.

## Auth

**CabShare token.** `Authorization: Bearer <cabshare token>` - from `POST /api/cabshare/auth` (30-day TTL, needs `cabshare_users` row).


## Request

**Method:** POST, GET  
**Path:** `/api/cabshare/trips`

| Field | Required | Type notes |
|---|---|---|
| `hub_id` | required | see code |
| `travel_date` | required | see code |
| `preferred_time` | required | see code |
| `tolerance_hours` | optional | see code |
| `seat_options` | optional | see code |
| `gender_preference` | optional | see code |
| `notes` | optional | see code |

## Response

```json
{
  "success": true,
  "trips": "..."
}
```

> Full shape: `{success,trips|trip_id} + ?date&hub_id (GET)`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/cabshare.md)

## Try it live

<EndpointTry path="/api/cabshare/trips" method="post" auth="cabshare" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/cabshare/trips" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "hub_id": "...",
           "travel_date": "...",
           "preferred_time": "...",
           "tolerance_hours": "...",
           "seat_options": "...",
           "gender_preference": "...",
           "notes": "..."
         }'
```
