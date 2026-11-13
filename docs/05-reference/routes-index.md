---
title: "Route index"
description: "Every one of the 127 routes: method, path, auth requirement and rate limit."
---

# Route index

> **In one line:** the complete map of this API — 127 routes, grouped by what they do.
>
> Every route below is also a `<EndpointTry>` page in the reference section.

## Auth & System

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| post | `/api/admin/auth` | public | 5/min/IP |
| post | `/api/login` | public | 5/min/IP |

## Academics & VTOP

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| post | `/api/attendance` | VTOP cookies | — |
| post | `/api/attendance/htmlparser2` | VTOP cookies | — |
| post | `/api/bulk` | VTOP cookies | — |
| post | `/api/calendar` | VTOP cookies | — |
| post | `/api/circulars` | VTOP cookies | — |
| post | `/api/circulars/download` | VTOP cookies | — |
| post | `/api/course-page` | VTOP cookies | — |
| post | `/api/course-page/material` | VTOP cookies | — |
| post | `/api/curriculum` | VTOP cookies | — |
| post | `/api/curriculum/download` | VTOP cookies | — |
| post | `/api/curriculum/syllabus` | VTOP cookies | — |
| post | `/api/ffcs` | VTOP cookies | — |
| post | `/api/grades` | VTOP cookies | — |
| post | `/api/hostel` | VTOP cookies | — |
| post, get | `/api/marks/stats` | VTOP cookies | 60/min/IP |
| post | `/api/marks/sync` | VTOP cookies | 20/min/IP |
| post | `/api/marks/tokens` | VTOP cookies | 60/min/IP |
| post | `/api/od` | VTOP cookies | — |
| post | `/api/whoami` | VTOP cookies | — |

## Transport & Buses

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| get | `/api/buses` | public | — |
| post | `/api/transport` | VTOP cookies | — |

## Finance

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| post | `/api/finance` | VTOP cookies | — |

## Clubs & Events

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| get, post | `/api/club-admin/details` | club bearer | — |
| get, post, delete | `/api/club-admin/feed` | club bearer | — |
| post | `/api/club-admin/feed/promote` | public | 30/min/IP |
| get, post | `/api/club-admin/landing-page` | club bearer | — |
| get, post, delete | `/api/club-admin/reps` | club bearer | — |
| get | `/api/clubs/details` | public | — |
| get | `/api/events` | public | — |
| post | `/api/events/download` | EventHub creds | — |
| post | `/api/events/login` | public | — |
| post | `/api/events/paynow` | EventHub creds | — |
| post | `/api/events/preview` | EventHub creds | — |
| post | `/api/events/profile` | EventHub creds | — |
| post | `/api/events/register` | EventHub creds | — |

## Social (FFCS Partners)

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| get, post | `/api/social/ffcs-match` | VTOP-verified | 30/min/IP |
| post | `/api/social/grant/revoke` | VTOP-verified | 60/min/IP |
| post | `/api/social/grant/visibility` | VTOP-verified | 60/min/IP |
| post | `/api/social/identity/sync` | VTOP-verified | 20/min/IP |
| post | `/api/social/pair/claim` | VTOP-verified | 30/hour/IP |
| post | `/api/social/people` | VTOP-verified | 20/min/IP |
| get | `/api/social/semester` | public | — |
| post | `/api/social/timetable` | VTOP-verified | 120/min/IP |

## QBank

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| post | `/api/qbank/admin/import-to-storage` | admin bearer | — |
| post | `/api/qbank/admin/ocr` | admin bearer | — |
| post | `/api/qbank/admin/publish` | admin bearer | — |
| get, post, patch, delete | `/api/qbank/admin/questions` | admin bearer | — |
| post | `/api/qbank/admin/questions/bulk` | admin bearer | — |
| get, patch | `/api/qbank/admin/queue` | admin bearer | — |
| post | `/api/qbank/admin/reject` | admin bearer | — |
| get | `/api/qbank/courses` | public | — |
| get | `/api/qbank/papers` | public | — |
| get | `/api/qbank/papers/download/[paperId]` | public | — |
| get | `/api/qbank/questions` | public | — |
| post | `/api/qbank/upload` | public | — |

## GoRobo Shop

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| get | `/api/gorobo/items` | public | — |
| post | `/api/gorobo/orders` | public | 5/min/IP |
| post | `/api/gorobo/seed` | admin bearer + perm | — |
| get | `/api/gorobo/version` | public | — |

## LMS & Koha

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| get | `/api/koha/availability` | public | — |
| get | `/api/koha/detail` | public | — |
| post | `/api/koha/patron` | public | — |
| get | `/api/koha/search` | public | — |
| post | `/api/lms-data` | Moodle creds | — |
| post | `/api/vitol-data` | Moodle creds | — |

## Faculty Directory

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| get | `/api/faculty/schools` | public | — |
| post | `/api/faculty/scrape` | public | 10/min/IP |

## CabShare

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| post | `/api/cabshare/auth` | public | 5/min/IP |
| post, delete | `/api/cabshare/blocks` | cabshare bearer | — |
| get | `/api/cabshare/hubs` | public | — |
| post | `/api/cabshare/match` | cabshare bearer | — |
| get, patch | `/api/cabshare/notifications` | cabshare bearer | — |
| post | `/api/cabshare/ratings` | cabshare bearer | — |
| get | `/api/cabshare/stats` | public | — |
| post, get | `/api/cabshare/trips` | cabshare bearer | — |
| get | `/api/cabshare/trips/me` | cabshare bearer | — |
| post | `/api/cabshare/waitlist` | cabshare bearer | — |

## Admin

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| post | `/api/admin/buses` | admin bearer | — |
| post, delete | `/api/admin/cabshare/hubs` | admin bearer + perm | — |
| get, delete | `/api/admin/cabshare/trips` | admin bearer + perm | — |
| get, post | `/api/admin/clubs` | admin bearer | — |
| get, post, delete | `/api/admin/clubs/representatives` | admin bearer | — |
| get, post, put, delete | `/api/admin/faculty-directories` | admin bearer + perm | — |
| get, post | `/api/admin/fresher-resources` | admin bearer + perm | — |
| patch, delete | `/api/admin/fresher-resources/[id]` | admin bearer + perm | — |
| get | `/api/admin/gorobo/analytics` | admin bearer + perm | — |
| get, post | `/api/admin/gorobo/bundles` | admin bearer + perm | — |
| put, delete | `/api/admin/gorobo/bundles/[id]` | admin bearer + perm | — |
| get, post | `/api/admin/gorobo/items` | admin bearer + perm | — |
| put, delete | `/api/admin/gorobo/items/[id]` | admin bearer + perm | — |
| patch | `/api/admin/gorobo/items/stock` | admin bearer + perm | — |
| get, post | `/api/admin/gorobo/orders` | admin bearer + perm | — |
| get, put, patch | `/api/admin/gorobo/orders/[id]` | admin bearer + perm | — |
| post | `/api/admin/gorobo/orders/[id]/archive` | admin bearer + perm | — |
| post | `/api/admin/gorobo/orders/[id]/complete` | admin bearer + perm | — |
| post | `/api/admin/gorobo/orders/[id]/confirm` | admin bearer + perm | — |
| post | `/api/admin/gorobo/orders/[id]/unarchive` | admin bearer + perm | — |
| get | `/api/admin/gorobo/wallet` | admin bearer + perm | — |
| post | `/api/admin/gorobo/wallet/orders/[id]/settle` | admin bearer + perm | — |
| post, get | `/api/admin/migrate` | admin bearer | 3/5min |
| post | `/api/admin/ocr` | admin bearer | — |
| post | `/api/admin/ocr/reset` | admin bearer | — |
| post | `/api/admin/push` | admin bearer | — |
| put | `/api/admin/settings/global` | admin bearer | — |
| get | `/api/admin/stats` | admin bearer | — |
| get, post | `/api/admin/storage` | admin bearer | — |
| get, post | `/api/admin/transport/placements` | admin bearer + perm | — |
| get, post | `/api/admin/transport/routes` | admin bearer + perm | — |
| get, put, delete | `/api/admin/transport/routes/[id]` | admin bearer + perm | — |
| post | `/api/admin/transport/routes/[id]/stops` | admin bearer + perm | — |
| get, post | `/api/admin/transport/rules` | admin bearer + perm | — |
| delete | `/api/admin/transport/rules/[id]` | admin bearer + perm | — |
| post | `/api/admin/transport/seed` | admin bearer + perm | — |
| post, delete | `/api/admin/transport/students` | admin bearer + perm | — |
| get, post | `/api/admin/users` | admin bearer | — |
| patch, delete | `/api/admin/users/[username]` | admin bearer | — |

## Auth & System (cont.)

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| get, post | `/api/cron/reminders` | CRON_SECRET | — |
| get | `/api/docs` | public | — |
| get | `/api/fresher-resources` | public | — |
| get | `/api/health` | public | — |
| get | `/api/notifications/status` | public | — |
| post | `/api/notifications/subscribe` | public | — |
| post | `/api/notifications/unsubscribe` | public | — |
| get | `/api/settings/global` | public | — |
| get | `/api/status` | public | — |

