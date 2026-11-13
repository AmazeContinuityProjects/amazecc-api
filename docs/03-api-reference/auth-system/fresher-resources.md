{/* generated: aapi1 */}
---
title: "Fresher Resources"
description: "Auth & System - GET /api/fresher-resources. Public list of fresher orientation resources from our DB."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `GET /api/fresher-resources`

> **In one line:** Public list of fresher orientation resources from our DB.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** GET  
**Path:** `/api/fresher-resources`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "resources": "..."
}
```

> Full shape: `{success,resources}`

## Try it live

<EndpointTry path="/api/fresher-resources" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/fresher-resources" \
  -H "Content-Type: application/json"
```
