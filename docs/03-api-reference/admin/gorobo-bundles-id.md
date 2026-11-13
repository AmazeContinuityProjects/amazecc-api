---
title: "Bundles [id]"
description: "Admin - PUT/DELETE /api/admin/gorobo/bundles/[id]. Edit/remove a bundle."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `PUT, DELETE /api/admin/gorobo/bundles/[id]`

> **In one line:** Edit/remove a bundle.

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** PUT, DELETE  
**Path:** `/api/admin/gorobo/bundles/[id]`

> Path parameter: the bracketed segment is part of the route (e.g. `[id]`).

| Field | Required | Type notes |
|---|---|---|
| `<bundle fields>` | required | see code |

## Response

```json
{
  "success": true,
  "bundle": "..."
}
```

> Full shape: `{success,bundle|message}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/admin.md)

## Try it live

<EndpointTry path="/api/admin/gorobo/bundles/[id]" method="put" auth="gorobo-admin" />

## curl

```bash
curl -X PUT "https://api.amazecc.com/api/admin/gorobo/bundles/[id]" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "<bundle fields>": "..."
         }'
```
