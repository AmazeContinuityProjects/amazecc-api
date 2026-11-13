---
title: "Faculty Directories"
description: "Admin - GET/POST/PUT/DELETE /api/admin/faculty-directories. Manage faculty directory school URLs. Requires faculty-directories permission."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET, POST, PUT, DELETE /api/admin/faculty-directories`

> **In one line:** Manage faculty directory school URLs. Requires faculty-directories permission.

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** GET, POST, PUT, DELETE  
**Path:** `/api/admin/faculty-directories`

| Field | Required | Type notes |
|---|---|---|
| `id` | optional | see code |
| `school_name` | required | see code |
| `url` | required | see code |

## Response

```json
{
  "success": true,
  "directories": "..."
}
```

> Full shape: `{success,directories|message}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/admin.md)

## Try it live

<EndpointTry path="/api/admin/faculty-directories" method="get" auth="gorobo-admin" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/admin/faculty-directories" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "id": [],
           "school_name": "...",
           "url": "..."
         }'
```
