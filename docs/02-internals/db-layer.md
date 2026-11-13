---
title: "The database layer"
description: "getDbPool, the circuit breaker, inline DDL, and why every table name is domain-prefixed."
---

# The database layer

> **In one line:** one pg Pool singleton, one `getDbError*()` translator, DDL inline with the routes that need it, and no ORM.

**File:** `src/lib/db.ts` · **Schema helpers:** `src/lib/<domain>Db.ts` (socialDb, gorobo schema, ffcsMatchDb…)

## The pool

`getDbPool()` returns a process-wide `pg.Pool`:

```ts
new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.DATABASE_URL_UNPOOLED,
  max: Number(process.env.PG_POOL_MAX ?? 5),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: /* localhost → false; else { ca?: PG_CA_CERT, rejectUnauthorized: !!ca } */,
})
```

Pool failure is detected and translated: `getDbErrorStatus()` returns 503 for circuit-breaker errors (pool starved/auth blew), 500 otherwise. `getDbErrorMessage()` returns a generic string — **driver details never reach the client** (table names, SQL, hosts would leak otherwise). The pool circuit breaker logs "wait ~60s" guidance when authentication failures repeat.

## House style: inline DDL

No migrations directory, no `db:push`, no ORM. Each domain's schema is created lazily on first use with `CREATE TABLE IF NOT EXISTS …`, wrapped in a memoized `ensure*Schema()` helper:

```ts
export const ensureSocialSchema = memoized(async () => {
  await pool.query(`create table if not exists social_people (...)`);
  await pool.query(`create table if not exists social_timetables (...)`);
  // …
});
```

Memoized once per process; failures re-arm after a cooldown. New tables only need an `ensure*()` call in the route or lib that uses them. The tradeoff is explicitness — but any engineer can `cat src/lib/socialDb.ts` and see the exact schema, which you should.

## Table naming

Snake_case, **domain-prefixed**: `social_*`, `gorobo_*`, `ffcs_match_*`, `class_*` (marks stats), `admin_*` (`admin_users`, `admin_audit_logs`), `qbank_*`, `buses*`, `push_subscriptions`, `app_config`, `api_route_logs`. If a table doesn't fit an existing prefix, it doesn't belong in this repo.

## What the indexes tell you

`social_people.handle` is `unique` (it's an HMAC of a reg number — idempotent re-mint), `social_timetables(owner_key, semester_id)` is the composite primary lookup, `ffcs_match_entries.class_ids` is **GIN-indexed** for `@>` containment queries, `push_subscriptions.endpoint` is a unique text key. The schema is the source of truth for query plans — grep it before adding an index.

## Health check

`POST /api/admin/migrate` has a GET sibling that reports pool connectivity and table counts without running DDL. If it 503s, the pool is starved and every DB-backed route is dead too.

## Where to next

- **[The social crypto](./social-crypto.md)** — the one place the DB and secrets really collide.
- **[Backblaze B2 & the paper pipeline](./b2-and-ocr.md)** — the storage layer that isn't pg.
- **[Rate limits and the captcha](../01-authentication/vtop-login.md)** — the other wall.
