---
title: "Academics & VTOP"
description: "Every Academics & VTOP endpoint: method, path, auth and rate limits."
---

{/* generated: aapi2 */}

# Academics & VTOP

> **In one line:** The academic heart of the API: attendance, marks, grades, the FFCS planner bundle, courses, curriculum, calendar, circulars, hostel and on-duty - every one of these is a VTOP page turned into JSON.

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| post | `/api/whoami` | VTOP session (body) | - |
| post | `/api/attendance` | VTOP session (body) | - |
| post | `/api/attendance/htmlparser2` | VTOP session (body) | - |
| post | `/api/grades` | VTOP session (body) | - |
| post | `/api/ffcs` | VTOP session (body) | - |
| post | `/api/bulk` | VTOP session (body) | - |
| post | `/api/course-page` | VTOP session (body) | - |
| post | `/api/course-page/material` | VTOP session (body) | - |
| post | `/api/curriculum` | VTOP session (body) | - |
| post | `/api/curriculum/download` | VTOP session (body) | - |
| post | `/api/curriculum/syllabus` | VTOP session (body) | - |
| post | `/api/calendar` | VTOP session (body) | - |
| post | `/api/circulars` | VTOP session (body) | - |
| post | `/api/circulars/download` | VTOP session (body) | - |
| post | `/api/hostel` | VTOP session (body) | - |
| post | `/api/od` | VTOP session (body) | - |
| post, get | `/api/marks/stats` | VTOP session (body) | 60/min/IP |
| post | `/api/marks/sync` | VTOP session (body) | 20/min/IP |
| post | `/api/marks/tokens` | VTOP session (body) | 60/min/IP |
