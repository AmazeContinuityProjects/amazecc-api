# Audit: CabShare, Events, Faculty & Misc (34 routes)

Scope: `/api/cabshare/*`, `/api/events/*`, `/api/eca-upload` → `/api/hod-dean`.

**Cross-cutting facts:**
- None of these routes use `requireAdminAuth`/`requireClubAuth`.
- The CabShare feature has **no token system at all** — client-supplied `reg_number` is the only identity (the auth route's own comment admits: "the frontend will pass reg_number as auth"). This is total IDOR.
- `eventHubAuth` + several routes set `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` (process-global TLS disable).

| Route | Methods | Auth | What it does | Risk | Issues found | Verdict |
|---|---|---|---|---|---|---|
| `/api/cabshare/auth` | POST | None | VTOP login proxy: solves captcha, submits creds, scrapes name, upserts `cabshare_users` | High | Raw VTOP credentials, no rate limit (brute-force/credential-stuffing); TLS disabled; no token issued despite comment | HARDEN |
| `/api/cabshare/blocks` | POST, DELETE | None (client reg_number) | Insert/delete `cabshare_blocks` | Med | IDOR: anyone can claim any reg_number and block/unblock as that user | HARDEN |
| `/api/cabshare/hubs` | GET | None | Read-only list of `cabshare_hubs` | Low | Public directory data; no write path | KEEP |
| `/api/cabshare/match` | POST | None (client reg_number) | Creates/accepts/rejects/withdraws ride match requests | Med | IDOR: reg_number spoofable so owner check bypassable; no rate limit | HARDEN |
| `/api/cabshare/notifications` | GET, PATCH | None (reg_number in query/body) | Reads/marks-read notifications for a user | Med | IDOR: read another student's notifications by reg_number | HARDEN |
| `/api/cabshare/ratings` | POST | None (client reg_number) | Inserts rating into `cabshare_ratings` | Med | Spoofable rater identity; no trip-membership check; rating spam/manipulation | HARDEN |
| `/api/cabshare/stats` | GET | None | Aggregate counts (trips, users, hubs) | Low | Read-only aggregates; no PII | KEEP |
| `/api/cabshare/trips/me` | GET | None (reg_number in query) | User's trips + per-trip **requesters' name, reg_number, phone_number** | High | IDOR: any reg_number reveals another student's trips and requesters' phone numbers (PII leak) | HARDEN |
| `/api/cabshare/trips` | POST, GET | None (client reg_number) | Creates trips + fires waitlist notifications; lists active trips with owner name/regno | Med | Spoofable identity on POST (create trip as anyone, spam waitlist); GET exposes owner reg numbers | HARDEN |
| `/api/cabshare/waitlist` | POST | None (client reg_number) | Inserts into `cabshare_waitlist` | Low-Med | Spoofable identity; spam vector; no rate limit | HARDEN |
| `/api/events` | GET | None | Fetches eventhubcc.vit.ac.in and scrapes event cards | Med | `NODE_TLS_REJECT_UNAUTHORIZED='0'`; fixed URL (no SSRF); no rate limit | HARDEN |
| `/api/events/download` | POST | None (username/password or jsessionid) | **SSRF proxy: fetches any client-supplied `url` server-side and streams back** | **High** | Open SSRF — internal network / cloud-metadata probing; no valid auth needed (jsessionid unvalidated); TLS disabled | **REMOVE** |
| `/api/events/login` | POST | None | Forwards username/password to EventHub, returns JSESSIONID | High | Credential relay, no rate limit (brute force); TLS disabled | HARDEN |
| `/api/events/paynow` | POST | None | Generates HTML with user's username **and password in hidden form fields**, returned as JSON | High | Password embedded in plaintext in returned HTML (visible in DOM/network/logs); `url` passed through unvalidated; TLS disabled | HARDEN |
| `/api/events/preview` | POST | None (username/password/jsessionid) | Scrapes event preview + fetches poster image as base64 | Med | Credential relay; no rate limit; TLS disabled | HARDEN |
| `/api/events/profile` | POST | None (username/password/jsessionid) | Scrapes user's registered events, order IDs, payment status | Med | Credential relay; returns payment/order data; no rate limit; TLS disabled | HARDEN |
| `/api/events/register` | POST | None (username/password/jsessionid) | Automates registration: accepts T&C, submits payment form, returns BillDesk/payment HTML | High | Money-adjacent side effect with user's credentials; returned HTML injected with `<base>` tag (tampers form targets); no rate limit | HARDEN |
| `/api/eca-upload` | POST | None (VTOP cookies) | VTOP scrape of ECA upload courses | Med | Cookie relay; TLS disabled; no rate limit | HARDEN |
| `/api/exc-registration` | POST | None (cookies) | VTOP scrape of EXC registration semesters | Med | Cookie relay; TLS disabled; no rate limit | HARDEN |
| `/api/extra-curricular` | POST | None (cookies) | VTOP scrape of extra-curricular data | Med | Cookie relay; TLS disabled; no rate limit | HARDEN |
| `/api/facility-reg` | POST | None (cookies) | VTOP scrape of facility registration | Med | Cookie relay; TLS disabled; no rate limit | HARDEN |
| `/api/faculty-info` | POST | None (cookies) | VTOP faculty search scrape | Med | **Debug `writeFileSync("c:/Users/sugee/Documents/Testing/...")` left in** — throws ENOENT on Linux, breaks `searchTerm` path (dead code); cookie relay; TLS disabled | HARDEN |
| `/api/faculty/schools` | GET | None | Read-only list of schools from `faculty_directory_urls` | Low | Public directory data | KEEP |
| `/api/faculty/scrape` | POST | None | Fetches school URL from DB, scrapes faculty rosters; up to 3 redirects with `rejectUnauthorized:false`; self-heals DB URL | Med | No auth on scrape trigger (abuse/DoS); TLS disabled; DB update side effect | HARDEN |
| `/api/faq` | POST | None (cookies) | VTOP FAQ scrape | Med | Cookie relay; TLS disabled; no rate limit | HARDEN |
| `/api/fdp-certificate` | POST | None (cookies) | VTOP FDP certificate scrape | Med | Cookie relay; TLS disabled; no rate limit | HARDEN |
| `/api/fdp-registration` | POST | None (cookies) | VTOP FDP registration scrape | Med | Cookie relay; TLS disabled; no rate limit | HARDEN |
| `/api/feedback-status` | POST | None (cookies) | VTOP feedback status scrape | Med | Cookie relay; TLS disabled; no rate limit | HARDEN |
| `/api/fees-intimation` | POST | None (cookies) | VTOP fee intimation scrape (financial data) | Med | Cookie relay exposes fee data; TLS disabled; no rate limit | HARDEN |
| `/api/fine-upload` | POST | None (cookies) | VTOP fine challan upload page scrape | Med | Cookie relay; TLS disabled; no rate limit | HARDEN |
| `/api/fresher-resources` | GET | None | Read-only list of active resources from DB | Low | Public content; parameterized query | KEEP |
| `/api/docs` | GET | None | Serves full Swagger/OpenAPI spec | Med | Exposes complete API surface incl. admin endpoints (recon aid); no gating in production | HARDEN |
| `/api/health` | GET | None | `{status:"ok"}` | None | Nothing | KEEP |
| `/api/hod-dean` | POST | None (cookies) | VTOP HOD/Dean details scrape | Med | Cookie relay; TLS disabled; no rate limit | HARDEN |

## Highest-risk findings

1. **Open SSRF — `/api/events/download`**: fetches any client-supplied `http(s)` URL server-side. Most dangerous endpoint in the audit. Remove or restrict to `eventhubcc.vit.ac.in`.
2. **Credential-relay login proxies with no rate limiting** — `cabshare/auth`, `events/login`, `events/paynow`, `events/preview`, `events/profile`, `events/register`. `events/paynow` embeds the user's password in plaintext HTML.
3. **Total IDOR across CabShare** — identity is client-supplied `reg_number`; `trips/me` leaks other students' phone numbers.
4. **TLS disabled** — `VTOPClient` (all VTOP routes), `events`, `events/login`, `events/paynow`, `eventHubAuth`, incl. process-global `NODE_TLS_REJECT_UNAUTHORIZED='0'`.
5. **Dead/dev code — `/api/faculty-info`**: `writeFileSync` to a hard-coded Windows path.
6. **Public Swagger — `/api/docs`**: full API spec incl. admin routes served unauthenticated.