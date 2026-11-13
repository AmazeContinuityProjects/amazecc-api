---
title: "Register"
description: "Clubs & Events - POST /api/events/register. EventHub registration proxy. May return HTML auto-form for payment steps."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/events/register`

> **In one line:** EventHub registration proxy. May return HTML auto-form for payment steps.

## Auth

**EventHub (body).** `{ username, password }` or a cached `{ jsessionid }` in the body. jsessionid cached by the client; re-login handled automatically (`looksLikeLoginPage`).


## Request

**Method:** POST  
**Path:** `/api/events/register`

| Field | Required | Type notes |
|---|---|---|
| `username` | required | see code |
| `password` | required | see code |
| `jsessionid` | required | see code |
| `eid` | required | see code |

## Response

```json
{
  "status": "...",
  "url": "...",
  "message": "..."
}
```

> Full shape: `{status,url|html|reauthenticate,message} / {error,reason}`

## Try it live

<EndpointTry path="/api/events/register" method="post" auth="eventhub" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/events/register" \
  -H "Content-Type: application/json" \
  -d '{
           "username": "21BCE0000",
           "password": "<your password>",
           "jsessionid": [],
           "eid": []
         }'
```
