---
title: "Response shapes: Clubs & Events"
description: "Every response body the events proxy and club ecosystem return, field by field."
---

# Response shapes: Clubs & Events

> **In one line:** Eventhub proxies (mostly raw bodies, never enveloped) and the club ecosystem (success-wrapped, SQL rows verbatim).

<Warning>
**Events routes answer raw** - the only envelope-free family left. `register` answers a discriminated `status` string; `preview` and `profile` bare objects; `events/download` bytes. Client code must branch on `status`/`reason`, not on `success`.
</Warning>

## GET /api/events

**Envelope:** raw - a **bare JSON array** · 200 / 500 · reference: [events](../../03-api-reference/clubs-events/events.md)

Each element (from `#events .card` scrape):

| Field | Type | Meaning |
|---|---|---|
| `eid` | string | event id (`button[name="eid"]`); cards without it are skipped |
| `title` | string | card title |
| `eligibility` | string | who may register; `''` if absent |
| `type` | string | e.g. `Online` - parenthesized text with parens stripped |
| `date` | string | event date; `''` if absent |
| `location` | string | venue; `''` if absent |
| `price` | string | fee; `''` if absent |
| `posterUrl` | string | absolute EventHub image URL; may be `''` |

**Typed?** No.

## POST /api/events/login

**Envelope:** success-wrapped (200) · 200 / 400 / 401 / 500 · reference: [events/login](../../03-api-reference/clubs-events/events-login.md)

Success: `{ success: true, jsessionid }` - `jsessionid` is the compound cookie fragment (`"<JSESSIONID>[; cookiesession1=<c>]"`). Error branches: 400 raw `{ error }` (no success flag!) · 401 `{ success: false, error: "Failed to authenticate with Event Hub. Please check your credentials." }` (EventHub returns 200 + login page for bad credentials; detected via `looksLikeLoginPage`).
**Typed?** Response untyped; `EventHubCredentials` type exists for the request side (`src/lib/eventHubAuth.ts`).

## POST /api/events/profile

**Envelope:** raw - `{ events: [...] }` on success, **no `success` flag** · 200 / 401 / 500

`events[]` (registered events, from `#regTable`):

| Field | Type | Meaning |
|---|---|---|
| `name` | string | event name (room 1) |
| `eid` | string \| null | event id from row buttons/links; `null` for past/closed registrations |
| `orderId` | string | order id (room 2); rows lacking it are skipped |
| `date` | string | event date (room 3) |
| `venue` | string | venue (room 4) |
| `time` | string | event time (room 5) |
| `paymentStatus` | string | `"Pay Now"` if a showPaymentTC link resolved, else the cell text (`Paid`, `Free Event`…) |
| `receiptId` | string \| null | from `/receipt/<id>` href |
| `certificateId` | string \| null | from `getCertificate/<id>` href |
| `receiptUrl` | string \| null | absolute EventHub URL |
| `certificateUrl` | string \| null | absolute |
| `payNowUrl` | string \| null | absolute |
| `payLaterLink` | literal `null` | always |

Failure: 401 `{ error, reason, reauthenticate? }` - `reason` ∈ `session_expired` (with `reauthenticate: true` - jsessionid expired) or `invalid_credentials`; plain 401 `{ error }` when no cookie could be built.
**Typed?** No.

## POST /api/events/preview

**Envelope:** raw · 200 / 400 / 401 / 500 · reference: [events/preview](../../03-api-reference/clubs-events/events-preview.md)

Success: `{ eid, imageSrc, description, metaDetails }`
`imageSrc` = `https://eventhubcc.vit.ac.in/EventHub/image/?id=<eid>` (public poster) · `description` = `.list-group-item` labelled "Event Description" or `''` · `metaDetails` = `Record<string,string>` - every *other* labelled `.list-group-item` (participants, date, venue, time, conducted by…), plus `Total Fees` from `#EventFees1` (defaults `'0'`).
Errors: 400 `{ error: "Missing eid" }` · 401 `{ error, reason }` (`missing_credentials` / `invalid_credentials`).
**Typed?** No.

## POST /api/events/register

**Envelope:** raw - success carries a discriminated `status` · 200 / 400 / 401 / 500 / 502

| `status` | Extra fields | Meaning |
|---|---|---|
| `already_registered` | `message` | no register button found - already registered or closed |
| `payment_form` | `html` | auto-submitting EventHub payment page with `<base href="…/EventHub/">` injected - embed it |
| `payment_required` | `url` | redirect to a pinned payment gateway URL (billdesk/paytm/razorpay) |
| `success` | `message` | registered |
| `redirect` | `url` | generic 302/303 fallback |

Errors: 400 `{ error: "Missing eid" }` / `Registration failed with status <n>` · 401 `{ error, reason, reauthenticate? }` (`session_expired` → `reauthenticate: true`) · 502 `{ error: "Unexpected payment redirect target" }` (URL failed the eventhub allow-list).
**Typed?** No.

## POST /api/events/paynow

**Envelope:** raw · 200 / 400 / 500 · reference: [events/paynow](../../03-api-reference/clubs-events/events-paynow.md)

Success: `{ status: "payment_form", html, tcUrl }` - `html` is a self-submitting hidden login form to EventHub's mainDashboard; `tcUrl` echoes the pinned payment/T&C URL so the client can redirect after login. No session is built here.
Errors: 400 `{ error }` (`Missing username, password, or url` / `Invalid url` for non-eventhub URLs).
**Typed?** No.

## POST /api/events/download

**Envelope:** **binary** - bytes stream, never JSON · 200 / 400 / 401 / 500

Content-Type from upstream (default `application/pdf`); `Content-Disposition` upstream or `attachment; filename="<Certificate|Receipt>.pdf"` based on `url` containing `certificate`. Errors are JSON: 400 (`Missing username or jsessionid` / `Missing url` / `Invalid url`), 401 (`reason` invalid/missing), 500 (`Failed to download file from Event Hub. Status: <n>`).
**Typed?** No.

## GET /api/clubs/details

**Envelope:** success-wrapped (public, unauthenticated, no query params) · 200 / 500 · reference: [clubs/details](../../03-api-reference/clubs-events/clubs-details.md)

Success: `{ success: true, clubs }` - raw rows of `club_details` ordered by `club_name` (column set isn't enumerated in repo; known columns from related routes: `club_id, club_name, mission, description, hiring_process, website, recruitment_link, instagram, whatsapp, poc, email, poc_phone, logo_url, updated_at`).
**Typed?** No.

## GET/POST /api/club-admin/details

GET public with mandatory `?club_id`: `{ success: true, details }` - single row or 404 `Club not found`. POST (club Bearer): `{ success: true, message: "Details updated successfully" }` - body keys `mission, description, hiring_process, website, recruitment_link, instagram, whatsapp, poc, email, poc_phone, logo_url` (`logo_url || null`); optional `club_id` override for reps (403 for non-reps).
**Typed?** No.

## GET/POST/DELETE /api/club-admin/feed

GET **public** with optional `?club_id` (and `?vtop_id` for promotion state): `{ success: true, feed }` - `club_feed` rows (explicit columns: `club_id, event_id, content, links (JSON), image_urls (JSON), posted_by`, implied `id, created_at`) + two computed columns:
`promote_count` (COUNT, int8 → **string** from pg) · `has_promoted` (boolean; `false` for anonymous).
POST (club Bearer): `{ success: true, post }` - `RETURNING *` of insert `{club_id, event_id (nullable), content (required), links[], image_urls[], posted_by}`.
DELETE (club Bearer): `{ success: true }` - `?post_id` param; super-club-rep bypasses membership check.
Errors: `401 Unauthorized Club Access` · `403 Unauthorized for this club` · `400 Content is required` / `Post ID is required` · `404 Post not found`.
**Typed?** No.

## POST /api/club-admin/feed/promote

**Envelope:** success-wrapped · public · rate-limited (30/min/IP) · 200 / 400 / 429 / 500

Success toggles - two literal shapes: `{ success: true, promoted: true }` (inserted) or `{ success: true, promoted: false }` (deleted). Body `{post_id, vtop_id}` both required; `vtop_id` must match `^[0-9A-Za-z]{6,15}$`; hashed with `promoteHash` = `HMAC-SHA256(ID_SALT, 'post-promotion:'+vtop_id)` hex[:16]. Any caller may toggle any post - no club check.
**Typed?** No.

## GET/POST /api/club-admin/landing-page

GET public with mandatory `?club_id`: `{ success: true, landingPage: rows[0] || null }` - absent row yields `null`, not 404. POST (club Bearer): `{ success: true, landingPage }` (the upserted row) - body `theme` (default `{ primary_color: '#3B82F6', mode: 'light' }`), `showcase_projects[]`, `popular_events[]` - written as JSONB.
**Typed?** No.

## GET/POST/DELETE /api/club-admin/reps

GET **requires club Bearer** (the exception): `{ success: true, reps, isSuperRep }` - rows `{id, vtop_id, role, created_at}` + `isSuperRep` (token role, token clubs[] entry, or DB role).
POST (super-club-rep only): upsert `{ success: true, message: "Representative added/updated successfully" }` - body `vtop_id` (uppercased), `role` (`super-club-rep` honored, others → `representative`), optional `club_id`.
DELETE (super-club-rep only): `{ success: true, message: "Representative removed successfully" }` - query `?vtop_id`, `?club_id` optional; self-removal → 400 `Cannot remove yourself`.
**Typed?** No.
