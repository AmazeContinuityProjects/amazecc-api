{/* generated: aapi1 */}
---
title: "Clubs & Events"
description: "Every Clubs & Events endpoint: method, path, auth and rate limits."
---

# Clubs & Events

> **In one line:** Eventhub (events & registration) and the club ecosystem: public directory, rep-managed club feeds and landing pages, and the admin moderation surface.

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| get | `/api/events` | None | - |
| post | `/api/events/login` | None | - |
| post | `/api/events/profile` | EventHub (body) | - |
| post | `/api/events/preview` | EventHub (body) | - |
| post | `/api/events/register` | EventHub (body) | - |
| post | `/api/events/paynow` | EventHub (body) | - |
| post | `/api/events/download` | EventHub (body) | - |
| get | `/api/clubs/details` | None | - |
| get, post | `/api/club-admin/details` | Club bearer token | - |
| get, post, delete | `/api/club-admin/feed` | Club bearer token | - |
| post | `/api/club-admin/feed/promote` | None | 30/min/IP |
| get, post | `/api/club-admin/landing-page` | Club bearer token | - |
| get, post, delete | `/api/club-admin/reps` | Club bearer token | - |
