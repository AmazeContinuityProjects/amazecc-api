---
title: "Admin auth"
description: "The HMAC admin bearer: how tokens are minted, verified on every request, and scoped per permission."
---

# Admin auth

> **In one line:** `POST /api/admin/auth` mints an HMAC bearer verified on every admin route; deactivation in the DB revokes immediately.

**Endpoint:** `POST /api/admin/auth`  
**Auth:** none (this is the door)  
**Issued token:** `Authorization: Bearer <token>`

## When you need this

Admin operations: users, storage, transport, clubs, fresher resources, QBank moderation, GoRobo back office, global settings. None of them are available without the token.

## Get a token

```bash
curl -X POST "https://api.amazecc.com/api/admin/auth" \
  -H "Content-Type: application/json" \
  -d '{"username":"21BCE0000","password":"your-password"}'
```

- Credentials are verified against VTOP (via loopback to `/api/login`) — so you need a real VTOP account to be admin.
- Your registration number must either be in the `ADMIN_VTOP_IDS` environment list or in the `admin_users` table with `is_active=true` and an assigned `role`/`permissions`.
- `ADMIN_VTOP_IDS` entries are always **superadmin** (all permissions, bypass DB).
- Failure returns `{ success: false, message: 'Unauthorized' }` with HTTP 401.

Success response:

```json
{
  "success": true,
  "username": "21BCE0000",
  "role": "superadmin",
  "permissions": ["*"],
  "token": "<base64url(payload)>.<hex-hmac-sha256>"
}
```

## How verification works (and why deactivation is instant)

The token is `base64url(payload).hex(HMAC_SHA256(key, payload))`, where `key` is derived as `HMAC(ADMIN_SECRET, "amazecc-token:admin")`. On **every** admin request:

1. `typ` is checked == `admin`.
2. `exp` is checked == not yet expired (7-day TTL).
3. The `admin_users` row for `username` is re-checked: `is_active = true`. If false → 401, immediately.
4. Permission checks (`gorobo`, `faculty-directories`, `fresher-resources`, `transport`) consult the JSON `permissions` array from the row.

So revoking an admin is a one-row update. The token may as well not exist after that.

## The superadmin escape hatch

`ADMIN_VTOP_IDS` (comma-separated registration numbers in the env) are always superadmin and skip the DB check entirely. This is the break-glass path for a fresh Supabase with no `admin_users` rows.

## What admin can do (that end users can't)

- Manage users (`/api/admin/users`), storage, transport data, club directory, fresher resources.
- Run the OCR pipeline for the QBank (`/api/admin/ocr`) and approve papers for publication.
- Broadcast web-push notifications to every subscriber (`/api/admin/push`).
- Global configuration: `/api/admin/settings/global` ← flip maintenance mode or a banner here.
- Broad transport/student/qbank ingests via seed routes.

## Config you will touch

- `ADMIN_SECRET` — the HMAC root. If it rotates, all admin tokens die.
- `ADMIN_VTOP_IDS` — superadmin list (backup login path).
- `admin_users` table — the canonical grant table (`username, role, permissions, is_active`).

## Where to next

- **[Club auth](./club-auth.md)** — the lighter-weight sibling.
- **[Reference → Admin](../03-api-reference/admin/index.md)** — every admin route, tried live.
- **[Operations → Security footguns](../04-operations/security.md)** — the public-write gotchas.
