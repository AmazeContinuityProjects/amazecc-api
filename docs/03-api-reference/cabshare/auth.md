{/* generated: aapi1 */}
---
title: "Auth"
description: "CabShare - POST /api/cabshare/auth. CabShare login: verifies against VTOP with an offline-solved captcha, upserts cabshare_users, issues a cabshare token (30d)."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/cabshare/auth`

> **In one line:** CabShare login: verifies against VTOP with an offline-solved captcha, upserts cabshare_users, issues a cabshare token (30d).

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** POST  
**Path:** `/api/cabshare/auth`

| Field | Required | Type notes |
|---|---|---|
| `username` | required | see code |
| `password` | required | see code |
| `phone_number` | required | see code |

## Response

```json
{
  "success": true,
  "user": "...",
  "token": "..."
}
```

> Full shape: `{success,user,token} / {success:false,error|message}`

**Rate limit:** 5/min/IP

## Try it live

<EndpointTry path="/api/cabshare/auth" method="post" auth="none" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/cabshare/auth" \
  -H "Content-Type: application/json" \
  -d '{
           "username": "21BCE0000",
           "password": "<your password>",
           "phone_number": "9xxxxxxxxx"
         }'
```
