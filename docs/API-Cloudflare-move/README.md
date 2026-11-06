# AmazeCC API -> Cloudflare Workers migration plan

**Status:** Proposal. No runtime or deployment changes have been made.  
**Repository review date:** 2026-11-06.

## Executive decision

Moving the API to Cloudflare Workers is feasible. The recommended shape is a
Cloudflare Worker as the **only public API entry point**, with Worker-native API
handlers taking over incrementally and a private Vercel/Node origin retained
only for routes that still require Node-native dependencies.

Since the API is willing to be rewritten, the long-term target should be a
Worker-native router using standard `Request`/`Response` APIs (Hono is a
reasonable router), not a permanent Next.js compatibility layer. Keep business
logic in portable TypeScript modules and put database, VTOP and platform work
behind narrow adapters. Do not attempt a one-shot port of all routes.

This can reduce Node/serverless work, improve edge ingress and make database
connection management more predictable. It **does not by itself reduce VTOP
request counts or VTOP rate-limit consumption**. Those need explicit batching,
deduplication, refresh policy and caching. A Worker also does not remove the
PostgreSQL query cost; Hyperdrive can improve connection reuse and latency, not
make expensive queries free.

The practical rollout is a strangler migration: keep the current API contract
and hostname, route compatible paths to Workers, and route verified exceptions
to Vercel. The Worker becomes the gateway before most handler code has moved.

## What exists today

Repository observations:

- The API is a Next.js 16 App Router application. The repository has 178
  `src/app/api/**/route.ts` modules; its README describes 215+ endpoints across
  50+ categories.
- The README documents Vercel deployment. A Node Dockerfile is also present;
  confirm which deployment is the production source of truth before cutover.
- PostgreSQL/Supabase is used through `pg`. `src/lib/db.ts` holds a process-wide
  `Pool` with a default maximum of five connections.
- VTOP access is mainly Axios-based and HTML parsing is mainly Cheerio-based.
  Social timetable parsing is in `src/lib/socialTimetable.ts`.
- `canvas` is used by `src/app/api/login/solveCaptcha.ts`, imported by both
  `/api/login` and `/api/cabshare/auth`. These routes are the first known
  Vercel/Node exceptions unless the CAPTCHA implementation is replaced.
- `src/lib/socialVocabulary.ts` reads `config.json` using Node filesystem/path
  APIs. Make this data a build-time module/binding rather than depending on the
  Node working directory.
- `src/lib/rateLimit.ts` keeps limits in an in-memory `Map`. It is
  process/isolate-local and is not a global quota.
- `src/proxy.ts` supplies CORS and response headers. It currently reflects any
  request `Origin` while allowing credentials; the Worker must use an explicit
  AmazeCC origin allowlist rather than copying that behavior.
- `node-cron` is in the manifest, but no source imports were found in the
  repository scan. Verify provider-side cron configuration separately.
- The API docs UI is part of the Next app and Swagger is generated from route
  annotations. Keep a working `/docs` and OpenAPI surface during the migration.

This is an initial compatibility map, not a complete audit of all 178 route
modules or their transitive imports.

## Target architecture

```text
AmazeCC static clients
        |
        | existing API hostname and HTTP contract
        v
Cloudflare Worker API Gateway (public entry point)
  - CORS, request IDs, edge rate limits, route dispatch
  - Worker-native handlers (Hono or standard Request/Response)
  - shared TypeScript domain/services
        |                         |
        | Hyperdrive              | signed internal proxy only
        v                         v
Existing Supabase/Postgres   Vercel/Node compatibility origin
                                  - /api/login (canvas CAPTCHA)
                                  - /api/cabshare/auth (canvas CAPTCHA)
                                  - any further exceptions found by audit
```

The API hostname stays stable, so the AmazeCC client should not need a
provider-specific rewrite. The origin hostname is separate from the public
hostname to prevent a proxy loop. Vercel exceptions must not remain directly
callable without the gateway's internal authentication.

The Worker should not become a generic, silent fallback to Vercel for unknown
paths. Maintain an explicit path/method dispatch table and return a normal 404
for an unregistered route.

### Routing and origin protection

1. Attach the API custom domain/route to the Worker.
2. Keep the Vercel deployment on a separate origin hostname.
3. For Vercel exceptions, have the Worker forward method, path, query, body,
   content headers, and safe response headers without rewriting the existing
   public response contract.
4. Sign Worker-to-Vercel requests with a timestamped HMAC over method, path,
   and body digest. Validate it in the Vercel entry proxy before route code
   executes. Reject direct origin requests and stale/replayed signatures.
5. Store separate Worker and Vercel secrets; rotate them independently.
6. Preserve request cancellation and upstream timeouts. Do not log request
   bodies, VTOP cookies, CSRF values, register numbers, or grant secrets.
7. Define CORS for the actual AmazeCC web origins and known local development
   origins. Return `Vary: Origin` where appropriate. Never treat CORS as
   authentication.

### Worker runtime and code structure

Recommended long-term approach:

- Use a Worker-native router such as Hono, or a small standard-Web-API router.
- Keep route handlers thin: parse/validate, authenticate, call a service, map
  the result to an HTTP response.
- Separate portable business logic from platform-specific adapters:
  `services/`, `repositories/`, `adapters/vtop/`, `adapters/database/`,
  `adapters/storage/`, and `worker/routes/`.
- Use `fetch` for VTOP and other HTTP services, with shared timeout,
  cancellation, retry, and error mapping. Replace Axios incrementally rather
  than changing every caller in one patch.
- Preserve request/response contracts while moving routes. Version behavior
  changes separately from runtime migration.
- Generate or bundle static data (including the slot vocabulary) at build
  time. Use Web Crypto where suitable; use Node compatibility only where it
  passes explicit runtime tests.

Cloudflare also documents running Next.js on Workers through **vinext** and
continues to document OpenNext. As of the review date, Cloudflare calls vinext
the recommended path and labels it beta. It is a useful compatibility
prototype, but because this project is willing to rewrite and the API is
mostly route handlers, it is not the recommended long-term boundary. Run its
compatibility check if evaluating it; do not assume every current dependency
or route works on Workers.

## Runtime and dependency disposition

| Existing concern | Initial disposition | Work required |
|---|---|---|
| Next route handlers / `NextRequest` / `NextResponse` | Port to Worker router | Preserve status, body, cookies, headers, and route semantics with contract tests |
| `pg` and Supabase/Postgres | Keep PostgreSQL; connect through Hyperdrive | Replace the global pool assumption with a Worker-safe DB adapter; use Hyperdrive-managed pooling and short-lived request clients; validate transactions and prepared statements |
| `canvas` CAPTCHA solver | Keep login and cabshare CAPTCHA paths on Vercel initially | Either retain `/api/login` and `/api/cabshare/auth` as exceptions, or replace `canvas` with a tested Worker-compatible image decoder/processor before moving them |
| Axios VTOP clients | Port to `fetch` | Match cookies, URL encoding, redirects, referers, timeout behavior, and error parsing; test against fixtures and a controlled account |
| Cheerio HTML parsing | Compatibility-test, then retain or replace | Verify package/runtime size and parsing parity. Do not silently accept incomplete VTOP pages |
| `socialVocabulary` filesystem read | Remove runtime filesystem dependency | Generate a TypeScript/JSON artifact during build or bind the data explicitly; compare the resulting slot-map version |
| `node:crypto`, filesystem/path APIs | Prefer Web Platform APIs/static imports where practical | Cloudflare has Node compatibility, but it is a subset; test each used API and do not treat import shims as proof of runtime support |
| S3-compatible AWS SDK usage | Port only after a focused spike | Validate signing, streaming, body size and timeouts; keep upload/download routes on Node until parity is proven |
| Cron/scheduled jobs | Worker Cron Triggers or a Worker Workflow | First identify actual deployment schedules; the current source scan did not find `node-cron` imports |
| `/docs`, OpenAPI, API homepage | Keep working throughout | Serve static docs where possible; otherwise retain on Vercel until a Worker-native docs route is ready |

Hyperdrive supports PostgreSQL databases including Supabase. It is not a
database migration: keep the current database and schema initially. Do not add
Firebase or D1 as a parallel store for this move.

## Rate-limit and performance strategy

Track three separate budgets; optimizing one does not automatically optimize
the others.

| Budget | What actually controls it |
|---|---|
| VTOP upstream requests | Avoid refetching unchanged data; coalesce duplicate syncs; batch reads; use per-user refresh cooldowns; bound retries; honor `Retry-After`; use circuit breakers |
| PostgreSQL connections and query load | Hyperdrive pooling; indexed, bounded queries; batch endpoints; connection/query metrics; avoid N+1 reads |
| Vercel/Worker requests, CPU and cost | Move compatible compute, use edge rate limits, cache only safe public data, and retain only necessary Vercel exceptions |

Never publicly cache authenticated timetables, profiles, credentials, or
student lookup responses. Cache keys must not omit user/semester/visibility
boundaries. Public, slowly changing responses (for example health metadata or
the current-semester label) may be cached after correctness tests.

For VTOP, use a per-user/per-operation dedupe key and a maximum age for cached
derived data. Do not send VTOP session cookies to a durable queue. Queue only
work that does not need the live session, or use an explicit short-lived
credential exchange if a later product requirement truly needs async VTOP
work.

Replace in-memory rate limits with a deliberate strategy:

- Cloudflare rate-limiting rules for coarse edge protection by IP/route.
- A shared store or Durable Object for application quotas keyed by a
  pseudonymous authenticated user and operation.
- Separate limits for login/CAPTCHA, VTOP sync, social lookup, uploads, and
  public reads.
- Document which limits are best-effort versus hard. Test limits across
  independent Worker isolates and Vercel instances.

## Migration phases

Each phase is independently deployable and has a stop/rollback gate.

### Phase 0 - Baseline, inventory, and success criteria

- Confirm production hosting, domains, DNS ownership, Vercel origin protection,
  scheduled jobs, database region, connection limits, and current client API
  URL.
- Inventory every route from `src/app/api` and `ROUTE_TRACKER.md`. Record:
  method/path, auth domain, request/response schema, caller count, VTOP calls,
  database tables/queries, external services, body/stream size, timeout,
  Node-only dependencies, cron/webhook use, and current owner.
- Classify each route:
  - **W1:** Worker-native with no external state.
  - **W2:** Worker + Hyperdrive database.
  - **W3:** Worker + external HTTP/VTOP; requires outbound/credential tests.
  - **V:** Vercel exception, with reason and expected removal path.
  - **D:** deprecated/unreferenced; verify before removing.
- Establish baseline p50/p95/p99 latency, error rate, Vercel invocations,
  Worker cost target, VTOP requests per user sync, database connection count,
  slow queries, and 429/5xx counts.
- Set explicit success thresholds before implementation. Do not promise lower
  VTOP request counts merely because compute moves.

**Exit gate:** signed-off route matrix and a measurable before/after dashboard.

### Phase 1 - Worker and database proof of concept

- Create a separate Worker package/config with generated Cloudflare types and
  local test bindings.
- Add `GET /api/health` and one low-risk read route; use Hyperdrive to query a
  non-sensitive table.
- Test local, preview, staging, and production database connectivity, TLS,
  connection churn, transaction behavior, query cancellation, and failure
  recovery.
- Verify Worker CPU, bundle size, cold-start behavior, logs, metrics, and
  origin placement.
- Do not move login, CAPTCHA, or user schedule data in this phase.

**Exit gate:** parity tests pass and DB connections/latency are within the
Phase 0 thresholds.

### Phase 2 - Public gateway and protected Vercel origin

- Configure the API hostname to route through the Worker without changing
  clients.
- Add the explicit route dispatch table and Vercel-origin forwarding.
- Add timestamped HMAC origin verification and reject direct bypasses.
- Replace reflected-origin CORS with an origin allowlist; verify preflight,
  cookies, auth headers, error responses, and `Vary` behavior.
- Ensure unknown routes fail closed, and add an emergency route-level rollback
  switch.

**Exit gate:** all legacy endpoints still work through the Worker gateway;
direct Vercel-origin requests are rejected; rollback is tested.

### Phase 3 - Shared foundations

- Introduce shared validation/contracts and stable error envelopes.
- Introduce Worker-compatible database repository helpers and move a first
  domain from direct global-pool usage.
- Add request IDs, redacted structured logs, trace boundaries, metrics and
  alerting.
- Add shared/global application rate limiting and per-route quotas.
- Add cache policy declarations; default authenticated responses to
  `private, no-store`.
- Move database schema changes out of route first-hit DDL where practical:
  versioned SQL migrations run once by a controlled deployment step.

**Exit gate:** shared behavior is tested in both Worker and Vercel runtimes;
no credentials/PII appear in logs; rate limits work across instances.

### Phase 4 - Port routes by domain

Port one domain at a time behind the existing public paths. A suggested order:

1. Health, static/current-semester metadata, and other low-risk public reads.
2. Social reads and the student-lookup pilot in
   [`student-lookup.md`](./student-lookup.md).
3. Simple database-backed reads/mutations with stable contracts.
4. Academic and timetable VTOP routes after the `fetch`/parser compatibility
   suite exists.
5. Admin, uploads, notifications, S3, and larger/streaming handlers after
   dedicated authorization and body-size tests.
6. Login/CAPTCHA and cabshare CAPTCHA last, after a Worker-compatible image
   implementation has equivalent accuracy and abuse protections.

For every route: move validation and business logic, add request/response
contract tests, replay fixture-based tests, run one staging integration test,
then switch gateway routing. Keep mutations single-writer during migration;
do not dual-write to both runtimes.

**Exit gate:** each migrated domain meets the same SLO and authorization
contract as its Vercel baseline; every unmigrated route is explicitly listed
as V or D.

### Phase 5 - Optimization and long-running work

- Use request coalescing for identical in-flight VTOP reads.
- Add sync freshness policies and incremental refresh where VTOP semantics
  permit it.
- Convert suitable non-interactive jobs to Queues/Workflows with bounded
  retries and dead-letter handling; never put raw VTOP credentials in queue
  messages.
- Move confirmed schedules to Cron Triggers and make jobs idempotent.
- Optimize SQL/indexes from measured plans, not guessed indexes.
- Use Worker Smart Placement / Hyperdrive only after measuring the API and DB
  regions; edge execution is not automatically lower latency for regional
  VTOP/Postgres calls.

**Exit gate:** per-user VTOP request budget and DB capacity improve or remain
within budget; no increase in stale or incorrect data.

### Phase 6 - Canary, cutover, and decommission

- Run read-only shadow comparisons where safe. Never shadow login or
  credential-bearing mutations.
- Canary route groups (for example 1%, 10%, 50%, 100%) using deterministic
  routing; compare status codes, schema, latency, VTOP call count and DB use.
- Keep Vercel as a reversible fallback until the agreed observation window
  passes.
- Decommission an old route only after client usage, logs, docs, and support
  confirm it is unused.
- Remove Node dependencies only after the last route that imports them has
  moved or been retired.

**Exit gate:** no unexpected public traffic to Vercel; all Vercel exceptions
have owners and removal criteria; rollback has been rehearsed.

## Testing and acceptance criteria

- Contract tests for every route: method, status, headers, response schema,
  error body, auth failure and validation failure.
- Unit tests for domain logic independent of Next.js/Workers.
- Parser fixtures for VTOP HTML changes; fail loudly on missing required
  fields rather than persisting partial records.
- Worker runtime tests for Hyperdrive, transactions, outbound `fetch`, body
  streaming, timeouts, redirects, cookies, and cancellation.
- End-to-end tests for login, session expiry, CAPTCHA, CORS, protected Vercel
  forwarding, rate limits, and origin-bypass rejection.
- Load tests for concurrent syncs and bounded batch queries. Include a
  database connection ceiling and VTOP request ceiling.
- Privacy tests: no public cache for student data; no raw registration numbers
  or credentials in logs, cache keys, analytics, or public responses.
- Acceptance: no contract regressions; no unbounded retries; worker and DB
  budgets meet Phase 0 targets; VTOP request counts do not increase; alarms and
  rollback work.

## Rollback plan

- Gateway routing is the control point. Each path/domain has a route target
  (`worker`, `vercel`, or disabled) that can be reverted without client
  releases.
- Keep Vercel deployment, DB schema compatibility and worker secrets live
  during the canary/observation window.
- A Worker outage routes only known-compatible paths back to the verified
  Vercel origin. Never use an open-ended fallback that hides missing routes.
- On data corruption, stop writes first; do not automatically replay uncertain
  mutations. Restore from database backups/audited migrations.
- Record a runbook for HMAC rotation, Worker rollback, Vercel recovery, and
  database/Hyperdrive failure before production traffic moves.

## Key risks and mitigations

| Risk | Mitigation |
|---|---|
| Framework/package compatibility | Route inventory, compatibility spike, per-domain ports, no big-bang cutover |
| Native CAPTCHA dependency | Keep login/cabshare auth on Vercel until a tested replacement exists |
| Vercel origin bypass | HMAC-signed internal requests validated before route handlers |
| Worker isolate-local state | No correctness-critical in-memory state; shared rate limiter and DB-backed state |
| DB connection exhaustion | Hyperdrive and measured concurrency limits |
| VTOP throttling | Request budgets, dedupe, batching, backoff and refresh policy; Workers do not bypass VTOP limits |
| Private-data caching/leak | `private, no-store` default; explicit reviewed allowlist for public caching |
| CORS regression | Exact origin allowlist; credentialed preflight and error-path tests |
| Bundle-size/CPU limits | Per-domain modules; split into multiple Worker services only when measurements require it |
| Two-runtime drift | Shared contracts/domain modules, explicit route owner matrix, CI tests against both runtimes |

## Decisions to make before implementation

1. Confirm production origin and the API custom hostname.
2. Choose the API router (Hono is the proposed default) and versioned
   Worker/Node shared-module layout.
3. Define which deployment secrets and database role the Worker receives.
4. Define acceptable VTOP request budgets and sync freshness.
5. Decide the initial Vercel exception list after the route inventory.
6. Decide whether classmate discovery is limited to already-paired peers or
   also includes separately opt-in, discoverable students. The feature plan
   defaults to explicit opt-in.

## References

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare Next.js on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Cloudflare Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
- [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/)
- [Cloudflare Queues](https://developers.cloudflare.com/queues/)
