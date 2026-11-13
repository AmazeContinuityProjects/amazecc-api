{/* generated: aapi1 */}
---
title: "Download"
description: "Clubs & Events - POST /api/events/download. EventHub asset/ticket download proxy (binary)."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/events/download`

> **In one line:** EventHub asset/ticket download proxy (binary).

## Auth

**EventHub (body).** `{ username, password }` or a cached `{ jsessionid }` in the body. jsessionid cached by the client; re-login handled automatically (`looksLikeLoginPage`).


## Request

**Method:** POST  
**Path:** `/api/events/download`

| Field | Required | Type notes |
|---|---|---|
| `username` | required | see code |
| `password` | required | see code |
| `jsessionid` | required | see code |
| `url` | required | see code |

## Response

```json
{
  "error": "...",
  "reason": "..."
}
```

> Full shape: `binary stream / {error,reason}`

## Try it live

<EndpointTry path="/api/events/download" method="post" auth="eventhub" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/events/download" \
  -H "Content-Type: application/json" \
  -d '{
           "username": "21BCE0000",
           "password": "<your password>",
           "jsessionid": [],
           "url": "..."
         }'
```
