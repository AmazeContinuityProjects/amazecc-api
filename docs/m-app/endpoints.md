# Endpoint & action catalog

This catalog lists server actions/endpoints recovered from Blutter (`asm/` call sites, `pp.txt`) and the Dart client `eHa` (`asm/aAh.dart`). Actions are invoked as HTTPS POST requests to the VTOP backend.

> **Conventions:** `base = https://vtopcc5.vit.ac.in/`, `pfx = cvf()` (runtime dynamic segment). Unless noted, requests are JSON (`content-type: application/json; charset=UTF-8`) with auth headers `S-API-KEY`/`S-KEY-USER` and (for `qrf`) `applNo` injected. `encData = Hxf(jsonEncode(payload))`.

## 1. Transport wrappers (how actions are called)

| Wrapper | `eHa` method | Effective target | Typical body | Use when |
|---|---|---:|---|---|
| Login | `orf(data)` | `base + login/vitian/appLoginProcess` (fixed) | `{encData}` | Authenticating / establishing session (no session auth headers) |
| Standard action | `qrf(params, path, {rrf})` | `base + pfx + path` | JSON params + `applNo` | Most menu/data fetch & actions |
| Encrypted action | `prf(path, data)` | `base + pfx + path` | `{encData}` | Sensitive payloads (e.g. MPIN set) |
| Encrypted/variant | `nrf(path, a, b)` | `base + pfx + path` | encrypted/structured | Specific flows (variant of `zrf`) |
| Multipart upload | `Hrf(form, file)` | `base + pfx + postGrievanceForm` | `multipart/form-data` + fields | Grievance submission with attachments |
| Specialized | `srf/vrf/wrf(...)` | `base + pfx + path` | JSON or `{encData}` per call | Feature-specific actions |

## 2. Recovered actions (by domain)

Path/action strings below were observed as the `path` argument to `qrf/prf/nrf/wrf/srf/vrf/Hrf` in recovered asm/call sites.

### 2.1 Authentication, session & device
| Action | Wrapper | Params / payload (inferred) | Interpretation | Best use |
|---|---|---|---|---|
| `login/vitian/appLoginProcess` | `orf` | credentials (e.g. `mobile`, user/pass/OTP as applicable) → `{encData}` | Establish VTOP session; returns data needed to derive `cvf`, `Pxf/Euf`, `applNo` | Call once per login; store session material securely; on success initialize `tLa` state |
| `validateMpin` | `qrf/prf`* | MPIN-related fields | Validate device MPIN against server/session | Use during MPIN login/verification; handle lockout responses |
| `setMpin` | `prf` | MPIN payload → `{encData}` | Set/reset MPIN | After auth; ensure encrypted envelope and fresh session |
| `biometricLog` | `qrf` | e.g. `fromDate`, `toDate` | Record/query biometric login events | Log/audit only; non-critical for data fetch |
| `logOut` | `qrf` | (minimal/none) | Invalidate server session | Always call on user logout; clear local cached/session data |

\* wrapper inferred from call patterns; confirm per build.

### 2.2 Dashboard & navigation
| Action | Wrapper | Params (inferred) | Interpretation | Best use |
|---|---|---|---|---|
| `dashboardFromAcademics` | `qrf` | none/body minimal | Academic dashboard summary/widgets | First call after login/home load to populate dashboard |
| `mainMenuPage` | `qrf` | none | Main menu/config | Use to drive available modules/tiles |
| `quickMenuDashboardPage` | `qrf` | none | Quick-access dashboard data | Lightweight home refresh |

### 2.3 Profile & student info
| Action | Wrapper | Params (inferred) | Interpretation | Best use |
|---|---|---|---|---|
| `myProfileInfo` | `qrf` | `applNo` (+ session) | Student/profile details | Cache per session; refresh on profile screen entry |
| `getSemesterList` | `qrf` | `applNo` | Available semesters (`semesterId/SubId/Description/Short`, timetable/feedback pattern ids) | Call once, then use selected `semesterSubId`/ids for semester-scoped queries |
| `viewHostellerInfo` | `qrf` | `applNo` | Hostel/residence info | Fetch on hostel/profile view |

### 2.4 Attendance
| Action | Wrapper | Params (inferred) | Interpretation | Best use |
|---|---|---|---|---|
| `viewAttendanceCal` / attendance-related actions* | `qrf/prf`* | semester/course/date context (e.g. `attendanceDate/Day/Slot/Status`) | Attendance calendar, per-slot/day/status, percentages & detail | Select semester first; request by date range/slot as UI needs; compute "Average Attendance"/calculator client-side from returned records when provided |
| `acadAttendanceCalculator` (domain) | (client + server data) | course/attended/total inputs | Attendance projection/calculation | Prefer server-sourced totals; treat calculator as advisory |

\* Specific attendance action name(s) appear in UI/data strings (`attendanceView/Detail/CalData/Status/Percentage`); bind to the action resolved in the installed build (see `pp.txt`/call sites).

**Interpretation tips:** `attendanceStatus/Description` give present/absent/on-duty semantics; `attendancePercentage` is per course/aggregate as returned—do not recompute differently than server without same inputs.

### 2.5 Timetable & courses
| Action | Wrapper | Params (inferred) | Interpretation | Best use |
|---|---|---|---|---|
| `timeTable` / `allDayTimetable` (domain actions)* | `qrf` | `semesterSubId`, `timeTablePatternId` | Current-day and full-week timetable | Fetch per selected semester/pattern; cache until semester/pattern changes |
| `courseList` / `courseOfferedView` | `qrf` | semester/filters | Registered/offered courses (`course_code/name/type/category`) | Use for course pickers, assignment/exam context |
| `activeSemMarkView` | `qrf` | semester | Active semester marks view bootstrap | Entry point before mark/grade detail fetches |

### 2.6 Exams & grades/marks
| Action | Wrapper | Params (inferred) | Interpretation | Best use |
|---|---|---|---|---|
| `examScheduleView` | `qrf` | semester (`semesterSubId`) | Exam schedule (`examDate`, `examTime`, `examSession`) | Fetch per semester; sort/group client-side by date/session |
| `gradeDetailsBySemId` | `qrf` | `semesterId/SubId` | Grade details for semester | Call after semester selection |
| `gradePageMarkBySemIdCourseId` | `qrf` | semester id + course id | Marks/grade breakdown per course | Drill-down from marks/grade list; pass exact ids from prior responses |

**Interpretation tips:** CGPA/grade views (`cgpaView`, `CgpaDetails`, grade counts/`Result - Grade`) derive from these responses; treat server values as authoritative.

### 2.7 Proctor, faculty & messaging
| Action | Wrapper | Params (inferred) | Interpretation | Best use |
|---|---|---|---|---|
| `proctorDetail` | `qrf` | `applNo` | Assigned proctor profile | Cache; show on proctor screen |
| `proctorMessage` | `qrf` | `applNo`/filters | Messages from proctor | Poll/refresh on open; mark-read only if API supports |
| `proctorMeetingSemList` | `qrf` | `applNo` | Semesters with proctor meetings | Select semester before history |
| `proctorMeetingHistory` | `qrf` | semester id | Meeting history | Fetch per selected semester |
| `searchFaculty` | `qrf` | query/filters | Faculty search results | Debounce queries; paginate if supported |
| `allVitFaculty` | `qrf` | none/filters | Faculty directory | Cache; prefer search for large lists |
| `getFacultyImage` | `qrf`/media fetch | faculty id | Faculty photo | Lazy-load images; cache by id |
| `myHodDeanInfoDetails` | `qrf` | `applNo` | HOD/Dean info | Display-only, low frequency |

### 2.8 Grievance
| Action | Wrapper | Params (inferred) | Interpretation | Best use |
|---|---|---|---|---|
| `getCategoryList` | `qrf` | none | Grievance categories | Load before compose; require user to select valid category |
| `postGrievanceForm` | `Hrf` (multipart) | form fields + attachments (`remarks`, category, etc.) | Submit new grievance | Use multipart; validate required fields/client-side; keep `grievanceTransId` from response |
| `getPostTrackingScreeenDataByStud` | `qrf` | `applNo` | Grievance history/list | List view; refresh after submit |
| `getPostTrackingViewDataByStud` | `qrf` | `grievanceId`/`grievanceTransId` | Tracking details, `grievanceStatus`, `grievanceRemarks`, `trackingRemarks` | Drill-down by selected grievance; display statuses like "Forwarded to Proctor / HOD", "Resolved" as returned |

### 2.9 Hostel & leave
| Action | Wrapper | Params (inferred) | Interpretation | Best use |
|---|---|---|---|---|
| `viewHostellerInfo` | `qrf` | `applNo` | Hosteller details | Profile/hostel screen |
| `getHostelLeaveType` | `qrf` | none | Leave types/options | Populate apply form |
| `hostelLeaveApply` | `qrf`/`prf`* | leave type, dates, reason | Submit leave request | Validate dates/reason; submit once; confirm server ack |
| `studentHostelLeaveHistory` | `qrf` | `applNo`/filters | Past leave requests/status | List/history view |

### 2.10 Notifications, spotlight & misc
| Action | Wrapper | Params (inferred) | Interpretation | Best use |
|---|---|---|---|---|
| `myNotificationDt` | `qrf` | `applNo` | Notifications | Fetch on open/badge refresh; dedupe client-side |
| `mySpotLightDt` | `qrf` | none | Spotlight items | Home/banner content |
| `getSpotlightFile` | `qrf` | file/item id | Spotlight file/content | Fetch on demand per item |
| `contactUsDt` | `qrf` | none | Contact/help info | Static-ish; cache |

### 2.11 Wallet & payments (VTOP-side)
| Action / domain | Wrapper | Params (inferred) | Interpretation | Best use |
|---|---|---|---|---|
| `walletBalance` / `walletHistory` / `walletPaymentProcessView` (domain) | `qrf`/`prf`* | `applNo`, amount/txn refs | Wallet balance, history, adjustment/payment initiation | Confirm amounts server-side; for adjustments use OTP/`submitOtp` flows as required |
| `submitOtp` | `qrf`/`prf`* | OTP, txn context | Verify OTP for wallet/payment | Single-shot submit; handle expiry/invalid OTP |
| `paymentProcessView` / `viewReceiptData` / `viewReceipt` | `qrf` | txn/order ids | Payment status & receipts | Use returned `txnToken`/order ids; treat receipt data as source of truth |
| `pendingPayments` / `paymentList` / heads & dates | `qrf` | `applNo` | Dues/payable items, windows, amounts | Respect `paymentOpenDate/CloseDate`; do not assume payable outside window |

> **Native Paytm assist** (separate from VTOP JSON actions): app also calls Paytm endpoints via `PaytmAssist.fetchAPIByAppVersion` / `accessCheckApi` (`https://securegw.paytm.in/payassist/api/getURLByAppVersion`, `.../getUniqueAssist`, `.../merchant-settlement-service/paytmAssist/enable`, `.../submit/event/logs`) and ACS `https://secure4.arcot.com/...` for in-app payment flows.

## 3. Generic usage recipe (authorized/research context)

1. **Login:** `orf` → `appLoginProcess` with encrypted credentials; capture session (derive `cvf`, `Pxf/Euf`, `applNo`).
2. **Headers:** for each request compute `S-API-KEY = Pxf`, `S-KEY-USER = Hv(ts+"|"+Euf()+"|vitian")`, `content-type: application/json; charset=UTF-8`.
3. **Call:** `POST base+cvf()+<action>` with `qrf`-style body (`params + applNo`) or `{encData}` / multipart as per action.
4. **Interpret:** decrypt/parse response; map to domain objects (semester → scoped queries; ids/tokens → drill-down).
5. **Handle edges:** 5s timeouts, offline, cached fallback, session expiry → re-login; respect cert pinning and rate/behavioral limits.

> Endpoint schemas can evolve across app/server versions; confirm field names/enums against live responses for your session.
