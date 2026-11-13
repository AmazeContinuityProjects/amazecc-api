---
title: "Club auth"
description: "How club representatives get a club token at login, and how the X-Club-Id header re-selects context."
---

# Club auth

> **In one line:** when your authorizedID represents one or more clubs, login hands you a club token automatically — scoped to those clubs.

**Endpoint:** `POST /api/login` (club tokens are minted here)  
**Header:** `Authorization: Bearer <club token>`

## How you get one

Call `POST /api/login` as you normally would. If your authorizedID is registered as a representative in `club_representatives` (or is a super-club-rep), the response includes:

```json
{
  "success": true,
  "...": "...",
  "clubToken": "<base64url(payload)>.<hex-hmac-sha256>",
  "clubRoles": [
    { "club_id": "...", "club_name": "CodeChef-VIT", "role": "super-club-rep" }
  ]
}
```

If you represent nothing, `clubToken` is `null` and no header is required for non-club work.

## What the token contains

`{ vtop_id, clubs[], club_id, role, typ: 'club', exp }` — signed with `HMAC(ADMIN_SECRET, "amazecc-token:club")`, 7-day TTL. The primary `club_id` is `clubs[0]`.

## The `X-Club-Id` header

A representative of multiple clubs picks the active one per request:

```bash
curl -X GET "https://api.amazecc.com/api/club-admin/feed" \
  -H "Authorization: Bearer <club token>" \
  -H "X-Club-Id: <another club id>"
```

- Super-club-reps may set `X-Club-Id` to any club.
- Regular reps may only set it to a club in their `clubs[]`; other values get 403.

## What club auth unlocks

Everything under `/api/club-admin/*` — the rep-managed feed, landing-page config, reps, and details. Read effects are mostly public (`/api/clubs/details` needs nothing); write effects require the club token.

## Where to next

- **[Clubs & Events](../03-api-reference/clubs-events/index.md)** — every club route, with try-it.
- **[Admin auth](./admin-auth.md)** — the heavier sibling.
