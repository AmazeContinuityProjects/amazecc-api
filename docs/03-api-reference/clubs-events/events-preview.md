---
title: "Preview"
description: "Clubs & Events - POST /api/events/preview. Event detail page metadata scrape (og:image etc.) for the app's card preview."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/events/preview`

> **In one line:** Event detail page metadata scrape (og:image etc.) for the app's card preview.

## Auth

**EventHub (body).** `{ username, password }` or a cached `{ jsessionid }` in the body. jsessionid cached by the client; re-login handled automatically (`looksLikeLoginPage`).


## Request

**Method:** POST  
**Path:** `/api/events/preview`

| Field | Required | Type notes |
|---|---|---|
| `username` | required | see code |
| `password` | required | see code |
| `jsessionid` | required | see code |
| `eid` | required | see code |

## Response

```json
{
  "imageSrc": "...",
  "description": "...",
  "metaDetails": "...",
  "eid": "..."
}
```

> Full shape: `{imageSrc,description,metaDetails,eid} / {error,reason}`

## Try it live

<EndpointTry path="/api/events/preview" method="post" auth="eventhub" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/events/preview" \
  -H "Content-Type: application/json" \
  -d '{
           "username": "21BCE0000",
           "password": "<your password>",
           "jsessionid": [],
           "eid": []
         }'
```
