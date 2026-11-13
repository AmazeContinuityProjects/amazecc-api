{/* generated: aapi1 */}
---
title: "Paynow"
description: "Clubs & Events - POST /api/events/paynow. Paytm-style payment form passthrough — the frontend renders the HTML in a hidden iframe/frame."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/events/paynow`

> **In one line:** Paytm-style payment form passthrough — the frontend renders the HTML in a hidden iframe/frame.

## Auth

**EventHub (body).** `{ username, password }` or a cached `{ jsessionid }` in the body. jsessionid cached by the client; re-login handled automatically (`looksLikeLoginPage`).


## Request

**Method:** POST  
**Path:** `/api/events/paynow`

| Field | Required | Type notes |
|---|---|---|
| `username` | required | see code |
| `password` | required | see code |
| `url` | required | see code |

## Response

```json
{
  "status": "...",
  "html": "...",
  "tcUrl": "..."
}
```

> Full shape: `{status:'payment_form',html,tcUrl} / {error}`

## Try it live

<EndpointTry path="/api/events/paynow" method="post" auth="eventhub" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/events/paynow" \
  -H "Content-Type: application/json" \
  -d '{
           "username": "21BCE0000",
           "password": "<your password>",
           "url": "..."
         }'
```
