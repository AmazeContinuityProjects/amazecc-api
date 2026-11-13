---
title: "Global"
description: "Auth & System - GET /api/settings/global. Public global config (maintenance banner etc.) for the app to poll."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET /api/settings/global`

> **In one line:** Public global config (maintenance banner etc.) for the app to poll.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** GET  
**Path:** `/api/settings/global`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "config": "..."
}
```

> Full shape: `{success,config}`

## Try it live

<EndpointTry path="/api/settings/global" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/settings/global" \
  -H "Content-Type: application/json"
```
