---
title: "Wallet"
description: "Admin - GET /api/admin/gorobo/wallet. Wallet dashboard: balances and transaction ledger."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET /api/admin/gorobo/wallet`

> **In one line:** Wallet dashboard: balances and transaction ledger.

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** GET  
**Path:** `/api/admin/gorobo/wallet`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "summary": "...",
  "transactions": "..."
}
```

> Full shape: `{success,summary,transactions}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/admin.md)

## Try it live

<EndpointTry path="/api/admin/gorobo/wallet" method="get" auth="gorobo-admin" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/admin/gorobo/wallet" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>"
```
