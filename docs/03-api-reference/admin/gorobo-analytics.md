---
title: "Analytics"
description: "Admin - GET /api/admin/gorobo/analytics. Sales analytics rollup."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET /api/admin/gorobo/analytics`

> **In one line:** Sales analytics rollup.

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** GET  
**Path:** `/api/admin/gorobo/analytics`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "analytics": "..."
}
```

> Full shape: `{success,analytics}`

## Try it live

<EndpointTry path="/api/admin/gorobo/analytics" method="get" auth="gorobo-admin" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/admin/gorobo/analytics" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>"
```
