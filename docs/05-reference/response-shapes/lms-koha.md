---
title: "Response shapes: LMS & Koha"
description: "Every response body the Moodle scrapes and the Koha OPAC proxies return, field by field."
---

# Response shapes: LMS & Koha

> **In one line:** Moodle assignment scrapes (raw arrays) and the library's OPAC as JSON (wrapped, minus one type-shape trap in availability).

## POST /api/lms-data

**Envelope:** **raw** - a **bare array**, no envelope · 200 / 400 / 500 · reference: [lms-data](/amazecc-api/03-api-reference/lms-koha/lms-data)

Success: `Assingment[]` (yes, the code's typo) - one entry per assignment event across the **current month's** calendar:

| Field | Type | Meaning |
|---|---|---|
| `name` | string | `${courseCode}/${courseName}/${assignmentName}` breadcrumb |
| `due` | string | "Due:" parent text minus the prefix |
| `done` | boolean | `btn-success` completion button present |
| `day` | number | calendar day |
| `month` | number | from `a[data-day]` |
| `year` | number | from `a[data-day]` |
| `url` | string | event link |
| `teachers` | string[] | course block proctor(s) - **pushed in, not declared in `Assingment`**; also may be `[]` or absent per element (parse-failed elements are dropped entirely) |

Errors: **no `success` field** - 400 `{ error: "Username and password are required." }` · 500 `{ error: "Internal server error" }`. Credentials are in the body, never stored.
**Typed?** Local unexported `Assingment` interface in the route file - dead-simple, no shareable types.

## POST /api/vitol-data

**Envelope:** **raw** - bare array · 200 / 400 / 500 · reference: [vitol-data](/amazecc-api/03-api-reference/lms-koha/vitol-data)

Success: `Assingment[]` - same as lms-data but **current + next month** calendars (deduped by `url`); keys differ: **`opens`** (activity-dates string containing "Opens:"/"Opened:"), `done` ("Finished" quiz attempt marker), and **no `teachers` field**. Body must include `vitolSite` (selects the Moodle instance).
**Typed?** Local unexported `Assingment`.

## GET /api/koha/search

**Envelope:** success-wrapped (public) · 200 / 500 · reference: [koha/search](/amazecc-api/03-api-reference/lms-koha/koha-search)

Query params: `?idx` (index selector - `kw`/`title`/…), `?q`, `?count` (default 20, cap 100), `?offset`. Empty `q` short-circuits to `{ success: true, books: [], total: 0 }` - count/query fields absent.
Otherwise: `{ success: true, books, total, query, offset, count }` where `books[]` = OPAC RSS items:
| Field | Type | Meaning |
|---|---|---|
| `biblionumber` | string | from `link` URL; `""` if unparseable |
| `title` | string | |
| `author` | string | parsed from `By <author>.` in description |
| `publisher` | string | from description `<place> <year>` regex |
| `isbn` | string | dc:identifier with `ISBN:` prefix stripped |
| `coverUrl` | string | first `<img src>` in description |
| `total` | number | `opensearch:totalResults` |

**Typed?** No.

## GET /api/koha/detail

**Envelope:** success-wrapped (public) · 200 / 400 / 500 · reference: [koha/detail](/amazecc-api/03-api-reference/lms-koha/koha-detail)

`?biblionumber=` (validated `^[0-9]+$`): `{ success: true, book }`:

| Field | Type | Meaning |
|---|---|---|
| `biblionumber` | string | echoed |
| `title`, `author`, `publisher`, `edition`, `description`, `isbn`, `subjects[]`, `ddc`, `summary` | mixed | MARC fields 245a/100a/700a/260/250/300/020a/650a/082a/520a; author/isbn joined with separators when repeated |
| `holdings[]` | object[] | from `/public/biblios/<id>/items` - `{itemId (item_id), barcode (external_id), currentLibrary (**home_library_id**), homeLibrary (**holding_library_id**), shelvingLocation, callNumber, status ("Not for loan"/"Damaged"/"Lost"/"Checked out"/"Available"), dateDue (date_due or null), notes}` - note the swapped library names |

**MARC failure still returns 200** with empty fields (allSettled).
**Typed?** No.

## GET /api/koha/availability

**Envelope:** success-wrapped (public) · 200 / 500 · reference: [koha/availability](/amazecc-api/03-api-reference/lms-koha/koha-availability)

`?biblionumbers=comma,separated` (deduped, cap 50, non-numeric dropped): `{ success: true, items }`

<Warning>**`items` changes type by input validity** - `[]` (bare array) when no valid ids; `Record<biblioId, Item[]>` otherwise. Clients must handle both.</Warning>

Item: `{itemId, barcode, homeLibrary (home_library_id), holdingLibrary (holding_library_id), location, callNumber, status, dueDate (checked_out_date or null)}`. Failures per-id are swallowed (allSettled) - failed ids simply missing from the map.
**Typed?** No.

## POST /api/koha/patron

**Envelope:** success-wrapped · 200 / 400 / 401 / 500 · reference: [koha/patron](/amazecc-api/03-api-reference/lms-koha/koha-patron)

Body `{card, password, page?}` - two distinct 200 shapes:

**A. With `page`** (in PAGE_MAP: `summary, charges, details, tags, password, history, checkouts, suggestions, messaging, lists`): `{ success: true, page: <name>, data: PageParse }`
**B. Without/unknown `page`**: `{ success: true, data: { loggedIn: true, patronName, pages: Record<pageName, PageParse> } }` - silently fetches ALL 10 pages sequentially (expensive).

**`PageParse`** = `{ title, patronName, tables: {caption, headers[], rows: string[][]}[], alerts[] }`
Errors: 400 `{ error }` · 401 `{ error: "Invalid card number or password" }` (login page contains auth_error or lacks logout marker). Credentials round-trip only; nothing stored.
**Typed?** No.
