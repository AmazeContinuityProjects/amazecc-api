<!-- generated: aapi1 -->
---
title: "Routes"
description: "Admin - GET/POST /api/admin/transport/routes. Transport route CRUD. transport permission."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `GET, POST /api/admin/transport/routes`

> **In one line:** Transport route CRUD. transport permission.

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** GET, POST  
**Path:** `/api/admin/transport/routes`

| Field | Required | Type notes |
|---|---|---|
| `` *(array)* `of BusRouteInput` | required | see code |

## Response

```json
{
  "success": true,
  "routes": "..."
}
```

> Full shape: `{success,routes|message}`

## Try it live

<EndpointTry path="/api/admin/transport/routes" method="get" auth="gorobo-admin" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/admin/transport/routes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "BusRouteInput": "..."
         }'
```
