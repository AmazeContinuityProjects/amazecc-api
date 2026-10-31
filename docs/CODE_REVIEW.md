# Code review: Faculty Reviews (AmazeCC-api)

Branch `feature/faculty-reviews`, 2026-10-31. Findings marked **fixed** were changed in
this branch; everything else is reported with a suggested fix.

## 1. Correctness

| Area | Result |
| --- | --- |
| Aggregation (runs in the Worker; config here) | Bayesian shrinkage `n_eff/(n_eff+m)*mean + m/(n_eff+m)*C` with `m = 8`, priors 3.65 (teaching) and 3.75 (project), weights verified 1.0 / unverified 0.5 (teaching) and 0.7 (project), recency half-life 4 semesters, 5% outlier trim at `n >= 20`. Math is consistent between `engine.ts` and the config. See Worker `docs/CODE_REVIEW.md` for the threshold issue |
| Question weights | Both tracks sum to 100 (tested); conditional lab question is re-normalised per component (tested) |
| Eligibility | Teaching requires an enrollment row for `(student, faculty, course, semester)` and an open review window (`semesterTiming.ts`); verified for rows that pass. **Project is never verified (fixed, was client-controlled)** |
| Idempotency | Unique index on the full submission key; submit uses `ON CONFLICT ... DO UPDATE`; edits are allowed for 14 days then locked (`editWindowDays`) |
| Project limit | `maxProjectReviewsPerYear = 3` is counted over **all time** (`SELECT COUNT(*) ... WHERE track = 'project'` has no year filter) (Medium C1) |
| Time and semester | `semesterTiming.ts` derives review windows from the semester id; the default semester `FALL2026-27` is hardcoded in two places (Medium C2) |
| Queue consumer | Worker inserts with `ignore-duplicates`; failures retry 3 times then dead-letter. The API writes first, so no review is lost when a message fails |

## 2. Maintainability

- Dead code: none in `src/lib/reviews`. `verifyIngestPayload` in `reviewAuth.ts` is only used by tests (the verifier that matters is in the Worker) (Low C3).
- Duplicated logic: `normalizeFacultyName` exists in `recordEnrollments.ts`, `sync-catalog/route.ts` and `admin/reviews/faculty/[id]/route.ts` (Medium C4: extract one helper).
- Magic numbers: submit rate limit (10 per 5 minutes) and enrollment rate limit (6 per 10 minutes) are inline; the 4 s ingest timeout and 3 s read timeout are inline. Move to `REVIEWS_CONFIG.limits` (Low C5). Project limit and edit window are already config.
- Config is a verbatim copy shared with two other places; a fingerprint test guards drift (see Worker `docs/CONTRACTS.md`).
- `console.warn` on Worker ingest failure and `console.error` on handler errors are intentional. No `TODO`/`FIXME` in the feature.
- Stray files: none. `docs/` contains only the audit and this review.

## 3. Types and tests

- `any` usage: `body: any` in the submit and enrollment-snapshot handlers and `Map<string, any>` in `eligibility/route.ts` (Low C6). The validator itself takes `unknown`.
- Tests added or present (62 in the API):

| Required area | Test |
| --- | --- |
| Validation | `reviews.test.ts`, `hardening.test.ts` |
| Eligibility | project is never verified (mocked DB) in `hardening.test.ts`; teaching eligibility is exercised through the route only by review (Medium C7: add a mocked-DB test for the 403 paths) |
| Aggregation | Worker repo (`aggregation.test.ts`) |
| Idempotency | key construction in `contract.test.ts`; DB-level uniqueness not tested (Medium C8) |
| `SnapshotStore` contract on all backends | Worker repo |
| Write-diffing | Worker repo |
| HMAC ingest check | `contract.test.ts` here (sign and verify); Worker `worker.test.ts` (verify) |
| No-free-text proof | `reviews.test.ts` and `hardening.test.ts` (free text in every slot) |
| Flag default off | `hardening.test.ts` (all five public routes return 503 and never touch the database) |
| Shared config drift | `questionConfigDrift.test.ts` |

## 4. Performance

- Public reads never query Postgres unless the Worker is unreachable (degraded mode).
  The degraded query is a single join over `faculty` and `faculty_aggregates`; it should
  not be used under load (it has no cache) (Low C9: add `s-maxage` to the degraded response, it already sets one).
- `eligibility` runs two indexed queries per call (`enrollments` by student, `reviews` by student).
- `recordEnrollmentSnapshot` runs up to five lookup queries per course sequentially (60 courses
  max after the cap). Acceptable, but batching would cut latency (Low C10).

## 5. Verification (clean checkout of the local commits)

| Gate | Result |
| --- | --- |
| install (frozen lockfile) | pass |
| typecheck | pass |
| lint | **1 error, 18 warnings, all pre-existing** (`src/lib/marksStats.test.ts:315`, identical to `main`); none in the reviews code |
| test | pass (62) |
| build | pass |
