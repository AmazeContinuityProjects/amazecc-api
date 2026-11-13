---
title: "Bundles"
description: "Admin - GET/POST /api/admin/gorobo/bundles. Bundle (kit) management."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET, POST /api/admin/gorobo/bundles`

> **In one line:** Bundle (kit) management.

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** GET, POST  
**Path:** `/api/admin/gorobo/bundles`

| Field | Required | Type notes |
|---|---|---|
| `name` | required | see code |
| `…` | required | see code |

## Response

```json
{
  "success": true,
  "count": 1,
  "bundles": "..."
}
```

> Full shape: `{success,count,bundles|bundle}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/admin.md)

## Try it live

<EndpointTry path="/api/admin/gorobo/bundles" method="get" auth="gorobo-admin" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/admin/gorobo/bundles" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "name": "...",
           "…": "..."
         }'
```
