---
title: "Response shapes: Admin"
description: "Every response body the admin endpoints return, field by field - auth-failure quirks included."
---

# Response shapes: Admin

> **In one line:** all 39 admin routes, wrapped or not, field by field - plus the two auth-failure shapes you will actually meet.

<Warning>
**The 401 shape here is always `{ success: false, message: "Unauthorized" }`** - key is `message`, not `error`. The 403 permission shape from `requireGoroboAdmin` is `{ success: false, error: "Forbidden" }`. DB errors: 503 with the minute-long apology on circuit breaker, 500 with `"Internal database error"` otherwise.
</Warning>

<Note>Packaged auth failures (401) have no per-route variation; omitted below for brevity. They are noted once, here.</Note>

## PUT /api/admin/settings/global

**Envelope:** success-wrapped · 200 / 400 / 401 / 500 · reference: [PUT /api/admin/settings/global](../../03-api-reference/admin/settings-global.md)

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | always `true`; body carries nothing else |

Error branches: `400 { success: false, error: "Missing key" }` · `500 { success: false, error }`.
**Typed?** No. Writes `app_config` upsert (`value` JSON.stringify'd into JSONB). Write-only - no read sibling in this route.

## GET/POST /api/admin/users

Reference: [users](../../03-api-reference/admin/users.md)

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `true` |
| `users[]` (GET) | row[] | raw rows: `{username, role: "admin"\|"superadmin", permissions: JSONB (string[]), added_by: string\|null, is_active: boolean, created_at: timestamptz}` |
| `user` (POST 201… actually 200) | object | `{username, role, permissions: string[], added_by, is_active}` - constructed, **no `created_at`** |

Error branches: `400` missing/invalid `username`, `role`, or `permissions` · `403 { success:false, error:"Only superadmins can …" }` (both verbs re-check role against the DB) · `409 { success:false, error:"User already exists" }` · `500`. Default permissions on create: `["dashboard","qbank","buses","push"]`.

**Typed?** No - raw pg rows. Valid permission names: `dashboard, qbank, buses, push, users, transport, gorobo, fresher-resources, faculty-directory, faculty-directories, cabshare, clubs, storage, audit_logs, settings`.

## PATCH/DELETE /api/admin/users/[username]

Reference: [users/[username]](../../03-api-reference/admin/users-username.md)

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `true` |
| `user` (PATCH) | row | updated row (same columns as list rows) |
| `message` (DELETE) | string | `User <NAME> deleted successfully` |

Error branches: `400` invalid role / permissions / `Cannot demote the last superadmin` / `Cannot delete the last superadmin` / `Cannot delete yourself` · `403` not-superadmin · `404 { success:false, error:"User not found" }` · PATCH 500 **leaks `error.message` verbatim** (unlike the masked pattern elsewhere).
**Typed?** No.

## GET /api/admin/stats

Reference: [stats](../../03-api-reference/admin/stats.md)

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `true` |
| `data.activeUsers` | number | `COUNT(DISTINCT user_id)` from push_subscriptions |
| `data.papers.total` | number | papers_archive count |
| `data.papers.approved` | number | `approval_status='APPROVED'` |
| `data.papers.pending` | number | `'PENDING'` |
| `data.papers.pendingReview` | number | `'PENDING_Q_APPROVAL'` |
| `data.papers.failedOcr` | number | `'OCR_FAILED'` |
| `data.busRoutes` | number | legacy `buses` table rows |
| `data.transportRoutes` | number | `buses_v2` rows |
| `data.transportRules` | number | `transport_rules` rows |
| `data.vitolSubscribers` | number | push_subscriptions with `vitol_enabled` |
| `data.recentLogs[]` | object[] | ≤100 audit-log rows `{id, admin_user, action, target_resource, timestamp (created_at), details: JSONB, ip_address}` |

Every subquery is individually `.catch()`-guarded to zero/empty - **partial DB failure still yields 200**. `ensureAuditLogsTable()` runs first.
**Typed?** No.

## GET/POST /api/admin/migrate

**Envelope:** success-wrapped but **inconsistent** · 200 / 401 / 429 (3 per 300 s per IP) / 500 · reference: [migrate](../../03-api-reference/admin/migrate.md)

**GET (health check - no DDL):**
| Field | Type | Meaning |
|---|---|---|
| `connected` | boolean | `false` + `error: "DATABASE_URL not set"` (HTTP 200!) when env missing |
| `db` | string | `current_database()` |
| `serverTime` | timestamptz | `NOW()` |
| `tables` | string[] | table list |

**POST (DDL runner):** `{ success: true, message }` listing tables created/confirmed. Error bodies are **raw `{ error }`** - no `success:false`. 429 follows the global rate-limit shape. Note: the message over-promises - `bus_routes`/`bus_stops`/`bus_placements`/`bus_students` are referenced but never created by its DDL.
**Typed?** No.

## GET/POST /api/admin/storage

Reference: [storage](../../03-api-reference/admin/storage.md)

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `true` |
| `data` (GET) | object | `{ totalSize (bytes), r2Count, otherCount, jsonCount, diagramCount, largestFiles[] (≤5), recentUploads[] (≤5) }` - classification by URL-host heuristic (Drive/OneDrive/Dropbox/SharePoint/live.com/docs.google vs `DIRECT_JSON` sentinel); `storage_provider` column is selected but unused for classification |
| `largestFiles[].source_id` / `course_code` / `title` / `file_size` / `storage_provider` / `created_at` / `file_url` | mixed | file rows |
| `missing` + `missingCount` (POST action=find_missing) | `{source_id, course_code, title}[]` + number | papers without a file |
| `message` (POST action=delete_orphaned / rebuild_metadata) | string | delete prunes REJECTED rows; rebuild is a **no-op stub** |

POST body: `{ action: "delete_orphaned" | "find_missing" | "rebuild_metadata" }` - unknown → `400 { success: false, error: "Invalid action" }`.
**Typed?** No.

## POST /api/admin/push

Reference: [push](../../03-api-reference/admin/push.md)

Success: `{ success: true, message }` - either `"No subscribers found."` or `"Broadcast triggered for <N> users."` Errors are **raw `{ error }`**: `"Missing title or body"` (400), `"VAPID keys not configured"` (500), `"Failed to send broadcast"` (500).
410 Gone endpoints are deleted during send. **Typed?** No.

## POST /api/admin/buses

Reference: [buses](../../03-api-reference/admin/buses.md)

Success: `{ success: true, message: "Buses updated successfully in the database." }` - body is a **bare JSON array** `{id, type, route, boardingPoints[], driverPhone, driverName, whatsappGroup, busLocation}` - TRUNCATEs `buses` and replaces in a transaction (legacy table; note its `id` is VARCHAR, unlike migrate DDL's SERIAL). Uses `message` (not `error`) in failure branches.
**Typed?** No.

## GET/POST /api/admin/clubs

Reference: [clubs](../../03-api-reference/admin/clubs.md)

GET `{ success: true, clubs }` - `SELECT * FROM club_details ORDER BY club_name ASC` (columns not enumerated in repo; known: `club_id, club_name, mission, description, hiring_process, website, recruitment_link, instagram, whatsapp, poc, email, poc_phone, logo_url, updated_at`).
POST upsert `{ success: true, club }` - RETURNING *.
**Typed?** No.

## GET/POST/DELETE /api/admin/clubs/representatives

Reference: [clubs/representatives](../../03-api-reference/admin/clubs-representatives.md)

GET `{ success: true, representatives }` (`?club_id=` optional) · POST upsert `{ success: true, representative }` (`club_id, vtop_id, role (default "representative"), assigned_by, created_at`) · DELETE `{ success: true, message }` - body (not query) carries `club_id, vtop_id`.
**Typed?** No.

## GET/POST/PUT/DELETE /api/admin/faculty-directories

Reference: [faculty-directories](../../03-api-reference/admin/faculty-directories.md) - permission-gated (`faculty-directory`/`faculty-directories`)

GET `{ success: true, directories }` → rows `{id, school_name, url}` · POST `{ success: true, message: "Directory added successfully" }` · PUT `{ success: true, message: "Directory updated successfully" }` · DELETE `{ success: true, message: "Directory deleted successfully" }`
Error branches add `403 Permission denied: faculty-directory permission required` (mutations) and `404 Directory not found`.
**Typed?** No.

## GET/POST /api/admin/fresher-resources

Reference: [fresher-resources](../../03-api-reference/admin/fresher-resources.md) - POST permission-gated (`fresher-resources`)

GET `{ success: true, resources }` → `{id (number), title, description, url (nullable), icon, sort_order, is_active, type: "link"|"text"|"md", content, created_at, updated_at}` · POST `{ success: true, resource }` (RETURNING omits `updated_at`).
**Typed?** No.

## PATCH/DELETE /api/admin/fresher-resources/[id]

Reference: [fresher-resources/[id]](../../03-api-reference/admin/fresher-resources-id.md)

PATCH `{ success: true, resource }` - RETURNING id/title/description/url/icon/sort_order/is_active/**updated_at** (no `type`/`content`) · DELETE `{ success: true }` (bare). Errors: `403 Permission denied…`, `400 Invalid id`/`No fields to update`, `404 Resource not found`.
**Typed?** No.

## POST /api/admin/ocr

Reference: [ocr](../../03-api-reference/admin/ocr.md)

Success: `{ success: true, message: "Paper queued for local OCR processing" }` - flips `papers_archive.approval_status` to `OCR_QUEUED`; **no OCR happens inline** (external worker). Errors are **raw `{ error }`** (`Paper ID is required` / `Paper not found` / `Paper is already being processed`) - no `success:false`.
(Sibling: [POST /api/admin/ocr/reset](../../03-api-reference/admin/ocr-reset.md) - `{ success: true, message: "Paper status reset to PENDING" }`, raw errors, no existence check.)
**Typed?** No.

## GET/POST /api/admin/transport/routes

Reference: [transport/routes](../../03-api-reference/admin/transport-routes.md) - `transport`/`buses` permission

GET `{ success: true, routes }` - rows from `buses_v2` incl. `stops`/`placements` JSONB + `stop_count` · POST **full replace** `{ success: true, message: "Routes updated successfully" }` - body is a bare array of `BusRouteInput` (`routeNumber, routeName, type, driverName?, driverPhone?, whatsappGroup?, busLocation?, supervisorName?, supervisorPhone?, driverInchargeName?, driverInchargePhone?, stops?, placements?`).
**Typed?** `BusRouteInput`/`BusStop`/`BusPlacement` in `src/types/transport.ts` (input side; row itself untyped).

## GET/PUT/DELETE /api/admin/transport/routes/[id]

Reference: [transport/routes/[id]](../../03-api-reference/admin/transport-routes-id.md)

GET `{ success: true, route }` (`SELECT *`) · PUT `{ success: true, route }` (full row, RETURNING *) · DELETE `{ success: true, message: "Route deleted successfully" }`
Errors: `400 Invalid route ID`, `404 Route not found`, `403 Forbidden`.
**Typed?** `BusStop`/`BusPlacement` inner shapes only.

## POST /api/admin/transport/routes/[id]/stops

Reference: [stops](../../03-api-reference/admin/transport-routes-id-stops.md)

Success: `{ success: true, message: "Stops updated successfully" }` - body is a bare array of `BusStop` (`{stopOrder, stopName, pickupTime}`); overwrites `stops` wholesale.
**Typed?** Yes - `BusStop`.

## GET/POST /api/admin/transport/placements

Reference: [placements](../../03-api-reference/admin/transport-placements.md)

GET `{ success: true, placements }` → flat `{routeId, routeNumber, routeName, dispersalTime: "5PM"|"6PM", zone}` sorted by dispersal time then route number · POST **full replace** `{ success: true, message: "Placements updated successfully" }` - body array of `{routeNumber, dispersalTime, zone}`; clears all `placements` then re-groups by routeNumber.
**Typed?** `BusPlacement` (input side).

## GET/POST /api/admin/transport/rules

Reference: [rules](../../03-api-reference/admin/transport-rules.md)

GET `{ success: true, rules }` → `{id, rule_number, content, created_at, updated_at}` ordered by `rule_number` · POST **full replace** `{ success: true, message: "Rules updated successfully" }` - body array of `{ruleNumber, content}`.
**Typed?** `TransportRule` / `TransportRuleInput`.

## DELETE /api/admin/transport/rules/[id]

Reference: [rules/[id]](../../03-api-reference/admin/transport-rules-id.md)
Success: `{ success: true, message: "Rule deleted successfully" }` · `400 Invalid rule ID` / `404 Rule not found`.
**Typed?** Row shape per `TransportRule`.

## POST /api/admin/transport/seed

Reference: [seed](../../03-api-reference/admin/transport-seed.md)

Success: `{ success: true, message: "Transport data seeded successfully", stats: {routes, placements, rules} }` - stats count the **payload**, not the DB. Body optional (defaults to bundled `seed.json`); any of `routes`/`placements`/`rules` present replaces seed wholesale; transaction wipes `buses_v2` + `transport_rules` and re-inserts.
**Typed?** `BusRouteInput`/`TransportRuleInput` inner shapes.

## POST/DELETE /api/admin/transport/students

Reference: [students](../../03-api-reference/admin/transport-students.md)

POST `{ success: true, message: "Inserted <N> students for route <routeNumber>" }` - body bare array or `{students: [...]}` - all must share one `routeNumber`; deletes that route's existing `bus_students` then re-inserts (route-scoped replace) · DELETE `?routeId=` `{ success: true, message: "Deleted <n> students for route <routeId>" }` - no existence check.
**Typed?** `BusStudentInput` (`{routeNumber, registrationNumber, applicationNumber?, destination?}`).

## GET/POST /api/admin/gorobo/items

Reference: [gorobo items](../../03-api-reference/admin/gorobo-items.md) · permission: `gorobo`

**GET** (`?search`, `?category`, `?lowStock=true`, `?limit` 1-1000 default 220): `{ success: true, count, totalCount, hasMore, limit, items }`
`ItemJson` (from `mapItemRow`): `{id (string number), name, description, price (base+margin), basePrice, margin, category, inStock, image, sku ("" default), stockQuantity, lowStockThreshold (default 5), locationBin, datasheetUrl, tags[], updatedAt}`

**POST 201:** `{ success: true, item }` - same shape; id = `MAX(id::int)+1` as string; `price = basePrice + margin`; `inStock = flag !== false && stockQuantity > 0`.
**Typed?** `GoroboItem` in `src/lib/gorobo/schema.ts` (mapItemRow's return is unexported, but schema is the reference).

## PUT/DELETE /api/admin/gorobo/items/[id]

Reference: [items/[id]](../../03-api-reference/admin/gorobo-items-id.md)
PUT `{ success: true, item }` (COALESCE-patch, price recomputed) · DELETE `{ success: true, message: "Item <id> deleted successfully" }` · 404 not-found.
**Typed?** `GoroboItem`.

## PATCH /api/admin/gorobo/items/stock

Reference: [items/stock](../../03-api-reference/admin/gorobo-items-stock.md)
Success: `{ success: true, item }` - `{itemId, delta?}` relative adjust or `{stockQuantity}` absolute set; clamps at ≥0, recomputes `in_stock`.
**Typed?** `GoroboItem`.

## GET/POST /api/admin/gorobo/orders

Reference: [gorobo orders](../../03-api-reference/admin/gorobo-orders.md) · `gorobo` permission

**GET** (`?status`, `?search`, LIMIT 500): `{ success: true, count, orders }`
`OrderJson` (from `mapOrderRow`): `{id (uuid), userName, phoneNumber, items: GoroboOrderLine[], status, subtotal, discountPct, discountAmount, taxable, gstPct, gstAmount, shipmentCost, total, notes, deliveryMode (default "normal"), mapsUrl, createdAt}` where `GoroboOrderLine` = `{itemId?, name?, custom?, quantity, unitPrice, basePrice?, margin?}` and status ∈ `pending|confirmed|processing|ready|completed|cancelled|archived`.

**POST 201:** `{ success: true, order }` - counter order, defaults `status: pending`, `deliveryMode: counter_pickup`; stock decremented only when born confirmed-or-later.
**Typed?** `GoroboOrderJson`/`GoroboOrderRow` in `src/lib/gorobo/orders.ts`, `GoroboOrderLine` in `schema.ts`, `Quote` in `src/lib/gorobo/quote.ts`.

## GET/PUT/PATCH /api/admin/gorobo/orders/[id]

Reference: [orders/[id]](../../03-api-reference/admin/gorobo-orders-id.md)

**GET** `{ success: true, order, wallet }` - `wallet`: `{party: "customer"|"vendor", kind: "profit"|"gst"|"cost", amount (float8), status: "pending"|"settled", settled_at, created_at}[]`
**PUT** `{ success: true, order }` - quote re-saved; rejects completed orders
**PATCH** `{ success: true, order }` - status/notes/deliveryMode; on transition INTO completed inserts wallet entries (`ON CONFLICT DO NOTHING`)
Errors: `404 Order not found` · `409 Cannot edit an order that is already completed`.
**Typed?** `GoroboOrderJson`, `GoroboWalletEntry` (schema.ts - note: that interface is actually dead; the wallet rows here are untyped raw selects).

## POST /api/admin/gorobo/orders/[id]/confirm

Reference: [confirm](../../03-api-reference/admin/gorobo-orders-id-confirm.md)
Success: `{ success: true, order }` - pending → confirmed. No stock movement. RETURNING omits `delivery_mode`/`maps_url` → defaults fabricate `"normal"`/`""`.
**Typed?** `GoroboOrderJson`.

## POST /api/admin/gorobo/orders/[id]/complete

Reference: [complete](../../03-api-reference/admin/gorobo-orders-id-complete.md)
Success: `{ success: true, order, wallet }` - inserts exactly 3 ledger rows, then re-reads them: `customer/profit` (taxable − Σ base×qty), `customer/gst` (gstAmount), `vendor/cost` (Σ base×qty), all `pending`. Confirmed-only; double-run prevented by status check + `FOR UPDATE` (no ON CONFLICT guard).
**Typed?** `GoroboOrderJson`; wallet rows untyped.

## POST /api/admin/gorobo/orders/[id]/archive

Reference: [archive](../../03-api-reference/admin/gorobo-orders-id-archive.md)
Success: `{ success: true, order, wallet: [] }` - `wallet` is always the empty array literal. Optional body `{reason}` (parse failures swallowed); idempotent re-archive returns 200 unchanged.
**Typed?** `GoroboOrderJson`. Unarchive ([unarchive](../../03-api-reference/admin/gorobo-orders-id-unarchive.md)): same shape; archived → pending; `[ARCHIVED...]` suffix stripped; 409 if not currently archived.

## GET/POST /api/admin/gorobo/bundles

Reference: [bundles](../../03-api-reference/admin/gorobo-bundles.md) · `gorobo` permission
GET `{ success: true, count, bundles }` · POST 201 `{ success: true, bundle }`
`BundleJson`: `{id (uuid), name, description, category (POST default "Project Kits"), items: GoroboOrderLine[], bundlePrice, discountPct, image, isActive, createdAt, updatedAt}`
**Typed?** `GoroboBundle` (schema.ts - DB snake_case shape; BundleJson untyped inline).

## PUT/DELETE /api/admin/gorobo/bundles/[id]

Reference: [bundles/[id]](../../03-api-reference/admin/gorobo-bundles-id.md)
PUT `{ success: true, bundle }` (COALESCE-patch) · DELETE `{ success: true, message: "Bundle deleted successfully" }` · 404.
**Typed?** `GoroboBundle`.

## GET /api/admin/gorobo/analytics

Reference: [analytics](../../03-api-reference/admin/gorobo-analytics.md)

`{ success: true, analytics }` with:
| Key | Contents |
|---|---|
| `today` | `{orders, revenue}` - since CURRENT_DATE |
| `orders` | `{total, pending, confirmed, processing, ready, completed, archived, completedRevenue, activePipelineRevenue (confirmed+processing+ready), totalQuotedRevenue}` |
| `inventory` | `{totalSkus, inStockCount, lowStockCount, outOfStockCount, totalCategories, lowStockAlerts[] (≤20 of {id,name,category,stockQuantity,lowStockThreshold,locationBin,price,inStock})}` |
| `financials` | `{profitTotal, profitSettled, gstTotal, gstSettled, vendorPayable, vendorPaid}` - all-time sums over `gorobo_wallet_entries` |
| `recentOrders[]` | ≤5: `{id, userName, phoneNumber, total, status, createdAt, itemCount}` |

Each subquery is `.catch()`-guarded to empty fallbacks; `ordersMetrics` failure yields zeros. Int8 arrives as string - all Numbers coerce it.
**Typed?** No.

## GET /api/admin/gorobo/wallet

Reference: [wallet](../../03-api-reference/admin/gorobo-wallet.md)

`{ success: true, summary, transactions }`
`summary`: `{profitTotal, profitSettled, gstTotal, gstSettled, vendorPayable, vendorPaid, customerReceivable, customerReceived}` - receivable/received count **profit only** (GST excluded)
`transactions[]` - one per order: `{orderId, userName, phoneNumber, createdAt, customer: {profit: {amount, status}|null, gst: {...}|null}, vendor: {cost: {amount, status}|null}}`
**Typed?** Local `EntryRow` interface in the route file; `GroupRow` absent. `GoroboWalletEntry` (schema.ts) describes a near-identical shape in snake_case but is unused here.

## POST /api/admin/gorobo/wallet/orders/[id]/settle

Reference: [settle](../../03-api-reference/admin/gorobo-wallet-orders-id-settle.md)
Success: `{ success: true, settled: number (rows actually flipped), entries: {party, kind, amount, status: "settled", settled_at}[] }` - body `{party: "customer"|"vendor"}` required; flips only `pending` rows; already-settled rows untouched; `settled: 0` with empty `entries` is a valid 200.
**Typed?** `GoroboWalletEntry` (near match - settle returns a subset of columns).

## GET/DELETE /api/admin/cabshare/trips

Reference: [cabshare trips](../../03-api-reference/admin/cabshare-trips.md) · `cabshare` permission

GET `{ success: true, trips }` - `t.*` + `name`/`reg_number`/`phone_number` (owner) + `hub_name` + injected **`requests[]`** per trip: `{match_id, status, name, reg_number, phone_number}` from `cabshare_match_events` (N+1 query pattern) · DELETE (`?trip_id=`) `{ success: true, message: "Trip deleted successfully" }` - silently succeeds on missing id.
Error: `403 Permission denied: cabshare permission required`.
**Typed?** No.

## POST/DELETE /api/admin/cabshare/hubs

Reference: [cabshare hubs](../../03-api-reference/admin/cabshare-hubs.md) · `cabshare` permission
POST `{ success: true, hub }` - `INSERT (hub_name, city) VALUES ($1,$2) RETURNING *`, city defaults `"Chennai"`; `403`/`400 Missing hub_name` · DELETE (`?hub_id=`) `{ success: true, message: "Hub deleted successfully" }` - no rowCount check.
**Typed?** No.
