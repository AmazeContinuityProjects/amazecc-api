---
title: "VITianCC: endpoints catalog"
description: "The server actions the app calls, what each is for, and how to interpret them."
---

# Server actions the app uses (endpoint catalog)

This is a plain-English catalog of the server actions the VITianCC app calls on `https://vtopcc5.vit.ac.in/`. For each area you’ll see what the action is for, what information it typically needs, and how to interpret/use it well. (How requests are built, authenticated, and encrypted is covered in [api-client-and-networking.md](api-client-and-networking.md) and [login-and-auth.md](login-and-auth.md).)

> **Conventions (plain English):** Most actions are sent as `POST` to **`server + session path segment + action name`** with JSON, the required authentication headers, and the student application number included automatically. Some actions send an **encrypted payload** (`{ "encData": "..." }`) or, for grievance submission, a **file upload (multipart form)**. Exact field-by-field schemas are partly inferred—confirm against your own authorized session where precision matters.

## 1. How actions are sent (request styles)

| Style | When it’s used | Target | Body | Authentication |
|---|---|---|---|---|
| **Login** | Sign in / start session | Fixed login URL (`.../login/vitian/appLoginProcess`) | Encrypted payload | No prior session headers |
| **Standard action** | Most data fetches and actions | Server + session path segment + action name | JSON parameters + application number | Session headers required |
| **Encrypted action** | Sensitive or protected operations | Server + session path segment + action name | Encrypted payload | Session headers required |
| **File upload** | Submit a grievance with attachments | Server + session path segment + `postGrievanceForm` | Multipart form (fields + files) | Session headers required |
| **Specialized variant** | A few specific flows | Server + session path segment + action name | JSON or encrypted, per flow | Per flow |

## 2. Actions by feature

### 2.1 Sign-in, session, and device
| Action | Request style | What it needs (inferred) | What it’s for | How to use it well |
|---|---|---|---|---|
| `appLoginProcess` (login) | Login (encrypted) | Login credentials (e.g. mobile and/or user/password/OTP as applicable) | Creates a VTOP session and returns session/config data | Call only to authenticate; store/use session values securely and initialize the session before other calls |
| `validateMpin` | Standard or encrypted* | MPIN-related input | Checks the MPIN with the server/session | Use during MPIN verification; handle wrong-PIN/lockout responses |
| `setMpin` | Encrypted | New MPIN details (encrypted) | Sets or resets the MPIN | Do after a valid login/session; requires the encrypted payload form |
| `biometricLog` | Standard | Date range (e.g. from/to) | Records or queries biometric login events | Treat as audit/logging; not required to fetch academic data |
| `logOut` | Standard | Minimal/none | Ends the server session | Call on user logout and clear local session/cached sensitive data |

\*Style inferred from usage patterns; confirm for the installed build.

### 2.2 Dashboard and navigation
| Action | What it needs | What it’s for | How to use it well |
|---|---|---|---|
| `dashboardFromAcademics` | Minimal/none | Summary data for the academic/home dashboard | Call after login or when loading home to populate widgets |
| `mainMenuPage` | None | Main menu/module configuration | Use to determine which sections/features to show |
| `quickMenuDashboardPage` | None | Quick-access/home shortcuts data | Good for lightweight home refreshes |

### 2.3 Profile and student information
| Action | What it needs | What it’s for | How to use it well |
|---|---|---|---|
| `myProfileInfo` | Application number (session) | Student profile details | Fetch on profile open; cache for the session |
| `getSemesterList` | Application number | List of semesters and related pattern IDs (semester IDs/descriptions, timetable/feedback pattern info) | Fetch once per session, let the user pick a semester, then pass that semester’s IDs to semester-specific calls |
| `viewHostellerInfo` | Application number | Hostel/residence details | Fetch when viewing hostel/profile information |

### 2.4 Attendance
| Action / data | What it needs | What it’s for | How to use it well |
|---|---|---|---|
| Attendance actions (e.g. calendar/detail views seen in the app) | Selected semester and course/date/slot context | Attendance by day/slot, status (present/absent/on-duty etc.), percentages and details | Always scope to the chosen semester; request the date range/slots you need. Treat the server’s percentages/totals as authoritative; the “attendance calculator” is a projection based on those numbers. |

**Reading the results:** look for fields like date, day, slot, status/description, and percentage. Don’t guess status meanings—use the labels/descriptions returned by the server.

### 2.5 Timetable and courses
| Action / data | What it needs | What it’s for | How to use it well |
|---|---|---|---|
| Timetable actions (current day / full timetable) | Semester and timetable pattern identifiers | Class schedule for the selected semester/pattern | Load semesters/patterns first; cache until the semester or pattern changes |
| `courseList` / `courseOfferedView` | Semester/filters | Registered or offered courses (code, name, type, category) | Use to populate course pickers and to supply course IDs to other calls |
| `activeSemMarkView` | Semester | Entry point for the active semester’s marks view | Call before drilling into mark/grade details for that semester |

### 2.6 Exams, marks, and grades
| Action | What it needs | What it’s for | How to use it well |
|---|---|---|---|
| `examScheduleView` | Semester (e.g. semester sub-id) | Exam schedule (date, time, session) | Fetch per semester; sort/group by date and session for display |
| `gradeDetailsBySemId` | Semester ID/sub-id | Grade details for a semester | Call after the user selects a semester |
| `gradePageMarkBySemIdCourseId` | Semester ID + course ID | Mark/grade breakdown for a specific course | Drill down using the exact IDs returned by list/summary responses |

**Reading the results:** marks, grades, and CGPA shown in the app come from these responses—treat server values as the source of truth.

### 2.7 Proctor, faculty, and messages
| Action | What it needs | What it’s for | How to use it well |
|---|---|---|---|
| `proctorDetail` | Application number | Your assigned proctor’s profile | Cache for the session; refresh if the user revisits the screen |
| `proctorMessage` | Application number / filters | Messages from the proctor | Refresh when opening the messages view |
| `proctorMeetingSemList` | Application number | Semesters that have proctor meetings | Pick a semester, then load its history |
| `proctorMeetingHistory` | Semester ID | Proctor meeting history for a semester | Fetch per selected semester |
| `searchFaculty` | Search query/filters | Find faculty members | Debounce searches; paginate if the response supports it |
| `allVitFaculty` | None/filters | Faculty directory | Cache results; prefer search for targeted lookups |
| `getFacultyImage` | Faculty identifier | Faculty photo/image | Load lazily and cache by ID |
| `myHodDeanInfoDetails` | Application number | HOD/Dean information | Low-frequency, display-only data |

### 2.8 Grievances
| Action | Request style | What it needs | What it’s for | How to use it well |
|---|---|---|---|---|
| `getCategoryList` | Standard | None | Available grievance categories | Load before composing so the user selects a valid category |
| `postGrievanceForm` | File upload (multipart) | Form fields (e.g. category, remarks) and any attachments | Submits a new grievance | Validate required fields, send as multipart, and keep the returned transaction/reference ID |
| `getPostTrackingScreeenDataByStud` | Standard | Application number | List/history of your grievances | Refresh after submitting a new grievance |
| `getPostTrackingViewDataByStud` | Standard | Grievance/transaction ID | Status and remarks for a specific grievance (status, remarks, tracking notes) | Use for the detail view; show statuses exactly as returned (e.g. forwarded, resolved) |

### 2.9 Hostel and leave
| Action | What it needs | What it’s for | How to use it well |
|---|---|---|---|
| `viewHostellerInfo` | Application number | Hosteller/residence details | Fetch for hostel/profile screens |
| `getHostelLeaveType` | None | Available leave types | Load to populate the leave application form |
| `hostelLeaveApply` | Leave type, dates, reason (inferred) | Submits a leave request | Validate dates/reason, submit once, and confirm the server’s acknowledgement/status |
| `studentHostelLeaveHistory` | Application number / filters | Past leave requests and their status | Use for the history/list view |

### 2.10 Notifications, spotlight, and contact
| Action | What it needs | What it’s for | How to use it well |
|---|---|---|---|
| `myNotificationDt` | Application number | Your notifications | Refresh on open or for badge counts; dedupe on the client if needed |
| `mySpotLightDt` | None | Spotlight/banner items for home | Suitable for home screen content |
| `getSpotlightFile` | Item/file identifier | The file/content for a spotlight item | Fetch on demand per item |
| `contactUsDt` | None | Contact/help information | Mostly static—safe to cache |

### 2.11 Wallet and payments (inside VTOP)
| Action / data | What it needs | What it’s for | How to use it well |
|---|---|---|---|
| Wallet balance/history/process views | Application number and (for actions) amount/transaction references | View balance and history, start/adjust a wallet payment | Always confirm amounts and status from the server; follow OTP/verification steps when required |
| `submitOtp` | OTP and transaction context | Verifies an OTP for a wallet/payment step | Submit once per challenge; handle invalid/expired OTP clearly |
| `viewReceiptData` / `viewReceipt` / payment process views | Transaction/order identifiers | Payment status and receipts | Use the transaction/order IDs returned by earlier steps; treat receipts as the record of payment |
| Pending payments / payment list & windows | Application number | Dues, payable amounts, and open/close windows | Respect open/close dates and the server’s payable status |

**Separate from VTOP actions (native Paytm assist):** for the payment gateway flow the app also talks to Paytm/ACS services from its native payment component (e.g. fetching assist/config by app version, enabling/checking assist, submitting payment events, and 3DS/ACS pages such as `https://securegw.paytm.in/payassist/api/getURLByAppVersion`, `getUniqueAssist`, `merchant-settlement-service/paytmAssist/enable`, `submit/event/logs`, and `https://secure4.arcot.com/...`). Treat these as the payment SDK’s flow, distinct from the VTOP JSON actions above.

## 3. A practical, safe way to work with an action

1. **Sign in first** so you have a valid session (session path segment, auth headers, application number).
2. **Pick the action** that matches the screen/task and gather the IDs it depends on (semester, course, grievance, transaction, etc.) from earlier responses.
3. **Send it in the right style** (standard JSON, encrypted payload, or multipart) with fresh auth headers to `server + session path segment + action name`.
4. **Read the response carefully:** decrypt/parse it, rely on server-provided statuses/labels/amounts/percentages, and cache if helpful.
5. **Handle common cases:** ~5s timeouts and retries, no-internet/cached fallbacks, and **session expired → sign in again**. Account for certificate pinning if using a custom client.

## 4. Good to know
- Action names and overall behavior are stable findings; **exact parameter/response field names can vary by version**—verify with a controlled, authorized test.
- Identifiers returned by one call (semester, course, grievance, transaction/order IDs) are the correct inputs for related follow-up calls.
- Use only for your own account and in accordance with VIT/VTOP terms and applicable law.
