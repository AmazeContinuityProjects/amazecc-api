---
title: "SYNC"
description: "Social (FFCS Partners) - POST /api/social/identity/sync. The big one — profile sync: resolves identity, semester, timetable (validate parse against config.json), grants and peer list. Backs the Soc"
---

{/* generated: aapi1 */}

import { EndpointTry } from "/snippets/endpoint-try.jsx";


# `POST /api/social/identity/sync`

> **In one line:** The big one — profile sync: resolves identity, semester, timetable (validate parse against config.json), grants and peer list. Backs the Social + FFCS planner tabs.

## Auth

**Social identity (VTOP-verified).** Body carries `cookies` + `authorizedID` + `csrf`; the server verifies them VTOP-side and derives your identity - the body never asserts identity.

Exactly what to put in the body (never the URL): `{cookies, authorizedID, csrf}`. See [Authentication -> VTOP login](/amazecc-api/01-authentication/vtop-login).

## Request

**Method:** POST  
**Path:** `/api/social/identity/sync`

| Field | Required | Type notes |
|---|---|---|
| `proposedSemesterId` | optional | see code |

## Response

```json
{
  "success": true,
  "identity": "...",
  "courses": "...",
  "busyMap": "...",
  "peers": "...",
  "grantSecrets": "...",
  "semesterSource": "...",
  "version": 1
}
```

> Full shape: `{success,identity,courses,busyMap,peers,grantSecrets,semesterSource,version}`

Field-by-field breakdown with types: [Response shapes ->](../../05-reference/response-shapes/social.md)

**Rate limit:** 20/min/IP

## Try it live

<EndpointTry path="/api/social/identity/sync" method="post" auth="social" />

## curl

```bash
curl -X POST "https://api.amazecc.com/api/social/identity/sync" \
  -H "Content-Type: application/json" \
  -d '{
           "proposedSemesterId": "CH20262705"
         }'
```
