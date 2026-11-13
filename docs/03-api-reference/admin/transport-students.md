---
title: "Students"
description: "Admin - POST/DELETE /api/admin/transport/students. Map students to routes. DELETE ?routeId."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST, DELETE /api/admin/transport/students`

> **In one line:** Map students to routes. DELETE ?routeId.

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** POST, DELETE  
**Path:** `/api/admin/transport/students`

| Field | Required | Type notes |
|---|---|---|
| `` *(array)* `of students` | required | see code |

## Response

```json
{
  "success": true,
  "message": "..."
}
```

> Full shape: `{success,message}`

## Try it live

<EndpointTry path="/api/admin/transport/students" method="post" auth="gorobo-admin" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/admin/transport/students" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "students": "..."
         }'
```
