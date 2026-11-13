{/* generated: aapi1 */}
---
title: "Login"
description: "Auth & System - POST /api/login. Solves the captcha server-side, POSTs to VTOP, parses authorizedID + _csrf off the dashboard. Issues a club token when the authorizedID has "
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/login`

> **In one line:** Solves the captcha server-side, POSTs to VTOP, parses authorizedID + _csrf off the dashboard. Issues a club token when the authorizedID has club representation.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** POST  
**Path:** `/api/login`

| Field | Required | Type notes |
|---|---|---|
| `username` | required | see code |
| `password` | required | see code |

## Response

```json
{
  "success": true,
  "message": "...",
  "cookies": "...",
  "csrf": "...",
  "authorizedID": "...",
  "clubToken": "...",
  "clubRoles": "..."
}
```

> Full shape: `{success,message,cookies,csrf,authorizedID,clubToken?,clubRoles?} / {success:false,message|error}`

**Rate limit:** 5/min/IP

## Try it live

<EndpointTry path="/api/login" method="post" auth="none" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/login" \
  -H "Content-Type: application/json" \
  -d '{
           "username": "21BCE0000",
           "password": "<your password>"
         }'
```
