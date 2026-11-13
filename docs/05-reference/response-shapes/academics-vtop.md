---
title: "Response shapes: Academics & VTOP"
description: "Every response body the Academics & VTOP endpoints return, field by field, and which TypeScript interfaces describe them."
---

# Response shapes: Academics & VTOP

> **In one line:** what comes back from every academics endpoint - usually VTOP tables turned into JSON, sometimes a raw envelope, sometimes bytes.

<Note>
Typed coverage is best in this section: the VTOP page contracts live in `src/types/data/*`. The outer envelopes themselves are untyped almost everywhere - only the rows you deserialize into those interfaces carry real types.
</Note>

## POST /api/whoami

**Envelope:** success-wrapped (200) · 400 / 500
[Reference page](/amazecc-api/03-api-reference/academics-vtop/whoami)

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `true` only when all 10 VTOP sources parsed cleanly; **partial failure still returns 200** with `success: false` |
| `fetchErrors` | object | `source -> message` for each failed source; absent when everything worked |
| `regNo` | string \| null | register number (falls back to application number) |
| `name` | string \| null | from student profile |
| `mobile`, `dob`, `gender`, `bloodGroup` | string \| null | profile basics |
| `photoBase64` | string \| null | base64 photo payload |
| `isHosteller` | boolean | always emitted (defaults `false`) |
| `program`, `nationality`, `nativeLanguage`, `nativeState`, `community`, `religion`, `caste`, `physicallyChallenged`, `aadharNumber` | string \| null | profile details |
| `currentAddress`, `permanentAddress`, `father`, `mother` | `KeyValueRow[]` | `{label, value}[]` cards; empty array means the VTOP section was absent |
| `proctor` | `Official \| null` | merged proctor card (student profile + viewProctorDetails; per-field non-null wins) - see below |
| `hodDean` | `Official[]` | HoD/Dean people - see below |
| `credentials` | `AccountCredential[]` | accounts issue credentials (portal credentials VTOP surfaces to the student) |
| `ranks` | `RankInfo[]` | `{name, rank}` honors/positions |
| `apaar` | `ApaarInfo \| null` | APAAR id block; `{hasApaar, fields[], tables[]}`; `null` when `hasApaar` is false |
| `bank` | `BankInfo \| null` | bank account block; `{name?, branch?, address?, fields[]}`; `null` when all empty |
| `contact` | `ContactCard[]` | HRMS contact offices: `{office, description, email?}` |
| `contactTitle` | string | present only when a title parsed |
| `acknowledgement` | object | acknowledgment card: `{title?, documents[], applicationNo?, registerNo?, programme?, branch?, campus?}`; absent when empty |
| `dayboarder` | object | `{title?, fields?}` - raw dayboarder form, minus `_csrf`/`authorizedID`; absent when empty |
| `eptSchedule` | object | exam schedule page parse: `{title?, tables?, keyValuePairs?, formFields?, messages?, message?}`; absent when empty |

**`Official`** = `{ role: string|null, name: string, designation: string, email: string, phone: string, school: string, cabin: string, department: string, intercom: string, facultyId: string|null, photoBase64: string|null, extras?: KeyValueRow[] }`

**`AccountCredential`** = `{ account: string, username: string, password: string, url: string|null, venueDate: string, seatLocation: string }`

**`ApaarInfo`** = `{ hasApaar: true, fields: KeyValueRow[], tables: VtopTable[] }` where **`VtopTable`** = `{ caption?: string, headers: string[], rows: Record<string,string>[] }`

**`BankInfo`** = `{ name?: string, branch?: string, address?: string, fields: KeyValueRow[] }`

**Typed?** Yes for the wire format itself - `StudentIdentity`, `Official`, `AccountCredential`, `RankInfo`, `ApaarInfo`, `BankInfo`, `KeyValueRow`, `VtopTable` in `src/lib/identity.ts`; `ContactCard` in `src/lib/parsers/contact.ts`; `ParsedVtopPage` in `src/lib/parsers/auto-parse.ts`. The route's `success`/`fetchErrors` wrapper is hand-rolled.

<Check>One 200, ~10 VTOP pages. If `success` is false with HTTP 200, look at `fetchErrors` before assuming your session died.</Check>

## POST /api/attendance

**Envelope:** raw (not success-wrapped) · 200 / 500
[Reference page](/amazecc-api/03-api-reference/academics-vtop/attendance)

| Field | Type | Meaning |
|---|---|---|
| `attRes.semester` | string | echo of the requested `semesterId` |
| `attRes.attendance[]` | `attendanceItem[]` | one row per **timetable-registered** course - attendance-only courses not in the timetable are dropped |
| `attRes.attendance[].slNo` | string \| null | serial number |
| `attRes.attendance[].courseCode` | string | course code (tests `L` prefix for lab) |
| `attRes.attendance[].courseTitle` | string | course name |
| `attRes.attendance[].courseType` | string \| null | course type code |
| `attRes.attendance[].slotName` | string | slot(s), or `NILL` |
| `attRes.attendance[].faculty` | string \| null | faculty name |
| `attRes.attendance[].registrationDate` | string \| null | VTOP date string |
| `attRes.attendance[].attendanceDate` | string \| null | VTOP date string |
| `attRes.attendance[].attendedClasses` | number \| null | parseInt of VTOP cell |
| `attRes.attendance[].totalClasses` | number \| null | parseInt of VTOP cell |
| `attRes.attendance[].attendancePercentage` | string | **raw 0-100 VTOP text** - never parsed to a number |
| `attRes.attendance[].viewLink` | string \| `{date, status}[]` \| null | polymorphic: raw `onclick` attr, replaced by per-date detail array `{date, status}[]` after the fan-out, stays raw string if the detail fetch fails, `null` when absent |
| `attRes.attendance[].classId` | string \| null | sem-prefixed class id (e.g. `CH2026270102069`) from timetable merge |
| `attRes.attendance[].credits` | string \| null | 5th token of LTPJC (from timetable) |
| `attRes.attendance[].slotVenue` | string \| null | last `<building>-<room>` match from timetable |
| `attRes.attendance[].category` | string \| null | course category (e.g. `PCC`) |
| `marksRes` | `{courses, cgpa}` | marks slice for the same semester (see marks shapes below) |

<Warning>**No `success` key anywhere** - raw envelope. On failure you get HTTP 500 with `{ error: "Internal server error" }`. 400/401 advertised in the OpenAPI stub are never emitted.</Warning>

**Typed?** `attendanceItem`, `courseItem`, `attendanceRes` in `src/types/data/attendance.ts`; `CourseItem`, `AssessmentItem`, `CGPA` in `src/types/data/marks.ts`. Outer envelope untyped.

## POST /api/attendance/htmlparser2

**Envelope:** raw · 200 / 500 - identical contract to `/api/attendance` (HTML is parsed with htmlparser2/css-select instead of cheerio; same merge, same polymorphic `viewLink`, same raw envelope).
[Reference page](/amazecc-api/03-api-reference/academics-vtop/attendance-htmlparser2)

<Note>Side effect you can't see in the payload: records your enrollment (`recordEnrollment`) which feeds `/api/marks/stats` authorization. Failures are logged, never thrown.</Note>

## POST /api/grades

**Envelope:** success-wrapped · 200 / 500
[Reference page](/amazecc-api/03-api-reference/academics-vtop/grades)

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `true` on success |
| `overall.cgpa` | `CGPA` | **VTOP's published CGPA, quoted verbatim - not reconstructable**: `{creditsRegistered?, creditsEarned?, cgpa?, grades?: {S,A,B,C,D,E,F,N?: number}}` (fields only when the row regex matched; `grades` letters always set when row found, NaN possible) |
| `overall.curriculum` | `CurriculumItem[]` | `{basketTitle, creditsRequired, creditsEarned}` per credits basket - tables `#fixedTableContainer` eq(5) and eq(6) |
| `semesters` | `GradeResultsMap` | `Record<semesterId, SemesterGradeResult \| null>` |
| `semesters.<sem>.gpa` | string \| null | semester GPA |
| `semesters.<sem>.grades[]` | `GradeItem[]` | one per course: `{slNo, courseCode, courseTitle, courseType, grandTotal, grade, courseId, details?, distributionType?, creditsEarned?, examMonth?, resultDeclared?, effectiveCourseType?}` |
| `GradeItem.details[]` | `GradeBreakdown[]` | `{slNo, component, maxMark, weightagePercent, status, scoredMark, weightageMark}` |
| `GradeItem.range` | `GradeRange \| null` | `{S,A,B,C,D,E,F: string}` mark-band table |
| `semesters.__unmapped_effective__` | `SemesterGradeResult` | synthetic bucket for effective-grade rows that matched no course (`gpa: null`) |

**Typed?** `CGPA` (grades variant), `CurriculumItem` in `src/types/data/grades.ts`; `GradeResultsMap`, `SemesterGradeResult`, `GradeItem`, `GradeBreakdown`, `GradeRange` in `src/types/data/allgrades.ts`.

<Note>`/api/all-grades` is served through this handler now - the app normalizes it via `adaptUnifiedGradesResponse()`.</Note>

## POST /api/ffcs

**Envelope:** success-wrapped · 200 / 400 / 500
[Reference page](/amazecc-api/03-api-reference/academics-vtop/ffcs)

Section filter in the body: `section: "registration" | "feedback" | "wishlist" | "schedule" | "qcm" | "qcm-view" | "all"` (default `all`). Keys for sections you didn't ask for are **absent** from the JSON.

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | always `true` on 200 - individual sections may contain `{error}` entries |
| `registrationSchedule` | object | `{ success: true, ...ParsedVtopPage }` - student's class registration schedule page (hostelDetails page, `verifyMenu`) |
| `feedbackStatus` | object | `{ success: true, semesterId, ...FeedbackStatusData }` - or without `semesterId`: `{ title, semesters[], feedbackTable[] }` |
| `feedbackStatus.semesters[]` | `SemesterOption[]` | `{value, text, selected}[]` from `#semesterSubId` options |
| `feedbackStatus.feedbackTable[]` | `FeedbackRow[]` | `{feedbackType, midSemester, teeSemester}` - GA/EE/assignment feedback status per semester |
| `feedback` | object | mid/end-sem curriculum & course feedback booleans: `{ MidSem: {Curriculum, Course}, EndSem: {Curriculum, Course} }` - `true` means "feedback completed" |
| `wishlist` | object | `{ success: true, semesters: Record<semesterText, ParsedVtopPage ∣ {error}> }` - per wishlist semester |
| `schedule` | object | `{ semester, Schedule }` where `Schedule = Record<examType, ExamItem[]>` - e.g. `"CAT 1" -> [...]` |
| `schedule.Schedule[][].courseCode` / `courseTitle` / `classId` / `slot` / `examDate` / `examSession` / `reportingTime` / `examTime` / `venue` / `seatLocation` / `seatNo` | string | exam sitting row |
| `qcmView` | object | `{ success: true, semesters: {value,text}[], data: Record<semId, {semester, tables?, keyValuePairs?, messages?, plainText?} ∣ {semester, error}> }` - QCM view per semester |
| body `section` absent | - | top-level `success: true` + whatever sections were requested |

**Typed?** `ParsedVtopPage` (`src/lib/parsers/auto-parse.ts`), `FeedbackStatusData` (`src/lib/parsers/feedback-status.ts`), `Schedule` / `ExamItem` (`src/types/data/schedule.ts`), `FeedbackStatus`-ish shape in `src/types/data/grades.ts` (mirror; the route emits raw booleans).

<Warning>Heaviest route in the codebase (\~17 KB, Fans out to VTOP once per wishlist + QCM semester). The `success` envelope does **not** protect you from section-level `{error}` payloads.</Warning>

## POST /api/bulk

**Envelope:** success-wrapped · 200 / 400 / 500
[Reference page](/amazecc-api/03-api-reference/academics-vtop/bulk)

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `true` when at least one endpoint ran; unknown names in `endpoints` are silently dropped |
| `results` | object | keyed by requested endpoint name; each value is that proxy's body |
| `results.hostel-counselling` | object | `{ success: true, ...ParsedVtopPage }` (hostel counselling page) |
| `results.registration-schedule` | object | `{ success: true, ...ParsedVtopPage }` |
| `results.exc-registration` | object | `{ success: true, semesters: Record<semText, ParsedVtopPage ∣ {error}> }` |
| `results.course-completion` | object | `{ success: true, semesters: Record<semText, ParsedVtopPage ∣ {error}> }` |
| `results.<any-of-the-4>` on failure | object | `{ success: false, error }` - **the batch stays 200** |
| `results.<unknown>` | absent | silently omitted |

**Typed?** No wire types; bodies are `ParsedVtopPage`-derived (untyped at the boundary). `ProxyOutcome`/`ProxyCreds` in `src/lib/vtop-proxy.ts`. The OpenAPI comment's `bank-info` example is bogus - it is not a supported endpoint.

## POST /api/course-page

**Envelope:** success-wrapped · 200 / 400 / 500 / 502
[Reference page](/amazecc-api/03-api-reference/academics-vtop/course-page)

Body-dependent response - four shapes depending on `formData`:

| Variant | Keys |
|---|---|
| Initial page (no `formData`) | `{ success: true, title, semesters: SemesterOption[], formFields: Record<name, {value, type: "select", label, options?}> }` |
| Detail/materials AJAX (`formData` set) | `{ success: true, ...parsed, results: { ...parsed, classOptions, materials } }` - parsed keys duplicated at top level **and** inside `results`; **read `results`** |
| Dropdown-chain AJAX (`getCourseForCoursePage`, `getSlotIdForCoursePage`, `getFacultyForCoursePage`) | `{ success: true, results: parsed }` - parsed only |
| Failure | `{ success: false, error }` (500/502) - 400s carry no `success` flag |

`classOptions[]` = `{slNo, classGroup, courseCode, courseTitle, courseType, classId, slot, faculty, viewParams: {semSubId, erpId, classId}}`

`materials` = `{semesterSubId, classId, courseId, courseType, syllabus: {courseId, courseType} | null, rows: CoursePagePlanRow[], uploadedCount: number}` with `CoursePagePlanRow` = `{slNo, date, slot, topic, materials: CoursePageMaterialRef[]}` and `CoursePageMaterialRef` = `{label, materialId, materialDate (dd-mm-yyyy), classId, semSubId}`

**Typed?** `CoursePageData`, `SemesterOption` (`src/lib/parsers/course-page.ts`), `ParsedVtopPage` (`src/lib/parsers/auto-parse.ts`), `CourseClassOption` (`src/lib/parsers/course-classes.ts`), `ParsedCoursePageMaterials` and friends (`src/lib/parsers/course-page-materials.ts`). Route literal untyped.

## POST /api/course-page/material

**Envelope:** binary passthrough · 200 (bytes) / 400 / 500 / 5xx≥500→502
[Reference page](/amazecc-api/03-api-reference/academics-vtop/course-page-material)

| Header | Contents |
|---|---|
| `Content-Type` | VTOP's content-type (default `application/octet-stream`) |
| `Content-Disposition` | `attachment; filename="<safeFilename>"` - from body `filename` → VTOP header → `vtop-<action>` |
| `Cache-Control` | `private, no-store` |

Body `action`: `reference-material` (`/vtop/downloadPdf` - needs `semSubId, classId, materialId, materialDate`), `syllabus` (`/vtop/courseSyllabusDownload` - `courseID, courseTYPE`), `course-plan` (course plan Excel), `all-materials` (zip), `general-materials` (\~657 KB descriptor zip). `semSubId` is accepted as alias of `semesterSubId`/`semesterId`.

**Error bodies are JSON**, never binary: `{ success: false, error }`. VTOP 4xx/5xx → 502/VTOP's status.

**Typed?** Untyped.

## POST /api/curriculum

**Envelope:** success-wrapped · 200 / 400 / 500
[Reference page](/amazecc-api/03-api-reference/academics-vtop/curriculum)

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `true` |
| `pageCsrf` | string | the page's own `input[name=_csrf]` (falls back to caller's csrf) - needed for the per-category calls |
| `title` | string | first `<h3>` |
| `totalCredits` | number | parsed from `Total Credits: N` (0 when absent) |
| `categories[]` | `CurriculumCategory[]` | `{code, name, credits, maxCredits}` - credit-basket categories |
| `details[]` | `CategoryDetail[]` | `{code, name, baskets: CurriculumBasket[]}` - one per category, filled by per-category POSTs (failures → `baskets: []`) |
| `details[].baskets[]` | `CurriculumBasket[]` | `{title, credits (summed), items: CurriculumBasketItem[]}` |
| `details[].baskets[].items[]` | `CurriculumBasketItem[]` | `{code, name, credits, type?}` |

**Typed?** `CurriculumData`, `CurriculumCategory`, `CategoryDetail`, `CurriculumBasket`, `CurriculumBasketItem` in `src/lib/parsers/curriculum.ts`.

## POST /api/curriculum/download

**Envelope:** binary passthrough · 200 (bytes) / 400 / 500 / 502
[Reference page](/amazecc-api/03-api-reference/academics-vtop/curriculum-download)

Syllabus PDF/zip bytes from `/vtop/curriculum-download`. Headers: VTOP's `Content-Type` (default `application/octet-stream`) and `Content-Disposition` (default `attachment; filename="curriculum.<zip|pdf>"`). No JSON payload. Error bodies: `400 {error}` / `502 { success: false, error, snippet }` (first \~300 bytes of upstream body, whitespace-collapsed) / `500 { success: false, error }`.

**Typed?** Untyped.<Note>`NODE_TLS_REJECT_UNAUTHORIZED=0` is set as a process-wide side effect on this path.</Note>

## POST /api/curriculum/syllabus

**Envelope:** binary passthrough · 200 / 400 / 500 / 502 - same pattern as curriculum/download, requires `courseCode` body param; default filename `<courseCode>_syllabus.<zip|pdf>`.
[Reference page](/amazecc-api/03-api-reference/academics-vtop/curriculum-syllabus)

## POST /api/calendar

**Envelope:** raw · 200 / 500
[Reference page](/amazecc-api/03-api-reference/academics-vtop/calendar)

| Field | Type | Meaning |
|---|---|---|
| `semesterId` | string | echo of input |
| `calendars` | `CalendarMonth[]` | one entry per month (3-5); only days with ≥1 event included |
| `calendars[].month` | string | month label (first `<h4>`) |
| `calendars[].days[]` | `CalendarDay[]` | `{date: number, events: CalendarEvent[]}` |
| `calendars[].days[].events[]` | `CalendarEvent[]` | `{text, type: "Instructional Day" \| "Holiday" \| "Other", color?, category?}` - `type` derived from keywords; `category` from parenthesized suffix or `"General"` |

**Typed?** `CalendarDay`, `CalendarEvent`, `CalendarMonth`, `CalendarRequestBody`, `CalendarType` in `src/types/data/semTT.ts` - note the whole `semTT.ts` calendar-analysis island (CalendarInput, AnalyzedDay, CalendarResult…) is dead code, but these five types are live.

## POST /api/circulars

**Envelope:** success-wrapped · 200 / 400 / 500
[Reference page](/amazecc-api/03-api-reference/academics-vtop/circulars)

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `true` |
| `title` | string | first `<h3>` |
| `circulars` | `CircularItem[]` | tree parsed from `#tree1` `<ul>` - folder nodes `{name?, children[]}`, leaf nodes `{id?, title?}`; `id` comes from `viewCertificate('...')` onclick (`null` when unparseable) |
| `circulars[].children[]` | `CircularItem[]` | recursive nesting |

**Typed?** `CircularsData`, `CircularItem` in `src/lib/parsers/circulars.ts` - route literal untyped.

## POST /api/circulars/download

**Envelope:** binary passthrough · 200 / 400 / 500 / 502 - circular PDF bytes; `circularId` required; error bodies as above; default filename `circular.pdf`.
[Reference page](/amazecc-api/03-api-reference/academics-vtop/circulars-download)

## POST /api/hostel

**Envelope:** raw · 200 / 500
[Reference page](/amazecc-api/03-api-reference/academics-vtop/hostel)

| Field | Type | Meaning |
|---|---|---|
| `hostelInfo` | `hostel` | hosteller snapshot: `{gender?, isHosteller? (value === "HOSTELLER"), blockName? (first token), roomNo?, messInfo? (first token; `NON` → `NON VEG`, `FOOD` → `FOOD PARK`, else `NOT ALLOTED`)}` |
| `leaveHistory` | `leaveItem[]` | merged dedup of LeaveHistory + LeaveApplied tables (Map on `leaveId`, applied row wins): `{leaveId, visitPlace?, reason?, leaveType?, from?, to?, status?, remarks?}` |

**Typed?** `hostel`, `leaveItem` in `src/types/data/hostel.ts`.

## POST /api/od

**Envelope:** success-wrapped · 200 / 400 / 500
[Reference page](/amazecc-api/03-api-reference/academics-vtop/od)

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `true` |
| `semesterId` | string | echo of input |
| `totalCount` | number | from "Total Count : N" badge, else `records.length` |
| `note` | string \| null | `h5.fw-bold.text-primary` text, or `null` |
| `records[]` | `odItem[]` | `{slNo, type, reason, basis, date, time, remarks}` - cleaned ASCII-ish; empty-state is a `.alert-warning` |

**Typed?** `odDetails`, `odItem` in `src/types/data/od.ts` - parser `src/lib/parsers/od-details.ts`.

## POST /api/marks/stats

**Envelope:** success-wrapped · rate-limited (60/min/IP) · 200 / 400 / 401 / 429 / 500 / 503 (GET → 405)
[Reference page](/amazecc-api/03-api-reference/academics-vtop/marks-stats)

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `true` |
| `stats` | `Record<classId, ClassStats>` | **only classes the caller is enrolled in** (enrollment recorded by `/api/attendance/htmlparser2`); unrequested/unenrolled ids silently dropped; empty tables → `{}` |
| `stats.<classId>.count` | number | cohort size |
| `stats.<classId>.mean` | number | cohort mean |
| `stats.<classId>.sd` | number | **sample standard deviation** (population m2; count-1 correction only when count > 1; zero when count ≤ 1) |
| `stats.<classId>.assessments` | `Record<key, {count, mean, sd}>` | per-assessment (by component·title HMAC key) |

Error branches carry `{ success: false, error, detail }` - `detail` is the machine-ish reason (`missing_credentials`, `no_classes`, `too_many_classes`, `no_valid_classes`, `vtop_identity_unresolved`, `vtop_session_expired`, `stats_read_failed`).

**Typed?** `ClassStats` in `src/lib/marksStats.ts`; table names `class_overall_stats` / `class_assessment_stats` are created on first use.

## POST /api/marks/sync

**Envelope:** success-wrapped · rate-limited (20/min/IP) · 200 / 400 / 401 / 429 / 502 / 500 / 503
[Reference page](/amazecc-api/03-api-reference/academics-vtop/marks-sync)

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `true` |
| `tally` | object | `{added, replaced, reconciled, skipped, rejected}` - all five always present; counts of contribution outcomes |
| `tokens` | object | receipts for accepted writes only; keys `${classId}::${scope}::${assessmentKey}` (`scope` = `overall` ∣ `assessment`); values are HMAC receipts of the mark - **non-invertible** |

`Contribution` input: `{classId, scope, title?, component?, mark, prevMark?}`. Error branches like marks/stats (`missing_credentials`, `no_contributions`, `too_many_contributions`, `no_valid_contributions`, `vtop_identity_unresolved`, `vtop_session_expired`, `stats_write_failed`, `vtop_unavailable` on 502).

**Typed?** `Contribution`, `ContributionOutcome`, `TokenRecord` in `src/lib/marksStats.ts`.

## POST /api/marks/tokens

**Envelope:** success-wrapped · rate-limited (60/min/IP) · 200 / 400 / 401 / 429 / 500 / 503
[Reference page](/amazecc-api/03-api-reference/academics-vtop/marks-tokens)

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `true` |
| `tokens` | `TokenRecord[]` | every HMAC the server holds for this caller, ordered by class/scope/key: `{classId, scope, assessmentKey, token, updatedAt (ms)}` - presence/continuity only, no values |
| `legacy` | string[] | distinct `class_id`s from `class_user_hashes_legacy` (pre-HMAC attempts) - "legacy-held" markers, no values |

**Typed?** `TokenRecord` in `src/lib/marksStats.ts`. First run (tables missing) returns `{success: true, tokens: [], legacy: []}`.
