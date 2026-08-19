# AmazeCC API

<p align="center">
  <img src="https://img.shields.io/badge/API-AmazeCC-6C5CE7?style=for-the-badge" alt="AmazeCC API">
</p>

<p align="center">
  <strong>Backend API for AmazeCC — powering the student ecosystem</strong>
</p>

<p align="center">
  <a href="https://amazecc-api.vercel.app"><strong>API Home</strong></a> ·
  <a href="https://github.com/AmazeContinuityProjects/amazecc-api"><strong>Repository</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/last-commit/AmazeContinuityProjects/amazecc-api/main?style=flat-square&label=Last%20Commit" alt="Last Commit">
  <img src="https://img.shields.io/github/repo-size/AmazeContinuityProjects/amazecc-api?style=flat-square&label=Repo%20Size&color=blueviolet" alt="Repo Size">
  <br>
  <img src="https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white" alt="Vercel">
</p>

---

## Overview

RESTful API powering the AmazeCC student ecosystem — 215+ routes across 50+ categories for attendance, grades, timetable, hostel, library, transport, events, academics, research, and more.

Scrapes real-time data from VIT's **VTOP**, **LMS**, **Koha**, and **EventHub** portals via Cheerio/Axios, supplemented by PostgreSQL-backed storage for synced data.

---

## Tech Stack

| Category | Technologies |
|----------|-------------|
| **Runtime** | Next.js 16 (App Router, API Routes) |
| **Language** | TypeScript (strict) |
| **Database** | PostgreSQL via `pg` (Supabase) |
| **Scraping** | Cheerio, Axios |
| **Auth** | HMAC-SHA256 tokens (admin + club) |
| **Storage** | AWS S3 SDK (Backblaze B2 compatible) |
| **Push** | web-push (VAPID) |
| **UI Docs** | Swagger (swagger-jsdoc + swagger-ui-react) |
| **Styling** | Tailwind CSS v4, @amazecontinuityprojects/amazeui |
| **Deploy** | Vercel |

---

## Getting Started

```bash
git clone https://github.com/AmazeContinuityProjects/amazecc-api.git
cd amazecc-api
pnpm install
# Copy .env.example or configure required env vars (see .env)
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the API docs.

> **Note:** This project uses Next.js 16 (App Router) with breaking changes from earlier versions. See `AGENTS.md` for details if contributing via AI agents.

---

## API Endpoints — Selected Categories

> See the interactive docs at `/docs` for the full list.

| Category | Key Endpoints |
|----------|--------------|
| **Auth** | `/api/login`, `/api/status`, `/api/test-login` |
| **Academic** | `/api/attendance`, `/api/marks`, `/api/grades`, `/api/all-grades`, `/api/timetable`, `/api/schedule`, `/api/curriculum`, `/api/course-page` |
| **Registration** | `/api/course-option-change`, `/api/course-withdraw`, `/api/coursework-reg`, `/api/sem-request`, `/api/registration-schedule`, `/api/registration-status`, `/api/additional-learning` |
| **Exams** | `/api/compre-exam`, `/api/compre-info`, `/api/arrear-details`, `/api/arrear-grade`, `/api/arrear-schedule`, `/api/makeup-exam`, `/api/makeup-schedule`, `/api/reexam`, `/api/ept-schedule`, `/api/paper-see-rev`, `/api/special-arrear`, `/api/online-exam-attempt` |
| **Hostel & Mess** | `/api/hostel`, `/api/hostel-attendance`, `/api/late-hour`, `/api/dayboarder`, `/api/mess-feedback` |
| **Transport** | `/api/transport`, `/api/transport/routes`, `/api/transport/rules`, `/api/transport/placements`, `/api/transport/track`, `/api/buses` |
| **Profile** | `/api/me`, `/api/change-password`, `/api/update-loginid` |
| **Payments** | `/api/payments`, `/api/payment-receipts`, `/api/wallet`, `/api/online-transfer`, `/api/fees-intimation` |
| **Library** | `/api/koha/search`, `/api/koha/login`, `/api/koha/patron`, `/api/library-due`, `/api/library-keys`, `/api/library-scanning`, `/api/book-recommendation` |
| **Events** | `/api/events`, `/api/events/profile`, `/api/events/register`, `/api/events/preview`, `/api/clubs`, `/api/club-enrollment`, `/api/club-admin` |
| **LMS** | `/api/lms-data`, `/api/lms-data/assignments`, `/api/vitol-data` |
| **Research** | `/api/faculty-info`, `/api/research-profile`, `/api/research-attendance`, `/api/research-docs`, `/api/thesis-status`, `/api/thesis-submission`, `/api/scholar-leave`, `/api/scholar-verification` |
| **Projects** | `/api/project`, `/api/project-course`, `/api/capstone`, `/api/internship` |
| **CabShare** | `/api/cabshare/auth`, `/api/cabshare/trips`, `/api/cabshare/match`, `/api/cabshare/hubs`, `/api/cabshare/ratings`, `/api/cabshare/notifications`, `/api/cabshare/waitlist` |
| **Circulars** | `/api/circulars`, `/api/university-day`, `/api/class-messages` |
| **Admin** | `/api/admin/auth`, `/api/admin/users`, `/api/admin/stats`, `/api/admin/storage`, `/api/admin/clubs`, `/api/admin/ocr`, `/api/admin/push`, `/api/admin/migrate`, `/api/admin/buses`, `/api/admin/fresher-resources`, `/api/admin/cabshare`, `/api/admin/settings/global`, `/api/admin/faculty-directories` |
| **QBank** | `/api/qbank`, `/api/qcm`, `/api/qcm-view`, `/api/question-preview`, `/api/qbank/admin/questions`, `/api/qbank/admin/publish`, `/api/qbank/admin/ocr`, `/api/qbank/admin/upload-diagram`, `/api/qbank/diagrams/[name]`, `/api/qbank/upload` |
| **Student Services** | `/api/biometric`, `/api/student-withdraw`, `/api/programme-migration`, `/api/bonafide`, `/api/certificate`, `/api/convocation`, `/api/transcript` |
| **Feedback** | `/api/feedback-status`, `/api/slo-feedback`, `/api/outcome-set`, `/api/regulation` |
| **MOOCs / SWF** | `/api/eca-upload`, `/api/extra-curricular`, `/api/swf-attendance`, `/api/swf-registration`, `/api/swf-requisition`, `/api/mooc-registration`, `/api/mooc-upload` |
| **Other** | `/api/achievements`, `/api/acknowledgement`, `/api/contact`, `/api/faq`, `/api/hod-dean`, `/api/notifications`, `/api/health`, `/api/stats`, `/api/wishlist`, `/api/docs` |

---

## Contributing

Contributions are welcome! Feel free to fork the repo and submit a pull request.

---

## License

This project is for educational purposes. No official license.
