{/* generated: aapi1 */}
---
title: "Storage"
description: "Admin - GET/POST /api/admin/storage. Storage/files dashboard; POST runs classification of papers (remote-URL / B2 / DIRECT_JSON)."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `GET, POST /api/admin/storage`

> **In one line:** Storage/files dashboard; POST runs classification of papers (remote-URL / B2 / DIRECT_JSON).

## Auth

**Admin bearer token.** `Authorization: Bearer <admin token>` - issued by `POST /api/admin/auth` against a superadmin list or the `admin_users` table. Every request re-checks the DB row (deactivation revokes immediately).


## Request

**Method:** GET, POST  
**Path:** `/api/admin/storage`

| Field | Required | Type notes |
|---|---|---|
| `action` | optional | see code |

## Response

```json
{
  "success": true,
  "data": "..."
}
```

> Full shape: `{success,data|missing|missingCount|message}`

## Try it live

<EndpointTry path="/api/admin/storage" method="get" auth="admin" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/admin/storage" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "action": "..."
         }'
```
