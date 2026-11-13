---
title: "Response shapes: Social (FFCS Partners)"
description: "Every response body the social routes return, field by field - pairing state and grants included."
---

# Response shapes: Social (FFCS Partners)

> **In one line:** timetable sharing and the friend finder - mutual pairing secrets, coarse/full visibility, and identity verified server-side on every call.

<Warning>
**Identity is never trusted from the body.** Every call carries VTOP cookies; the server re-derives `ownerKey` from VTOP. `/api/social/semester` is the single exception - it takes no credentials at all.
</Warning>

## GET/POST /api/social/ffcs-match

[Reference page](../../03-api-reference/social/ffcs-match.md) · rate-limited (30/min/IP)

**GET (unauthenticated)** - success: `{ success: true, semesterId, classes }`
| Field | Type | Meaning |
|---|---|---|
| `semesterId` | string | echoed, upper-cased semester id (from VTOP dropdown) |
| `classes` | `ClassRosterEntry[]` | rosters - all classes in the semester, or those `?classIds=` names |
| `classes[].classId` | string | class id with embedded semester code |
| `classes[].courseCode`, `courseTitle`, `courseType`, `slot`, `faculty`, `credits`, `room` | string | offering details - slot is `NIL` for projects |
| `classes[].registerNos` | string[] | reg numbers in the class |
| `classes[].students` | `{regNo, name, handle}[]` | public roster with friend-finder handles |

**POST** - body `{op}` where `op` ∈ `get | publish | visibility | leave | classes`. Success returns `buildState()`:

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `true` |
| `semesterId` | string | |
| `participants` | number | count of discoverable people in the semester |
| `me` | object | `{handle, name, joined: boolean, discoverable: boolean, source: "registered"\|"planned"\|null, classIds[] (max 30), updatedAt: string\|null, changesLeft: number}` - `changesLeft` from the 10-per-24h cap |
| `sections[]` | `SectionMatch[]` | one per caller class (even empty): `{classId, offering: FfcsOffering\|null, registerNos[], people: MatchPerson[]}` |
| `sections[].offering` | `FfcsOffering` | `{classId, code, title, type, credits, room, slot, faculty, facultyId?}` from the FFCS CSV report - `null` when the class isn't in the report |
| `sections[].people[]` | `MatchPerson[]` | `{handle, name, regNo, source}` |
| `overlaps[]` | `OverlapMatch[]` | people sharing ≥2 classes, ranked: participants' `{handle, name, regNo, source, shared, sharedClassIds[], identical: boolean, updatedAt}` |

Errors: `{ success: false, error, ...detail? }` - e.g. `semester_not_supported`, `invalid_op`, `planned_sharing_disabled`, `invalid_visibility`, `not_joined` (404), `no_registered_classes` (422), `change_limit` (429), `report_unavailable` (502), `database_unavailable` (503).
**Typed?** `MatchResult`, `SectionMatch`, `OverlapMatch`, `MatchPerson`, `MatchSource` in `src/lib/ffcsMatch.ts`; `ClassRosterEntry`/`ClassRosterStudent` in `src/lib/ffcsMatchDb.ts`; `FfcsOffering`/`FfcsReport` in `src/lib/ffcsReport.ts`.

## POST /api/social/identity/sync

**Envelope:** success-wrapped · 200 / 400 / 401 / 422 / 429 / 502 · reference: [identity/sync](../../03-api-reference/social/identity-sync.md)

Success - note the **inline** identity literal (`StudentIdentity` is **not** used by this route):

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `true` |
| `identity` | object | 7-key literal: `{ownerKey (maskUserID regNo), handle (AMZ-XXXX-XXXX), displayName, semesterId, semesterLabel, derivedAt (from stored publishedAt), slotmapVersion}` |
| `semesterSource` | `"proposed_validated" ∣ "first_available" ∣ "selected_option"` | how the semester was resolved (`SemesterResolution.source`) |
| `version` | number | timetable version counter |
| `busyMap` | `BusyMap` | `Record<string, BusyEntry>` - keys `"DAY:SLOTID"`, entries `{c?, t?, v?}` (course/type/venue abbreviations) |
| `courses[]` | `SocialCourse[]` | `{code, title, venue, ltpjc, category, componentType ("Lab Only"/"Embedded Theory"…), classId (e.g. CH2026270102069), faculty}` |
| `peers[]` | object[] | mutual pairings: `{handle, name, visibility: "coarse"\|"full", shared: true, lastPublishedAt: string\|null, semesterId: string\|null (null unless peer published this term), isSelf: false}` - degrades to `[]` on grant-layer failure |
| `grantSecrets[]` | object[] | plaintext secrets for grants the caller participates in: `{grantId, secret, peerHandle, visibility, createdAt}` - handed out exactly here and at pair/claim |

Errors: 400 (`missing_credentials`, `unknown_slot` with `invalidKeys`/`slotmapVersion`) · 401 (`vtop_identity_unresolved`, `vtop_session_expired`) · 422 (`semester_not_offered` / `semester_mismatch`) · 502 (`semester_list_unavailable`, `timetable_parse_failed`, `vtop_unavailable`) · 429.
**Typed?** `BusyMap`, `SocialCourse`, `SocialVisibility`, `SemesterResolution` in `src/lib/socialTypes.ts`; the `identity` literal is untyped.

## POST /api/social/pair/claim

**Envelope:** success-wrapped · 200 / 400 / 401 / 404 / 409 / 429 (30/hour/IP) / 502 · reference: [pair/claim](../../03-api-reference/social/pair-claim.md)

Body `{handle, visibility: "coarse"|"full", expiresInMinutes?}` - `visibility` is exactly `"full"` for full, else coarse; `expiresInMinutes` > 0, clamped to one year. Success creates (or idempotently re-claims) a **mutual** grant:

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `true` |
| `grantId` | string | grant id - re-claim returns the same grantId without rotating the secret |
| `secret` | string | plaintext grant secret - **shown exactly here and at identity/sync** |
| `created` | boolean | whether this call minted the grant |
| `visibility` | `"coarse" ∣ "full"` | as requested |
| `peer` | object | `{handle (uppercased input), name, lastPublishedAt: string\|null, semesters: string[] (distinct shared published semesters)}` |

Errors: `invalid_handle_format` (400 - expected `AMZ-XXXX-XXXX`) · `handle_not_found` (404 - existence not disclosed) · `already_self` / `grant_limit_reached` (409 - 200 max) · 429 (30/hour).
**Typed?** `SocialVisibility`; `GrantRow`/`CreateGrantResult` in `src/lib/socialGrants.ts` (response literal untyped).

## POST /api/social/timetable

**Envelope:** success-wrapped · 200 / 400 / 401 / 403 / 404 / 429 (120/min/IP) / 502 · reference: [timetable](../../03-api-reference/social/timetable.md)

Body `{handle | secret, semester?, semesterLabel?}` - access is authorized by the presented grant secret ANDed with both participants' membership; session alone is insufficient. Semester defaults to the campus-cached current term. Success:

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `true` |
| `identity` | object | **no `owner_key`**: `{handle, displayName, semesterId, semesterLabel (or "" when body.semester supplied), publishedAt, slotmapVersion}` |
| `visibility` | `"coarse" ∣ "full"` | the shared grant row - change applies both ways |
| `stale` | boolean | `true` when `publishedAt` is older than `STALE_AFTER_DAYS` (14) |
| `version` | number | timetable version counter |
| `busyMap` | `BusyMap` | full map when `full`; **keys only** (`Record<string, {}>`) when `coarse` |
| `courses` | `SocialCourse[]` | **`[]` when coarse** - a coarse peer is never serialized with course data |

Errors: 400 `missing_grant` · 403 `grant_invalid` (unknown/revoked/expired) / `not_a_participant` (same status+error for both sides - anti-probing) · 404 `handle_not_found` / `no_current_semester` / `no_timetable_for_semester`.
**Typed?** `BusyMap`, `SocialCourse`, `SocialVisibility`, `STALE_AFTER_DAYS` in `src/lib/socialTypes.ts`.

## POST /api/social/people

**Envelope:** success-wrapped · 200 / 400 / 401 / 404 / 429 (20/min/IP - tightest read) / 502 · reference: [people](../../03-api-reference/social/people.md)

Body `{handle}` - exact-match lookup only (no name search - directory-enumeration protection). Success: `{ success: true, person }` where `person` = `{handle, displayName, alreadyPaired: boolean}` - `alreadyPaired` is `grant_count > 0`. `owner_key` deliberately absent.
Errors: `invalid_handle_format` (400) · `handle_not_found` (404).
**Typed?** No.

## POST /api/social/grant/visibility

**Envelope:** success-wrapped · 200 / 400 / 401 / 403 / 404 / 429 (60/min/IP) / 502 · reference: [grant/visibility](../../03-api-reference/social/grant-visibility.md)

Body `{grantId, visibility}` - either partner may set it; one shared row applies to both directions. Secret NOT required (grantId + session + participant check). Success: `{ success: true, grantId, visibility }`.
Errors: `missing_grant_reference` / `invalid_visibility` (400) · `not_a_participant` (403) · `grant_not_found` (404).
**Typed?** `SocialVisibility`; `GrantRow` internal to `src/lib/socialGrants.ts` (secret fields never serialize).

## POST /api/social/grant/revoke

**Envelope:** success-wrapped (idempotent) · 200 / 400 / 401 / 403 / 404 / 429 (60/min/IP) / 502 · reference: [grant/revoke](../../03-api-reference/social/grant-revoke.md)

Body `{grantId, secret?}` - revokes the single row, severing **both** directions, forever (unpair-and-recant doesn't exist - re-pair instead). `secret` is required by the body check but not used for authorization. Revoking an already-revoked grant returns 200 anyway. Success: `{ success: true, grantId, revoked: true }`.
**Typed?** `GrantRow` internal.

## GET /api/social/semester

**Envelope:** success-wrapped (**unauthenticated**) · 200 / 404 / 503 · reference: [semester](../../03-api-reference/social/semester.md)

Success: `{ success: true, semesterId, semesterLabel, resolvedAt: string|null }` - the campus-cached current semester derived from VTOP's dropdown during any derivation (`app_config`), **not per-student** - one row shared by every student. 404 `no_current_semester` (`No derivation has run yet`) · 503 `database_unavailable`.
**Typed?** No.
