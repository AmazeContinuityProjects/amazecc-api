# Audit: Student & Academics VTOP Proxies (33 routes)

Scope: `/api/achievements` → `/api/curriculum/*`. All routes follow the open VTOP cookie-relay pattern: caller supplies `cookies`/`authorizedID`/`csrf`; no server-side session binding; no rate limiting; shared VTOP client has TLS verification disabled.

| Route | Methods | Auth | What it does | Risk | Issues found | Verdict |
|---|---|---|---|---|---|---|
| `/api/achievements` | POST | None | Proxies VTOP `SpecialAchieversAwards`, parses achievements | Med | Open unauthenticated relay; no rate limit; no input validation; TLS disabled | HARDEN |
| `/api/acknowledgement` | POST | None | Proxies VTOP `AcknowledgmentView` | Med | Open relay; no rate limit; VTOP internal error messages echoed | HARDEN |
| `/api/additional-learning` | POST | None | Scrapes add-learning dashboard, loops every semester option | High | Unauthenticated; semester-loop amplification (DoS/abuse of server IP); no rate limit | HARDEN |
| `/api/all-grades` | POST | None | Scrapes grades for every semester from admission year + per-course detail | High | 15-60+ VTOP calls per unauthenticated request; easiest endpoint to abuse; no rate limit | HARDEN |
| `/api/apaarid` | POST | None | Scrapes VTOP `apaarid/upload` + `hasApaar` heuristic | Med | **Exact duplicate of APAAR block in `/api/me`**; open relay | **REMOVE** |
| `/api/attendance` | POST, GET | None | POST: scrapes attendance+timetable+marks; GET: reads `class_stats` from DB by `classId` | Med | Heavy multi-call unauthenticated scrape; open DB read (parameterized, no SQLi); no rate limit | HARDEN |
| `/api/bank-info` | POST | None | Scrapes VTOP `BankInfoStudent` | Med | **Exact duplicate of bank block in `/api/me`**; open relay | **REMOVE** |
| `/api/biometric` | POST | None | Scrapes VTOP `BiometricInfo` | Med | Open relay; returns biometric-adjacent personal data; no rate limit | HARDEN |
| `/api/bonafide` | POST | None | Scrapes VTOP bonafide page | Med | Open relay; no rate limit | HARDEN |
| `/api/book-recommendation` | POST | None | Scrapes book recommendations; **when `formData` passed, SUBMITS arbitrary merged form to VTOP** | High | Unauthenticated write/action against VTOP with attacker-chosen fields; no rate limit | HARDEN |
| `/api/buses` | GET | None | Public bus routes (driver names/phones, WhatsApp groups, stops) from DB | Low | Open read of staff PII — intended public feature | KEEP |
| `/api/calendar` | POST | None | Scrapes VTOP calendar 3-5 months | Med | Open relay; no rate limit; no validation on `semesterId`/`type` | HARDEN |
| `/api/capstone` | POST | None | Scrapes VTOP StudentDA with user-supplied `semesterId` as classId | Med | Open relay; `semesterId` passed unvalidated to VTOP | HARDEN |
| `/api/caterer-change` | POST | None | Scrapes VTOP `onlineCatererChange` | Med | Open relay; no rate limit | HARDEN |
| `/api/certificate` | POST | None | Scrapes VTOP certificate page | Med | Open relay; no rate limit | HARDEN |
| `/api/change-password` | POST | None | Proxies VTOP `UpdatePassword` with `oldPassword`/`newPassword` | High | Password-rotation relay with zero app-level auth; plaintext passwords in JSON; no rate limit | HARDEN |
| `/api/circulars` | POST | None | Scrapes VTOP circulars list | Med | Open relay; no rate limit | HARDEN |
| `/api/circulars/download` | POST | None | Raw fetch of circular PDF from VTOP, streams back | High | Sets `NODE_TLS_REJECT_UNAUTHORIZED="0"` (process-wide); raw fetch with caller cookie; no rate limit | HARDEN |
| `/api/class-messages` | POST | None | Scrapes VTOP `StudentClassMessage` | Med | Open relay; no rate limit | HARDEN |
| `/api/club-enrollment` | POST | None | Scrapes VTOP club chapter enrollment | Med | Open relay; no rate limit | HARDEN |
| `/api/clubs/details` | GET | None | Static SELECT of `club_details` (public club info) | Low | Non-sensitive public data; no user input | KEEP |
| `/api/contact` | POST | None | Scrapes VTOP contact details | Med | Open relay; no rate limit | HARDEN |
| `/api/convocation` | POST | None | Scrapes VTOP convocation entry | Med | Open relay; no rate limit | HARDEN |
| `/api/course-completion` | POST | None | Scrapes course-completion control, loops every semester | High | Unauthenticated semester-loop amplification; no rate limit | HARDEN |
| `/api/course-page` | POST | None | Scrapes course page + AJAX endpoints; forwards unvalidated `classId`/`erpId`/`slotId`/`faculty`/`semSubId` | Med | Arbitrary parameter injection into VTOP AJAX; open relay; no rate limit | HARDEN |
| `/api/course-withdraw` | POST | None | Scrapes VTOP course-withdraw page | Med | Open relay; no rate limit | HARDEN |
| `/api/course-withdraw-view` | POST | None | Scrapes CourseWithDraw view + per-semester views | Med | Near-duplicate of `/api/course-withdraw`; open relay; no rate limit | HARDEN |
| `/api/coursework-reg` | POST | None | Scrapes VTOP coursework registration | Med | Open relay; no rate limit | HARDEN |
| `/api/credentials` | POST | None | Scrapes `viewStudentCredentials` — **returns linked-account usernames AND passwords** | High | Returns live credentials for any supplied session; **duplicate of `/api/me`**; no rate limit | **REMOVE** |
| `/api/cron/reminders` | POST | None | Queries `push_subscriptions`, sends web-push reminders to all due users; deletes 410 subscriptions | High | **No cron secret** — anyone can mass-push to every registered user and trigger DB writes; no rate limit | HARDEN |
| `/api/curriculum` | POST | None | Scrapes curriculum + per-category views | Med | Open relay; multiple parallel VTOP calls; no rate limit | HARDEN |
| `/api/curriculum/download` | POST | None | Raw fetch of curriculum zip from VTOP, streams back | High | `NODE_TLS_REJECT_UNAUTHORIZED="0"`; duplicate `_csrf` param appended twice; no rate limit | HARDEN |
| `/api/curriculum/syllabus` | POST | None | Raw fetch of syllabus PDF/zip for user-supplied `courseCode` | High | `NODE_TLS_REJECT_UNAUTHORIZED="0"`; `courseCode` echoed into Content-Disposition filename (header injection surface); no rate limit | HARDEN |

## Highest-risk findings in this batch

1. **`/api/cron/reminders`** — unauthenticated mass push-notification broadcast to all users.
2. **`/api/credentials`** — returns live portal passwords; duplicate of `/api/me`; remove.
3. **TLS verification disabled** — `VTOPClient` hard-codes `rejectUnauthorized:false` for all scrapes; `circulars/download`, `curriculum/download`, `curriculum/syllabus` additionally set `NODE_TLS_REJECT_UNAUTHORIZED="0"` at runtime (process-wide in that serverless instance).
4. **`/api/change-password`** — unauthenticated password-rotation relay.
5. **Amplifier routes** — `all-grades`, `additional-learning`, `course-completion` loop over semesters, making them trivial DoS/abuse amplifiers.
6. **Unauthenticated write actions** — `/api/book-recommendation` (VTOP form submit) and `/api/course-page` (VTOP AJAX params).