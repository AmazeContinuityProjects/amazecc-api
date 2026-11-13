---
title: "Buses"
description: "Transport & Buses - GET /api/buses. Public bus routes + rules + placements from OUR database (with defaultBuses JSON fallback if unreachable)."
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET /api/buses`

> **In one line:** Public bus routes + rules + placements from OUR database (with defaultBuses JSON fallback if unreachable).

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** GET  
**Path:** `/api/buses`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true,
  "buses": "...",
  "rules": "..."
}
```

> Full shape: `{success,buses,rules}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/transport-buses.md)

## Try it live

<EndpointTry path="/api/buses" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/buses" \
  -H "Content-Type: application/json"
```
