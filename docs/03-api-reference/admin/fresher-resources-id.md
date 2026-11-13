---
title: "Fresher Resources [id]"
description: "Admin - PATCH/DELETE /api/admin/fresher-resources/[id]. Update or remove a single fresher resource."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `PATCH, DELETE /api/admin/fresher-resources/[id]`

> **In one line:** Update or remove a single fresher resource.

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** PATCH, DELETE  
**Path:** `/api/admin/fresher-resources/[id]`

> Path parameter: the bracketed segment is part of the route (e.g. `[id]`).

| Field | Required | Type notes |
|---|---|---|
| `<partial fields object>` | required | see code |

## Response

```json
{
  "success": true,
  "resource": "..."
}
```

> Full shape: `{success,resource} / {success:true}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/admin.md)

## Try it live

<EndpointTry path="/api/admin/fresher-resources/[id]" method="patch" auth="gorobo-admin" />

## curl

```bash
curl -X PATCH "https://api.amazecc.com/api/admin/fresher-resources/[id]" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "<partial fields object>": "..."
         }'
```
