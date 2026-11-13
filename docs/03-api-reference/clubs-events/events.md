<!-- generated: aapi1 -->
---
title: "Events"
description: "Clubs & Events - GET /api/events. Public Eventhub scrape. Sets NODE_TLS_REJECT_UNAUTHORIZED=0 (upstream serves a broken chain)."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `GET /api/events`

> **In one line:** Public Eventhub scrape. Sets NODE_TLS_REJECT_UNAUTHORIZED=0 (upstream serves a broken chain).

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** GET  
**Path:** `/api/events`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true
}
```

> Full shape: `raw array of events (not enveloped)`

## Try it live

<EndpointTry path="/api/events" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/events" \
  -H "Content-Type: application/json"
```
