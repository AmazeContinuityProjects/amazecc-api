---
title: "Import To Storage"
description: "QBank - POST /api/qbank/admin/import-to-storage. Resolves Google Drive links → uploads PDF buffer to B2 → rewrites file_url to the anonymous download route."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/qbank/admin/import-to-storage`

> **In one line:** Resolves Google Drive links → uploads PDF buffer to B2 → rewrites file_url to the anonymous download route.

## Auth

**Admin bearer token.** `Authorization: Bearer <admin token>` - issued by `POST /api/admin/auth` against a superadmin list or the `admin_users` table. Every request re-checks the DB row (deactivation revokes immediately).


## Request

**Method:** POST  
**Path:** `/api/qbank/admin/import-to-storage`

| Field | Required | Type notes |
|---|---|---|
| `paperId` | required | see code |

## Response

```json
{
  "success": true,
  "fileUrl": "...",
  "fileSize": "..."
}
```

> Full shape: `{success,fileUrl,fileSize}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/qbank.md)

## Try it live

<EndpointTry path="/api/qbank/admin/import-to-storage" method="post" auth="admin" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/qbank/admin/import-to-storage" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "paperId": "<paper id>"
         }'
```
