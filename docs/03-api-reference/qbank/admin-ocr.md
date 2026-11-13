{/* generated: aapi1 */}
---
title: "OCR"
description: "QBank - POST /api/qbank/admin/ocr. Sets approval_status=OCR_QUEUED for the external local OCR worker."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/qbank/admin/ocr`

> **In one line:** Sets approval_status=OCR_QUEUED for the external local OCR worker.

## Auth

**Admin bearer token.** `Authorization: Bearer <admin token>` - issued by `POST /api/admin/auth` against a superadmin list or the `admin_users` table. Every request re-checks the DB row (deactivation revokes immediately).


## Request

**Method:** POST  
**Path:** `/api/qbank/admin/ocr`

| Field | Required | Type notes |
|---|---|---|
| `paperId` | required | see code |

## Response

```json
{
  "success": true,
  "count": 1
}
```

> Full shape: `{success,count}`

## Try it live

<EndpointTry path="/api/qbank/admin/ocr" method="post" auth="admin" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/qbank/admin/ocr" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "paperId": "<paper id>"
         }'
```
