# Business logic & application behavior

Recovered from Blutter asm (`asm/*`), `pp.txt`, in-app routes, and client behavior in `eHa`/callers.

## 1. Application domains & flows

### 1.1 Onboarding & access
- **Entry:** `package:vtop/main.dart` (`::main`), splash/loading → sign-in or home based on stored session.
- **Authentication:** credentials login to VTOP (`appLoginProcess`, encrypted), optional MPIN (6-digit) and biometric unlock, OTP for sensitive/wallet operations.
- **Session bootstrap:** on successful auth the app resolves runtime config (`tLa`: `cvf`, `Pxf`, `Euf`) and identity (`applNo`) used for all subsequent API calls.

### 1.2 Dashboard (`/homeScreen`, dashboard actions)
- Aggregates entry points: academics, attendance, timetable, exams, grades, proctor, grievances, wallet, notifications/spotlight.
- Populated via `dashboardFromAcademics`, `mainMenuPage`, `quickMenuDashboardPage`; quick actions deep-link into feature screens.

### 1.3 Academics
- **Semester context:** `getSemesterList` returns semester identifiers/labels and timetable/feedback pattern ids. Most academic queries are **scoped to a selected semester** (`semesterId/SubId/Desc`, `timeTablePatternId`).
- **Attendance:** calendar/slot/day views and per-course percentages/details; client presents averages and an `acadAttendanceCalculator` to project attendance impact of future classes.
- **Timetable:** current-day and all-day/week timetable driven by semester & pattern (`allDayTimetable`, `timeTable`).
- **Courses:** registered/offered course lists and course details; feeds marks/assignments contexts.
- **Exams:** `examScheduleView` per semester (date/time/session).
- **Grades/Marks/CGPA:** active semester mark view, grade/mark details by semester and course; CGPA details surfaced from server responses.

### 1.4 Proctor & faculty
- Proctor profile, messages, semester-wise meeting lists/history.
- Faculty directory/search, faculty detail/image, HOD/Dean info, course-faculty messages — supports lookup and communication context.

### 1.5 Grievance management
- **Compose:** fetch categories (`getCategoryList`) → user fills form and may attach files → submit via multipart `postGrievanceForm` (`Hrf`).
- **Track:** list/history (`getPostTrackingScreeenDataByStud`) and detail/remarks/status (`getPostTrackingViewDataByStud`) including `grievanceTransId`, `grievanceStatus`, `grievanceRemarks`, `trackingRemarks` (e.g. forwarded/resolved states).

### 1.6 Hostel & leave
- Hosteller profile, leave type lookup, apply leave, and view leave history/status.

### 1.7 Wallet & payments
- **VTOP wallet:** balance, history, amount entry, payment/adjustment processing (OTP-guarded where required) and receipt viewing.
- **Payment gateway:** pending dues/list, payable windows (`paymentOpenDate/CloseDate`), amounts/status; native Paytm Assist/Easypay integration for gateway/3DS flows, event logging, and app-version/config fetch.

### 1.8 Notifications & content
- In-app notifications, spotlight items/files, contact/help info.

## 2. Cross-cutting behaviors

### 2.1 Request lifecycle (client)
1. Resolve session (`cvf`, headers, `applNo`); check connectivity.
2. Build request per wrapper (`qrf/prf/nrf/orf/Hrf/...`), encrypt body when required (`encData`), attach auth headers.
3. POST with timeout (~5s typical), JSON content-type.
4. On success: decrypt/parse, update UI, and **cache** response in local DB (`jHa`/`gGa` keyed with timestamps).
5. On failure: show contextual errors (network/timeout/server/bad request); on session-invalid trigger **re-auth navigation** to `/sign_in_page`.

### 2.2 Caching & offline behavior
- Responses cached in encrypted `VitianLocalDB` (`id, encryptedData, lastDate`) enabling reuse/stale reads and resilience; UI surfaces "No proper Internet Connection..." when offline and may fall back to cached data where implemented.

### 2.3 Data scoping & identifiers
- `applNo` (student/application number) is a primary identity key injected into many requests.
- Semester/course/transaction identifiers (`semesterId/SubId`, `course_code/id`, `grievanceId/TransId`, txn/order ids) returned by list endpoints must be passed back to detail/action endpoints.
- `cvf()` path prefix and auth tokens are **dynamic/session-bound** — not hardcoded constants.

### 2.4 Security/validation logic
- Sensitive payloads encrypted client-side into `encData`; server responses may be decrypted/validated client-side (`Hxf/Ixf`).
- Time-bound request signing via `S-KEY-USER` (`timestamp|user|vitian` encoded).
- TLS certificate pinning (Flutter plugin) on top of HTTPS.
- MPIN/biometric/OTP as step-up or convenience auth; API lockout/timeout messaging handled (e.g. too-many-attempts lockouts).

## 3. Inferred end-to-end example (exam schedule)
1. User logs in (`orf` → `appLoginProcess`, `{encData}`) → session established.
2. App loads semesters (`getSemesterList`, `qrf`) → user selects semester.
3. App calls `examScheduleView` (`qrf`, params include selected semester context) to `base+cvf()+examScheduleView` with `S-API-KEY`, `S-KEY-USER`, `applNo`.
4. Response cached/decrypted and rendered as schedule; on session expiry, redirected to sign-in.

## 4. Limits of inference
- Exact request/response JSON schemas per action (field-level) are partially implicit; `encData` contents and some param maps are constructed at runtime. Use these notes to guide authorized inspection (debug proxy with pinning handled, or instrumented client) for schema-precise integration.
- Server-side validation/business rules (eligibility, windows, state transitions) are authoritative on VTOP; the client enforces UX-level checks only.
