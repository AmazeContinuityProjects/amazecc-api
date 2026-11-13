---
title: "Login"
description: "Clubs & Events - POST /api/events/login. Eventhub login. jsessionid must be cached by the client; EventHub sessions live long."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/events/login`

> **In one line:** Eventhub login. jsessionid must be cached by the client; EventHub sessions live long.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** POST  
**Path:** `/api/events/login`

| Field | Required | Type notes |
|---|---|---|
| `username` | required | see code |
| `password` | required | see code |

## Response

```json
{
  "success": true,
  "jsessionid": "..."
}
```

> Full shape: `{success,jsessionid} / {success:false,error}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/clubs-events.md)

## Try it live

<EndpointTry path="/api/events/login" method="post" auth="none" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/events/login" \
  -H "Content-Type: application/json" \
  -d '{
           "username": "21BCE0000",
           "password": "<your password>"
         }'
```
