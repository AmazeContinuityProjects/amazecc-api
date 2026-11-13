---
title: "Response shapes: Auth & System"
description: "Login, the admin doorway, cron, notifications and the liveness probes - every response body, field by field."
---

# Response shapes: Auth & System

> **In one line:** the doorway (login), the vault key (admin auth), the heartbeat probes, and the announcement wires - all of them, exactly as the code emits them.

## POST /api/login

**Envelope:** success-wrapped (200) · 200 / 401 / 429 / 502 / 504 · reference: [login](../../03-api-reference/auth-system/login.md)

Success (HTTP 200):
| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | always `true` |
| `message` | string | literal `"Login successful!"` |
| `cookies` | string | `"; "`-joined session cookies (initial + post-login) |
| `csrf` | string | `_csrf` from the dashboard HTML |
| `authorizedID` | string | from `#authorizedID` (fallback: `username` uppercased) |
| `clubToken` | string \| `undefined` | signed club JWT - **present only if the user is in `club_representatives`**; `undefined` otherwise (key present, value undefined) |
| `clubRoles` | `{club_id, role}[]` | deduped by club_id (super-club-rep wins duplicates); `[]` otherwise - or if the DB lookup threw |

Failure - **note the key-name inconsistency**:
| Status | Body |
|---|---|
| 401 | `{ success: false, message }` - `"Invalid Captcha"` / `"Invalid Username / Password"` / `"Login failed for an unknown reason."` |
| 200 (!) | `{ success: false, message: "Please visit VTOP and change your password, it has expired after the usual 3 month period" }` - password-expired comes back as **200** |
| 504 | `{ success: false, error: "VTOP did not respond in time. Please try again." }` (50 s budget) |
| 502 | `{ success: false, error }` |
| 429 | global rate-limit shape |

Fire-and-forget: `syncClubsBackground` (club membership refresh).
**Typed?** `CaptchaResponse`/`CaptchaResult` in `src/types/data/login.ts` describe the captcha step; the response body is untyped. `LoginRequestBody` there is a stale type that doesn't match this handler.

## POST /api/admin/auth

**Envelope:** success-wrapped on 200 - **unwrapped errors** (`{ error }` only) on every failure · 200 / 400 / 401 / 403 / 429 / 500 · reference: [admin-auth](../../03-api-reference/auth-system/admin-auth.md)

Success:
| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `true` |
| `username` | string | upper-cased |
| `role` | `"superadmin" \| "admin"` | env-superadmin or DB grant |
| `permissions` | string[] | superadmins get `["dashboard","qbank","buses","push","fresher-resources","faculty-directories","faculty-directory","users","transport","gorobo"]`; others their stored JSONB array |
| `token` | string | `signAdminToken` - 7-day HMAC token, send as `Authorization: Bearer` |

Errors are raw `{ error }` with **no success flag**: 400 `"Username and password required"` · 401 `"Invalid VTOP Credentials or VTOP is down"` · 403 `"Access Denied: …"` (not an admin / deactivated / can't verify) · 500. (429 alone uses the wrapped `{success:false, error}`.)
Credentials are verified by calling this app's own `/api/login` - if captcha-solving is down, admin auth is down.
**Typed?** Consumer side: `AdminTokenPayload` in `src/lib/auth.ts`. Response untyped.

## GET /api/health

**Envelope:** none · always 200 · reference: [health](../../03-api-reference/auth-system/health.md)

`{ status: "ok" }` - liveness probe. No error path.
**Typed?** No.

## GET /api/status

**Envelope:** none · always 200 · reference: [status](../../03-api-reference/auth-system/status.md)

`{ text: "API is working" }` - liveness probe. No error path.
**Typed?** No.

## GET /api/docs

**Envelope:** none - **raw OpenAPI 3.0.0 document** via swagger-jsdoc · always 200 · reference: [docs](../../03-api-reference/auth-system/docs.md)

`openapi: "3.0.0"`, `info: {title, version: "1.0.0", description}`, `servers: [production, localhost:3000]`, `paths` built at runtime from `@openapi` JSDoc annotations in route files - the schemas are mostly auto-generated stubs and **do not reflect real handler payloads**. Not an envelope; clients must parse OpenAPI.
**Typed?** `getApiDocs()` inferred from swaggerJsdoc; `options` typed `swaggerJsdoc.Options`.

## GET /api/settings/global

**Envelope:** success-wrapped (public) · 200 / 500 · reference: [settings/global](../../03-api-reference/auth-system/settings-global.md)

Success: `{ success: true, config }` - `config` is `Record<string, unknown>` folded from `app_config` rows (JSONB already parsed). Fresh deploys yield `{}`.
**Typed?** Inline `Record<string, unknown>` - otherwise no.

## GET /api/fresher-resources

**Envelope:** success-wrapped · 200 always · reference: [fresher-resources](../../03-api-reference/auth-system/fresher-resources.md)

Success: `{ success: true, resources }` - explicit columns `{id (number), title, description, url (nullable), icon, sort_order, type: "link"|"text"|"md", content}`, only `is_active`, ordered by `sort_order` then `id`.
**Failure returns HTTP 200 too** with `{ success: false, resources: [] }` - check `success`.
**Typed?** No.

## POST /api/notifications/subscribe

**Envelope:** success-wrapped on success; **raw `{ error }` on failure** · 200 / 400 / 500 · reference: [subscribe](../../03-api-reference/auth-system/notifications-subscribe.md)

Success: `{ success: true }`. Errors (note: no `success:false`): 400 `{ error: "Invalid payload" }` · 500 `{ error: "Database error" }`. Upserts `push_subscriptions` keyed on `endpoint` (`UserID`, `subscription.endpoint`, optional `keys.p256dh`/`auth`, `vitol_enabled`, `vitol_reminder_day`, `vitol_reminder_time`).
**Typed?** No.

## POST /api/notifications/unsubscribe

**Envelope:** success-wrapped on success; raw `{ error }` on failure · 200 / 400 / 500 · reference: [unsubscribe](../../03-api-reference/auth-system/notifications-unsubscribe.md)

Success: `{ success: true }`. Errors: 400 `{ error: "Invalid payload" }` · 500 `{ error: "Database error" }`. Deletes by `endpoint` alone - **`UserID` is validated but never used** (anyone who knows an endpoint can delete its subscription).
**Typed?** No.

## GET /api/notifications/status

**Envelope:** **none** · 200 / 400 / 500 · reference: [notifications/status](../../03-api-reference/auth-system/notifications-status.md)

`?endpoint=` → `{ vitol: boolean, vitol_reminder_day: number, vitol_reminder_time: string }`; unknown endpoint yields the literal `{ vitol: false, vitol_reminder_day: 1, vitol_reminder_time: "10:00" }`. No `success` on any path.
**Typed?** No.

## GET|POST /api/cron/reminders

**Envelope:** partial - success has `success:true`; errors are raw · 200 / 401 / 500 · reference: [cron/reminders](../../03-api-reference/auth-system/cron-reminders.md)

Success variants: `{ success: true, message: "No reminders due at this time." }` or `{ success: true, message: "Reminders sent to <N> users." }` - no counts/rows beyond the human message. Errors raw: 401 `{ error: "Unauthorized" }` (timing-safe compare on `CRON_SECRET`) · 500 `{ error: "VAPID keys not configured" }` / `{ error: "Failed to run cron" }`. Fires web-push to subscriptions matching `vitol_enabled AND day = EXTRACT(DOW …) AND time within (now-6min, now]` (Asia/Kolkata); 410 responses delete rows.
**Typed?** No.
