---
title: "Upload"
description: "QBank - POST /api/qbank/upload. Public upload endpoint — every upload lands PENDING for admin moderation. Flagged in docs: public-write, rate-limit only by platform."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/qbank/upload`

> **In one line:** Public upload endpoint — every upload lands PENDING for admin moderation. Flagged in docs: public-write, rate-limit only by platform.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** POST  
**Path:** `/api/qbank/upload`

| Field | Required | Type notes |
|---|---|---|
| `courseCode` | required | see code |
| `title` | required | see code |
| `paperType` | required | see code |
| `examYear` | required | see code |
| `examSemester` | required | see code |
| `uploaderRegNo` | required | see code |
| `fileUrl` | required | see code |

## Response

```json
{
  "success": true,
  "sourceId": "..."
}
```

> Full shape: `{success,sourceId}`

## Try it live

<EndpointTry path="/api/qbank/upload" method="post" auth="none" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/qbank/upload" \
  -H "Content-Type: application/json" \
  -d '{
           "courseCode": "...",
           "title": "...",
           "paperType": "...",
           "examYear": "...",
           "examSemester": "...",
           "uploaderRegNo": "...",
           "fileUrl": "..."
         }'
```
