{/* generated: aapi1 */}
---
title: "Reminders"
description: "Auth & System - GET/POST /api/cron/reminders. VIT student Vitol reminder push fan-out. Authorization: Bearer $CRON_SECRET (timingSafeEqual)."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `GET, POST /api/cron/reminders`

> **In one line:** VIT student Vitol reminder push fan-out. Authorization: Bearer $CRON_SECRET (timingSafeEqual).

## Auth

**CRON_SECRET bearer.** `Authorization: Bearer <CRON_SECRET>` compared with `timingSafeEqual`. Server-side only - never call from a browser.


## Request

**Method:** GET, POST  
**Path:** `/api/cron/reminders`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "message": "..."
}
```

> Full shape: `{success,message} / {error}`

## Try it live

<EndpointTry path="/api/cron/reminders" method="get" auth="cron" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/cron/reminders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer CRON_SECRET>"
```
