# Security audit: Faculty Reviews (AmazeCC-api)

Scope: `src/app/api/reviews/*`, `src/app/api/admin/reviews/*`, `src/lib/reviews/*`,
`src/config/reviewQuestions.ts`, `migrate_reviews.sql`, and the review environment
variables. Audit date 2026-10-31, branch `feature/faculty-reviews`. The frontend and
Worker side is in `AmazeCC/docs/faculty-reviews/SECURITY_AUDIT.md` (the two are meant
to be read together).

Out of scope and unchanged: Supabase schema, RLS and seed data (only the additive,
idempotent `migrate_reviews.sql` is committed), `vitfac.amazecc.com`, any `.env`.
No secret values appear in this document.

## 1. Data flow

```
Browser ── x-authorized-id ──► /api/reviews/eligibility | submit | enrollment-snapshot ──► Postgres
Browser ───────────────────► /api/reviews/catalog | faculty/[id]   (proxy to Worker, degraded Postgres fallback)
API ── HMAC-signed POST ──► Worker /internal/ingest ──► queue ──► Postgres (insert, ignore-duplicates)
Admin ── admin token ──► /api/admin/reviews/*  (requireAdminAuth)
```

Identity is read from the `x-authorized-id` header, an `Authorization: Bearer` header,
or the JSON body. **Never the URL query.**

## 2. Findings

### Critical (fixed)

| ID | Finding | Fix |
| --- | --- | --- |
| C1 | `extractAuthorizedID` also read the query string, leaking identity into logs and history | removed (header or body only) |
| C2 | `normalizeAuthorizedId` mapped two developer-specific ids onto a third student's registration number, so those users could file verified reviews as that student | mapping deleted; normalisation is trim and uppercase only |

### High (fixed)

| ID | Finding | Fix |
| --- | --- | --- |
| H1 | `ENABLE_AMAZE_REVIEWS` was documented as default off but **no API code read it**: every review route was live on merge | `src/lib/reviews/featureFlag.ts`; submit, eligibility, enrollment-snapshot, catalog and faculty/[id] return 503 unless the value is exactly `true`; covered by `hardening.test.ts` |
| H2 | `POST /api/reviews/sync-catalog` was **anonymous**: it fetched an upstream roster, upserted faculty and triggered a Worker recompute | `requireAdminAuth` |
| H3 | Project-guide reviews were stored `verified` from a client-supplied `context.verified_context`, letting anyone self-award full weight | always `verified = false` for the project track (`submit/route.ts`) |
| H4 | Every successful submit also called the Worker's full `/internal/recompute` (reads every faculty and review row): a cost-exhaustion vector | removed; the Worker cron and the admin route recompute |
| H5 | Unknown top-level fields and unvalidated `context` and `project_term` values reached the database (a deny-list of 12 field names was the only guard) | allow-list of keys; `context` values and `project_term` must come from the approved lists; identifier patterns for `course_code` and `semester` |
| H6 | `enrollment-snapshot` accepted unbounded, unvalidated client text that is written to the public faculty catalog (auto-provisioning) | cap of 60 courses, character and length limits, per-student rate limit (`enrollmentInput.ts`) |
| H7 | Dual-secret rotation for `REVIEWS_INGEST_SECRET` was missing | accepted on the Worker side via `REVIEWS_INGEST_SECRET_PREVIOUS` |

### High (open, maintainer decision)

| ID | Finding | Why it is not fixed here | Suggested fix |
| --- | --- | --- | --- |
| R1 | **Identity is client-asserted** (`x-authorized-id`). Anyone who knows a registration number can act as that student | app-wide authentication design | server-issued session or signed token at VTOP login; hash that subject |
| R2 | **Enrollments are client-asserted**, so Teaching "verified" can be self-granted | needs server-side VTOP verification | derive enrollments server-side, or weight client-sourced rows as unverified |
| R3 | **Small samples de-anonymise reviewers**: grades and per-question data publish from `n = 1` (`REVIEWS_CONFIG.aggregation.minReviewsToShowGrade = 1`) | product decision plus a three-repo config change | publish detail only at `n >= 3`; raise the minimum |

### Medium (reported)

| ID | Finding | Location | Suggested fix |
| --- | --- | --- | --- |
| M1 | In-memory rate limiter is per server instance | `src/lib/rateLimit.ts`, used in `submit/route.ts:36` | WAF rate rules (Worker DEPLOYMENT.md section 5) or a shared store |
| M2 | `OPTIONS` answers `Access-Control-Allow-Origin: *` on review routes | `eligibility`, `submit`, `enrollment-snapshot` routes line 14-16 | reuse an origin allowlist (identity is a header, not a cookie, so not credentialed) |
| M3 | Faculty auto-provisioned from client timetable text | `recordEnrollments.ts:142` | route unknown faculty to `unmatched_faculty` for admin review |
| M4 | Hardcoded `FALL2026-27` default semester | `recordEnrollments.ts:49`, `enrollment-snapshot/route.ts:50` | derive from `semesterTiming` |
| M5 | Hardcoded Supabase project host in image URLs | `sync-catalog/route.ts:62` | config value |
| M6 | `sync-catalog` takes the vitfac URL from code, fetches without timeout | `sync-catalog/route.ts` | add `AbortController` timeout |
| M7 | No automated assertion for the "one verified review per student per faculty per term" rule beyond the upsert test | tests | add an integration test against a test database |
| M8 | Vulnerable production dependencies (22 advisories: 7 high in `undici` and `follow-redirects`, 12 moderate, 3 low) | `pnpm-workspace.yaml` overrides pin `undici` at `7.29.1` (patched is `7.30.1`) | bump overrides and run `pnpm up` |

### Low

- L1: `introSong` and other pre-existing flows log `authorizedID` (outside reviews).
- L2: `normalizeAuthorizedId` uppercases; ids stored by other flows with different casing need the same canonicalisation at write time (enrollment ingestion does it).
- L3: `lint` fails on one pre-existing error in `src/lib/marksStats.test.ts:315` (`require()` import), identical to `main`.

## 3. Controls verified

| Control | Where | Test |
| --- | --- | --- |
| Reviewer hash `HMAC-SHA256(REVIEW_HASH_SECRET, id)`; throws if the secret is unset | `reviewAuth.ts` | `reviews.test.ts` |
| Strict structured input, no free text anywhere | `validation.ts` | `reviews.test.ts`, `hardening.test.ts` |
| Ingest signature `HMAC(secret, "<ts>.<body>")`, +/- 5 min, constant-time compare | `reviewAuth.ts` | `contract.test.ts` |
| Parameterised SQL everywhere | all routes | review |
| Flag default off, strict opt-in | `featureFlag.ts` | `hardening.test.ts` |
| Admin routes behind RBAC | `/api/admin/reviews/*` all call `requireAdminAuth` | review |
| Eligibility and edit window re-checked on every submit | `submit/route.ts` | review |

## 4. Secrets inventory (names only)

| Name | Used by | Notes |
| --- | --- | --- |
| `REVIEW_HASH_SECRET` | API | keys every reviewer hash; must differ from every other secret; do not rotate casually |
| `REVIEWS_INGEST_SECRET` | API and Worker | identical on both; dual-secret rotation (Worker RUNBOOK section 5) |
| `ENABLE_AMAZE_REVIEWS` | API, Worker, frontend | default off |
| `REVIEWS_WORKER_URL` | API | Worker base URL per environment (not secret) |

No secret is committed. History scan results (no real secrets in any of the three
repos; two placeholder-only matches in this repo's `.env.example`) are in the AmazeCC
audit, section 2. A real registration number used as a test fixture was replaced; it
remains in earlier local commits of this unpushed branch (history was not rewritten).

## 5. Go-live checks

1. Flag unset: `POST /api/reviews/submit` returns 503 JSON; `GET /api/reviews/catalog` returns 503.
2. `POST /api/reviews/sync-catalog` without an admin token returns 401/403.
3. `POST /internal/ingest` on the Worker unsigned returns 401; wrong secret 401; stale timestamp 401.
4. Fuzz `submit` (flag on, staging): unknown field, free-text `context`, rating 0/6/NaN, tags over 3
   all return 400, never 500.
5. Project review: stored `verified = false` whatever the client sends.
