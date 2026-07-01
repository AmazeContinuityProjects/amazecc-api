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

AmazeCC API is the backend service that powers the AmazeCC student ecosystem. It provides RESTful endpoints for attendance tracking, grades, timetable, hostel management, library services, events, and more.

Built with **Next.js API Routes**, **PostgreSQL**, and **Cheerio** for VTOP scraping.

---

## Tech Stack

| Category | Technologies |
|----------|-------------|
| **Runtime** | Next.js 15+ (API Routes) |
| **Language** | TypeScript |
| **Database** | PostgreSQL (via Supabase) |
| **ORM/Client** | Kysely |
| **Scraping** | Cheerio, Axios |
| **Auth** | HMAC-SHA256 tokens |
| **Deploy** | Vercel |

---

## Getting Started

```bash
git clone https://github.com/AmazeContinuityProjects/amazecc-api.git
cd amazecc-api
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result.

---

## API Endpoints

| Category | Endpoints |
|----------|-----------|
| **Auth** | `/api/login`, `/api/status` |
| **Academic** | `/api/attendance`, `/api/marks`, `/api/grades`, `/api/all-grades`, `/api/schedule`, `/api/calendar` |
| **Hostel** | `/api/hostel`, `/api/hostel-leave`, `/api/mess-menu`, `/api/mess-feedback` |
| **Profile** | `/api/student`, `/api/profile-image`, `/api/bank-info` |
| **Payments** | `/api/payments`, `/api/payment-receipts`, `/api/wallet`, `/api/online-transfer` |
| **Library** | `/api/koha/search`, `/api/koha/login`, `/api/koha/patron`, `/api/library-due` |
| **Transport** | `/api/buses`, `/api/transport`, `/api/dayboarder` |
| **Events** | `/api/events`, `/api/events/profile`, `/api/clubs/details` |
| **LMS** | `/api/lms-data`, `/api/lms-data/assignments` |
| **Exams** | `/api/arrear-details`, `/api/makeup-exam`, `/api/compre-exam`, `/api/reexam` |
| **Research** | `/api/faculty-info`, `/api/research-profile`, `/api/project` |
| **Admin** | `/api/admin/auth`, `/api/admin/fresher-resources`, `/api/admin/buses`, `/api/admin/migrate` |

---

## Contributing

Contributions are welcome! Feel free to fork the repo and submit a pull request.

---

## License

This project is for educational purposes. No official license.
