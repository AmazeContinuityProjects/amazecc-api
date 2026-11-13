{/* generated: aapi1 */}
---
title: "Import To Storage"
description: "QBank - POST /api/qbank/admin/import-to-storage. Resolves Google Drive links → uploads PDF buffer to B2 → rewrites file_url to the anonymous download route."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


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
