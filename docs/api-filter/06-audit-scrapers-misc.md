# Audit: VTOP Scrapers, Koha, LMS, Notifications (40 routes)

Scope: `/api/grades` → `/api/payments`.

**Confirmed:** zero of these 40 routes call `requireAdminAuth`/`requireClubAuth`. Rate limiting exists only on `/api/login` in this batch. All VTOP routes are open cookie-relay proxies; Koha/LMS clients run with TLS verification disabled.

| Route | Methods | Auth | What it does | Risk | Issues found | Verdict |
|---|---|---|---|---|---|---|
| `/api/grades` | POST | None | VTOP grade history + curriculum + CGPA + feedback status | Med | Open proxy; no session binding; no rate limit; duplicates `/api/all-grades` | HARDEN |
| `/api/graduated-info` | POST | None | VTOP passed-out info page, generic auto-parse | Low | Static/no-value page per tracker (P3); leaks `err.message` | **REMOVE** |
| `/api/hostel` | POST | None | Hostel profile + leave history + active leave (3 POSTs) | Med | Open proxy; superset of `/api/hostel-leave`; no rate limit | HARDEN |
| `/api/hostel-attendance` | POST | None | Month attendance report | Med | Open proxy; no rate limit; leaks `err.message` | HARDEN |
| `/api/hostel-counselling` | POST | None | **Scrapes VTOP `technoCrendentials` (TechnoVIT credentials/OTP page)** | High | Open proxy exposing student credentials page content; no rate limit | **REMOVE** |
| `/api/hostel-leave` | POST | None | Hostel leave page | Med | **Dead duplicate** — covered by `/api/hostel` | **REMOVE** |
| `/api/internship` | POST | None | Internship registration page | Med | Open proxy; no rate limit; leaks `err.message` | HARDEN |
| `/api/ir-outbound` | POST | None | IR visiting-request page | Med | Open proxy; no rate limit; leaks `err.message` | HARDEN |
| `/api/koha/availability` | GET | None | Koha item availability by biblionumber list | Low | No validation of `biblionumbers` (raw concat into URL); `rejectUnauthorized:false`; unbounded list | HARDEN |
| `/api/koha/detail` | GET | None | Koha MARC detail + holdings | Low | Input validated (digits-only); `rejectUnauthorized:false` on fixed host | KEEP |
| `/api/koha/patron` | POST | None | **Accepts `card` + `password`, logs into Koha OPAC, scrapes 9+ account pages** | High | Credential-forwarding/brute-force proxy; no rate limit; full patron data returned; TLS disabled; heavy sequential scrape | **REMOVE** |
| `/api/koha/search` | GET | None | Koha OPAC RSS search proxy | Low | `count` capped at 100, `offset` unbounded; TLS disabled; public data | KEEP |
| `/api/late-hour` | POST | None | Late-hour request page | Med | Open proxy; no rate limit; leaks `err.message` | HARDEN |
| `/api/library-due` | POST | None | Library payments/due page | Med | Open proxy; no rate limit; leaks `err.message` | HARDEN |
| `/api/library-keys` | POST | None | Scanning-request keys page | Med | Open proxy; no rate limit; leaks `err.message` | HARDEN |
| `/api/library-scanning` | POST | None | **Write path: merges arbitrary `formData` with hidden fields and submits scanning-request form** | Med | Open proxy that can submit actions on a VTOP session; no rate limit | HARDEN |
| `/api/lms-data` | POST | None | **Accepts `username` + `pass`, logs into Moodle LMS, scrapes assignments** | High | Credential-forwarding proxy; no rate limit → credential-stuffing/brute-force relay | **REMOVE** |
| `/api/login` | POST | Rate-limited only (5/min/IP, in-memory) | Real VTOP login: fetches+solves captcha locally, returns raw VTOP session cookies + csrf + authorizedID in body; issues HMAC club token; club sync side effect | Med | Cookies returned in plaintext JSON (no httpOnly/server session); auto-solves captcha (defeats anti-bot); rate limiter in-memory + spoofable `X-Forwarded-For` | HARDEN |
| `/api/login-history` | POST | None | VTOP login history, dedicated parser | Med | Open proxy; no rate limit; leaks `err.message` | HARDEN |
| `/api/mdp` | POST | None | MDP student view | Med | Open proxy; no rate limit; leaks `err.message` | HARDEN |
| `/api/meeting-info` | POST | None | Research scholar meeting page | Low | Static "Not a Research-Scholar" page per tracker (P3); leaks `err.message` | **REMOVE** |
| `/api/mess-feedback` | POST | None | Mess feedback page | Med | Open proxy; no rate limit; leaks `err.message` | HARDEN |
| `/api/mess-selection` | POST | None | Mess registration page | Low | Static "No valid bookings" page per tracker (P3); leaks `err.message` | **REMOVE** |
| `/api/minor-honour` | POST | None | Cascading dropdown scrape — N×M sequential VTOP POSTs | Med | **Request amplification** (recursive cascade, no caps) → DoS multiplier; leaks `err.message` | HARDEN |
| `/api/monthly-report` | POST | None | Research weekly-progress page | Med | Open proxy; no rate limit; leaks `err.message` | HARDEN |
| `/api/mooc-registration` | POST | None | MOOC registration page | Med | Open proxy; no rate limit; leaks `err.message` | HARDEN |
| `/api/mooc-upload` | POST | None | MOOC course list AJAX page | Med | Open proxy; no rate limit; leaks `err.message` | HARDEN |
| `/api/notifications/status` | GET | None | **Unauthenticated DB read**: push-subscription prefs by `UserID` query param | Med | **IDOR** — read any user's notification prefs by guessing UserID | HARDEN |
| `/api/notifications/subscribe` | POST | None | **Unauthenticated DB upsert**: arbitrary push endpoint + arbitrary UserID + prefs | High | **Push-spam vector** — inject junk endpoints, overwrite another user's subscription (upsert keyed on endpoint), pollute DB | HARDEN |
| `/api/notifications/unsubscribe` | POST | None | **Unauthenticated DB DELETE by endpoint** | High | **IDOR** — delete any user's push subscription; UserID not even checked | HARDEN |
| `/api/online-exam-attempt` | POST | None | Compre/online-exam attempt view | Med | Open proxy; no rate limit; leaks `err.message` | HARDEN |
| `/api/online-transfer` | POST | None | Finance online-transfer page | Med | Open proxy; no rate limit; leaks `err.message` | HARDEN |
| `/api/outcome-set` | POST | None | Outcome-set registration page | Med | Open proxy; no rate limit; leaks `err.message` | HARDEN |
| `/api/outgoing-report` | POST | None | Final-year check page | Med | Open proxy; no rate limit; leaks `err.message` | HARDEN |
| `/api/paper-see-rev` | POST | None | Paper-seeing/review page | Med | Open proxy; no rate limit; leaks `err.message` | HARDEN |
| `/api/pat-reg` | POST | None | PAT registration page | Med | Open proxy; no rate limit; leaks `err.message` | HARDEN |
| `/api/payment-receipts` | POST | None | Payment receipts by applNo, dedicated parser | Med | Open proxy; **dead code** — `if (applNo)` and `else` branches are identical; no rate limit | HARDEN |
| `/api/payments` | POST | None | P2P payments list, dedicated parser | Med | Open proxy; financial data exposure; no rate limit | HARDEN |

## Highest-risk findings

1. **Credential-forwarding proxies (critical):** `/api/lms-data` (Moodle `username`+`pass`) and `/api/koha/patron` (Koha `card`+`password`) — unauthenticated, unrate-limited brute-force/credential-stuffing relays. Remove both.
2. **~30 unauthenticated VTOP scrape proxies** — client-supplied cookies with no server-side session binding and no rate limiting. Since `/api/login` hands raw VTOP session cookies back to the client, any stolen cookie = full access to a student's academic, financial, hostel, and exam data. One shared fix: server-side session store + HMAC session token.
3. **`/api/hostel-counselling`** scrapes a credentials page (`technoCrendentials`) and returns it wholesale — remove.
4. **`/api/notifications/*`** — unauthenticated DB endpoints: subscribe (spam vector), unsubscribe (IDOR delete), status (IDOR read). Harden all three.
5. **`/api/login` itself** — returns VTOP cookies in plaintext JSON, auto-solves VTOP's captcha, rate limiter in-memory and bypassable.
6. **Redundant/dead endpoints:** `/api/hostel-leave` (⊂ `/api/hostel`), `/api/meeting-info`, `/api/mess-selection`, `/api/graduated-info` (static pages per tracker).
7. **Cross-cutting:** `rejectUnauthorized:false` on Koha clients; `err.message` leaked on ~25 routes; `/api/minor-honour` cascade amplification; `/api/koha/availability` unvalidated input; `/api/payment-receipts` dead branch.