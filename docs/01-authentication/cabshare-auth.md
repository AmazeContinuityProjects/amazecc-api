---
title: "CabShare auth"
description: "Trip-sharing login: VTOP-verified registration plus a phone number, minting a 30-day CabShare token."
---

# CabShare auth

> **In one line:** `POST /api/cabshare/auth` proves you against VTOP and ties your trip-sharing to your phone number — a 30-day trip board pass, not a general credential.

**Endpoint:** `POST /api/cabshare/auth`  
**Auth:** none (this is the door)  
**Issued token:** `Authorization: Bearer <token>` (30 days)

## What the request looks like

```bash
curl -X POST "https://api.amazecc.com/api/cabshare/auth" \
  -H "Content-Type: application/json" \
  -d '{"username":"21BCE0000","password":"your-password","phone_number":"98xxxxxxx0"}'
```

Unlike the vanilla login, this **needs a phone number** — CabShare is a board for organizing shared cabs, so the phone is the coordination primitive. The API:

1. Verifies your VTOP credentials (same captcha-solved login as everywhere else).
2. Upserts a row in `cabshare_users` (register number ↔ phone number).
3. Signs a `cabshare` token (30-day TTL) with `HMAC(ADMIN_SECRET, "amazecc-token:cabshare")`.

## What CabShare covers

Trips between hostel blocks and campus hubs: matching, blocking, ratings, notifications, waitlist. Its routes are all under `/api/cabshare/*` and guarded by `requireCabshareUser()` (which also re-checks the `cabshare_users` row).

**It is deliberately separate from the FFCS friend finder** — different data model, different crypto, different users (any hosteler, not just FFCS students), different purpose.

## Where to next

- **[CabShare reference](../03-api-reference/cabshare/index.md)** — every CabShare route.
- **[Club auth](./club-auth.md)** — the other scoped bearer.
