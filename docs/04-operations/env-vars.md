---
title: "Env vars"
description: "Every environment variable this service reads, grouped by subsystem — required vs optional, and what goes wrong when it's missing."
---

# Env vars

> **In one line:** three secrets, one database, one TLS escape hatch, and a dozen optional knobs.

Copy this table into a fresh `.env` and `pnpm dev`. Values marked **REQUIRED** will fail
routes silently or loudly if missing — there is no validation-on-boot enforced by code.

## VTOP (upstream)

| Var | Needed | What it does |
|---|---|---|
| `VTOP_BASE_URL` | no (default `https://vtopcc.vit.ac.in`) | Base URL for VTOP HTTP calls |
| `VIT_TLS_INSECURE` | **only if desperate** | `1` disables upstream cert verification wholesale. Never set it. |
| `VTOP_USERNAME` / `VTOP_PASSWORD` | scripts only | Used by `scripts/` probes; not by the runtime |

## Database (Supabase / pg)

| Var | Needed | What it does |
|---|---|---|
| `DATABASE_URL` | **REQUIRED** | pg connection string; falls back to `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `DATABASE_URL_UNPOOLED` |
| `PG_CA_CERT` | recommended | CA cert for TLS; without it pg connects **without TLS verification** (libpq warns but works) |
| `PG_POOL_MAX` | no (default 5) | Pool ceiling — raise only with evidence |

## Secrets & identity

| Var | Needed | What it does |
|---|---|---|
| `ADMIN_SECRET` | **REQUIRED** | HMAC root for admin + club + cabshare tokens. Rotate → all admin sessions die |
| `ID_SALT` | **REQUIRED** | HMAC root for `ownerKey` and `maskUserID` (social identity) |
| `SOCIAL_GRANT_SECRET_KEY` | **REQUIRED** | HMAC root for pairing-grant secrets. **Must differ from the two above** (asserted at boot by `instrumentation.ts`) |
| `CRON_SECRET` | **REQUIRED for cron** | `Authorization: Bearer` for `/api/cron/reminders` |
| `ADMIN_VTOP_IDS` | ops | Comma-separated registration numbers always treated as superadmin (bootstrap) |

## Storage (Backblaze B2 / R2-compatible)

| Var | Needed | What it does |
|---|---|---|
| `B2_REGION` / `B2_ENDPOINT` / `B2_ACCESS_KEY_ID` / `B2_SECRET_ACCESS_KEY` / `B2_BUCKET_NAME` | qbank only | S3-compatible endpoint for exam-paper PDFs |

## Push & platform

| Var | Needed | What it does |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | push only | web-push VAPID credentials |
| `TRUSTED_IP_HEADER` | infra | Which header to read for client IP (e.g. `cf-connecting-ip`) |
| `VERCEL` | platform | Present on Vercel; changes IP + timeout defaults |
| `NODE_ENV` | standard | `development` vs `production` |

## What you must never commit

- `.env` (obviously)
- `VTOP_PASSWORD` (used by probes only; never reads at runtime)
- `ADMIN_SECRET`, `ID_SALT`, `SOCIAL_GRANT_SECRET_KEY` — the three independent roots.
  They are pairwise-unrelated by design; if you reuse one across two of these roles,
  a leak of `ADMIN_SECRET` becomes a full identity-forgery vector.

## Verification in a new deploy

1. `pnpm dev` with only `DATABASE_URL` + the three secrets → `/api/health` 200?
2. `curl localhost:3000/api/admin/migrate` (GET) → `connected: true`?
3. `curl -X POST localhost:3000/api/admin/auth -d '{"username":"…","password":"…"}'` → token returned?

## Where to next

- **[Deployment](./deployment.md)** — the Dockerfile, line by line.
- **[Security footguns](./security.md)** — what each secret buys an attacker.
