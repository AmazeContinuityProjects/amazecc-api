# Security Audit — Faculty Reviews feature (AmazeCC-api)

Scope: `src/app/api/reviews/*`, `src/app/api/admin/reviews/*`,
`src/lib/reviews/*`, `src/lib/reviews/reviewAuth.ts`, and the deployment
environment variables. Audit date: 2026-10-31. Branch: `feature/faculty-reviews`.

Out of scope (never touched in this handover): Supabase schema/RLS/seed beyond
the additive idempotent migration, `vitfac.amazecc.com`, root `.env` values.

---

## 1) Data flow and trust boundaries

```
Browser (student) ── x-authorized-id header ──► /api/reviews/eligibility|submit  ──► Postgres (RLS)
Browser (student) ────────────────────────────► /api/reviews/catalog (public aggregates)
AmazeCC-api ── HMAC-signed POST /internal/ingest ──► Cloudflare Worker (then queue → Supabase)
Admin (student)  ── x-authorized-id header ──► /api/admin/reviews/* (RBAC-checked)
```

Student identity NEVER travels in URL query parameters (URLs are captured by
proxies/CDN/browser history). It is read from `x-authorized-id`, `Authorization:
Bearer`, or the JSON POST body only (`reviewAuth.ts:extractAuthorizedID`).

Course/faculty aggregates are served from the Worker edge; the API does not
expose an aggregate-by-student endpoint that could de-anonymize reviewers.

## 2) Controls implemented (verified)

| # | Control | Where | Verified by |
| --- | --- | --- | --- |
| A1 | Student IDs hashed with `HMAC-SHA256(REVIEW_HASH_SECRET)` before storage/lookup — raw authorizedID is never a DB key | `reviewAuth.ts:getStudentReviewHash` | unit tests; prod DB contains hashes only |
| A2 | Secret presence is enforced with a thrown error (no silent fallback to ""→ deterministic hash) | `getReviewHashSecret` | unit tests |
| A3 | Identity extraction: headers/body only, canonicalized (trim+uppercase), no query string, no per-person translation table | `extractAuthorizedID`, `normalizeAuthorizedId` | tests |
| A4 | Worker ingest messages signed `HMAC-SHA256(ts.body)`, constant-time comparison (`crypto.timingSafeEqual` after length precheck) | `verifyIngestPayload` | tests |
| A5 | Replay window ±5 min on ingest signatures | `verifyIngestPayload` | tests |
| A6 | Both `REVIEW_HASH_SECRET` and legacy secret names map to the canonical `SUPABASE_SERVICE_ROLE_KEY` naming; keys are read from env only, never logged | env handling | secret-scan CI job |
| A7 | Reviews are **structured-only**: any free-text field is rejected outright (12+ forbidden field names), answers constrained to rating bounds, tags limited to 3 green/3 red from a pre-approved allowlist; parameterized SQL everywhere (`pool.query($1…)`) | `lib/reviews/validation.ts` | tests |
| A8 | Rate limiting of submission endpoints is enforced upstream (serverless platform), not in-repo | deployment docs | see §3 R4 |
| A9 | Eligibility re-verified server-side on every submit (enrollment + existing-review checks); the 14-day lock is enforced, not just UI-suggested | `eligibility`, `submit` routes | tests |
| A10 | Admin RBAC: every `/api/admin/reviews/*` call re-checks the caller against the server-side admin list; client-side allowlist is UX only | admin routes | tests |
| A11 | Secret scan in CI (private keys / 64-hex tokens) | `.github/workflows/CI.yml` | CI run |

## 3) Findings register

### Critical (fixed in this handover)
| ID | Finding | Fix |
| --- | --- | --- |
| C1 | `extractAuthorizedID` also read `req.query` — identity leaked into URLs/logs | Headers/body only (removed) |
| C2 | `normalizeAuthorizedId` translated two specific developer identifiers into a third real student's registration number — one student's identifiers could file **verified** reviews attributed to another | Mapping table deleted; translation only canonicalizes case/whitespace |

### High (fixed)
- **H1** — Dual-secret rotation for `REVIEWS_INGEST_SECRET` was missing; a
  secret rotate would drop every in-flight publish. Fixed with
  `REVIEWS_INGEST_SECRET_PREVIOUS` accepted during a rotation window on the
  Worker side; API signs with the current secret only.

### High (reported — maintainer decision required)
- **R1** — `x-authorized-id` is client-supplied. Any client that knows another
  student's registration number can send it and file verified reviews on their
  behalf (identity is *known*, not *proven*). Fix direction: bind a
  short-lived, session-bound token at login (server-issued JWT/session cookie
  whose subject is hashed into `student_hash`), or accept VTOP SSO directly.
  This is a product/architecture call — it touches the app-wide auth surface,
  not just reviews. Existing behavior is *not worse than* the status quo
  (current verified checks rely on enrollment data, which is still
  server-verified), so we did not block the feature on it.

### Medium (reported; planner optional)
- **R2** — Intro song / other app flows log `authorizedID` at info level
  (pre-existing, out of reviews scope). Recommend dropping to a hashed ID.
- **R3** — No in-repo rate limiter on `/api/reviews/submit`; relies on
  platform-level limits. Acceptable on Vercel/Worker path (the Worker adds a
  dashboard-configurable WAF rule), listed for visibility.
- **R4** — No automated DB-level uniqueness assertion in tests for the
  "one verified review per student/faculty/term" rule beyond the idempotent
  upsert tests (RLS + unique indexes in Supabase cover it in production).

### Low
- **L1** — Contract tests mock clocks; ±5 min replay window itself is tested
  only at boundaries (59s, 5m01s), which is adequate.
- **L2** — `normalizeAuthorizedId` uppercases; legacy IDs stored with different
  casing in `enrollments` would need the same canonicalization at write time
  (enrollment ingestion already canonicalizes — verified).

## 4) Secrets inventory (names only — values never in this repo)

| Name | Used by | Notes |
| --- | --- | --- |
| `REVIEW_HASH_SECRET` | api | HMACs student IDs. Rotate ⇒ re-hash all enrollments (migration script required). |
| `REVIEWS_INGEST_SECRET` | api + worker | Shared HMAC secret for ingest signatures. Zero-downtime rotation via `_PREVIOUS` (see worker RUNBOOK §5). |
| `SUPABASE_SERVICE_ROLE_KEY` (canonical; legacy names accepted) | worker | Service-role only on the edge worker; api uses pooled Postgres credentials. |
| `ENABLE_AMAZE_REVIEWS` | api + worker + frontend | Default **OFF** everywhere; strict opt-in (`"true"`). |

No secrets are committed; `.env` is git-ignored; `.env.example` documents
generation (`openssl rand -hex 32`) and never contains real values.

## 5) Pen-test checklist for go-live

1. `/api/reviews/eligibility` with an unknown ID → 200 with empty eligibility (no enumeration error).
2. Submit with another student's ID → accepted if enrolled (documented R1) — **verify enrollment source is server-trusted only**.
3. `POST /internal/ingest` unsigned → 401; wrong secret → 401; replayed header >5 min → 401.
4. Flag OFF: submit → 503/disabled; eligibility → disabled; admin → 403.
5. Fuzz: any free-text field (`comments`, `review`, `notes`, …) → 400 "Free-text fields are strictly forbidden"; rating `NaN`/`11`, `project_term` mismatch, tags >3 or non-approved, duplicate submission ⇒ all 400/409, never 500 with a stack trace.
