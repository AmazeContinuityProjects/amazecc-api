# API Security Audit — Index & Overview

Forensic security review of all **213 API routes** in AmazeCC-API (Next.js App Router).

**Date:** 2026-08-18
**Method:** Full source read of every `route.ts` + auth/DB/client infrastructure, verified against git history and ROUTE_TRACKER.md.

## Headline numbers

| Metric | Count |
|---|---|
| Total route files | 213 |
| Admin-authenticated | 30 |
| Club-token authenticated | 5 |
| **Fully open (no auth)** | **~178** |
| Rate-limited | 4 (`/api/login`, `/api/admin/auth`, `/api/admin/migrate`, `/api/gorobo/orders`) |
| CRITICAL findings | 3 unauthenticated admin routes, 1 open SSRF, 3 credential-relay proxies |
| Recommended REMOVE | 18 |
| Recommended HARDEN | ~190 |
| Safe as-is (KEEP) | ~23 |
| SQL injection found | None (all queries parameterized) |

## Files in this directory

| File | Contents |
|---|---|
| `00-README.md` | This index |
| `01-remove-list.md` | The 18 routes recommended for removal, with reasons |
| `02-audit-student-academics.md` | Audit: student/academics VTOP proxies (33 routes) |
| `03-audit-admin.md` | Audit: all `/api/admin/*` routes (36 routes) |
| `04-audit-cabshare-events-faculty.md` | Audit: cabshare, events, faculty, misc (34 routes) |
| `05-audit-gorobo-qbank.md` | Audit: gorobo + qbank (15 routes) |
| `06-audit-scrapers-misc.md` | Audit: remaining VTOP scrapers, koha, lms, notifications (40 routes) |
| `07-audit-misc-remaining.md` | Audit: proctor, transport, research, wallet, misc (43 routes) |
| `08-audit-verified-directly.md` | Audit: 11 routes reviewed directly (me, marks, qcm, registration, schedule, dayboarder, ept) |
| `09-hardening-plan.md` | Systemic fixes and priority hardening plan |

## Top findings (executive summary)

1. **3 admin routes have ZERO authentication** and write/delete live data:
   - `POST/DELETE /api/admin/cabshare/hubs` — unauthenticated DB insert/delete
   - `GET/DELETE /api/admin/cabshare/trips` — unauthenticated PII dump (names, reg numbers, phone numbers) + deletion
   - `GET/POST/PUT/DELETE /api/admin/faculty-directories` — full unauthenticated CRUD

2. **Open SSRF:** `POST /api/events/download` fetches any client-supplied URL server-side.

3. **3 credential-relay proxies** accept live passwords with no auth/rate limit:
   - `POST /api/koha/patron` (Koha card+password)
   - `POST /api/lms-data` (Moodle username+password)
   - `POST /api/vitol-data` (VITOL username+password)

4. **~150 VTOP scrape proxies** accept client-supplied VTOP `cookies`/`authorizedID`/`csrf` with no server-side session binding and no rate limiting. `/api/me` (and `/api/credentials`) return **live portal passwords** (`viewStudentCredentials`) to any caller.

5. **Systemic auth flaw:** `requireAdminAuth` verifies only the HMAC token, never `permissions` — any admin can truncate tables, run DDL migrations, mass-delete, broadcast push, overwrite config.

6. **TLS verification disabled** in `VTOPClient`, `VitolClient`, `eventHubAuth` and via `process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"` in 8 routes.

7. **No SQL injection found anywhere** — parameterized queries throughout.

## Verdict legend

| Verdict | Meaning |
|---|---|
| **KEEP** | Safe as-is (public-by-design reads, well-gated admin) |
| **HARDEN** | Keep functionality but fix auth/rate-limit/validation/TLS |
| **REMOVE** | Delete: dead, duplicated, static, mock, or too dangerous to keep |