# Audit: Admin Routes (36 routes)

Scope: all `/api/admin/*`. Key systemic flaw: `requireAdminAuth` (src/lib/auth.ts) verifies the HMAC token but **never checks `permissions`**. Only transport routes, gorobo routes (`requireGoroboAdmin`), and users routes enforce role/permission.

| Route | Methods | Auth | What it does | Risk | Issues found | Verdict |
|---|---|---|---|---|---|---|
| `/api/admin/auth` | POST | None (login) + rate limit 5/min/IP | Validates creds via self-fetch to `/api/login`; signs 7-day HMAC admin token; auto-creates superadmin from `ADMIN_VTOP_IDS` env | Med | No 2FA; in-memory rate limit keyed on spoofable `X-Forwarded-For`; self-fetch SSRF/credential-leak if `NEXT_PUBLIC_API_URL` misconfigured; 7-day tokens, no revocation | HARDEN |
| `/api/admin/buses` | POST | `requireAdminAuth` — **no permission check** | `TRUNCATE` + bulk re-insert of entire `buses` table | High | Any admin (even qbank-only) can wipe/rewrite all bus data; no per-field validation | HARDEN |
| `/api/admin/cabshare/hubs` | POST, DELETE | **NONE** | Insert/delete `cabshare_hubs` rows | **CRITICAL** | Completely unauthenticated DB write/delete; leaks `err.message`; anyone can create/delete hubs | **REMOVE** |
| `/api/admin/cabshare/trips` | GET, DELETE | **NONE** | Lists all trips joined with user PII (name, reg_number, phone_number) + match requests; deletes any trip | **CRITICAL** | Unauthenticated PII disclosure of all cabshare users; unauthenticated deletion; `err.message` leak | **REMOVE** |
| `/api/admin/clubs/representatives` | GET, POST, DELETE | `requireAdminAuth` — no permission check | List/assign/remove club representatives | Med | Any admin can assign/revoke reps; arbitrary `role` strings stored unvalidated | HARDEN |
| `/api/admin/clubs` | GET, POST | `requireAdminAuth` — no permission check | List/upsert `club_details` | Low | Any admin can edit club content; no permission exists for clubs | HARDEN |
| `/api/admin/faculty-directories` | GET, POST, PUT, DELETE | **NONE** | Full CRUD on `faculty_directory_urls` | **CRITICAL** | Completely unauthenticated DB writes/deletes; `err.message` leak; URL field accepts arbitrary content (stored XSS) | **REMOVE** |
| `/api/admin/fresher-resources/[id]` | PATCH, DELETE | `requireAdminAuth` — no permission check | Update/delete fresher resource (allowlisted cols, parameterized) | Low | No permission enforcement; `err.message` leak | HARDEN |
| `/api/admin/fresher-resources` | GET, POST | `requireAdminAuth` — no permission check | List/create fresher resources | Low | No permission enforcement; weak validation; stores `content`/`url` raw | HARDEN |
| `/api/admin/gorobo/items/[id]` | PUT | `requireGoroboAdmin` | Update inventory item; price recomputed server-side | Low | Solid validation; no SQLi; minor: id not format-checked | KEEP |
| `/api/admin/gorobo/items` | GET, POST | `requireGoroboAdmin` | List/search/create items (`MAX(id)+1` auto-increment) | Low | Id-generation race under concurrency (benign); otherwise solid | KEEP |
| `/api/admin/gorobo/orders/[id]/complete` | POST | `requireGoroboAdmin` | `confirmed`→`completed` + creates wallet ledger entries (profit/GST/vendor cost = **money movement**) in tx with `FOR UPDATE` | Med | Money movement, no audit trail of who completed; no rate limit | HARDEN |
| `/api/admin/gorobo/orders/[id]/confirm` | POST | `requireGoroboAdmin` | `pending`→`confirmed` transition | Low | State check + parameterized | KEEP |
| `/api/admin/gorobo/orders/[id]` | GET, PUT | `requireGoroboAdmin` | Order detail + wallet entries; edit quote (server-side recompute, 10% discount cap) | Low | Validation strong; no SQLi | KEEP |
| `/api/admin/gorobo/orders` | GET | `requireGoroboAdmin` | List orders with filters, `LIMIT 500` | Low | Status allowlisted; parameterized | KEEP |
| `/api/admin/gorobo/wallet/orders/[id]/settle` | POST | `requireGoroboAdmin` | Marks customer/vendor wallet entries `settled` (**money movement**) | Med | Idempotent + party enum validated; no audit trail; not superadmin-only | HARDEN |
| `/api/admin/gorobo/wallet` | GET | `requireGoroboAdmin` | Financial summary + transaction history | Low | Read-only; permission-gated | KEEP |
| `/api/admin/migrate` | GET, POST | `requireAdminAuth` — no permission check + rate limit 3/5min | POST: runs full DDL migration (creates ~15 tables); GET: DB name + table inventory | High | Any admin can run schema migrations at runtime; GET leaks DB name + schema inventory; ops tool should be CI-only | HARDEN |
| `/api/admin/ocr` | POST | `requireAdminAuth` — no permission check | Flips `approval_status` to `OCR_QUEUED` for external worker (no consumer in repo) | Med | No `qbank` permission check; paperId not validated; worker external | HARDEN |
| `/api/admin/ocr/reset` | POST | `requireAdminAuth` — no permission check | Resets any paper's `approval_status` to `PENDING` | Low | Any admin can revert APPROVED papers; no permission/existence check | HARDEN |
| `/api/admin/push` | POST | `requireAdminAuth` — no permission check | Broadcasts push to **all** `push_subscriptions` | High | No `push` permission check; no rate limit → any admin can spam entire user base; title/body unbounded | HARDEN |
| `/api/admin/settings/global` | PUT | `requireAdminAuth` — no permission check | Upserts arbitrary `key`/`value` into `app_config` (JSONB) | Med | No key allowlist — any admin can overwrite any config/feature flag; `err.message` leak | HARDEN |
| `/api/admin/stats` | GET | `requireAdminAuth` | Aggregated counts | None | Read-only | KEEP |
| `/api/admin/storage` | GET, POST | `requireAdminAuth` — no permission check | GET: storage stats; POST `delete_orphaned` = **mass delete of all REJECTED papers**; `find_missing`; `rebuild_metadata` is no-op stub | High | Mass data deletion with no permission check/confirm/rate limit; stub action; `err.message` leak | HARDEN |
| `/api/admin/transport/placements` | GET, POST | `requireAdminAuth` + `transport`/`buses` perm | Wipe-all + rewrite placements across all routes | Med | Destructive replace-all but permission-gated; no shape validation | HARDEN |
| `/api/admin/transport/routes/[id]` | GET, PUT, DELETE | `requireAdminAuth` + `transport`/`buses` perm | Single-route CRUD on `buses_v2`; id validated int; parameterized | Low | Permission-gated; solid | KEEP |
| `/api/admin/transport/routes/[id]/stops` | POST | `requireAdminAuth` + `transport`/`buses` perm | Replace stops JSON for one route | Low | Permission-gated; minor: no stop-shape validation | KEEP |
| `/api/admin/transport/routes` | GET, POST | `requireAdminAuth` + `transport`/`buses` perm | `DELETE FROM buses_v2` + bulk re-insert all routes | Med | Destructive replace-all (rolled back on error); no per-field validation | HARDEN |
| `/api/admin/transport/rules/[id]` | DELETE | `requireAdminAuth` + `transport`/`buses` perm | Delete single rule | None | Fine | KEEP |
| `/api/admin/transport/rules` | GET, POST | `requireAdminAuth` + `transport`/`buses` perm | `TRUNCATE` + bulk re-insert rules | Med | Replace-all pattern; no validation of rule content | HARDEN |
| `/api/admin/transport/seed` | POST | `requireAdminAuth` + `transport`/`buses` perm | Wipes `buses_v2` + `transport_rules`, reseeds from bundled JSON **or arbitrary request body** | High | Attacker-supplied body → any transport admin can wipe ALL routes/rules and inject their own data; dev tool exposed at runtime; no rate limit | HARDEN |
| `/api/admin/transport/students` | POST, DELETE | `requireAdminAuth` + `transport`/`buses` perm | Bulk replace students for a route; delete all students for a route | Med | Mass delete scoped to one route; no per-row validation | HARDEN |
| `/api/admin/users` | GET, POST | `requireAdminAuth` + DB re-check of superadmin | List/add admin users; validates role + permission allowlist | Low | Proper superadmin gate (DB re-check, not token claim) | KEEP |
| `/api/admin/users/[username]` | PATCH, DELETE | `requireAdminAuth` + DB re-check of superadmin | Update role/permissions/is_active; delete user; guards last-superadmin + self-delete | Low | Well-guarded; field allowlist; parameterized | KEEP |

## Critical findings

1. **Three routes with zero authentication** — `admin/cabshare/hubs`, `admin/cabshare/trips` (PII dump), `admin/faculty-directories`. Live features. Remove or auth-gate immediately.
2. **Authentication without authorization** — `requireAdminAuth` never checks `permissions`; only transport/gorobo/users routes enforce them. Any admin can: truncate `buses`, run DDL migrations, mass-delete papers, broadcast push spam, overwrite config, wipe/reseed transport data.
3. **Runtime-exposed destructive tools** — `admin/migrate` (full DDL), `admin/transport/seed` (wipe + arbitrary body), `admin/buses`/`admin/transport/routes`/`admin/transport/rules` (truncate-and-replace).
4. **Money movement without audit** — `gorobo/orders/[id]/complete` and `gorobo/wallet/orders/[id]/settle` create/settle wallet ledger entries; no audit trail, not superadmin-only.
5. **Rate limiting** — only `admin/auth` and `admin/migrate`; in-memory, keyed on spoofable `X-Forwarded-For`.
6. **Info disclosure** — `err.message` from the Postgres driver leaked on many routes; `admin/migrate` GET returns DB name + table list.
7. **No global middleware** — no `middleware.ts`; every route relies on per-route (often missing) auth.