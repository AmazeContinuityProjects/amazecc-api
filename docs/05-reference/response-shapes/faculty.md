---
title: "Response shapes: Faculty Directory"
description: "Every response body the faculty directory routes return, field by field."
---

# Response shapes: Faculty Directory

> **In one line:** the public faculty directory - school list from our DB, live scrape on demand, both rows verbatim.

## GET /api/faculty/schools

**Envelope:** success-wrapped (public, unauthenticated) · 200 / 500 · reference: [faculty/schools](/amazecc-api/03-api-reference/faculty/schools)

Success: `{ success: true, schools }` - `SELECT id, school_name FROM faculty_directory_urls ORDER BY school_name ASC` → `{id, school_name}[]` - **snake_case** keys, deliberately different from the `schoolId` parameter used by scrape.
Error: `{ success: false, schools: [], error: publicErrorMessage(error) }` (500) - `schools: []` present even on failure.
**Typed?** No.

## POST /api/faculty/scrape

**Envelope:** success-wrapped (public, rate-limited 10/min/IP) · 200 / 400 / 404 / 429 / 500 · reference: [faculty/scrape](/amazecc-api/03-api-reference/faculty/scrape)

Body `{schoolId}` - scrapes the VIT faculty directory page (allow-listed via `vitUrl`, 1-2 outbound fetches; if no cards are found it auto-discovers a `*-faculty` subpage and **rewrites `faculty_directory_urls.url`** for next time). Success:

`{ success: true, faculties }` - rows:

| Field | Type | Meaning |
|---|---|---|
| `id` | string | employeeId extracted from the card image/link, else `card-<i>`/`exad-<i>`/`legacy-<i>` |
| `name` | string | |
| `designation` | string | `"Faculty"` when missing |
| `imageUrl` | string | |
| `profileUrl` | string | `https://directorycc.vit.ac.in/faculty/<employeeId>` when known; else the raw card href |
| `email` | string | `""` (only the legacy parser fills it) |
| `employeeId` | string | from image/link numerics; `""` when unparseable |
| `intercom` | string | `""` (only the legacy parser fills it) |

Errors: `400 "schoolId is required"` · `404 "School not found"` · `500 "Failed to fetch faculty list"` (never echoes the upstream message).
**Typed?** Local `RosterFaculty` interface in the route file only.
