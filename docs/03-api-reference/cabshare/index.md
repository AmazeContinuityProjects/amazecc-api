<!-- generated: aapi1 -->
---
title: "CabShare"
description: "Every CabShare endpoint: method, path, auth and rate limits."
---

# CabShare

> **In one line:** Hostel cab-share: trip planning, matching, blocking, ratings and waitlists. Not the friend finder - a separate, simpler board.

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| post | `/api/cabshare/auth` | None | 5/min/IP |
| post, get | `/api/cabshare/trips` | CabShare token | - |
| get | `/api/cabshare/trips/me` | CabShare token | - |
| get | `/api/cabshare/hubs` | None | - |
| post | `/api/cabshare/match` | CabShare token | - |
| post, delete | `/api/cabshare/blocks` | CabShare token | - |
| post | `/api/cabshare/ratings` | CabShare token | - |
| get, patch | `/api/cabshare/notifications` | CabShare token | - |
| post | `/api/cabshare/waitlist` | CabShare token | - |
| get | `/api/cabshare/stats` | None | - |
