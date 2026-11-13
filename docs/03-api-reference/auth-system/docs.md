---
title: "Docs"
description: "Auth & System - GET /api/docs. swagger-jsdoc aggregate of the @openapi JSDoc blocks in route files. Mostly placeholders — use this handbook instead."
---

{/* generated: aapi2 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `GET /api/docs`

> **In one line:** swagger-jsdoc aggregate of the @openapi JSDoc blocks in route files. Mostly placeholders — use this handbook instead.

## Auth

**None.** Public - no credentials required. Still rate-limited where noted.


## Request

**Method:** GET  
**Path:** `/api/docs`

| Field | Required | Type notes |
|---|---|---|
| _none_ | - | - |

## Response

```json
{
  "success": true
}
```

> Full shape: `raw OpenAPI spec object`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/auth-system.md)

## Try it live

<EndpointTry path="/api/docs" method="get" auth="none" />

## curl

```bash
curl -X GET "https://api.amazecc.com/api/docs" \
  -H "Content-Type: application/json"
```
