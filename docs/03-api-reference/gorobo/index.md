---
title: "GoRobo Shop"
description: "Every GoRobo Shop endpoint: method, path, auth and rate limits."
---

{/* generated: aapi2 */}

# GoRobo Shop

> **In one line:** The internal GoRobo shop - catalog, ordering, stock and wallet settlement. Public catalog + orders, admin-gated management.

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| get | `/api/gorobo/items` | None | - |
| post | `/api/gorobo/orders` | None | 5/min/IP |
| post | `/api/gorobo/seed` | Admin bearer + permission | - |
| get | `/api/gorobo/version` | None | - |
