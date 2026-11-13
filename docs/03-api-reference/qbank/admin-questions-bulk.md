<!-- generated: aapi1 -->
---
title: "Bulk"
description: "QBank - POST /api/qbank/admin/questions/bulk. Bulk-insert questions from an OCR pass."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/qbank/admin/questions/bulk`

> **In one line:** Bulk-insert questions from an OCR pass.

## Auth

**Admin bearer token.** `Authorization: Bearer <admin token>` - issued by `POST /api/admin/auth` against a superadmin list or the `admin_users` table. Every request re-checks the DB row (deactivation revokes immediately).


## Request

**Method:** POST  
**Path:** `/api/qbank/admin/questions/bulk`

| Field | Required | Type notes |
|---|---|---|
| `paperId` | required | see code |
| `questions` | required | see code |

## Response

```json
{
  "success": true,
  "count": 1
}
```

> Full shape: `{success,count}`

## Try it live

<EndpointTry path="/api/qbank/admin/questions/bulk" method="post" auth="admin" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/qbank/admin/questions/bulk" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "paperId": "<paper id>",
           "questions": "..."
         }'
```
