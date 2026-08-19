# Audit: Gorobo & QBank (15 routes)

Scope: `/api/gorobo/*` and `/api/qbank/*`.

**Context:** `papers_archive` is populated by the **unauthenticated** `/api/qbank/upload` (attacker-controlled `file_url`), then fetched server-side by the admin-gated `/api/qbank/admin/import-to-storage` → stored SSRF chain. Downloads are unauthenticated.

| Route | Methods | Auth | What it does | Risk | Issues found | Verdict |
|---|---|---|---|---|---|---|
| `/api/gorobo/items` | GET | None | Public SELECT from `gorobo_items` with optional category filter; calls `ensureGoroboSchema()` | Low | Public read-only fine for shopfront; no injection (parameterized); DDL auto-create on cold start benign | KEEP |
| `/api/gorobo/orders` | POST | None (by design) + in-memory rate limit 5/min/IP | Validates name/phone/items, resolves prices server-side, inserts `gorobo_orders` (JSONB items, total, delivery_mode, maps_url) | Med | Rate limit in-memory + spoofable `X-Forwarded-For`; `mapsUrl` stored unvalidated (stored-XSS if rendered unescaped); no CAPTCHA → order spam; pricing server-side (good) | KEEP |
| `/api/gorobo/seed` | POST | `requireAdminAuth` | Upserts item catalog from bundled JSON or request body; optional `replace` mode deletes all ids not in payload; transactional | Low | Admin-gated; uses `requireAdminAuth` not `requireGoroboAdmin` (no `gorobo` permission check); acceptable for admins | KEEP |
| `/api/qbank/admin/import-to-storage` | POST | `requireAdminAuth` | Fetches `paper.file_url` via axios (Google-Drive rewrite), uploads to B2/R2 as `papers/{paperId}.pdf`, rewrites `file_url` | High | **Stored SSRF**: `file_url` attacker-controlled via unauthenticated `/api/qbank/upload`; no scheme/host allowlist; follows redirects; no private-IP/cloud-metadata blocking; unbounded download → memory exhaustion; error leaks; `Host`/`x-forwarded-proto` header injection into stored `file_url` | HARDEN |
| `/api/qbank/admin/ocr` | POST | `requireAdminAuth` | **Simulated OCR**: sets `OCR_PROCESSING`, sleeps 3s, inserts 3 hard-coded mock questions, sets `PENDING_Q_APPROVAL` | Low | Dead/mock code ("SIMULATED OCR DELAY — replace with GPT-4o Vision / Mathpix"); pollutes prod DB with placeholder questions | **REMOVE** |
| `/api/qbank/admin/publish` | POST | `requireAdminAuth` | `UPDATE papers_archive SET approval_status='APPROVED'` by `paperId` | Low | Parameterized; no existence check; `qbank` permission not verified | KEEP |
| `/api/qbank/admin/questions/bulk` | POST | `requireAdminAuth` | Transaction: DELETE all questions for paper, then bulk INSERT supplied questions | Low | Admin-gated mass replace; no limits on array size/field lengths/marks range | KEEP |
| `/api/qbank/admin/questions` | GET/POST/PATCH/DELETE | `requireAdminAuth` on all | List/create/update/delete `qbank_questions`; PATCH builds SET from fixed field map | Low | No SQLi (hard-coded fields, bound values); admin-only | KEEP |
| `/api/qbank/admin/queue` | GET/PATCH | `requireAdminAuth` | GET all `papers_archive` rows (optional status filter); PATCH whitelisted fields incl. `approval_status`, `file_url` | Low | Field allowlist; no rate limit | KEEP |
| `/api/qbank/admin/reject` | POST | `requireAdminAuth` | Sets `approval_status='REJECTED'` | Low | Parameterized; no existence check | KEEP |
| `/api/qbank/courses` | GET | None | `SELECT DISTINCT course_code, title` from APPROVED papers | None | Read-only, no input, APPROVED-only | KEEP |
| `/api/qbank/papers` | GET | None | `SELECT *` from `papers_archive` for a course code, APPROVED only | Low | Parameterized; **leaks non-public columns** (`file_url`, `uploader_reg_no`, `approval_status`, internal storage URLs) to anonymous users; no rate limit on enumeration | KEEP (trim columns) |
| `/api/qbank/papers/download/[paperId]` | GET | **None** | Streams `papers/{paperId}.pdf` from B2/R2 | High | **Unauthenticated download**: no `APPROVED` check → PENDING/REJECTED papers downloadable; serves attacker-imported bytes inline → malware/abuse hosting; no rate limit → bandwidth/storage-cost DoS | HARDEN |
| `/api/qbank/questions` | GET | None | JOIN questions↔papers, APPROVED only, by course | Low | Parameterized; returns `correct_answer`/`options` to anonymous users (answer-key disclosure by design?) | KEEP |
| `/api/qbank/upload` | POST | **None** | Open INSERT into `papers_archive` with attacker-supplied `courseCode/title/fileUrl/uploaderRegNo`; status forced `PENDING` | High | **Open unauthenticated write**: no auth, no rate limit, no URL validation (accepts internal IPs/cloud metadata) → **root of stored-SSRF chain**; `uploaderRegNo` spoofable; unlimited row spam | HARDEN |

## Highest-risk findings

1. **Stored SSRF chain (High):** `POST /api/qbank/upload` (unauthenticated) plants arbitrary `file_url`; `POST /api/qbank/admin/import-to-storage` fetches it server-side (redirects followed, no private-IP/`169.254.169.254` blocking). Impact: internal network/cloud-metadata probing; fetched content then served publicly via the unauthenticated download route.
2. **Unauthenticated storage read / bandwidth abuse:** `GET /api/qbank/papers/download/[paperId]` serves any imported object, including non-APPROVED papers, with no rate limiting.
3. **Open unauthenticated write:** `POST /api/qbank/upload` — unlimited row creation (DB flooding), spoofable `uploaderReg_no`, arbitrary URLs.
4. **Dead mock code:** `/api/qbank/admin/ocr` writes hard-coded fake questions into production DB.
5. **Weak rate limiting:** only `gorobo/orders` rate-limited, in-memory, spoofable.

No raw-SQL injection found — parameterized queries throughout. HMAC admin-token scheme is sound (timing-safe comparison, 7-day expiry).