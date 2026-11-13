<!-- generated: aapi1 -->
---
title: "Seed"
description: "Admin - POST /api/admin/transport/seed. Seed transport data from seed.json (used for initial import)."
---

import { EndpointTry } from "/snippets/endpoint-try.js";


# `POST /api/admin/transport/seed`

> **In one line:** Seed transport data from seed.json (used for initial import).

## Auth

**Admin bearer + permission.** `Authorization: Bearer <admin token>` with a per-route permission check (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`). Superadmins bypass.


## Request

**Method:** POST  
**Path:** `/api/admin/transport/seed`

| Field | Required | Type notes |
|---|---|---|
| `routes` | optional | see code |
| `placements` | optional | see code |
| `rules` | optional | see code |

## Response

```json
{
  "success": true,
  "stats": "..."
}
```

> Full shape: `{success,stats} / {success,message}`

## Try it live

<EndpointTry path="/api/admin/transport/seed" method="post" auth="gorobo-admin" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/admin/transport/seed" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
           "routes": "...",
           "placements": "...",
           "rules": "..."
         }'
```
