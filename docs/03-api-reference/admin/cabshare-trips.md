---
title: "Trips"
description: "Admin - GET/DELETE /api/admin/cabshare/trips. CabShare trips moderation. DELETE ?trip_id"
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET, DELETE /api/admin/cabshare/trips`

> **In one line:** CabShare trips moderation. DELETE ?trip_id

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** GET, DELETE  
**Path:** `/api/admin/cabshare/trips`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "trips": "..."
}
```

> Full shape: `{success,trips} / {success,message}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/admin.md)

## Try it live

<EndpointTry path="/api/admin/cabshare/trips" method="get" auth="gorobo-admin" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/admin/cabshare/trips" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>"
```
