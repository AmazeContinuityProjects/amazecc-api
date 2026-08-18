# VTOP API Route Conversion Tracker

## Status Legend
- **PARSED** — Has dedicated parser integrated into route
- **WRITE** — Write/submission endpoint (needs form POST capability)
- **FORM** — Form shell with dropdowns; use auto-parse + AJAX data endpoint
- **TABLE** — Has embedded data tables; needs dedicated parser
- **STATIC** — Static reference page (no data tables, no dropdowns)
- **raw** — Not yet converted (uses generic auto-parse)

---

## ✅ Routes with Dedicated Parsers Integrated (17 routes)

| Route | Parser | Notes |
|-------|--------|-------|
| ~achievements | `parseAchievements` | Dedicated parser |
| ~acknowledgement | `parseAcknowledgement` | Dedicated parser |
| ~biometric | `parseBiometric` | Dedicated parser |
| ~bonafide | `parseBonafide` | Dedicated parser |
| ~change-password | `parseChangePassword` | Dedicated parser |
| ~circulars | `parseCirculars` | Dedicated parser |
| ~class-messages | `parseClassMessages` | Dedicated parser |
| ~compre-exam | `parseCompreExam` | Dedicated parser |
| ~contact | `parseContact` | Dedicated parser |
| ~course-page | `parseCoursePage` | Dedicated parser (AJAX steps use auto-parse) |
| ~curriculum | `parseCurriculum` | Dedicated parser |
| ~dayboarder | `parseDayboarder` | Dedicated parser |
| ~extra-curricular | `parseExtraCurricular` | Dedicated parser |
| ~faculty-info | `parseFacultyInfo` | Dedicated parser (search step uses auto-parse) |
| ~faq | `parseFaq` | Dedicated parser |
| ~feedback-status | `parseFeedbackStatus` | Dedicated parser |
| ~fees-intimation | `parseFeesIntimation` | Dedicated parser |
| ~login-history | `parseLoginHistory` | Dedicated parser |
| ~payment-receipts | `parsePaymentReceipts` | Dedicated parser |
| ~payments | `parsePayments` | Dedicated parser |
| ~proctor | `parseProctor` | Dedicated parser |
| ~wallet | `parseWallet` | Dedicated parser |

## examinations/ (15 routes)

| Route | Type | Status | Notes |
|-------|------|--------|-------|
| ~arrear-details | FORM | raw | sem dropdown → AJAX `/viewRARArrearBySemesterWise` |
| ~arrear-grade | FORM | raw | sem dropdown → AJAX `/doStudentArrearGradeView` |
| ~arrear-paper-see | FORM | raw | sem + service dropdowns → AJAX `/PaperSeeingOnChange` |
| ~arrear-reg | WRITE | raw | Registration closed; checkbox form w/ invoice |
| ~arrear-schedule | TABLE | raw | Has exam schedule table (customTable with 9 cols) |
| ~capstone | FORM | raw | sem dropdown → AJAX `/processDigitalAssignment` |
| ~eca-upload | FORM | raw | sem → course list → file upload AJAX |
| ~fine-upload | TABLE | raw | DataTable of fines + file upload |
| ~makeup-exam | FORM+TABLE | raw | Tables: eligible/not-eligible courses + checkboxes |
| ~makeup-schedule | FORM | raw | sem dropdown → search → AJAX schedule |
| ~mooc-upload | FORM | raw | sem dropdown → course list AJAX |
| ~paper-see-rev | FORM | raw | sem + service → course list w/ checkboxes |
| ~project-file-upload | FORM | raw | sem → project list → file upload |
| ~reexam | FORM | raw | sem → course list w/ checkbox + reason |
| ~special-arrear | WRITE | raw | Registration closed; checkbox form |

## research/ (14 routes)

| Route | Type | Status | Notes |
|-------|------|--------|-------|
| ~coursework-reg | STATIC | raw | "Registration closed" message |
| ~monthly-report | TABLE+FORM | raw | File upload + history DataTable |
| ~registration-status | FORM | raw | sem dropdown → AJAX course list |
| ~research-attendance | FORM | raw | year/month/date → AJAX attendance |
| ~research-award | FORM | raw | Full form: fields + file upload |
| ~research-docs | FORM | raw | Dynamic doc list + file upload |
| ~research-letters | FORM | raw | Letter download links |
| ~research-profile | FORM | raw | Full form for research scholars |
| ~research-templates | STATIC | raw | "Not a Research Scholar" message |
| ~scholar-leave | FORM+TABLE | raw | Leave form + history table |
| ~scholar-verification | FORM | raw | Profile + correction form w/ uploads |
| ~thesis-status | FORM | raw | Search → thesis status table |
| ~thesis-submission | STATIC | raw | "Contact research office" message |

## academics/ (10 routes)

| Route | Type | Status | Notes |
|-------|------|--------|-------|
| ~course-option-change | FORM | raw | sem dropdown → AJAX course list |
| ~course-withdraw | WRITE+FORM | raw | Modal-driven; OTP + invoice |
| ~course-withdraw-view | FORM | raw | sem dropdown → view + payment |
| ~exc-registration | FORM+TABLE | raw | Course list + modal registration |
| ~minor-honour | FORM | raw | Cascading dropdowns (type→code→courses) |
| ~mooc-registration | FORM | raw | Course registration |
| ~project | FORM | raw | sem dropdown → project view |
| ~project-course | FORM+TABLE | raw | Project list w/ Accept/Decline |
| ~wishlist | FORM | raw | sem dropdown → wishlist courses |
| ~wishlist-registration | FORM | raw | sem dropdown → wishlist view |

## hostels/ (5 routes)

| Route | Type | Status | Notes |
|-------|------|--------|-------|
| ~caterer-change | STATIC | raw | "Not a hosteller" message |
| ~hostel-attendance | FORM | raw | year/month → AJAX attendance table |
| ~late-hour | FORM | raw | Buttons → AJAX request/status/history |

## compre/ (3 routes)

| Route | Type | Status | Notes |
|-------|------|--------|-------|
| ~ept-schedule | FORM | raw | (not analyzed yet) |
| ~online-exam-attempt | FORM | raw | (not analyzed yet) |
| ~question-preview | FORM | raw | (not analyzed yet) |

## admissions/ (3 routes)

| Route | Type | Status | Notes |
|-------|------|--------|-------|
| ~programme-migration | FORM | raw | (not analyzed yet) |
| ~sem-request | FORM | raw | (not analyzed yet) |

## sap/ (2 routes)

| Route | Type | Status | Notes |
|-------|------|--------|-------|
| ~sap-info | FORM | raw | (not analyzed yet) |
| ~sap-project | WRITE | raw | (not analyzed yet) |

## event/swf/ (3 routes)

| Route | Type | Status | Notes |
|-------|------|--------|-------|
| ~club-enrollment | FORM | raw | (not analyzed yet) |
| ~swf-registration | FORM | raw | (not analyzed yet) |
| ~swf-requisition | FORM | raw | (not analyzed yet) |

## finance/ (2 routes)

| Route | Type | Status | Notes |
|-------|------|--------|-------|
| ~library-due | TABLE | raw | (not analyzed yet) |
| ~online-transfer | FORM | raw | (not analyzed yet) |

## events/ASC/ (2 routes)

| Route | Type | Status | Notes |
|-------|------|--------|-------|
| ~fdp-certificate | FORM | raw | (not analyzed yet) |
| ~fdp-registration | FORM | raw | (not analyzed yet) |

## other/ (8 routes)

| Route | Type | Status | Notes |
|-------|------|--------|-------|
| ~bonafide | FORM | parsed | `parseBonafide` integrated |
| ~facility-reg | FORM | raw | (not analyzed yet) |
| ~ir-outbound | FORM | raw | (not analyzed yet) |
| ~library-keys | FORM | raw | (not analyzed yet) |
| ~library-scanning | FORM | raw | (not analyzed yet) |
| ~mdp | FORM | raw | (not analyzed yet) |
| ~outgoing-report | FORM | raw | (not analyzed yet) |
| ~pat-reg | FORM | raw | (not analyzed yet) |
| ~student-withdraw | FORM | raw | (not analyzed yet) |
| ~course-completion | FORM | raw | (not analyzed yet) |

---

## Conversion Priority

### ✅ Completed — Dedicated parser integrated
1. acknowledgement, biometric, bonafide, change-password, dayboarder
2. extra-curricular, feedback-status, fees-intimation, payment-receipts
3. achievements, circulars, class-messages, compre-exam, contact, course-page, curriculum
4. faculty-info, faq, login-history, payments, proctor, wallet

> Note: `bank-info` and `credentials` parsers are now consumed only via `/api/me` (their standalone routes were removed in the Tier-1 cleanup).

### P0 — Has data tables (write dedicated parser)
1. arrear-schedule — exam schedule table
2. fine-upload — fine records DataTable
3. makeup-exam — eligible/not-eligible course tables
4. monthly-report — history DataTable
5. scholar-leave — leave history table
6. hostel-attendance — attendance table
7. library-due — library due table
8. project-course — project list table

### P1 — Semester dropdown + AJAX data endpoint (auto-parse form + add AJAX call)
1. arrear-details — sem → arrear courses
2. arrear-grade — sem → grade view
3. arrear-paper-see — sem+service → course list
4. capstone — sem → assignments
5. eca-upload — sem → course list
6. makeup-schedule — sem → schedule
7. mooc-upload — sem → course list
8. registration-status — sem → registration view
9. course-option-change — sem → course list
10. minor-honour — cascading dropdowns
11. wishlist — sem → wishlist courses
12. project — sem → project view
13. course-withdraw-view — sem → view + payment
14. research-attendance — year/month → attendance

### P2 — Simple form shells (auto-parse only, no AJAX needed)
1. reexam, paper-see-rev, project-file-upload
2. exc-registration, mooc-registration
3. research-docs, research-letters
4. thesis-status, thesis-submission
5. programme-migration, sem-request
6. sap-info, sap-project
7. club-enrollment, swf-registration, swf-requisition

### P3 — Static/no-data pages (auto-parse for message only)
1. coursework-reg, research-templates
2. caterer-change
3. research-award
4. online-transfer, fdp-certificate, fdp-registration

### P4 — Not analyzed yet (need HTML dump)
1. facility-reg, ir-outbound, library-keys, library-scanning
2. mdp, outgoing-report, pat-reg, student-withdraw, course-completion
3. ept-schedule, online-exam-attempt, question-preview
4. qbank, regulation, sap-project
