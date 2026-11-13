---
title: "Profile"
description: "Clubs & Events - POST /api/events/profile. Eventhub profile — auto re-auths when the cached session looks like a login page."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/events/profile`

> **In one line:** Eventhub profile — auto re-auths when the cached session looks like a login page.

## Auth

**EventHub (body).** `{ username, password }` or a cached `{ jsessionid }` in the body. jsessionid cached by the client; re-login handled automatically (`looksLikeLoginPage`).


## Request

**Method:** POST  
**Path:** `/api/events/profile`

| Field | Required | Type notes |
|---|---|---|
| `username` | required | see code |
| `password` | required | see code |
| `jsessionid` | required | see code |

## Response

```json
{
  "events": "..."
}
```

> Full shape: `raw {events,…} / {error,reason}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/clubs-events.md)

## Try it live

<EndpointTry path="/api/events/profile" method="post" auth="eventhub" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/events/profile" \
  -H "Content-Type: application/json" \
  -d '{
           "username": "21BCE0000",
           "password": "<your password>",
           "jsessionid": []
         }'
```
