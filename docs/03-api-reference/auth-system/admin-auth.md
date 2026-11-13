---
title: "Auth"
description: "Auth & System - POST /api/admin/auth. Admin login. Verifies creds via loopback /api/login, then issues the HMAC admin token +DB record; ADMIN_VTOP_IDS entries become superadmin."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/admin/auth`

> **In one line:** Admin login. Verifies creds via loopback /api/login, then issues the HMAC admin token +DB record; ADMIN_VTOP_IDS entries become superadmin.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** POST  
**Path:** `/api/admin/auth`

| Field | Required | Type notes |
|---|---|---|
| `username` | required | see code |
| `password` | required | see code |

## Response

```json
{
  "success": true,
  "username": "...",
  "role": "...",
  "permissions": "...",
  "token": "..."
}
```

> Full shape: `{success,username,role,permissions,token} / {success:false,message}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/auth-system.md)

**Rate limit:** 5/min/IP

## Try it live

<EndpointTry path="/api/admin/auth" method="post" auth="none" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/admin/auth" \
  -H "Content-Type: application/json" \
  -d '{
           "username": "21BCE0000",
           "password": "<your password>"
         }'
```
