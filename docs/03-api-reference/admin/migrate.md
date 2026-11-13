{/* generated: aapi1 */}
---
title: "Migrate"
description: "Admin - POST/GET /api/admin/migrate. Runs inline DDL migrations for every table in the codebase. GET is a connectivity check."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST, GET /api/admin/migrate`

> **In one line:** Runs inline DDL migrations for every table in the codebase. GET is a connectivity check.

## Auth

**Admin bearer token.** `Authorization: Bearer <admin token>` - issued by `POST /api/admin/auth` against a superadmin list or the `admin_users` table. Every request re-checks the DB row (deactivation revokes immediately).


## Request

**Method:** POST, GET  
**Path:** `/api/admin/migrate`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "message": "...",
  "tables": "..."
}
```

> Full shape: `{success,message,tables} / {connected,db,tables,serverTime} (GET health-check)`

**Rate limit:** 3/5min

## Try it live

<EndpointTry path="/api/admin/migrate" method="post" auth="admin" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/admin/migrate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>"
```
