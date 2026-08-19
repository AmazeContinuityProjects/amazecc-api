# Removal List — 18 Routes

Two tiers. Tier 1 = dead/duplicate/static/mock (safe to delete). Tier 2 = dangerous open endpoints (delete, or redesign before re-enabling).

---

## Tier 1 — REMOVE (dead, duplicate, static, or mock)

These serve no unique value; each is superseded, static, or fake. Referenced in `README.md`, `ROUTE_TRACKER.md`, and/or `src/app/docs/page.tsx` — those references must be updated on removal.

| # | Route | Methods | Why remove |
|---|---|---|---|
| 1 | `/api/apaarid` | POST | Exact duplicate of the APAAR block inside `/api/me` (identical `hasApaar` heuristic) |
| 2 | `/api/bank-info` | POST | Exact duplicate of the bank-info block inside `/api/me` |
| 3 | `/api/credentials` | POST | Duplicate of `/api/me` **and** returns live portal passwords (`defaultCredentials`); highest-value target among the duplicates |
| 4 | `/api/student` | POST | Strict subset of `/api/me` (student profile only); dead duplicate |
| 5 | `/api/profile-images` | POST | Subset of `/api/me` (proctor + HoD/Dean + `viewStudentCredentials` with default passwords); leaks credentials |
| 6 | `/api/hostel-leave` | POST | Dead duplicate — leave history already covered by `/api/hostel` |
| 7 | `/api/graduated-info` | POST | Static no-data page per ROUTE_TRACKER (P3); generic auto-parse |
| 8 | `/api/meeting-info` | POST | Static "Not a Research-Scholar" page per ROUTE_TRACKER (P3) |
| 9 | `/api/mess-selection` | POST | Static "No valid bookings" page per ROUTE_TRACKER (P3) |
| 10 | `/api/qbank/admin/ocr` | POST | **Simulated mock** — sleeps 3s and inserts 3 hard-coded fake questions into the production `qbank_questions` table ("SIMULATED OCR DELAY — replace with GPT-4o Vision / Mathpix") |
| 11 | `/api/hostel-counselling` | POST | Scrapes VTOP `technoCrendentials` (TechnoVIT credentials/OTP page) through an unauthenticated open proxy — sensitive data exfil surface |

## Tier 2 — REMOVE or REDESIGN (dangerous open endpoints)

| # | Route | Methods | Why remove/gate |
|---|---|---|---|
| 12 | `/api/koha/patron` | POST | Accepts `card` + `password` in body, logs into Koha OPAC, scrapes 9+ account pages. Unauthenticated credential-relay/brute-force vector; TLS disabled; no rate limit |
| 13 | `/api/lms-data` | POST | Accepts Moodle `username` + `pass` in body. Unauthenticated login+scrape proxy; credential-stuffing relay; no rate limit |
| 14 | `/api/vitol-data` | POST | Accepts `username` + `pass`, logs into vitolcc.vit.ac.in. Only raw-credential login proxy in repo; TLS disabled; no rate limit; account-lockout abuse |
| 15 | `/api/events/download` | POST | **Open SSRF** — fetches any client-supplied `http(s)` URL server-side and streams it back; `jsessionid` unvalidated so no creds needed to probe internal network / cloud metadata. Rewrite with a strict `eventhubcc.vit.ac.in` host allowlist, or remove |
| 16 | `/api/admin/cabshare/hubs` | POST, DELETE | **CRITICAL** — zero-auth DB insert/delete on a live feature (public cabshare API exists) |
| 17 | `/api/admin/cabshare/trips` | GET, DELETE | **CRITICAL** — zero-auth dump of all trips joined with user PII (name, reg_number, phone_number) + zero-auth trip deletion |
| 18 | `/api/admin/faculty-directories` | GET, POST, PUT, DELETE | **CRITICAL** — full zero-auth CRUD on `faculty_directory_urls` |

## Conditional removals (merge candidates — not required, but recommended)

| Route | Note |
|---|---|
| `/api/grades` | Overlaps `/api/all-grades` (both scrape grade history). Merge into one |
| `/api/course-withdraw-view` | Near-duplicate of `/api/course-withdraw` (distinct VTOP endpoints, but same purpose) |
| `/api/wishlist-registration` | Near-identical copy of `/api/wishlist` |
| `/api/transport/routes/[id]` + `/api/transport/placements` | Subsets of `/api/transport/routes` (which returns everything incl. placements) |

## Removal execution checklist

1. Delete the route file(s).
2. Update `README.md` route tables (lines referencing: Profile, Hostel & Mess, Library, LMS, Research, Admin, QBank).
3. Update `ROUTE_TRACKER.md` (route lists at lines ~19, 28, 67, 102, 104, 118, 163, 171, 212-221).
4. Update `src/app/docs/page.tsx` `categoryGroup`/`categoryIcons` maps.
5. Update `src/app/docs/EndpointTester.tsx` if it special-cases removed routes (it does for `/api/lms-data` and `/api/vitol-data`).
6. **Before deleting `/api/lms-data` / `/api/vitol-data` / `/api/student` / `/api/profile-images` / `/api/credentials` / `/api/events/download`:** confirm the AmazeCC mobile app does not call them directly; if it does, rewire the app to `/api/me` or the redesigned endpoint first.
7. Run `pnpm run lint` and `next build`.

## Files removed from git history that are related

- `a075aac` already removed arrear/compre/makeup/project endpoints (precedent for this cleanup).
- Deleted dev artifacts (temp routes, test files) were confirmed non-malicious in the earlier forensic pass.