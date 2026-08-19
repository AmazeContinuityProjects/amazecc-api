# Hardening Plan — Systemic Fixes

Prioritized execution plan. Items marked **[P0]** are active exploits today; **[P1]** are required before production; **[P2]** hygiene.

---

## P0 — Fix immediately (active exploit paths)

### 1. Auth-gate the 3 zero-auth admin routes
`/api/admin/cabshare/hubs`, `/api/admin/cabshare/trips`, `/api/admin/faculty-directories` — add `requireAdminAuth` + permission checks, or delete per `01-remove-list.md`.

### 2. Close the open SSRF
`POST /api/events/download` — restrict to a fixed `eventhubcc.vit.ac.in` host allowlist with URL-parse validation (scheme `https` only, no userinfo/IP/port), or remove.

### 3. Kill the credential-relay proxies
`/api/koha/patron`, `/api/lms-data`, `/api/vitol-data` — remove (they accept raw passwords with no auth/rate limit). If the app needs LMS/VITOL data, redesign with a server-side session issued at `/api/login` time.

### 4. Fix `/api/cron/reminders`
Verify `Authorization: Bearer <CRON_SECRET>` (Vercel cron secret) before querying subscribers and sending push. Currently anyone can mass-broadcast push notifications to every user.

### 5. Re-enable TLS verification
- `src/lib/clients/VTOPClient.ts` and `src/lib/clients/VitolClient.ts`: remove `rejectUnauthorized: false` (use the real VIT certs).
- Remove `process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"` from: `src/lib/eventHubAuth.ts`, `circulars/download`, `curriculum/download`, `curriculum/syllabus`, `events`, `events/login`, `events/paynow`.
- `src/lib/db.ts`: `ssl: { rejectUnauthorized: false }` → true (use Supabase CA).

### 6. Gate `/api/qbank/upload` + fix the SSRF chain
- Require auth (or uploader verification) + rate limit on `POST /api/qbank/upload`.
- Validate `fileUrl`: allow only `https`, known hosts (drive.google.com / docs.google.com), block private IPs / link-local / `169.254.169.254`, cap download size in `admin/import-to-storage`.

### 7. Fix `/api/notifications/*`
Auth + ownership checks: `subscribe` (validate endpoint origin, bind UserID to session), `unsubscribe` (verify ownership of endpoint), `status` (derive UserID from session).

---

## P1 — Systemic hardening (fixes ~150 routes at once)

### 8. Server-side session binding for all VTOP proxies
Today every VTOP route trusts client-supplied `cookies`/`authorizedID`/`csrf`. Replace with:
1. `/api/login` stores the VTOP session server-side (or signs an HMAC session token containing cookies — reuse the `auth.ts`/`clubAuth.ts` HMAC pattern) and returns a **session token**, never raw cookies.
2. All VTOP proxy routes verify the session token and inject the stored cookies — clients never touch raw VTOP cookies.
3. This one change removes the IDOR/credential-exposure of ~150 routes.

### 9. Authorization, not just authentication
`requireAdminAuth` verifies only the HMAC token. Add permission enforcement (pattern: `requireGoroboAdmin`):
- `admin/buses` → `buses` permission
- `admin/push` → `push` permission + rate limit
- `admin/settings/global` → key allowlist + superadmin-only
- `admin/storage` → superadmin-only + confirmation + rate limit (mass delete)
- `admin/migrate` → superadmin-only (ideally move DDL to CI); GET endpoint must not leak DB name/table inventory
- `admin/transport/seed` → reject client bodies in production (bundled JSON only)
- `admin/ocr`, `admin/ocr/reset` → `qbank` permission + existence checks
- `admin/clubs`, `admin/clubs/representatives` → permission + role allowlist
- `admin/fresher-resources*` → `fresher-resources` permission + length caps
- Gorobo money routes (`orders/[id]/complete`, `wallet/orders/[id]/settle`) → superadmin-only + audit log of actor
- Remove mock `/api/qbank/admin/ocr` (see remove list)

### 10. Rate limiting everywhere
Extend `src/lib/rateLimit.ts` to all write routes and all VTOP proxy routes:
- Replace in-memory Map with a shared store (e.g., DB table or Vercel KV); stop trusting `X-Forwarded-For` alone (hash IP + user-agent, or use `x-real-ip` behind proxy).
- Tune: login 5/min (already), proxies ~30/min/IP, admin writes ~10/min/IP, push broadcast 1/min.

### 11. Stop leaking `err.message`
~25 routes return the raw Postgres/axios error to clients (schema info). Return a generic message, log server-side.

### 12. Trim sensitive response data
- `/api/me`: stop returning `defaultCredentials` passwords (or scope to authenticated owner only).
- `/api/transport/routes` + `[id]`: strip `driver_phone`, `supervisor_phone`, `whatsapp_group`, `bus_location` (or gate behind auth).
- `/api/qbank/papers`: replace `SELECT *` with a public column allowlist.
- `/api/qbank/papers/download/[paperId]`: require `approval_status='APPROVED'`, add rate limit + content-type validation.
- `/api/settings/global` GET and `/api/stats`: require admin auth.
- `/api/docs`: disable Swagger spec outside non-production environments.

### 13. Redesign CabShare identity
Issue a signed token at `/api/cabshare/auth` (HMAC over reg_number); every cabshare route derives identity from the token, never from the request body/query. Fixes total IDOR (incl. `trips/me` phone-number leak). Add trip-membership check to `ratings`.

### 14. EventHub routes
- `/api/events/paynow`: never embed the password in returned HTML — authenticate server-side and generate the payment form on the server.
- Rate limit `events/login` (credential relay).
- Validate/sanitize the returned BillDesk HTML in `events/register` (remove injected `<base>`).

### 15. Input validation on amplifier routes
Cap semester loops: `all-grades`, `additional-learning`, `course-completion`, `wishlist`, `wishlist-registration`, `minor-honour` — bound the number of upstream calls per request.

---

## P2 — Hygiene

- Remove debug artifact in `/api/faculty-info` (`writeFileSync` to `c:/Users/sugee/...`).
- Remove duplicate `_csrf` param in `curriculum/download`.
- Validate `courseCode` before echoing into Content-Disposition in `curriculum/syllabus`.
- Fix dead `if/else` in `/api/payment-receipts`.
- Bound `offset` in `koha/search`; validate `biblionumbers` in `koha/availability`.
- Validate `semesterId`/`classId` format on routes that forward them to VTOP (`capstone`, `course-page`, `calendar`).
- `gorobo/orders`: validate `mapsUrl` format; consider CAPTCHA.
- `marks/sync`: bind `userHash` to the authenticated session (data poisoning).
- Add `middleware.ts` for global security headers + optional global auth policy.
- 2FA / shorter token TTL + revocation for admin tokens.

---

## Verification after changes

```bash
pnpm run lint
pnpm run build
```

Re-run the forensic scans (zero-width/unicode, eval/exec, encoded payloads, keyword injection) to confirm no regressions.