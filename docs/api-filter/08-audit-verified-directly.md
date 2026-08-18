# Audit: Routes Verified Directly (11 routes)

Routes not covered by the batch audits, reviewed line-by-line in this pass:
`/api/me`, `/api/dayboarder`, `/api/ept-schedule`, `/api/marks/stats`, `/api/marks/sync`, `/api/qcm`, `/api/qcm-view`, `/api/question-preview`, `/api/registration-status`, `/api/registration-schedule`, `/api/schedule`.

| Route | Methods | Auth | What it does | Risk | Issues found | Verdict |
|---|---|---|---|---|---|---|
| `/api/me` | POST | None (client cookies/authorizedID/csrf) | **Consolidated identity**: 6 parallel VTOP calls — student profile + proctor + HoD/Dean + **`viewStudentCredentials` (linked-account usernames AND passwords)** + APAAR + bank info; built via `buildIdentity` | **High** | Returns live portal passwords + bank data to any caller who supplies a session; open cookie relay, no rate limit, no server-side session binding; error message echoed | HARDEN |
| `/api/dayboarder` | POST | None (cookies/authorizedID/csrf) | VTOP auto-parse scrape of dayboarder page | Med | Standard open cookie relay; no rate limit | HARDEN |
| `/api/ept-schedule` | POST | None (cookies/authorizedID/csrf) | VTOP auto-parse scrape of EPT schedule | Med | Standard open cookie relay; no rate limit | HARDEN |
| `/api/marks/stats` | GET | None | **Open DB read** of class assessment stats by `classes` query param | Med | Unauthenticated DB read (parameterized, no SQLi); anyone can query class stats; no rate limit | HARDEN |
| `/api/marks/sync` | POST | None | **Open DB write**: client sends `actions` (max 500) with `userHash` + `timestamp`; updates Welford class/assessment stats via `class_user_hashes` | Med-High | **`userHash` is client-supplied and spoofable** — attacker can poison class statistics for any `classId` (no auth binds hash to real user); timestamp check weak (30s window); no rate limit; DB writes unbounded per request (500 actions) | HARDEN |
| `/api/qcm` | POST | None (cookies/authorizedID/csrf) | VTOP auto-parse scrape of QCM page | Med | Standard open cookie relay; no rate limit | HARDEN |
| `/api/qcm-view` | POST | None (cookies/authorizedID/semesterId/csrf) | VTOP auto-parse scrape of QCM view | Med | Standard open cookie relay; `semesterId` unvalidated; no rate limit | HARDEN |
| `/api/question-preview` | POST | None (cookies/authorizedID/csrf) | VTOP auto-parse scrape of question preview | Med | Standard open cookie relay; no rate limit | HARDEN |
| `/api/registration-status` | POST | None (cookies/authorizedID/semesterId/csrf) | VTOP auto-parse scrape of registration status | Med | Standard open cookie relay; `semesterId` unvalidated; no rate limit | HARDEN |
| `/api/registration-schedule` | POST | None (cookies/authorizedID/csrf) | VTOP auto-parse scrape of registration schedule | Med | Standard open cookie relay; no rate limit | HARDEN |
| `/api/schedule` | POST | None (cookies/authorizedID/csrf) | Exam schedule scrape with dedicated Cheerio parser (`ExamItem`/`Schedule` types) | Med | Standard open cookie relay; no rate limit | HARDEN |

## Notes

1. **`/api/me` is the crown jewel of the credential-exposure problem.** It bundles six VTOP endpoints into one call and returns the parsed result — including `viewStudentCredentials` passwords (via `parseCredentials`) and bank data — to any caller that can supply (or steal) a session. It also makes `/api/student`, `/api/profile-images`, `/api/credentials`, `/api/apaarid`, and `/api/bank-info` redundant (see `01-remove-list.md`).
2. **`/api/marks/sync` is a data-integrity risk**: the Welford statistics feeding `/api/marks/stats` and any leaderboard can be poisoned by anyone with a guessed `classId`, since `userHash` is not server-issued. Bind the hash to an authenticated session and rate-limit.
3. All other routes in this batch follow the identical open VTOP cookie-relay pattern — they inherit the same systemic fixes (session binding + rate limiting + TLS verification).