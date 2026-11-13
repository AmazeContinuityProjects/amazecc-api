---
title: "Conventions: envelopes, errors, limits"
description: "The response envelope styles, error taxonomy, rate limits, and status codes used across the API."
---

# Conventions: envelopes, errors, limits

> **In one line:** three envelope styles, one rule — `success:false` always means failure — and a short list of rate limits.

## The three response styles

Every route declares its style on its reference page. The styles:

| Style | Example routes | Body shape |
|---|---|---|
| **success envelope** | `/api/grades`, `/api/od`, `/api/gorobo/*`, most admin routes | `{ success: true, ...payload }` |
| **legacy raw** | `/api/attendance`, `/api/hostel`, `/api/calendar`, `/api/events`, `/api/docs`, `/api/health`, `/api/status`, `/api/lms-data` | raw payload, no `success` wrapper |
| **binary passthrough** | `/api/curriculum/download`, `/api/curriculum/syllabus`, `/api/circulars/download`, `/api/events/download`, `/api/qbank/papers/download/[paperId]` | raw bytes + `Content-Disposition: attachment` |

Within the success envelope the **partial** convention also exists:
`{ error, success: false }` is a failure with HTTP 200. Two routes additionally return
`{ status: 'payment_form', html, tcUrl }` for payment passthroughs, and `/api/events` returns a
bare JSON array.

## The error taxonomy

| Condition | HTTP | Body |
|---|---|---|
| No/invalid credentials on a protected route | 400 or 401 | `{ success: false, message }` or `{ success: false, error }` |
| VTOP session expired | 401/502 | `{ success: false, error: 'invalid csrf / session' }` or `{ success: false, message: 'Not logged in' }` |
| Rate limited | 429 | `{ success: false, error: 'Too many requests …' }` + `Retry-After` header |
| Circuit breaker (pool starved or auth blowout) | 503 | `{ success: false, error: 'Database temporarily unavailable…' }` |
| VTOP unreachable/TLS/parse change | 502/500 | `{ success: false, error: '…' }` |

**The rule:** if `success` is false, the request failed — even with HTTP 200. Check `success` first. If `success` is absent (legacy raw routes), check HTTP status.

## Rate limits

In-memory sliding-window limiters, per instance (not shared across replicas — see
[Operations → Security footguns](../04-operations/security.md)). Limits that protect real VTOP:

| Route | Limit | Why |
|---|---|---|
| `POST /api/login` | 5 / min / IP | Captcha + VTOP press |
| `POST /api/admin/auth` | 5 / min / IP | Admin credential brute force |
| `POST /api/migrate` | 3 / 5 min / IP | One-shot maintenance tool |
| `POST /api/cabshare/auth` | 5 / min / IP | Same class of protection |
| `POST /api/social/pair/claim` | 30 / hour / IP | Pairing spam |
| `POST /api/marks/sync` | 20 / min / IP | Class-table writes |
| `POST /api/marks/stats`, `/api/marks/tokens` | 60 / min / IP | Class-read load |
| `POST /api/social/identity/sync` | 20 / min / IP | Profile fan-out |
| `POST /api/social/timetable` | 120 / min / IP | Busy-map reads |
| `POST /api/faculty/scrape` | 10 / min / IP | Public scrape, contained |
| `POST /api/club-admin/feed/promote` | 30 / min / IP | Public toggle, contained |
| `POST /api/gorobo/orders` | 5 / min / IP | Order spam |

Every limit 429s with a `Retry-After` hint when knowable.

## Content types

- Request bodies are **JSON** at the HTTP boundary. Inside, the API re-encodes them as
  `application/x-www-form-urlencoded` for VTOP. You never need to care — except when reading
  the curl examples, which send JSON always.
- Responses are usually `application/json; charset=utf-8`. File downloads vary (`application/pdf`, `application/zip`, `application/octet-stream`).

## The one rule you will actually remember

> `curl -X POST <route> -d '{"success":true}' ` → check `success`. If false, stop.

## Where to next

- **[Authentication overview](../01-authentication/index.md)** — which credentials your request needs.
- **[API Reference → Auth & System](../03-api-reference/auth-system/index.md)** — the login doorway.
