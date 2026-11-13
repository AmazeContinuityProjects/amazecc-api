<!-- generated: aapi1 -->
---
title: "Rules"
description: "Admin - GET/POST /api/admin/transport/rules. Transport rules CRUD."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `GET, POST /api/admin/transport/rules`

> **In one line:** Transport rules CRUD.

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** GET, POST  
**Path:** `/api/admin/transport/rules`

| Field | Required | Type notes |
|---|---|---|
| `` *(array)* `of TransportRuleInput` | required | see code |

## Response

```json
{
  "success": true,
  "rules": "..."
}
```

> Full shape: `{success,rules|message}`

## Try it live

<EndpointTry path="/api/admin/transport/rules" method="get" auth="gorobo-admin" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/admin/transport/rules" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "TransportRuleInput": "..."
         }'
```
