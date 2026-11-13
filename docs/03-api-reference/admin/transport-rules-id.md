{/* generated: aapi1 */}
---
title: "Rules [id]"
description: "Admin - DELETE /api/admin/transport/rules/[id]. Delete one rule."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `DELETE /api/admin/transport/rules/[id]`

> **In one line:** Delete one rule.

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** DELETE  
**Path:** `/api/admin/transport/rules/[id]`

> Path parameter: the bracketed segment is part of the route (e.g. `[id]`).

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "message": "..."
}
```

> Full shape: `{success,message}`

## Try it live

<EndpointTry path="/api/admin/transport/rules/[id]" method="delete" auth="gorobo-admin" />

## curl

```bash
curl -X DELETE "https://api.amazecc.com/api/admin/transport/rules/[id]" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>"
```
