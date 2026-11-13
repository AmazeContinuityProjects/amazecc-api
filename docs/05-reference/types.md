---
title: "Types you'll meet"
description: "The core response types: attendanceItem, courseItem (timetable), CGPA summary, identity, and transport."
---

# Types you'll meet

> **In one line:** these are the shapes you'll actually see fly past in a response — keep the ones you care about and ignore the rest.

Defined in `src/types/data/*.ts`, scraped from live VTOP pages.

## attendanceItem (attendance route)

```ts
type attendanceItem = {
  slNo: number | null;
  courseCode: string;          // "CS2001" — prefix without lab tag
  courseTitle: string;
  courseType: string | null;
  slotName: string;            // "A1+TA1" or "NILL"
  faculty: string | null;
  registrationDate: string | null;
  attendanceDate: string | null;
  attendedClasses: number | null;
  totalClasses: number | null;
  attendancePercentage: number | null;  // 0-100
  viewLink: string | Array<{ date, status }>;  // polymorphic — see attendance anatomy
  classId: string;             // "CH2026270102069" — sem prefixed
  credits: string | null;      // from LTPJC column 5
  slotVenue: string | null;    // cleaned, last block room match wins
  category: string | null;
}
```

## courseItem (timetable / marks merge)

```ts
type courseItem = {
  courseCode: string;          // "CS2001L" — with lab tag for labs
  course: string;              // "Operating Systems"
  LTPJC: string;               // "3-0-0-6" — credits in last slot
  classId: string;             // same sem-prefixed shape as attendance
  category: string;            // "PCC"
  slotVenue: string;           // raw, pre-cleaning
  facultyDetails: string;      // "SHREENU MORKHALA"
  semId?: string;
}
```

## CGPA summary (semTT / grades)

```ts
type CGPA = {
  totalCreditsEarned: number;
  totalCreditsRegistered: number;
  cgpa: number;                // e.g. 9.2
  gradedCredits: number;
  // plus per-semester GPA breakdowns
}
```

## IdentityObject (whoami / identity/sync)

```ts
// assembled by src/lib/identity.ts — only filled fields appear
type Identity = {
  ownerKey: string;            // HMAC of regNo — the only lookup key
  handle: string;              // "AMZ-XXXX-XXXX"
  displayName: string;
  semesterId: string;
  semesterLabel: string;
  derivedAt: string;           // ISO timestamp
  slotmapVersion: string;      // config.json fingerprint
  // plus contact, proctor, hod_dean, bank, credentials presence… — all nullable fields
}
```

## transport

```ts
type BusRoute = { id, name, stops[], placements[] };
type BusPlacement = { id, bus_route_id, hostel, sort_order };
type TransportRule = { id, title, description, sort_order };
```

## Error-as-string (the nasty one)

Several VTOP routes historically returned **the parser error as a string** in place of an object
(e.g. `getMarks` may return `string` instead of `{courses, cgpa}`). The frontend MUST type-guard
before reading. The API never crashes on these — it just relays them.

## Where to next

- **[Route index](./routes-index.md)** — the full map.
- **[OpenAPI spec](./openapi-spec.md)** — the machine-readable view.
