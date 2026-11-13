{/* generated: aapi1 */}
---
title: "OCR"
description: "Admin - POST /api/admin/ocr. Queue a paper for the external OCR worker (approval_status=OCR_QUEUED)."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/admin/ocr`

> **In one line:** Queue a paper for the external OCR worker (approval_status=OCR_QUEUED).

## Auth

**Admin bearer token.** `Authorization: Bearer <admin token>` - issued by `POST /api/admin/auth` against a superadmin list or the `admin_users` table. Every request re-checks the DB row (deactivation revokes immediately).


## Request

**Method:** POST  
**Path:** `/api/admin/ocr`

| Field | Required | Type notes |
|---|---|---|
| `paperId` | required | see code |

## Response

```json
{
  "success": true,
  "message": "..."
}
```

> Full shape: `{success,message} / {error}`

## Try it live

<EndpointTry path="/api/admin/ocr" method="post" auth="admin" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/admin/ocr" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "paperId": "<paper id>"
         }'
```
