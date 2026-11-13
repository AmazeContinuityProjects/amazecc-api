---
title: "Quickstart: run the API locally"
description: "Clone, configure env vars, install, run, and make your first request to the AmazeCC API."
---

# Quickstart: run the API locally

> **In one line:** clone it, install with pnpm, point it at a Postgres URL, `pnpm dev`, then `curl localhost:3000/api/health`.

## What you need

- **Node.js 22 LTS** and **pnpm** (the repo pins `packageManager: pnpm@11.24.0`).
- **A Postgres connection string** (Supabase works out of the box; any pg-compatible pool works).
- A terminal, and about five minutes.

## Steps

```bash
git clone https://github.com/AmazeContinuityProjects/AmazeCC-API.git
cd AmazeCC-API
pnpm install
```

Create `.env` in the repo root with **at minimum**:

```bash
# Postgres (Supabase) — REQUIRED, or every DB-backed route 500s
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres

# The HMAC secrets — three independent 32+ byte random strings
ADMIN_SECRET=<generate>
ID_SALT=<generate>
SOCIAL_GRANT_SECRET_KEY=<generate>  # MUST differ from ADMIN_SECRET and ID_SALT
```

Generate them with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Then:

```bash
pnpm dev
```

The API is now listening on **http://localhost:3000**. Prove it:

```bash
curl http://localhost:3000/api/health
# {"status":"ok"}

curl http://localhost:3000/api/status
# {"text":"API is working"}
```

## Your first real call

`/api/health` proves the process is alive. `POST /api/login` proves the VTOP machinery works —
it will solve the captcha server-side and return your cookies/csrf/authorizedID:

```bash
curl -X POST "$API/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"21BCE0000","password":"your-password"}'
```

Replace `$API` with `http://localhost:3000`. A success looks like:

```json
{
  "success": true,
  "message": "Login successful",
  "cookies": "JSESSIONID=...; _csrf=...; ...",
  "csrf": "<current csrf token>",
  "authorizedID": "21BCE0000",
  "clubToken": null
}
```

Keep those values. Next to them, take the next page — **[How a request flows](./how-a-request-flows.md)**.

## If it doesn't work

| Symptom | Likely cause |
|---|---|
| `pnpm dev` fails at build time | Missing native build tools for `canvas` (see [Deployment](../04-operations/deployment.md)) |
| `/api/health` 200 but everything 500s | `DATABASE_URL` not set or wrong pool parameters |
| `POST /api/login` returns captcha errors | VTOP is serving `gResponse` reCAPTCHA to your IP — VTOP serves reCAPTCHA to datacenter IPs specifically |
| `POST /api/login` 401/502 | Wrong VTOP credentials, or VTOP changed the login page markup |

## The demo trick

There is no demo mode on the API itself — the frontend's demo mode is a fixture. To develop UI
without hitting VTOP, use the frontend's demo data. To develop *this* repo, you must have a VTOP
account. If you don't, seed a read-only dev database and read the routes with
`{ success: true, ... }` responses in the reference pages.

## Where to next

- **[How a request flows](./how-a-request-flows.md)** — what happens between `curl` and JSON.
- **[Authentication overview](../01-authentication/index.md)** — the credential families.
- **[API Reference](../03-api-reference/index.md)** — every endpoint, with a live try-it button.
