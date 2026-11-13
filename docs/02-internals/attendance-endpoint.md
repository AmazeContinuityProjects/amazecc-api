---
title: "Attendance endpoint anatomy"
description: "Anatomy of src/app/api/attendance/route.ts: the merge with timetable, the per-course fan-out, and the viewLink polymorphism."
---

# Attendance endpoint anatomy

> **In one line:** `POST /api/attendance` is three VTOP pages deep before you get yours — and the response is the contract the whole Attendee tab depends on.

**Endpoint:** `POST /api/attendance`  
**Contract:** `{ attRes: { semester, attendance }, marksRes }` — raw shape, NOT `{success}`.

```mermaid
flowchart TD
  BODY[POST body<br/>cookies/authorizedID/csrf/semesterId] --> SCRAPE1[VTOP attendance page]
  BODY --> SCRAPE2[VTOP timetable page]
  SCRAPE1 --> MERGE[mergeAttendanceWithTimetable]
  SCRAPE2 --> MERGE
  MERGE --> FANOUT[processViewAttendanceDetail<br/>per-course, concurrency 3]
  FANOUT --> PARSE[cheerio → attendanceItem[]]
  PARSE --> ENVELOPE["{ attRes, marksRes }"]
```

## The merger (`mergeAttendanceWithTimetable`)

VTOP's attendance sheet and timetable live on different pages. The route merges them on `courseCode`:

```ts
attendance.forEach((att) => {
  const tt = timetable.find(tt =>
    tt.courseCode.trim() === att.courseCode.trim());
  // ...
  merged.push({
    ...att,
    classId: tt.classId,
    // credits from slot LTPJC's 5th column (J-credit hours)
    credits: tt.LTPJC?.split(' ')[4] || null,
    slotVenue: cleanedVenue,
    category: tt.category || null,
  });
});
```

Notice the hard-coded VTOP column conventions:

- `att.courseCode` matches `tt.courseCode` on **code prefix only** (before the space) — the timetable is qualified (`CS2001L`) where the attendance is not (`CS2001`).
- `slotVenue` is scraped with a regex off `tt.slotVenue` — the last `<building>-<room>` group wins.
- `credits` comes from the LTPJC field — VTOP's `T-P-J-C` format where `C` is credits.

## The fan-out (`processViewAttendanceDetail`, concurrency 3)

The attendance table alone won't tell you per-date status. For every merged course, the route regex-scrapes `onclick="processViewAttendanceDetail(...)"`, replays that call, and stores the parsed dates+status array into `attEntry.viewLink` — **overwriting the field with an array**, which is the one place in the codebase where a field's type mutates mid-flight. You are warned.

```ts
const detailed = await batchAll(merged, processViewAttendanceDetail, 3);
// each item: { date, status: 'P'|'A'|'OD'|'EL' }
```

## Marks merge

The same handler calls `getMarks(...)` for the same semester. The result is attached as `marksRes`. The frontend's attendance tab consumes both atomically — the page is hydrated from `cache_attendance`, which is exactly this shape.

## What can break

- VTOP ships a new table layout → every parser throws, nothing catches → 500. Fix = update the cheerio selectors in the two attendance parsers (cheerio + htmlparser2 twins).
- A course offered this semester but with no attendance yet → `viewLink` gets an empty array, UI shows zeros. Working as intended.
- The join is on code prefix — two distinct courses sharing `CS2001` prefix would cross-pollinate credits. Known VTOP quirk; do not "fix" by matching on title.

## Where to next

- **[The VTOP client](./vtop-client.md)** — the `.post()` those details hit.
- **[Reference → Attendance](../03-api-reference/academics-vtop/attendance.md)** — live try-it.
- **[Sessions and cookies](../01-authentication/sessions-and-cookies.md)** — the credentials you'll need to see any of this yourself.
