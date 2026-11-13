---
title: "Response shapes: GoRobo Shop"
description: "Every response body the public GoRobo catalog and orders return, field by field."
---

# Response shapes: GoRobo Shop

> **In one line:** the public face of the shop - catalog, ordering and the cache-busting version probe - plus the admin back office that manages it.

<Note>Admin-side GoRobo routes (`/api/admin/gorobo/*`) live in [Response shapes: Admin](./admin.md). This page covers the four public routes.</Note>

## GET /api/gorobo/items

**Envelope:** success-wrapped (public) · 200 / 500 / 503 · reference: [gorobo/items](../../03-api-reference/gorobo/items.md)

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `true` |
| `count` | number | items in THIS response |
| `total` | number | total matching rows |
| `page` | number | 1 when unpaginated, else requested page (≥1) |
| `pages` | number | `Math.max(1, ceil(total/limit))`; 1 when unpaginated |
| `items[]` | `GoroboOrderItem[]`… actually `GoroboItem[]` | catalog slice - ordered by `category`, then `name` |
| `items[].id` | string | stable item id (PK) |
| `items[].name` | string | |
| `items[].description` | string | |
| `items[].price` | number | selling price |
| `items[].basePrice` | number | cost price |
| `items[].margin` | number | markup |
| `items[].category` | string | |
| `items[].inStock` | boolean | |
| `items[].image` | string | image URL |

Query params: `?category=`, `?limit=`, `?page=` (requires limit), `?q=`. Success carries `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` (edge-cached, Cloudflare). Error branch: `Cache-Control: no-store` + `{ success: false, error }` - 503 "Database temporarily unavailable. Please try again in a minute." on circuit breaker, else 500 "Internal database error". Driver messages never echo.
**Typed?** `GoroboItem` exists (`src/lib/gorobo/schema.ts`) but `mapItem` is a local function - the wire shape is unexported.

## POST /api/gorobo/orders

**Envelope:** success-wrapped (public) · **201** / 400 / 429 / 500 · reference: [gorobo/orders](../../03-api-reference/gorobo/orders.md)

Success (HTTP **201**):

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `true` |
| `order.id` | string | UUID |
| `order.user_name` | string | orderer's name (≤100 chars) |
| `order.phone_number` | string | normalized 10-digit Indian mobile (`^[6-9]\d{9}$`, +91/91 stripped) |
| `order.items` | `GoroboOrderLine[]` | `{itemId?, name?, custom?, quantity, unitPrice, basePrice?, margin?}` - inventory lines carry the snapshot price/cost/margin at order time |
| `order.total` | number | Σ unitPrice × quantity |
| `order.delivery_mode` | string | `"buzz"` if body `deliveryMode` is `"buzz"` or `"bolt"`; else `"normal"` |
| `order.maps_url` | string | trimmed body URL or `""` |
| `order.created_at` | timestamptz | pg-serialized |

Errors: 400 (invalid JSON / name-length / phone format / items array ≤100 lines / quantity 1-99 / unknown item id) · 429 (**5/min/IP**) · 500 (`publicErrorMessage`). Duplicate line ids merge (cap 99). Only in-stock items accepted. Append-only - no update/delete.
**Typed?** `GoroboOrderLine`, `GoroboOrderItem` in `src/lib/gorobo/schema.ts` - `GoroboOrderRow`/`GoroboOrderJson` (admin) are the camelCase twins.

## POST /api/gorobo/seed

**Envelope:** success-wrapped (admin) · 200 / 400 / 401 / 500 / 503 · reference: [gorobo/seed](../../03-api-reference/gorobo/seed.md)

Requires `Authorization: Bearer <admin token>` with **`gorobo` permission** (superadmins bypass). Body `{items, replace?}` - `replace` defaults to **true** (rows absent from the payload are DELETED). Success: `{ success: true, message: "GoRoBo items seeded successfully", stats: {items: number, replaced: boolean} }` - stats counts the payload, not the DB.
401 uses `message` again: `{ success: false, message: "Unauthorized" }`.
**Typed?** `GoroboItem` input shape only.

## GET /api/gorobo/version

**Envelope:** success-wrapped (public) · 200 / 500 / 503 · reference: [gorobo/version](../../03-api-reference/gorobo/version.md)

`{ success: true, count: number, lastUpdate: string|null }` - `count` = rows in `gorobo_items`, `lastUpdate` = `max(updated_at)::text` (null on empty table). Success carries `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`. Cheap freshness probe - the client polls this to invalidate its local catalog cache.
**Typed?** No.
