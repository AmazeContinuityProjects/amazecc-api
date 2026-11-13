<!-- generated: aapi1 -->
---
title: "Global"
description: "Admin - PUT /api/admin/settings/global. Set global config keys (writes app_config)."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `PUT /api/admin/settings/global`

> **In one line:** Set global config keys (writes app_config).

## Auth

**Admin bearer token.** `Authorization: Bearer <admin token>` - issued by `POST /api/admin/auth` against a superadmin list or the `admin_users` table. Every request re-checks the DB row (deactivation revokes immediately).


## Request

**Method:** PUT  
**Path:** `/api/admin/settings/global`

| Field | Required | Type notes |
|---|---|---|
| `key` | required | see code |
| `value` | required | see code |

## Response

```json
{
  "success": true
}
```

> Full shape: `{success} / {success:false,error}`

## Try it live

<EndpointTry path="/api/admin/settings/global" method="put" auth="admin" />

## curl

```bash
curl -X PUT "https://api.amazecc.com/api/admin/settings/global" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "key": "...",
           "value": "..."
         }'
```
