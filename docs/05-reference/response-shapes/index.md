---
title: "Response shapes"
description: "Every response body the AmazeCC API can return, field by field - envelope style, types, and the quirks that cut across all 127 routes."
---

# Response shapes

> **In one line:** the complete catalog of what every AmazeCC-API endpoint returns - the envelope, every field, what it means, and whether TypeScript knows it.

This section documents **every response the API can produce**, endpoint by endpoint: envelope style, top-level and nested fields, meanings taken from the code, and a **Typed?** line per route. It is the answer to "what exactly comes out of this endpoint, and can I trust the shape?"

## How to read the catalog

Each category page lists its routes alphabetically. Every route block carries:

- **Envelope** - which of the four response styles the endpoint uses (see below)
- **HTTP codes** - the statuses it can actually emit
- **Fields** - every field on the success path, dot-nested (`attRes.attendance[].courseCode`)
- **Typed?** - which TypeScript interfaces describe the payload (with file paths), or `untyped`

Field meanings come only from the code. Where a field's meaning isn't documented anywhere in the handler or its helpers, the table says so - we don't guess.

## The four envelope styles

| Style | Routes | Body |
|---|---|---|
| **success-wrapped** | most new routes: grades, ffcs, bulk, course-page, curriculum, circulars, od, marks/*, every admin route, gorobo, qbank, club-admin, social, cabshare, Koha, faculty, settings | `{ success: true, ...payload }` on success; `{ success: false, error }` on failure - **even with HTTP 200** |
| **raw payload** | attendance, attendance/htmlparser2, calendar, hostel, events (bare array), docs (raw OpenAPI), status, health, notifications/status, lms-data/vitol-data (bare arrays) | The bare payload, no `success` key; on failure `{ error }` |
| **binary passthrough** | course-page/material, curriculum/download, curriculum/syllabus, circulars/download, events/download, qbank/papers/download/[paperId] | Streams file bytes with `Content-Disposition`; **error bodies are JSON**, never binary |
| **partial/mixed** | login (`message` on 401, `error` on 504), notifications/subscribe and unsubscribe (error branches drop `success: false`), qbank/admin/ocr (errors carry no `success` flag) | Wrapped when designed, raw when inherited - check the route block |

<Warning>
**HTTP status is not the contract - the envelope is.** Many `success: false` bodies arrive with HTTP 200. A handful of endpoints report failures as 200 too (`/api/transport`, `/api/finance` sections). Check `success` (or, on raw routes, HTTP status) before reading anything else.
</Warning>

## Errors: the shapes that recur

| Shape | Where | Contents |
|---|---|---|
| `{ success: false, error }` | Most routes | Machine-ish English message |
| `{ success: false, message }` | `/api/login` 401s, `/api/admin/auth` 401/403/500, `/api/gorobo/seed` 401, `/api/admin/push`, OCR routes, `/api/admin/migrate` POST | Same role as `error` - **key name differs by route** |
| `{ success: false, detail }` | marks/* | A finer-grained reason string alongside `error` |
| `{ success: false, resources/…: [] }` | fresher-resources error path is **HTTP 200** | Failure and success indistinguishable by status |
| `{ error }` alone (no success) | curriculum, calendar, circulars, circulars/download | Raw routes - no `success` to check |

## Rate limiting

Every 429 carries the same body and headers, regardless of route:

```json
{ "success": false, "error": "Too many requests. Try again later." }
```

with `Retry-After`, `X-RateLimit-Limit: 0`, and `X-RateLimit-Remaining: 0`. Sources: `src/lib/rateLimit.ts`.

## PostgreSQL types vs wire types

`node-pg` returns `int8` (including every `COUNT(*)`) as a **string**. Where a number is parseInt'd before sending it is documented; where the raw string is returned (e.g. `cabshare/stats.popularHubs[].trip_count`) it is called out in that route's table.

## Is the API typed?

Honest answer, route by route:

- **Handwritten contract types exist** for the VTOP scrape outputs in `src/types/data/*` (`attendanceItem`, `courseItem`, `grades`, `marks`, `hostel`, `od`, `semTT`, `allgrades`), for `/api/ffcs` (`Schedule`/`ExamItem`), for identity in `src/lib/identity.ts` (`StudentIdentity`), and for the Gorobo back office (`GoroboOrderJson`, `GoroboItem`, `GoroboOrderLine`).
- **Almost everything else is `untyped`** in the literal sense: the route builds a literal and TypeScript never sees a name for it. Those routes say `untyped` with the closest useful type pointer (or none).
- **The runtime types are not the wire contract.** Parser `*Data` types describe intermediate scraper artifacts; `StudentIdentity` describes `/api/whoami`'s normalizer, exactly what's on the wire there - but `social/identity/sync` embeds a small **inline** identity literal instead, and doesn't use it.
- **Name collisions to know about:** two unrelated `RankInfo` (`src/lib/identity.ts` vs `src/lib/parsers/credentials.ts`), two unrelated `CGPA` (`src/types/data/grades.ts` vs `src/types/data/marks.ts`). The join site (`/api/attendance`) uses the marks one.
- **Dead contract shells:** `AllGradesRes`, `LoginRequestBody`, `BusRoute`, `BusPlacement`, `BusStudent`, `TransportRule`, `GoroboWalletEntry`, `ClassRosterEntry`, and the entire `semTT.ts` calendar-analysis island are defined but never referenced by any route.

## Category pages

| Area | Routes | Page |
|---|---|---|
| Auth & System | 11 | [Response shapes: Auth & System](./auth-system.md) |
| Academics & VTOP | 19 | [Response shapes: Academics & VTOP](./academics-vtop.md) |
| Transport & Buses | 2 | [Response shapes: Transport & Buses](./transport-buses.md) |
| Finance | 1 | [Response shapes: Finance](./finance.md) |
| Clubs & Events | 13 | [Response shapes: Clubs & Events](./clubs-events.md) |
| Social (FFCS Partners) | 8 | [Response shapes: Social](./social.md) |
| QBank | 12 | [Response shapes: QBank](./qbank.md) |
| GoRobo Shop | 4 | [Response shapes: GoRobo Shop](./gorobo.md) |
| LMS & Koha | 6 | [Response shapes: LMS & Koha](./lms-koha.md) |
| Faculty Directory | 2 | [Response shapes: Faculty](./faculty.md) |
| CabShare | 10 | [Response shapes: CabShare](./cabshare.md) |
| Admin | 39 | [Response shapes: Admin](./admin.md) |

See also: the [Route index](../routes-index.md) for a flat map of every route, auth requirement and rate limit, and [Types](../types.md) for the VTOP contract types in full.
