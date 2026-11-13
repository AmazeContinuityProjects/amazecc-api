{/* generated: aapi1 */}
---
title: "Reject"
description: "QBank - POST /api/qbank/admin/reject. Rejects a paper (back to PENDING / set REJECTED)."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/qbank/admin/reject`

> **In one line:** Rejects a paper (back to PENDING / set REJECTED).

## Auth

**Admin bearer token.** `Authorization: Bearer <admin token>` - issued by `POST /api/admin/auth` against a superadmin list or the `admin_users` table. Every request re-checks the DB row (deactivation revokes immediately).


## Request

**Method:** POST  
**Path:** `/api/qbank/admin/reject`

| Field | Required | Type notes |
|---|---|---|
| `paperId` | required | see code |

## Response

```json
{
  "success": true
}
```

> Full shape: `{success}`

## Try it live

<EndpointTry path="/api/qbank/admin/reject" method="post" auth="admin" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/qbank/admin/reject" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "paperId": "<paper id>"
         }'
```
