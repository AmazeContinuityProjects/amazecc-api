---
title: "Admin"
description: "Every Admin endpoint: method, path, auth and rate limits."
---

{/* generated: aapi2 */}

# Admin

> **In one line:** Everything behind the admin bearer: users, storage, Buses/transport, clubs, fresher resources, QBank moderation and the GoRobo back office. Read the Admin auth page before using any of these.

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| put | `/api/admin/settings/global` | Admin bearer token | - |
| get, post | `/api/admin/users` | Admin bearer token | - |
| patch, delete | `/api/admin/users/[username]` | Admin bearer token | - |
| get | `/api/admin/stats` | Admin bearer token | - |
| post, get | `/api/admin/migrate` | Admin bearer token | 3/5min |
| get, post | `/api/admin/storage` | Admin bearer token | - |
| post | `/api/admin/push` | Admin bearer token | - |
| post | `/api/admin/buses` | Admin bearer token | - |
| get, post | `/api/admin/clubs` | Admin bearer token | - |
| get, post, delete | `/api/admin/clubs/representatives` | Admin bearer token | - |
| get, post, put, delete | `/api/admin/faculty-directories` | Admin bearer + permission | - |
| get, post | `/api/admin/fresher-resources` | Admin bearer + permission | - |
| patch, delete | `/api/admin/fresher-resources/[id]` | Admin bearer + permission | - |
| post | `/api/admin/ocr` | Admin bearer token | - |
| post | `/api/admin/ocr/reset` | Admin bearer token | - |
| get, post | `/api/admin/transport/routes` | Admin bearer + permission | - |
| get, put, delete | `/api/admin/transport/routes/[id]` | Admin bearer + permission | - |
| post | `/api/admin/transport/routes/[id]/stops` | Admin bearer + permission | - |
| get, post | `/api/admin/transport/placements` | Admin bearer + permission | - |
| get, post | `/api/admin/transport/rules` | Admin bearer + permission | - |
| delete | `/api/admin/transport/rules/[id]` | Admin bearer + permission | - |
| post | `/api/admin/transport/seed` | Admin bearer + permission | - |
| post, delete | `/api/admin/transport/students` | Admin bearer + permission | - |
| get, post | `/api/admin/gorobo/items` | Admin bearer + permission | - |
| put, delete | `/api/admin/gorobo/items/[id]` | Admin bearer + permission | - |
| patch | `/api/admin/gorobo/items/stock` | Admin bearer + permission | - |
| get, post | `/api/admin/gorobo/orders` | Admin bearer + permission | - |
| get, put, patch | `/api/admin/gorobo/orders/[id]` | Admin bearer + permission | - |
| post | `/api/admin/gorobo/orders/[id]/confirm` | Admin bearer + permission | - |
| post | `/api/admin/gorobo/orders/[id]/complete` | Admin bearer + permission | - |
| post | `/api/admin/gorobo/orders/[id]/archive` | Admin bearer + permission | - |
| post | `/api/admin/gorobo/orders/[id]/unarchive` | Admin bearer + permission | - |
| get, post | `/api/admin/gorobo/bundles` | Admin bearer + permission | - |
| put, delete | `/api/admin/gorobo/bundles/[id]` | Admin bearer + permission | - |
| get | `/api/admin/gorobo/analytics` | Admin bearer + permission | - |
| get | `/api/admin/gorobo/wallet` | Admin bearer + permission | - |
| post | `/api/admin/gorobo/wallet/orders/[id]/settle` | Admin bearer + permission | - |
| get, delete | `/api/admin/cabshare/trips` | Admin bearer + permission | - |
| post, delete | `/api/admin/cabshare/hubs` | Admin bearer + permission | - |
