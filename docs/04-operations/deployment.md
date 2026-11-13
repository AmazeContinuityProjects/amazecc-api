---
title: "Deployment"
description: "The Dockerfile explained line by line, why CI has no test job, and how Vercel and Riven both pick this repo up."
---

# Deployment

> **In one line:** multi-stage `node:22-bookworm-slim`, pnpm 11, `canvas` needs native libs, and nothing else happens until you push.

**The pipeline:** commit to `main` → CI (`lint + build`) → auto-deploy to the target (Vercel or Riven).

## The Dockerfile (multi-stage, `node:22-bookworm-slim`)

**Stage `deps`:** apt installs the native build chain for `canvas` (`build-essential python3 libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev pkg-config`) — `canvas` powers the offline captcha solver. Copy `package.json + pnpm-lock.yaml + pnpm-workspace.yaml` (the workspace yaml carries pnpm 11 `allowBuilds` — the captcha model needs it) and `pnpm install --frozen-lockfile`.

**Stage `builder`:** `NEXT_TELEMETRY_DISABLED=1`, `pnpm run build`. Product is fully static-export? No — server rendering is needed for the API routes; it builds `.next/` with a Node runtime.

**Stage `runner`:** fresh slim image + runtime-only canvas libs (`libcairo2 libpango-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 fontconfig fonts-dejavu-core`) — **no pnpm**, no dev deps — `COPY --chown=node:node` of `node_modules/.next/public`, `next.config.ts`, `package.json`, and **src** (the `/api/docs` swagger-jsdoc globs `src/app/api/**/*.ts` at runtime from cwd — without `src/`, the docs endpoint would only return empty schemas). `USER node`, `EXPOSE 3000`, `CMD` execs `next start -H 0.0.0.0 -p "${PORT:-3000}"`.

## Why pnpm, not npm

`package.json` pins `packageManager: pnpm@11.24.0`. The lockfile is `pnpm-lock.yaml`. Do not `npm install` — the canvas native build relies on the pnpm workspace's `allowBuilds` and the lockfile layout is incompatible.

## Why CI has no test job

`vitest run` exists (5 test files — `ffcsMatch`, service-worker precache, `marksSync` models). It is not gated. The repo line is honest: *"Build and lint are the gates."* If you add tests, wire them — but do not block the deploy on them without team sign-off.

## Vercel vs Riven

- **Vercel** — original target (`amazecc-api.vercel.app`). The repo has no `vercel.json` (fine — Vercel infers from `package.json`). Vercel's default timeout is 30s on Hobby — VTOP_PHASE_BUDGET_MS is 50s, which **exceeds** it — the login endpoint will time out on Hobby plans; Pro ($20/mo) or the Docker path is needed.
- **Riven** — the current host: deploys the Dockerfile preferentially, honors `$PORT` injected at runtime, and the image is self-contained Postgres-agnostic.

## Health after deploy

```bash
curl https://api.amazecc.com/api/health      # {"status":"ok"}
curl https://api.amazecc.com/api/status      # {"text":"API is working"}
curl https://api.amazecc.com/api/admin/migrate   # GET: connectivity + table list
```

## Where to next

- **[Cron and push](./cron-and-push.md)** — the scheduler you need once Vercel is replaced.
- **[Env vars](./env-vars.md)** — what each of those means for prod.
