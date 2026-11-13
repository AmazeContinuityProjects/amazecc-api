---
title: "Response shapes: CabShare"
description: "Every response body the CabShare trip board returns, field by field."
---

# Response shapes: CabShare

> **In one line:** the friendlier, separate trip board - one envelope style, phone-number coordination, shared-cab matching.

<Note>CabShare-gated routes return `401 { success: false, error: "Cab-share sign-in required" }` on failure. Everything else is success-wrapped; the only rate limit in the family is on login (5/min/IP).</Note>

## POST /api/cabshare/auth

**Envelope:** success-wrapped · 200 / 400 / 401 / 429 / 500 · reference: [cabshare/auth](../../03-api-reference/cabshare/auth.md)

Success:
| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `true` |
| `user` | object | upserted `cabshare_users` row: `{user_id (number), name (scraped, fallback "Student"), phone_number (body), reg_number (VTOP `authorizedID`)}` - exactly these 4 columns |
| `token` | string | cabshare session token `base64({typ:'cabshare', reg, exp}).hmac_sha256` - 30-day TTL, send as `Authorization: Bearer` |

Failure: 401 `{ success: false, message: "Invalid Username / Password" }` (**message, not error**) · 400 missing fields (all three required) · 500 (`captchaRes.error` passthrough / `Cab-share sign-in failed`) · 429 global shape.
**Typed?** No. Login failure reuses `/api/login`-style VTOP captcha solving upstream; the `cabshare_users` schema lives only in the live DB.

## GET/POST /api/cabshare/trips

Reference: [trips](../../03-api-reference/cabshare/trips.md)

**POST** body `{hub_id, travel_date, preferred_time, tolerance_hours?, seat_options, gender_preference, notes?}`: **`{ success: true, trip_id }`** - note the key order and naming differs between verbs:
- `trip_id`: number - the new trip's id (status hardcoded `active`, seat_options stringified into JSONB, tolerance_hours default 0)
- side effect: waitlisters for the same (hub, date) get a "Ride Match Found!" notification and are removed from the waitlist

**GET** (`?hub_id`, `?date` - both optional; caller's own trips excluded): **`{ success: true, trips }`** - rows `t.*` (trip_id, user_id, hub_id, travel_date, preferred_time, tolerance_hours, seat_options (JSONB array), gender_preference, notes, status) plus `name`, `owner_reg_number`, `hub_name`, `city`.
**Typed?** No.

## GET /api/cabshare/trips/me

**Envelope:** success-wrapped · 200 / 401 / 500 · reference: [trips/me](../../03-api-reference/cabshare/trips-me.md)

Literal: `{ success: true, my_trips, joined_trips }`
- `my_trips[]` = `t.*` + `hub_name` + `city` **plus injected `requests[]`** (N+1): `{match_id, status, name, reg_number, phone_number?}` - phone only when `status IN ('accepted','accept')`
- `joined_trips[]` = trips the caller requested to join: `t.*` + `hub_name` + `city` + `match_status` (`m.status`) + `owner_name` (+ `owner_phone` only when accepted)
**Typed?** No - two collections, neither under a `data` key.

## GET /api/cabshare/hubs

**Envelope:** success-wrapped (**public, no auth**) · 200 / 500 · reference: [hubs](../../03-api-reference/cabshare/hubs.md)

`{ success: true, hubs }` - `SELECT * FROM cabshare_hubs ORDER BY hub_id ASC` - columns (from admin-insert usage): `hub_id (number PK), hub_name, city` (city default `"Chennai"`). Error goes through `publicErrorMessage` (internal-looking errors masked to `'Internal server error'`).
**Typed?** No.

## POST /api/cabshare/match

**Envelope:** success-wrapped · 200 / 400 / 401 / 403 / 404 / 500 · reference: [match](../../03-api-reference/cabshare/match.md)

Body `{trip_id?, action, match_id?}` - success messages only, no ids echoed:
- `action: "request"` → `{ success: true, message: "Request sent" }` - inserts `pending` match (ON CONFLICT DO NOTHING)
- `action: "accept" | "reject"` → `{ success: true, message: "Request accepted" }` / `"Request rejected"` - requires `match_id`
- `action: "withdraw"` → `{ success: true, message: "Request withdrawn" }`

Errors: `Missing action` (400) · `Cannot request your own trip` (400) · `Trip not found` (404) · `Match not found` (404) · `Cannot request this trip` (403 - a block pair exists) · `Unauthorized` (403 - not the trip owner) · `Invalid action` (400).
**Typed?** No.

## POST/DELETE /api/cabshare/blocks

Reference: [blocks](../../03-api-reference/cabshare/blocks.md)
POST body `{blocked_id}` → `{ success: true, message: "User blocked successfully" }` · DELETE `?blocked_id=` → `{ success: true, message: "User unblocked successfully" }` - asymmetric param location; no self-block guard; no existence check.
**Typed?** No.

## POST /api/cabshare/ratings

Reference: [ratings](../../03-api-reference/cabshare/ratings.md)
Body `{trip_id, ratee_id, score, comment?}` - `score` must be an integer 1-5; requires a prior `accepted` match between ratee and rater on the same trip (either direction), else 403 `You can only rate people you shared this trip with`. Duplicates silently ignored (`ON CONFLICT DO NOTHING`), still 200 `{ success: true, message: "Rating submitted" }`.
**Typed?** No.

## GET/PATCH /api/cabshare/notifications

Reference: [notifications](../../03-api-reference/cabshare/notifications.md)
GET → **`{ success: true, notifications }`** - `SELECT * ... ORDER BY created_at DESC LIMIT 50` - columns inferred from inserts only: `notif_id, user_id, title, message, type (e.g. "waitlist_alert"), is_read (boolean), created_at`.
PATCH body `{notif_id}` - `"all"` marks everything read; otherwise scoped to caller; **no distinction between "marked" and "not found"; no 400 branch**.
**Typed?** No.

## POST /api/cabshare/waitlist

Reference: [waitlist](../../03-api-reference/cabshare/waitlist.md)
Body `{hub_id, travel_date}` → `{ success: true, message: "Added to waitlist" }` - `ON CONFLICT DO NOTHING` (dup requests ignored). Write-only via API; consumed by POST /api/cabshare/trips which alerts and removes waitlisters.
**Typed?** No.

## GET /api/cabshare/stats

**Envelope:** success-wrapped (**public**) · 200 / 500 · reference: [stats](../../03-api-reference/cabshare/stats.md)

`{ success: true, stats }`:
| Field | Type | Meaning |
|---|---|---|
| `totalTrips` | number | COUNT(*) `parseInt`'d |
| `activeTrips` | number | COUNT(*) WHERE status='active' |
| `totalUsers` | number | COUNT(*) of cabshare_users |
| `popularHubs` | `{hub_name: string, trip_count: string}[]` | top 3 hubs by trip count - **`trip_count` is a raw pg COUNT string** (not parseInt'd) |

**Typed?** No - note the inconsistent numeric typing inside `stats`.
