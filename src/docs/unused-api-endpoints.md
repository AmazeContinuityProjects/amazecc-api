# Unused API Endpoints

Endpoints in `AmazeCC-API` with no frontend reference in `AmazeCC/src`.
Last updated: 2026-06-25

---

## Other / Uncategorized

| Endpoint | Backend VTOP URL | Notes |
|---|---|---|
| `achievements` | — | Student achievements |
| `biometric` | — | Biometric attendance data |
| `book-recommendation` | — | Book recommendations |
| `capstone` | — | Capstone project info |
| `class-messages` | — | Class messages/notices |
| `extra-curricular` | — | Extra-curricular activities |
| `hod-dean` | — | HOD/Dean details |
| `login-history` | — | VTOP login history |
| `mdp` | — | Management Development Program |
| `monthly-report` | — | Monthly reports |
| `proctor-messages` | — | Proctor messages |
| `vitol-data` | Moodle (Vitol) | Fetches Moodle assignments/quizzes calendar (see below) |

### `vitol-data` — How it works

Scrapes VIT's Moodle instance (Vitol) for upcoming assignments, quizzes, and exams. Uses **separate credentials** (not VTOP):

1. Logs into `https://vitolcc.vit.ac.in/login/index.php` (or alternative site) with username/password
2. Extracts Moodle `sesskey` from the dashboard HTML
3. Fetches current + next month's calendar via Moodle's AJAX API (`core_calendar_get_calendar_monthly_view`)
4. Iterates over each calendar event, visits the event page, and extracts:
   - Course code + name (from breadcrumb)
   - Assignment/quiz name
   - Open date
   - Completion status (whether quiz attempt is finished)
5. Returns `Assignment[]` array

Has a frontend component (`VitolDisplay.tsx`) but it's **commented out** in `ScheduleSubTab.tsx:11-15`, so it's currently unused.

---

## Academic / Student

| Endpoint | Backend VTOP URL | Notes |
|---|---|---|
| `bonafide` | — | Bonafide certificate requests |
| `certificate` | — | Certificate generation |
| `convocation` | — | Convocation details |
| `course-withdraw` | — | Course withdrawal |
| `course-withdraw-view` | — | View course withdrawals |
| `coursework-reg` | — | Coursework registration |
| `eca-upload` | — | ECA (Extra-Curricular Activity) upload |
| `graduated-info` | — | Graduated student info |
| `programme-migration` | — | Programme/branch migration |
| `reexam` | — | Re-exam details |
| `registration-status` | — | Registration status |
| `student-withdraw` | — | Student withdrawal |
| `transcript` | — | Transcript generation |
| `update-loginid` | — | Update VTOP login ID |

---

## Exams / Grades

| Endpoint | Backend VTOP URL | Notes |
|---|---|---|
| `outcome-set` | — | Outcome set mapping |
| `paper-see-rev` | — | Paper revaluation |
| `qcm` | — | QCM (Quiz/Test) |
| `qcm-view` | `/vtop/academics/common/QCMStudentLogin` | **Quality Circle Meeting** for regular UG students. Form with semester selector → calls `getStudentLoginForQcm`. No backend endpoint exists yet — current `meeting-info` is for research scholars only, this is different |
| `question-preview` | — | Question paper preview |
| `receipt-download` | — | Payment receipt download |

---

## Research / PhD

| Endpoint | Backend VTOP URL | Notes |
|---|---|---|
| `ir-outbound` | — | IR outbound |
| `outgoing-report` | — | Outgoing student report |
| `research-attendance` | — | Research attendance |
| `research-award` | — | Research awards |
| `research-docs` | — | Research documents |
| `research-letters` | — | Research letters |
| `research-profile` | — | Research profile |
| `research-templates` | — | Research templates |
| `sap-info` | — | SAP info |
| `sap-project` | — | SAP project |
| `thesis-status` | — | Thesis status |
| `thesis-submission` | — | Thesis submission |

---

## Hostel

| Endpoint | Backend VTOP URL | Notes |
|---|---|---|
| `hostel-attendance` | — | Hostel attendance |
| `hostel-leave` | — | Hostel leave management |
| `mess-feedback` | — | Mess feedback |
| `mess-selection` | — | Mess menu selection |
| `late-hour` | — | Late hour entry |

---

## Library

| Endpoint | Backend VTOP URL | Notes |
|---|---|---|
| `library-keys` | — | Library keys management |
| `library-scanning` | — | Library scanning |

---

## Registrations / Applications

| Endpoint | Backend VTOP URL | Notes |
|---|---|---|
| `caterer-change` | — | Caterer change request |
| `club-enrollment` | — | Club enrollment |
| `fees-intimation` | — | Fees intimation |
| `fine-upload` | — | Fine upload |
| `facility-reg` | — | Facility registration |
| `fdp-certificate` | — | FDP certificate |
| `fdp-registration` | — | FDP registration |
| `internship` | — | Internship details |
| `mooc-registration` | — | MOOC registration |
| `mooc-upload` | — | MOOC upload |
| `online-exam-attempt` | — | Online exam attempt |
| `online-transfer` | — | Online transfer |
| `pat-reg` | — | PAT registration |
| `sem-request` | — | Semester request |
| `slo-feedback` | — | SLO feedback |
| `swf-attendance` | — | SWF attendance |
| `swf-registration` | — | SWF registration |
| `swf-requisition` | — | SWF requisition |
| `wishlist-registration` | — | Wishlist course registration |

---

## Events / Other

| Endpoint | Backend VTOP URL | Notes |
|---|---|---|
| `regulation` | `/vtop/academics/council/CouncilRegulationView/new` | Council regulations view |
| `university-day` | `/vtop/event/uday/certificates` | University Day certificates |
| `meeting-info` | `/vtop/research/scholarsMeetingView` | **Research scholars** meeting view (Quarterly Committee Meeting for PhD scholars). NOT the same as UG `qcm-view` |
| `scholar-leave` | — | Scholar leave |
| `scholar-verification` | — | Scholar verification |

---

## Previously considered but confirmed used (48 endpoints)

`acknowledgement`, `additional-learning`, `all-grades`, `apaarid`, `attendance`, `bank-info`, `buses`, `calendar`, `change-password`, `circulars`, `course-completion`, `course-page`, `credentials`, `curriculum`, `dayboarder`, `ept-schedule`, `events`, `exc-registration`, `faculty-info`, `feedback-status`, `grades`, `hostel`, `hostel-counselling`, `library-due`, `lms-data`, `login`, `marks`, `minor-honour`, `payment-receipts`, `payments`, `proctor`, `profile-images`, `registration-schedule`, `schedule`, `student`, `timetable`, `transport`, `wallet`, `wishlist`
