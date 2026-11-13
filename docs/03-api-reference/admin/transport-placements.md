<!-- generated: aapi1 -->
---
title: "Placements"
description: "Admin - GET/POST /api/admin/transport/placements. Bus placement assignments (hostel → stop)."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `GET, POST /api/admin/transport/placements`

> **In one line:** Bus placement assignments (hostel → stop).

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** GET, POST  
**Path:** `/api/admin/transport/placements`

| Field | Required | Type notes |
|---|---|---|
| `` *(array)* `of placements` | required | see code |

## Response

```json
{
  "success": true,
  "placements": "..."
}
```

> Full shape: `{success,placements|message}`

## Try it live

<EndpointTry path="/api/admin/transport/placements" method="get" auth="gorobo-admin" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/admin/transport/placements" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "placements": "..."
         }'
```
