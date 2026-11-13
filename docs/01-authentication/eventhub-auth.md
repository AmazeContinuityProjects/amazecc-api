---
title: "EventHub auth"
description: "How events login works: Eventhub credentials, the cached jsessionid, and the re-auth fallback."
---

# EventHub auth

> **In one line:** `POST /api/events/login` gets you an EventHub session; everything else reuses it with username/password or jsessionid.

**Endpoints:** `/api/events/login` · `/api/events/profile` · `/api/events/preview` · `/api/events/register` · `/api/events/download` · `/api/events/paynow`  
**Auth:** `{username, password}` or a cached `{jsessionid}` in the body

## What EventHub is

VIT's event registration system — `eventhubcc.vit.ac.in`. The API scrapes it for event listings, previews, registration, and downloads. Unlike VTOP, EventHub sessions live much longer, so caching the `jsessionid` on the client is normal.

## Getting a session

```bash
curl -X POST "https://api.amazecc.com/api/events/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"21BCE0000","password":"your-password"}'
```

Response: `{ "success": true, "jsessionid": "<session>" }`. Keep it. Note EventHub's username is *not* the same shape as the VTOP one — it's your Events account (usually the same registration number).

## Using the session

Every other events route accepts **either** `{username, password}` (slow, re-logs-in each call) **or** `{jsessionid}` (fast single cookie). The handlers try the session first and only re-authenticate if the cached session looks like a login page (`looksLikeLoginPage()` detects `action="/EventHub/mainDashboard"`).

```bash
curl -X POST "https://api.amazecc.com/api/events/profile" \
  -H "Content-Type: application/json" \
  -d '{"username":"21BCE0000","password":"your-password","jsessionid":"<session>"}'
```

## Notes & gotchas

- EventHub serves a **broken certificate chain**, so the server runs with `NODE_TLS_REJECT_UNAUTHORIZED=0` for EventHub calls. This is contained to that code path — do not copy it elsewhere.
- Registration is a browser-flow: the handler can return `{status:"reauthenticate"}` if your session dropped mid-form — re-login and retry.
- `/api/events/paynow` returns `{status:'payment_form', html, tcUrl}` — HTML in JSON. The frontend embeds it directly. Bot-protection HTML is the itself the answer, not an error.

## Where to next

- **[Clubs & Events reference](../03-api-reference/clubs-events/index.md)**
- **[Security footguns](../04-operations/security.md)** — why TLS=0 is acceptable only here.
