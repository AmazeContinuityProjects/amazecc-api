<!-- generated: aapi1 -->
---
title: "Questions"
description: "QBank - GET/POST/PATCH/DELETE /api/qbank/admin/questions. Question CRUD. qbank admin routes all use requireAdminAuth + _success,data_."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `GET, POST, PATCH, DELETE /api/qbank/admin/questions`

> **In one line:** Question CRUD. qbank admin routes all use requireAdminAuth + &#123;success,data&#125;.

## Auth

**Admin bearer token.** `Authorization: Bearer <admin token>` - issued by `POST /api/admin/auth` against a superadmin list or the `admin_users` table. Every request re-checks the DB row (deactivation revokes immediately).


## Request

**Method:** GET, POST, PATCH, DELETE  
**Path:** `/api/qbank/admin/questions`

| Field | Required | Type notes |
|---|---|---|
| `questionId` | optional | see code |
| `questionText` | required | see code |
| `options` | required | see code |
| `correctAnswer` | required | see code |
| `questionType` | required | see code |
| `marks` | required | see code |
| `topicName` | required | see code |
| `imageUrl` | required | see code |
| `questionNumber` | optional | see code |

## Response

```json
{
  "success": true,
  "data": "..."
}
```

> Full shape: `{success,data}`

## Try it live

<EndpointTry path="/api/qbank/admin/questions" method="get" auth="admin" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/qbank/admin/questions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "questionId": [],
           "questionText": "...",
           "options": "...",
           "correctAnswer": "...",
           "questionType": "...",
           "marks": "...",
           "topicName": "...",
           "imageUrl": "...",
           "questionNumber": "..."
         }'
```
