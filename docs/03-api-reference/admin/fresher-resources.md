---
title: "Fresher Resources"
description: "Admin - GET/POST /api/admin/fresher-resources. Fresher orientation resources CRUD. fresher-resources permission."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET, POST /api/admin/fresher-resources`

> **In one line:** Fresher orientation resources CRUD. fresher-resources permission.

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** GET, POST  
**Path:** `/api/admin/fresher-resources`

| Field | Required | Type notes |
|---|---|---|
| `title` | required | see code |
| `description` | optional | see code |
| `url` | required | see code |
| `icon` | optional | see code |
| `sort_order` | optional | see code |
| `is_active` | optional | see code |
| `type` | optional | see code |
| `content` | optional | see code |

## Response

```json
{
  "success": true,
  "resources": "..."
}
```

> Full shape: `{success,resources|resource}`

## Try it live

<EndpointTry path="/api/admin/fresher-resources" method="get" auth="gorobo-admin" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/admin/fresher-resources" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "title": "...",
           "description": "...",
           "url": "...",
           "icon": "...",
           "sort_order": "...",
           "is_active": "...",
           "type": "...",
           "content": "..."
         }'
```
