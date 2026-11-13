---
title: "Publish"
description: "QBank - POST /api/qbank/admin/publish. Publishes a paper (approval_status=APPROVED)."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/qbank/admin/publish`

> **In one line:** Publishes a paper (approval_status=APPROVED).

## Auth

**Admin bearer token.** `Authorization: Bearer <admin token>` - issued by `POST /api/admin/auth` against a superadmin list or the `admin_users` table. Every request re-checks the DB row (deactivation revokes immediately).


## Request

**Method:** POST  
**Path:** `/api/qbank/admin/publish`

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

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/qbank.md)

## Try it live

<EndpointTry path="/api/qbank/admin/publish" method="post" auth="admin" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/qbank/admin/publish" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "paperId": "<paper id>"
         }'
```
