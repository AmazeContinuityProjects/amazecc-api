---
title: "VITianCC: business logic"
description: "How the app's features fit together: dashboard, academics, proctor, grievances, hostel, wallet."
---

# Business logic and how the app behaves

This explains what the VITianCC app does for a student, how its features connect, and the key rules the client follows behind the scenes.

## 1. Main features and flows

### 1.1 Getting in: launch and sign-in
- **Launch:** the app opens, shows a loading/start screen, then takes you to sign-in or straight to home depending on whether a usable session exists.
- **Sign-in:** you authenticate against VTOP (credentials sent in an encrypted request). You can also use on-device helpers like a 6-digit MPIN, biometrics, or an OTP for certain steps.
- **After sign-in:** the app sets up the session details it needs for every later request (the session-specific URL path, authentication header values, and your application number).

### 1.2 Home / dashboard
- Brings together entry points to academics, attendance, timetable, exams, grades, proctor, grievances, hostel, wallet/payments, notifications, and spotlight content.
- Populated by dashboard/menu actions (academic dashboard, main menu, quick menu) and links into the relevant screens.

### 1.3 Academics
- **Choose a semester first:** the app fetches your semester list (IDs, labels, and related pattern IDs). Most academic information is shown **for the selected semester**.
- **Attendance:** shows a calendar/slot/day view with status (e.g. present/absent/on-duty as reported), per-course details and percentages, plus an attendance calculator to estimate how future classes affect your percentage (based on the numbers provided).
- **Timetable:** shows today’s and the full timetable for the selected semester/pattern.
- **Courses:** lists registered/offered courses (code, name, type, category) and feeds into exams/marks/assignments views.
- **Exams:** shows the exam schedule for the selected semester (date, time, session).
- **Marks, grades, and CGPA:** lets you view marks/grades per semester and per course, with CGPA/details as returned by the server.

**Rule of thumb:** pick a semester → fetch data for that semester → drill down using the IDs returned (course, exam, etc.).

### 1.4 Proctor and faculty
- View your proctor’s details, messages, and semester-wise meeting history.
- Look up faculty (directory/search), view faculty details/photos, HOD/Dean info, and course-faculty messages.

### 1.5 Grievances
- **Raise a grievance:** load the category list → fill in the form → optionally attach files → submit (sent as a form upload). Keep the returned transaction/reference ID.
- **Track a grievance:** view your grievance list/history, then open a specific item to see its status, remarks, and tracking updates (e.g. forwarded, resolved) as reported by the server.

### 1.6 Hostel and leave
- View hosteller details, see available leave types, apply for leave, and check the status/history of leave requests.

### 1.7 Wallet and payments
- **VTOP wallet:** check balance and history, add/adjust amounts, and complete wallet steps (some steps require an OTP). View receipts for transactions.
- **Payments/dues:** see pending payments, amounts, and payable windows (open/close dates). Completing payment may go through the integrated Paytm payment/assist flow (including 3DS verification) in addition to VTOP’s own payment records.

### 1.8 Notifications and content
- View notifications, spotlight items/files, and contact/help information.

## 2. How the app behaves behind the scenes

### 2.1 A typical request from tap to screen
1. **Prepare:** confirm there’s a valid session (session path, auth headers, application number) and that the device is online.
2. **Build & send:** choose the right action and request style (standard, encrypted, or file upload), add headers and the encrypted body when needed, and send it (usually with about a 5-second timeout).
3. **On success:** decrypt/read the response, show it, and **save a copy in a local encrypted cache** (with a timestamp) so it can load faster or be reused.
4. **On failure:** show a helpful message (no internet, timeout, server busy/error). If the problem means the **session expired/invalid**, take the user back to sign-in instead of retrying endlessly.

### 2.2 Caching and offline behavior
- The app keeps an **encrypted local database** (`VitianLocalDB`) of cached responses/data. This helps screens load quickly and can provide previously fetched information when the network is poor.
- When there’s no connection, the app reports it and may show cached data where available—but actions that need the server still require connectivity and a valid session.

### 2.3 How data is scoped
- **By student:** many requests include the student’s application number.
- **By semester (and related IDs):** academics are usually tied to the selected semester (and sometimes a course or timetable pattern). The app uses IDs returned by one call (semester, course, grievance, transaction) as inputs to the next.
- **By session:** the URL path segment and authentication headers are created for the current session and change when you log in again—nothing here should be treated as a permanent, hardcoded value.

### 2.4 Security and safety checks in the flow
- Sensitive requests (including login) are sent as **encrypted payloads**; responses may be decrypted by the app.
- Each authenticated request carries a **time-based signed header** tied to the user/session.
- Connections to the backend are protected with **certificate pinning**.
- MPIN, biometrics, and OTP add extra verification for access or specific actions; the app also handles lockouts/too-many-attempts cases with user-facing messages.

## 3. Example: checking your exam schedule
1. Sign in → the app establishes a session.
2. Fetch the semester list → you pick a semester.
3. The app requests the exam schedule for that semester → the server returns the schedule.
4. The app shows it (and caches it). If your session has expired at any point, the app asks you to sign in again first.

## 4. What these notes can’t fully tell you
- Some **exact field names and response shapes** are built at runtime or encrypted in transit; confirm details with your own authorized, controlled testing if you need schema-level precision.
- Final decisions like eligibility, payment windows, and status transitions are enforced by the **VTOP server**—the app mainly presents and guides, it doesn’t override server rules.
- Use this understanding only for your own account and in line with VIT/VTOP policies and applicable law.
