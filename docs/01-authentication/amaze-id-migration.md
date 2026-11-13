---
title: "Amaze ID migration plan"
description: "The phased plan to replace the HMAC admin/club/cabshare token families and the per-app VTOP re-login with one OIDC identity provider: auth.amazecc.com (better-auth on Cloudflare Workers + D1)."
---

# Amaze ID migration plan

> **Status (2026-11-13):** Phase 0 shipped. `https://auth.amazecc.com` is live (Cloudflare Worker `amazecc-auth`, D1 database `amazecc-auth`), issuing the OpenID Connect configuration at `https://auth.amazecc.com/api/auth/.well-known/openid-configuration`.
>
> **2026-11-13 (later):** Club-Hub migrated. Club reps now sign in through Amaze ID (auth.amazecc.com); /api/club-admin/* requires Amaze ID session + vtopRegNo + club_representatives row; no HMAC club tokens. /api/club-admin/my-clubs powers the Club-Hub switcher. AmazeCC (web) still untouched.
> **2026-11-13 (later):** RBAC shipped. `amazecc-auth` D1 `user.permissions` (comma-separated section keys, server-set) + roles `superadmin | admin | user`. `hono.amazecc.com` enforces section-level access on every admin route via the shared D1 (`AUTH_DB`); `migrate` + `/api/admin/users*` are superadmin-only. QBank storage: `import-to-storage`/`papers/download/*` use an R2 binding (`PAPERS_BUCKET`) or `B2_*` S3-compatible fallback; unconfigured → explicit `503 storage not configured`. Dashboard admin-users UI rewritten; login stores real D1 permissions. Local end-to-end verified: superadmin 200s where scoped admins get 403, anonymous 401. `auth.amazecc.com` admin plugin restricted to superadmin; OAuth client registration = admin or superadmin. AmazeCC-Dashboard is migrated to Amaze ID (direct cross-origin call from the static export; both workers answer CORS preflights with `Allow-Origin: *`, matching `api.amazecc.com`) and AmazeCC-Club-Hub now points at `hono.amazecc.com` (both deployed via GitHub Pages on merge). AmazeCC (web) intentionally not switched — its non-VTOP surface (cabshare, gorobo public, social, …) is not yet ported.

## Target architecture

```text
                        ┌──────────────────────────────┐
                        │ auth.amazecc.com             │
                        │ (Cloudflare Worker, D1)      │
                        │ better-auth + OAuth provider │
                        │                              │
                        │  Amaze ID users (no VTOP)    │
                        │  optional VTOP link          │
                        │  OIDC issuer / JWKS          │
                        └──────────────┬───────────────┘
                                       │ OIDC (authorization code + PKCE)
        ┌──────────────┬──────────────┼───────────────┬──────────────┐
        ▼              ▼              ▼               ▼              ▼
   AmazeCC web   Club-Hub      Dashboard        FFCS (later)   Kotlin / Flutter

   api.amazecc.com (Next.js) keeps ONLY the VTOP scraper.
   amazecc-api-hono (Cloudflare Worker) hosts the non-VTOP API.
   Inter-service: workers -> api.amazecc.com with a shared
   service secret, or a Cloudflare Queue for async VTOP jobs.
```

- **Amaze ID exists without VTOP.** Sign-up is email + password. VTOP is an *optional linked account* (`/api/vtop/link`), verified server-to-server against the VTOP scraper. VTOP passwords are never stored — they are used once for the link call and discarded.
- **One identity, many audiences.** Apps become OIDC clients; each gets its own `client_id`/`client_secret`, redirect URIs, and consent entry (skipConsent for first-party clients).
- **api.amazecc.com stays the VTOP scraper** (login, attendance, marks, …). It is the only service that solves captchas.
- **Non-VTOP routes move to Cloudflare Workers** (`amazecc-api-hono`). Routes that need VTOP data call the scraper server-to-server (`x-service-secret`) or enqueue a job; they never re-verify VTOP sessions in the edge.

## Phase 0 — foundation (DONE 2026-11-13)

- [x] `amazecc-auth` repo: Hono + better-auth 1.7 on Workers, D1 (`amazecc-auth`, APAC).
- [x] Email + password Amaze ID; internal UUID user id; `vtopRegNo` additional field.
- [x] OIDC/OAuth 2.1 provider (`@better-auth/oauth-provider`): issuer `https://auth.amazecc.com/api/auth`, discovery at `/api/auth/.well-known/openid-configuration`, PKCE, JWKS, client credentials, back-channel logout.
- [x] Admin plugin (role claim, default `user`, `admin` role for operators).
- [x] VTOP account linking endpoints (`POST/GET/DELETE /api/vtop/link`), one VTOP identity per Amaze ID.
- [x] Worker-rendered `/sign-in`, `/consent`, `/account` pages; RFC 8414 root-level well-known redirects.
- [x] D1 migration `0001_init.sql` applied locally and remotely; `BETTER_AUTH_SECRET` set; custom domain on `amazecc.com` zone.

## Phase 1 — client pilots (AmazeCC, Club-Hub, Dashboard)

Only these three apps move in this phase. Dashboard and Club-Hub stop treating bearer tokens as opaque blobs; AmazeCC gains "Sign in with Amaze ID" next to the VTOP login.

> Progress: **Dashboard** — Amaze ID session sign-in shipped (#44). **Club-Hub** — Amaze ID sign-in shipped (#22). **Both apps are now true OIDC clients (2026-11-14)**: authorization code + PKCE against `https://auth.amazecc.com`, silent `prompt=none` SSO on mount, `/userinfo` carries `role`/`permissions` custom claims. Registered in prod D1 as public PKCE clients **`amazecc-admin-dashboard`** and **`amazecc-club-hub`** (`skip_consent`, grant types `authorization_code`+`refresh_token`, 1h opaque access tokens hashed at rest). Dashboard PR #47, Club-Hub PR #25 (deploy on merge). **AmazeCC** — deferred; needs the remaining non-VTOP route groups ported (see below).
>
> Client PRs (do **not** merge until checks pass): AmazeCC-Club-Hub #25, AmazeCC-Dashboard #47. Both apps are static exports on GitHub Pages and deploy on merge to `main` — merging triggers production deploys.

1. **Register OAuth clients** (one-off per environment) via the operator procedure below. Status (2026-11-14):
   - `amazecc-admin-dashboard` — **registered** (public, PKCE, `https://admin.amazecc.com/auth/callback` + loopback dev, `skip_consent`)
   - `amazecc-club-hub` — **registered** (public, PKCE, `https://clubs.amazecc.com/auth/callback/` + loopback dev, `skip_consent`)
   - `amazecc-web` — pending the web cutover (public client + PKCE, redirect `https://amazecc.com/auth/callback` + local dev)
   - `amazecc-kotlin` — pending (public, `application_type='native'`, `amazecc://auth/callback` deep link)
   - `ffcs` — pending Phase 3
   - Set `skip_consent: 1` for first-party clients to keep the SSO hop seamless.
   - Note: SPA clients are **public**, never confidential — a secret shipped in a browser bundle is not a secret. Confidential clients are only for server-side apps (FFCS/Kotlin backend), hashed with better-auth's hasher.
2. **AmazeCC web**: add "Sign in with Amaze ID" (OIDC authorization code + PKCE). After sign-in, if `vtopRegNo` is absent, offer the VTOP link flow from settings (`POST /api/vtop/link` with VTOP username/password — the API call goes to `auth.amazecc.com`, which calls the scraper server-to-server).
3. **Dashboard**: sign in via Amaze ID. Gate admin surfaces on `user.role === "admin"`. During the grace period `/api/admin/auth` keeps working; schedule its retirement in Phase 4.
4. **Club-Hub**: sign in via Amaze ID. Club memberships remain in the existing tables (`club_representatives`); Phase 2 moves the *claim* into the token so Club-Hub stops sending `x-club-id` to a bespoke verifier.
5. **Docs**: this page + `01-authentication/amaze-id.md` replace the hand-rolled token docs once each client cuts over.

## Phase 2 — service-side (api.amazecc.com → Workers)

1. **amazecc-api-hono** verifies Amaze ID credentials locally against the shared D1 (done 2026-11-14): opaque OAuth access tokens are matched by `base64url(SHA-256(token))` against `oauthAccessToken` (revocation + expiry enforced); JWT access tokens (only minted once a resource audience is registered) verify offline against `https://auth.amazecc.com/api/auth/jwks` (`typ: "at+jwt"` required, DPoP-bound/`cnf` tokens rejected as plain Bearer); better-auth session tokens keep working. ID tokens are never valid API credentials. It maps identity to permissions:
   - `role`/`permissions` → admin RBAC (read from the D1 `user` row on every request — revocations apply instantly).
   - `vtopRegNo` → VTOP-linked identity for campus routes.
   - Club memberships → resolved from D1/`club_representatives` at token-use time, not trusted from a long-lived claim (revocations must take effect without waiting for token expiry).
2. **Route-by-route migration** of non-VTOP endpoints into the Worker, each with a parity test against the Next.js route (request/response fixtures in `grounding/`). Order: admin (users, buses, settings, push, gorobo) → cabshare → clubs → social → qbank → transport → everything else.
3. **VTOP-dependent non-VTOP routes** (e.g. anything that re-posts the VTOP captcha flow server-side) call `api.amazecc.com` with `x-service-secret` (shared secret, both sides) or enqueue via Cloudflare Queue when async is acceptable (e.g. fresher-resources sync).
4. **Next.js rewrite**: `next.config.ts` rewrites each migrated path to the Worker, keeping `api.amazecc.com` as the single public hostname during the transition. Delete the proxy entries as clients move.
5. **Secrets**: `VTOP_SERVICE_SECRET` set on both the Next.js app and the Worker; flip `amazecc-api-hono` from HMAC-admin verification to JWKS verification; keep the HMAC verifier behind a feature flag for one release.

## Phase 3 — FFCS accounts

FFCS holds the only real user table in the ecosystem (bcrypt + JWT, `MEMBER/ADMIN/SUPER_ADMIN`). Federation, not migration of passwords:

1. FFCS registers as OIDC client `ffcs` (confidential, PKCE).
2. On first Amaze ID sign-in, FFCS looks up/creates `users` row keyed by OIDC `sub`. The existing claim flow for imported FFCS rosters maps `sub` → pre-created placeholder.
3. FFCS roles stay in the FFCS DB (they are course/club-scoped, not global identity). `requireRole` unchanged, only the token source changes.
4. Parallel run: `JWT_SECRET`-issued tokens keep working for one release; then FFCS `requireAuth` verifies Amaze ID JWKS only.
5. `bcryptjs`/`jsonwebtoken` remain in FFCS for nothing once cutover completes; then remove.

## Phase 4 — decommission the HMAC families

- [ ] `src/lib/auth.ts` (admin HMAC), `src/lib/clubAuth.ts`, `src/lib/cabshareAuth.ts` deleted from Next.js and the Hono port.
- [ ] `/api/admin/auth` returns `410 Gone` with a pointer to Amaze ID.
- [ ] `ADMIN_SECRET`, `socialGrantSecret`-family keys rotated; `ID_SALT` documented as distinct.
- [ ] `ADMIN_VTOP_IDS` seeds the D1 `user.role="admin"` for the env-superadmins on first deploy, then the env var is deleted.
- [ ] Hono port drops byte-compatible HMAC verification once both admin surfaces are on JWKS.
- [ ] Docs (`01-authentication/*`) rewritten: VTOP login, admin-auth, club-auth, cabshare-auth get "superseded by Amaze ID" banners.

## Open items / risks

- **Email delivery**: no Resend/SMTP is wired up, so `requireEmailVerification` stays `false`. Add a provider (ZeptoMail/Resend) and flip it on before opening public sign-ups; Amaze ID is campus-internal until then.
- **Client registration is admin-only** (`clientPrivileges`) and the registration endpoint is `SERVER_ONLY` — there is no public self-registration (`allowDynamicClientRegistration: false`). See the operator procedure below.
- **Web client redirect URIs**: https required outside loopback; plain HTTP allowed only on literal loopback hosts (`localhost`, `127.0.0.1`, `[::1]`) via `allowInsecureRedirectUri`.
- **Local dev on this machine**: the network filter rewrites the `Origin` header of requests whose origin is `localhost:<same-port>` — sign-in returns `Invalid origin`. Workaround: use `127.0.0.1`; for browser-based local testing only, `DISABLE_ORIGIN_CHECK=true` in `.dev.vars` (dev-only).
- **Consent UX**: first-party clients should register with `skip_consent: 1`; third-party apps keep the consent screen.
- **Rate limiting**: better-auth rate limits are stored in D1 (`storage: "database"`); D1 write volume is fine at campus scale but watch the `rateLimit` table size.
- **Admin bootstrap**: create the first `user` row, then set `role='admin'` directly in D1 (`UPDATE user SET role='admin' WHERE email=...`). There is no self-service promotion by design.
- **Token revocation**: sessions are D1 rows (revoke = delete). Opaque access tokens are also hashed D1 rows (`oauthAccessToken`) - revoking = deleting/flagging the row, hono enforces it per request (1h TTL bounds the rest). JWT access tokens (only once a resource audience is registered) are stateless - keep access-token TTL short and use introspection for high-value routes if needed.
- **Multi-account**: one VTOP identity ↔ one Amaze ID, enforced. One email ↔ one Amaze ID, enforced. Deliberately no account merging UI yet.
- **UniCC**: remains the AmazeCC login-failover target with plaintext creds client-side; it should be retired once AmazeCC web uses Amaze ID for sessions (Phase 1 removes the "unicc fallback" path in `fetch-utils.ts`).

## Registering a client (operator procedure)

The OAuth client registration endpoint is `SERVER_ONLY` — never routed over HTTP. Only `admin`-role sessions may register clients (`clientPrivileges`). Registration is therefore a server-side operation.

**Local rehearsal** (writes to local D1 state only):

```sh
pnpm exec wrangler d1 migrations apply amazecc-auth --local
pnpm exec vite-node scripts/register-client.mjs --base-url http://127.0.0.1:8791 \
  --email <admin-email> --password '<password>' \
  --name "AmazeCC Web" --type public \
  --redirect-uris "http://127.0.0.1:3000/auth/callback" \
  --skip-consent true --local-db "$(find .wrangler/state/v3/d1 -name '*.sqlite' | head -1)"

# full PKCE roundtrip check: sign-up -> authorize -> code -> token -> userinfo
pnpm exec vite-node scripts/oidc-smoke.mjs --base-url http://127.0.0.1:8791 \
  --client-id <returned-client-id> --redirect-uri http://127.0.0.1:3000/auth/callback
```

**Production** (no HTTP route exists — insert directly):

1. Create the account and make it admin:
   `pnpm exec wrangler d1 execute amazecc-auth --remote --command "UPDATE user SET role='admin' WHERE email='<operator-email>'"`
2. Public clients (SPAs/mobile: PKCE, no secret) — insert directly:

   ```sh
   pnpm exec wrangler d1 execute amazecc-auth --remote --command "
   INSERT INTO oauthClient (id, clientId, name, redirectUris, grantTypes, responseTypes,
     tokenEndpointAuthMethod, applicationType, requirePKCE, skipConsent, disabled, scopes,
     createdAt, updatedAt, clientDiscoveryId)
   VALUES (
     lower(hex(randomblob(16))), 'amazecc-web', 'AmazeCC Web',
     '[\"https://amazecc.com/auth/callback\"]', '[\"authorization_code\"]', '[\"code\"]',
     'none', 'web', 1, 1, 0, '[\"openid\",\"profile\",\"email\",\"offline_access\"]',
     (strftime('%Y-%m-%dT%H:%M:%fZ','now')), (strftime('%Y-%m-%dT%H:%M:%fZ','now')), null)"
   ```

   Verify the exact column serialization against one row created locally first
   (`SELECT * FROM oauthClient`) — better-auth stores JSON arrays as text.
3. Confidential clients are only for server-side apps (e.g. FFCS backend). SPA/static clients (Dashboard, Club-Hub) are registered as **public** PKCE clients — done directly via SQL on 2026-11-14 (`amazecc-admin-dashboard`, `amazecc-club-hub`). For confidential clients, hash the client secret with better-auth's own hasher (`@better-auth/utils/password` `hashPassword`), set
   `tokenEndpointAuthMethod='client_secret_basic'`, and store the hash in
   `clientSecret`. If unsure, generate the client via the local rehearsal path
   against a throwaway D1 and copy the row - the hashing is then guaranteed
   correct.
4. Web clients require https redirect URIs; plain HTTP is allowed only on
   loopback (`allowInsecureRedirectUri` in `amazecc-auth/src/auth.ts`). Native
   apps (Kotlin/Flutter) should use `application_type='native'` with the app
   scheme (e.g. `amazecc://auth/callback`).

OIDC endpoints after cutover:

| What | URL |
|---|---|
| Issuer | `https://auth.amazecc.com/api/auth` |
| Discovery | `https://auth.amazecc.com/api/auth/.well-known/openid-configuration` |
| Authorize | `https://auth.amazecc.com/api/auth/oauth2/authorize` |
| Token | `https://auth.amazecc.com/api/auth/oauth2/token` |
| JWKS | `https://auth.amazecc.com/api/auth/jwks` |
| Userinfo | `https://auth.amazecc.com/api/auth/oauth2/userinfo` |
| Device authorization (RFC 8628) | `https://auth.amazecc.com/api/auth/device/code` (device request), `https://auth.amazecc.com/device` (user approval), poll `grant_type=urn:ietf:params:oauth:grant-type:device_code` on the token endpoint |
| End session | `https://auth.amazecc.com/api/auth/oauth2/end-session` |
| Sign in (UI) | `https://auth.amazecc.com/sign-in` |

SSO behavior for registered first-party clients (`skip_consent: 1`): an authorize redirect with a valid IdP session (or `prompt=none`) completes without any interaction, so a user with one Amaze ID session at auth.amazecc.com lands authenticated in every AmazeCC app - that's the "log in once" property. Access tokens are 1h opaque strings (hashed at rest); renewal is a silent `prompt=none` re-authorization, not a refresh grant. Sign-out offers both standard semantics (a two-choice button in each app): **app-only** (verified `/oauth2/revoke` for this app's tokens + local clear; IdP session persists) and **device-global** (this app's tokens revoked, then RP-Initiated Logout at `/oauth2/end-session` with `id_token_hint` - the device session dies and its session-delete hook revokes every session-bound token on this device, across all AmazeCC apps).
