---
title: "Events"
description: "Clubs & Events - GET /api/events. Public Eventhub scrape. Sets NODE_TLS_REJECT_UNAUTHORIZED=0 (upstream serves a broken chain)."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


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

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/clubs-events.md)

## Try it live

<EndpointTry path="/api/events" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/events" \
  -H "Content-Type: application/json"
```
