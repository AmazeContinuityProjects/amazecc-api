# Audit: Proctor, Transport, Research, Wallet & Misc (43 routes)

Scope: `/api/proctor` → `/api/wishlist-registration`.

**Confirmed:** none of the 43 audited routes import `requireAdminAuth`/`requireClubAuth`. `VTOPClient` and `VitolClient` run with TLS certificate verification disabled. No `middleware.ts` exists.

| Route | Methods | Auth | What it does | Risk | Issues found | Verdict |
|---|---|---|---|---|---|---|
| `/api/proctor` | POST | None | VTOP proxy: proctor details | Med | Open cookie relay; no rate limit; proctor PII; TLS disabled | HARDEN |
| `/api/proctor-messages` | POST | None | VTOP proxy: proctor messages | Med | Open relay; no rate limit | HARDEN |
| `/api/profile-images` | POST | None | VTOP proxy: proctor + HoD/Dean + **student credentials (default passwords)** | High | Duplicate subset of `/api/me`; leaks `viewStudentCredentials`; open; no rate limit | **REMOVE** |
| `/api/programme-migration` | POST | None | VTOP proxy: programme migration page | Med | Open relay; no rate limit | HARDEN |
| `/api/receipt-download` | POST | None | VTOP proxy: payment receipts as styled HTML | High | Financial documents served to anyone with cookies; open relay; no rate limit | HARDEN |
| `/api/reexam` | POST | None | VTOP proxy: reFAT request page + submit re-exam request | Med | Can submit re-exam requests via relayed cookies; no rate limit | HARDEN |
| `/api/regulation` | POST | None | VTOP proxy: council regulations | Low | Open relay; no rate limit | HARDEN |
| `/api/research-attendance` | POST | None | VTOP proxy: scholar attendance with date filters | Med | Open relay; arbitrary date params; no rate limit | HARDEN |
| `/api/research-award` | POST | None | VTOP proxy: monthly award application | Low | Open relay; no rate limit | HARDEN |
| `/api/research-docs` | POST | None | VTOP proxy: research document upload page | Med | Open relay; upload surface; no rate limit | HARDEN |
| `/api/research-letters` | POST | None | VTOP proxy: research letters view | Low | Open relay; no rate limit | HARDEN |
| `/api/research-profile` | POST | None | VTOP proxy: research profile | Low | Open relay; no rate limit | HARDEN |
| `/api/research-templates` | POST | None | VTOP proxy: scholar template view | Low | Open relay; no rate limit | HARDEN |
| `/api/sap-info` | POST | None | VTOP proxy: SAP information | Med | SAP/account data; open relay; no rate limit | HARDEN |
| `/api/sap-project` | POST | None | VTOP proxy: SAP manage | Med | Open relay; no rate limit | HARDEN |
| `/api/scholar-leave` | POST | None | VTOP proxy: scholar leave request | Med | Can submit leave requests via relayed cookies; no rate limit | HARDEN |
| `/api/scholar-verification` | POST | None | VTOP proxy: scholar data verification | Med | Open relay; no rate limit | HARDEN |
| `/api/sem-request` | POST | None | VTOP proxy: semester transaction page | Med | Fee/transaction data; open relay; no rate limit | HARDEN |
| `/api/settings/global` | GET | None | **DB read: ALL rows from `app_config`** | Med | Public read of config while write is admin-protected; may contain sensitive values; `ensureTable()` DDL every request | HARDEN |
| `/api/slo-feedback` | POST | None | VTOP proxy: submits SLO feedback | Med | Can submit feedback for any account via relayed cookies; no rate limit | HARDEN |
| `/api/stats` | GET | None | **DB read: `api_route_logs` + `visitor_logs` → HTML chart dashboard** | Med | Unauthenticated internal analytics: route usage + hashed visitor IPs; info disclosure | HARDEN |
| `/api/status` | GET | None | Health check "API is working" | None | Harmless | KEEP |
| `/api/student` | POST | None | VTOP proxy: student profile only | Med | **Dead duplicate** — `/api/me` returns strictly more | **REMOVE** |
| `/api/student-withdraw` | POST | None | VTOP proxy: student withdraw page | Med | Open relay; no rate limit | HARDEN |
| `/api/swf-attendance` | POST | None | VTOP proxy: SWF event attendance | Low | Open relay; no rate limit | HARDEN |
| `/api/swf-registration` | POST | None | VTOP proxy: SWF event registration | Low | Open relay; no rate limit | HARDEN |
| `/api/swf-requisition` | POST | None | VTOP proxy: SWF requisition page | Low | Open relay; no rate limit | HARDEN |
| `/api/thesis-status` | POST | None | VTOP proxy: thesis status; optional `regNo` searches any scholar | Med | IDOR-flavored: caller-supplied `regNo` queries arbitrary scholars | HARDEN |
| `/api/thesis-submission` | POST | None | VTOP proxy: thesis submission page | Med | Open relay; no rate limit | HARDEN |
| `/api/timetable` | POST | None | VTOP proxy: timetable + per-semester fetch | Med | Open relay; N upstream calls; no rate limit | HARDEN |
| `/api/transcript` | POST | None | VTOP proxy: alumni transcript page | Med | Open relay; academic records; no rate limit | HARDEN |
| `/api/transport` | POST | None | VTOP proxy: transport registration + QR code + payment status | Med | Payment status + attendance QR for relayed cookies; no rate limit | HARDEN |
| `/api/transport/placements` | GET | None | DB read: flattened bus route placements | Low | No PII; unauthenticated DB read | KEEP |
| `/api/transport/routes` | GET | None | DB read: ALL routes incl. `driver_phone`, `supervisor_phone`, `whatsapp_group`, `bus_location` | Med | **Public PII exposure** (driver/supervisor phones, WhatsApp links) + live bus location; no auth; parameterized (no SQLi) | HARDEN |
| `/api/transport/routes/[id]` | GET | None | DB read: `SELECT * FROM buses_v2 WHERE id=$1` | Med | Same PII exposure; parameterized | HARDEN |
| `/api/transport/rules` | GET | None | DB read: `transport_rules` | None | Static rules; no sensitive data | KEEP |
| `/api/transport/track` | POST | None | VTOP proxy: live `busUrl` tracking link | Med | Open relay; live location URL; no rate limit | HARDEN |
| `/api/university-day` | POST | None | VTOP proxy: Uday certificates | Low | Open relay; no rate limit | HARDEN |
| `/api/update-loginid` | POST | None | VTOP proxy: `ChangePreferredUser` (change login ID) | Med | Account-modifying action via relayed cookies; no rate limit | HARDEN |
| `/api/vitol-data` | POST | None | **Logs into vitolcc.vit.ac.in with caller-supplied username+password**, scrapes assignments | High | Only raw-credential login proxy in repo; credential relay/phishing vector; account-lockout abuse; TLS disabled; no rate limit | **REMOVE** |
| `/api/wallet` | POST | None | VTOP proxy: wallet balance & transactions | High | Financial balance data through open relay; no rate limit | HARDEN |
| `/api/wishlist` | POST | None | VTOP proxy: wishlist per semester (loops all semesters) | Med | Amplification: 1 request → N upstream VTOP calls; open relay; no rate limit | HARDEN |
| `/api/wishlist-registration` | POST | None | VTOP proxy: near-identical copy of `/api/wishlist` | Med | Same amplification; near-duplicate | HARDEN |

## Highest-risk findings

1. **`/api/vitol-data` — credential-accepting open login proxy (High, REMOVE).** Only route that takes plaintext username/password and performs a full login + scrape, TLS disabled, zero rate limiting.
2. **~30 VTOP scrape proxies are unauthenticated session-cookie relays with no rate limiting** — re-exam requests, leave requests, feedback, login-ID change, fee receipts, wallet balance all accessible with any stolen session.
3. **Sensitive data in responses** — `/api/me` and `/api/profile-images` return `viewStudentCredentials` (default portal credentials/passwords); `/api/wallet` and `/api/receipt-download` financial data; `/api/transport/routes` and `[id]` publicly expose driver/supervisor phone numbers, WhatsApp links, and live bus location.
4. **Unauthenticated internal-info endpoints** — `/api/stats` (usage logs + hashed visitor IPs), `/api/settings/global` GET (entire `app_config`).
5. **Dead/duplicated code** — `/api/student` (⊂ `/api/me`), `/api/profile-images` (⊂ `/api/me`), `/api/wishlist` vs `/api/wishlist-registration`, `/api/transport/routes` supersedes `[id]`/`placements`.
6. **Infrastructure gaps** — no `middleware.ts`; rate limiting only on 4 routes; both HTTP clients disable TLS verification; rate limiter is in-memory (bypassed across instances).

No raw-string SQL injection found — all DB routes use parameterized queries or allow-listed values.