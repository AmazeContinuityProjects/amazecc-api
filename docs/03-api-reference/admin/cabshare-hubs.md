---
title: "Hubs"
description: "Admin - POST/DELETE /api/admin/cabshare/hubs. CabShare hub management. DELETE ?hub_id"
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST, DELETE /api/admin/cabshare/hubs`

> **In one line:** CabShare hub management. DELETE ?hub_id

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** POST, DELETE  
**Path:** `/api/admin/cabshare/hubs`

| Field | Required | Type notes |
|---|---|---|
| `hub_name` | required | see code |
| `…` | required | see code |

## Response

```json
{
  "success": true,
  "hub": "..."
}
```

> Full shape: `{success,hub|message} / {success:false,error}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/admin.md)

## Try it live

<EndpointTry path="/api/admin/cabshare/hubs" method="post" auth="gorobo-admin" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/admin/cabshare/hubs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "hub_name": "...",
           "…": "..."
         }'
```
